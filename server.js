// ════════════════════════════════════════════════════
// AutoAprobado Miami — server.js
// Express: sirve landing + recibe leads + notifica
// ════════════════════════════════════════════════════

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import cron from 'node-cron';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { generarReporte } from './monitor-ads.js';
import { bot as tgBot, manejarMensaje, manejarCallback } from './bot-telegram.js';
import { ejecutarAnalista } from './agentes/analista.js';
import { ejecutarSupervisor } from './agentes/supervisor.js';
import { programarLlamada, procesarResultadoLlamada } from './agentes/llamador.js';
import { cargarPlan, marcarEjecutado } from './agentes/plan-store.js';
import { ejecutarPlan } from './agentes/ejecutor.js';
import { registrarLead } from './agentes/leads-store.js';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Telegram ─────────────────────────────────────────
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ── WhatsApp — round-robin por paridad del timestamp ─
const WHATSAPP = [
  process.env.WHATSAPP_EDUARDO || '17869167339',
  process.env.WHATSAPP_JORGE   || '17865809908',
];
function nextWhatsApp() {
  return WHATSAPP[Math.floor(Date.now() / 1000) % 2];
}

// ── CAPI — enviar evento Lead a Meta Conversions API ─
async function enviarEventoCAPI({ nombre, telefono, segmento, ip, userAgent, eventId = null, eventName = 'Lead', valor = null }) {
  try {
    const pixelId = process.env.META_PIXEL_ID?.trim();
    const token   = process.env.META_ACCESS_TOKEN?.trim();
    if (!pixelId || !token) return;

    const sha256  = v => crypto.createHash('sha256').update(v.toLowerCase().trim()).digest('hex');
    const telNorm = telefono.replace(/\D/g, '');
    // event_id único para deduplicar con el pixel del browser — evita contar doble
    const evId = eventId || `${eventName.toLowerCase()}_${telNorm}_${Date.now()}`;

    const eventoData = {
      event_name:       eventName,
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         evId,
      action_source:    'website',
      event_source_url: 'https://oferta.hyundaipromomiami.com',
      user_data: {
        ph:                [sha256(telNorm)],
        fn:                [sha256(nombre.split(' ')[0] || nombre)],
        ln:                nombre.includes(' ') ? [sha256(nombre.split(' ').slice(1).join(' '))] : undefined,
        client_ip_address: ip,
        client_user_agent: userAgent,
      },
      custom_data: {
        lead_type: segmento || 'general',
        currency:  'USD',
        ...(valor ? { value: valor } : {})
      }
    };

    await axios.post(
      `https://graph.facebook.com/v25.0/${pixelId}/events`,
      { data: [eventoData] },
      { params: { access_token: token }, timeout: 8000 }
    );
    console.log(`[CAPI] Evento ${eventName} enviado — ${nombre} (id: ${evId})`);
    return evId;
  } catch (err) {
    console.warn(`[CAPI] Error (no crítico): ${err.response?.data?.error?.message || err.message}`);
  }
}

// ── Rate limiting — máx 5 leads por IP por minuto ────
const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos. Espera un momento.' },
});

// ── Trust proxy (Railway usa reverse proxy) ──────────
app.set('trust proxy', 1);

// ── Middleware ───────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/photos', express.static(path.join(__dirname, 'photos')));

// ════════════════════════════════════════════════════
// POST /api/lead — Recibe lead desde la landing
// ── Lead Scoring — califica el lead según sus respuestas ─
function scoreLead({ segmento, negado, ingreso, cuando, inicial }) {
  let puntos = 0;
  const razones = [];

  if (segmento === 'mal-credito') {
    if (ingreso?.includes('trabajo') || ingreso?.includes('negocio')) { puntos += 2; razones.push('tiene ingreso'); }
    if (negado?.includes('No'))  { puntos += 1; razones.push('nunca negado'); }
  }
  if (segmento === 'sin-credito') {
    if (ingreso?.includes('trabajo') || ingreso?.includes('negocio')) { puntos += 2; razones.push('tiene ingreso'); }
  }
  if (segmento === 'urgente') {
    if (cuando?.includes('semana')) { puntos += 3; razones.push('necesita esta semana'); }
    else if (cuando?.includes('mes')) { puntos += 2; razones.push('necesita este mes'); }
  }
  if (segmento === 'upgrade') {
    puntos += 2; razones.push('tiene carro para trade-in');
  }
  if (segmento === 'oferta-especial') {
    if (inicial?.includes('2,000') || inicial?.includes('Más'))  { puntos += 3; razones.push('inicial > $2,000'); }
    else if (inicial?.includes('500'))                           { puntos += 2; razones.push('inicial $500-$2,000'); }
    else                                                          { puntos += 1; razones.push('inicial < $500'); }
  }

  if (puntos >= 3) return { emoji: '🔥', label: 'CALIENTE', puntos, razones };
  if (puntos >= 1) return { emoji: '🟡', label: 'TIBIO',    puntos, razones };
  return             { emoji: '🔵', label: 'FRÍO',     puntos, razones };
}

// ════════════════════════════════════════════════════
app.post('/api/lead', leadLimiter, async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      segmento,       // mal-credito | sin-credito | urgente | upgrade | oferta-especial
      negado,         // ¿te han negado antes? (mal crédito)
      ingreso,        // ¿tienes ingreso estable? (mal crédito / sin crédito)
      cuando,         // ¿cuándo necesitas el carro? (urgente)
      carro_actual,   // ¿qué carro tienes ahora? (upgrade)
      carro_promo,    // carro de la promoción elegido
      inicial,        // cuánto de inicial tiene (oferta-especial)
    } = req.body;

    // Validación básica
    if (!nombre || !telefono) {
      return res.status(400).json({ ok: false, error: 'Nombre y teléfono requeridos' });
    }

    const ts = new Date().toLocaleString('es-US', { timeZone: 'America/New_York' });
    const segmentoLabel = {
      'mal-credito':     '⚠️ Mal crédito',
      'sin-credito':     '🆕 Sin historial',
      'urgente':         '🚨 Urgente',
      'upgrade':         '🔄 Upgrade de carro',
      'oferta-especial': '🔥 Oferta Especial',
    }[segmento] || '❓ Sin clasificar';

    // Campos extra según segmento
    let extras = '';
    if (segmento === 'mal-credito') {
      extras += negado      ? `\n❌ Le han negado antes: ${negado}`        : '';
      extras += ingreso     ? `\n💼 Ingreso estable: ${ingreso}`           : '';
    }
    if (segmento === 'sin-credito') {
      extras += ingreso     ? `\n💼 Tiene trabajo o negocio: ${ingreso}`   : '';
    }
    if (segmento === 'urgente') {
      extras += cuando      ? `\n⏰ Necesita carro: ${cuando}`             : '';
    }
    if (segmento === 'upgrade') {
      extras += carro_actual ? `\n🚗 Carro actual: ${carro_actual}`        : '';
    }
    if (segmento === 'oferta-especial') {
      extras += carro_promo  ? `\n🔥 Carro de interés: ${carro_promo}`    : '';
      extras += inicial      ? `\n💵 Inicial disponible: ${inicial}`       : '';
    }

    // Score del lead
    const score = scoreLead({ segmento, negado, ingreso, cuando, inicial });

    // Mensaje Telegram
    const msg =
      `🚗 <b>NUEVO LEAD — AutoAprobado Miami</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Nombre:</b> ${nombre}\n` +
      `📱 <b>Teléfono:</b> ${telefono}\n` +
      `🎯 <b>Situación:</b> ${segmentoLabel}` +
      extras + '\n' +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${score.emoji} <b>Score: ${score.label}</b>${score.razones.length ? ` — ${score.razones.join(', ')}` : ''}\n` +
      `🕐 ${ts}`;

    // Registrar lead para tracking de cierres
    registrarLead({ nombre, telefono, segmento, score: score.label });

    // Botones inline para seguimiento rápido
    const telLimpio = telefono.replace(/\D/g, '');
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Vendido',      callback_data: `cerrado:${telLimpio}` },
        { text: '📵 No contestó',  callback_data: `no_contesto:${telLimpio}` },
        { text: '💬 WhatsApp',     url: `https://wa.me/${telLimpio}` }
      ]]
    };

    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', reply_markup: keyboard });

    // CAPI — enviar evento Lead a Meta server-side (no bloquea la respuesta)
    enviarEventoCAPI({
      nombre,
      telefono,
      segmento,
      ip:        req.ip,
      userAgent: req.headers['user-agent'] || ''
    });

    // VAPI — llamar de 9 AM a 8 PM ET, cualquier día incluido domingos
    // Si VAPI falla o no está configurado, el lead ya llegó a Telegram arriba
    if (process.env.VAPI_API_KEY && process.env.VAPI_PHONE_NUMBER_ID) {
      const horaET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
      const hora   = parseInt(horaET);
      if (hora >= 9 && hora < 20) {
        try {
          programarLlamada({ nombre, telefono, segmento });
        } catch (vapiErr) {
          console.error('[VAPI] Error al programar llamada:', vapiErr.message);
          await bot.sendMessage(CHAT_ID,
            `⚠️ <b>VAPI no disponible</b> — llama manualmente a ${nombre}\n📱 <a href="https://wa.me/${telefono.replace(/\D/g,'')}">WhatsApp: ${telefono}</a>`,
            { parse_mode: 'HTML' }
          );
        }
      } else {
        console.log(`[VAPI] Fuera de horario (${hora}h ET) — lead en Telegram`);
      }
    } else {
      console.log('[VAPI] No configurado — lead notificado solo por Telegram');
    }

    // WhatsApp redirect URL
    const waNum = nextWhatsApp();
    const waMsg = encodeURIComponent(
      `Hola, me registré en AutoAprobado Miami. Mi nombre es ${nombre} y quiero saber cómo me pueden ayudar con mi situación: ${segmentoLabel.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ ]/g, '').trim()}.`
    );
    const waUrl = `https://wa.me/${waNum}?text=${waMsg}`;

    res.json({ ok: true, whatsapp: waUrl });

  } catch (err) {
    console.error('[Lead] Error:', err.message);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

// ── Health check ─────────────────────────────────────
app.get('/api/ping', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── GET /inventario.xml — Feed de inventario para Meta Catalog ───────────
// Meta descarga este feed automáticamente cada 24h
app.get('/inventario.xml', (req, res) => {
  const DISCLAIMER = 'Sujeto a aprobacion de credito, plazo, inicial y tasa aplicable. Terminos en el dealer.';
  const BASE = 'https://oferta.hyundaipromomiami.com';
  const LANDING = BASE;

  const vehiculos = [
    { id: 'elantra-2026',  title: 'Hyundai Elantra 2026',  mensual: 299, foto: 'general-elantra.png',   body: 'SEDAN',     color: 'Gris Metalico',   model: 'Elantra'  },
    { id: 'venue-2026',    title: 'Hyundai Venue 2026',    mensual: 335, foto: 'general-venue.png',     body: 'CROSSOVER', color: 'Blanco Perlado',  model: 'Venue'    },
    { id: 'kona-2026',     title: 'Hyundai Kona 2026',     mensual: 355, foto: 'general-kona.png',      body: 'CROSSOVER', color: 'Azul Electrico',  model: 'Kona'     },
    { id: 'tucson-2026',   title: 'Hyundai Tucson 2026',   mensual: 359, foto: 'general-tucson.png',    body: 'SUV',       color: 'Blanco Perlado',  model: 'Tucson'   },
    { id: 'sonata-2026',   title: 'Hyundai Sonata 2026',   mensual: 359, foto: 'general-sonata.png',    body: 'SEDAN',     color: 'Negro Onix',      model: 'Sonata'   },
    { id: 'santa-fe-2026', title: 'Hyundai Santa Fe 2026', mensual: 475, foto: 'general-santa-fe.png',  body: 'SUV',       color: 'Rojo Veloz',      model: 'Santa Fe' },
    { id: 'palisade-2026', title: 'Hyundai Palisade 2026', mensual: 555, foto: 'general-palisade.png',  body: 'SUV',       color: 'Blanco Perlado',  model: 'Palisade' },
  ];

  const items = vehiculos.map(v => {
    const vin = `KMH${v.id.toUpperCase().replace(/-/g,'').slice(0,8)}26`.padEnd(17,'0').slice(0,17);
    return `
    <item>
      <g:id>${v.id}</g:id>
      <g:title>${v.title} - Pagos desde $${v.mensual}/mes*</g:title>
      <g:description>Pagos desde $${v.mensual}/mes* en AutoAprobado Miami. Aprobamos aunque tengas mal credito o sin historial en USA. Proceso 100% en espanol. *${DISCLAIMER}</g:description>
      <g:availability>in stock</g:availability>
      <g:condition>new</g:condition>
      <g:price>${v.mensual}.00 USD</g:price>
      <g:link>${LANDING}?utm_source=catalog&amp;utm_medium=dynamic&amp;utm_campaign=${v.id}</g:link>
      <g:image_link>${BASE}/photos/${v.foto}</g:image_link>
      <g:brand>Hyundai</g:brand>
      <g:make>Hyundai</g:make>
      <g:model>${v.model}</g:model>
      <g:year>2026</g:year>
      <g:vin>${vin}</g:vin>
      <g:body_style>${v.body.toLowerCase()}</g:body_style>
      <g:exterior_color>${v.color}</g:exterior_color>
      <g:fuel_type>gasoline</g:fuel_type>
      <g:transmission>automatic</g:transmission>
      <g:state_of_vehicle>new</g:state_of_vehicle>
      <g:mileage>0 mi</g:mileage>
      <g:dealer_name>AutoAprobado Miami</g:dealer_name>
      <g:dealer_phone>+17869167339</g:dealer_phone>
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>AutoAprobado Miami — Inventario Hyundai 2026</title>
    <link>${LANDING}</link>
    <description>Inventario Hyundai 2026 con financiamiento para hispanos en Miami</description>
    ${items}
  </channel>
</rss>`;

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// ── GET /inventario.csv — Feed CSV para Meta Vehicle Catalog ─────────────
app.get('/inventario.csv', (req, res) => {
  const BASE    = 'https://oferta.hyundaipromomiami.com';
  const LANDING = BASE;
  const DISCLAIMER = 'Sujeto a aprobacion de credito. Terminos en el dealer.';

  const vehiculos = [
    { id: 'elantra-2026',   title: 'Hyundai Elantra 2026',   mensual: 299, foto: 'general-elantra.png',   body: 'SEDAN',     color: 'Gris Metalico',  model: 'Elantra'   },
    { id: 'venue-2026',     title: 'Hyundai Venue 2026',     mensual: 335, foto: 'general-venue.png',     body: 'CROSSOVER', color: 'Blanco Perlado', model: 'Venue'     },
    { id: 'kona-2026',      title: 'Hyundai Kona 2026',      mensual: 355, foto: 'general-kona.png',      body: 'CROSSOVER', color: 'Azul Electrico', model: 'Kona'      },
    { id: 'tucson-2026',    title: 'Hyundai Tucson 2026',    mensual: 359, foto: 'general-tucson.png',    body: 'SUV',       color: 'Blanco Perlado', model: 'Tucson'    },
    { id: 'sonata-2026',    title: 'Hyundai Sonata 2026',    mensual: 359, foto: 'general-sonata.png',    body: 'SEDAN',     color: 'Negro Onix',     model: 'Sonata'    },
    { id: 'santa-fe-2026',  title: 'Hyundai Santa Fe 2026',  mensual: 475, foto: 'general-santa-fe.png',  body: 'SUV',       color: 'Rojo Veloz',     model: 'Santa Fe'  },
    { id: 'palisade-2026',  title: 'Hyundai Palisade 2026',  mensual: 555, foto: 'general-palisade.png',  body: 'SUV',       color: 'Blanco Perlado', model: 'Palisade'  },
  ];

  const header = 'vehicle_id,make,model,year,vin,mileage.value,mileage.unit,body_style,title,description,price,image[0].url,url,availability,fuel_type,transmission,exterior_color,state_of_vehicle,address.street,address.city,address.region,address.country,address.postal_code';

  const rows = vehiculos.map(v => {
    const vin = `KMH${v.id.toUpperCase().replace(/-/g,'').slice(0,8)}26`.padEnd(17,'0').slice(0,17);
    const title = `${v.title} - Pagos desde $${v.mensual}/mes*`;
    const desc  = `Pagos desde $${v.mensual}/mes* en AutoAprobado Miami. Aprobamos aunque tengas mal credito o sin historial. *${DISCLAIMER}`;
    const url   = `${LANDING}?utm_source=catalog&utm_medium=dynamic&utm_campaign=${v.id}`;
    const img   = `${BASE}/photos/${v.foto}`;
    const price = `${v.mensual}.00 USD`;
    const fields = [v.id,'Hyundai',v.model,'2026',vin,'0','MI',v.body,title,desc,price,img,url,'available','gasoline','automatic',v.color,'new','3250 NW 79th Ave','Miami','FL','US','33122'];
    return fields.map(f => `"${String(f).replace(/"/g,'""')}"`).join(',');
  });

  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.send([header, ...rows].join('\n'));
});

// ── POST /api/venta — Registra venta cerrada y manda Purchase a Meta CAPI ──
// Uso desde Telegram: /venta <telefono> [valor]
// Esto enseña a Meta quién COMPRA carros, no solo quien llena formularios
app.post('/api/venta', async (req, res) => {
  try {
    const { telefono, nombre = 'Cliente', valor = 15000, segmento = 'general' } = req.body;
    if (!telefono) return res.status(400).json({ ok: false, error: 'Teléfono requerido' });

    // Marcar como cerrado en leads-store
    const lead = marcarCerrado(telefono);

    // Enviar Purchase a Meta CAPI — entrena el algoritmo para buscar compradores reales
    await enviarEventoCAPI({
      nombre:    lead?.nombre || nombre,
      telefono,
      segmento:  lead?.segmento || segmento,
      ip:        req.ip,
      userAgent: req.headers['user-agent'] || '',
      eventName: 'Purchase',
      valor:     parseFloat(valor),
    });

    await bot.sendMessage(CHAT_ID,
      `🎉 <b>¡VENTA CERRADA!</b>\n` +
      `👤 ${lead?.nombre || nombre}\n` +
      `📱 ${telefono}\n` +
      `💵 Valor: $${valor}\n` +
      `📊 <i>Evento Purchase enviado a Meta — el algoritmo aprende quién compra</i>`,
      { parse_mode: 'HTML' }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Venta] Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ════════════════════════════════════════════════════
// Webhook de Meta Lead Ads — recibe leads en tiempo real
// ════════════════════════════════════════════════════

// Verificación del webhook (Meta llama a esto al configurarlo)
app.get('/api/meta/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_TOKEN) {
    console.log('[Meta Webhook] Verificado ✅');
    res.send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Recepción de leads (Meta llama a esto cuando alguien llena el formulario)
app.post('/api/meta/webhook', async (req, res) => {
  res.sendStatus(200); // responder inmediato
  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const { leadgen_id, ad_id, form_id } = change.value;
        if (!leadgen_id) continue;

        // Obtener datos del lead desde Meta API
        const { data: lead } = await axios.get(
          `https://graph.facebook.com/v25.0/${leadgen_id}`,
          { params: { fields: 'field_data,created_time,ad_name,campaign_name', access_token: process.env.META_ACCESS_TOKEN?.trim() }, timeout: 10000 }
        );

        // Extraer campos del formulario
        const campos = {};
        for (const f of lead.field_data || []) campos[f.name] = f.values?.[0] || '';

        const nombre   = campos.full_name    || '—';
        const telefono = campos.phone_number || '—';
        const califica = campos.pregunta_calificacion || '';
        const ts       = new Date(lead.created_time).toLocaleString('es-US', { timeZone: 'America/New_York' });
        const campana  = lead.campaign_name || '—';
        const adNombre = lead.ad_name || '—';

        // Extraer campos de las nuevas preguntas de calificación
        const tieneIngreso  = campos.tiene_ingreso      || '';
        const cuandoNecesita = campos.cuando_necesita   || '';
        const inicialDisp   = campos.inicial_disponible || '';
        const tieneCarro    = campos.tiene_carro        || '';
        const tiempoUsa     = campos.tiempo_en_usa      || '';

        // Detectar segmento desde nombre de campaña
        const segmento = campana.toLowerCase().includes('mal') ? 'mal-credito'
          : campana.toLowerCase().includes('sin') ? 'sin-credito'
          : campana.toLowerCase().includes('urgente') ? 'urgente'
          : campana.toLowerCase().includes('upgrade') ? 'upgrade'
          : campana.toLowerCase().includes('oferta') ? 'oferta-especial'
          : 'mal-credito';

        // Score del lead con las nuevas preguntas
        const score = scoreLead({
          segmento,
          ingreso:  tieneIngreso,
          cuando:   cuandoNecesita,
          inicial:  inicialDisp,
        });

        const telLimpio = telefono.replace(/\D/g, '');
        const extras = [
          tieneIngreso   ? `💼 Ingreso: ${tieneIngreso}`       : '',
          cuandoNecesita ? `⏰ Cuándo: ${cuandoNecesita}`      : '',
          inicialDisp    ? `💵 Inicial: ${inicialDisp}`        : '',
          tieneCarro     ? `🚗 Carro trade-in: ${tieneCarro}`  : '',
          tiempoUsa      ? `🇺🇸 En USA: ${tiempoUsa}`          : '',
          califica       ? `💬 ${califica}`                    : '',
        ].filter(Boolean).join('\n');

        const msg =
          `🚗 <b>NUEVO LEAD — Facebook Lead Ads</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Nombre:</b> ${nombre}\n` +
          `📱 <b>Teléfono:</b> ${telefono}\n` +
          (extras ? `${extras}\n` : '') +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${score.emoji} <b>Score: ${score.label}</b>${score.razones.length ? ` — ${score.razones.join(', ')}` : ''}\n` +
          `📢 ${campana}\n` +
          `🕐 ${ts}`;

        const keyboard = {
          inline_keyboard: [[
            { text: '✅ Vendido',     callback_data: `cerrado:${telLimpio}` },
            { text: '📵 No contestó', callback_data: `no_contesto:${telLimpio}` },
            { text: '💬 WhatsApp',    url: `https://wa.me/${telLimpio}` }
          ]]
        };

        await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', reply_markup: keyboard });

        // Registrar en leads-store
        registrarLead({ nombre, telefono, segmento, score: score.label });

        // CAPI — deduplicar con event_id basado en leadgen_id
        enviarEventoCAPI({ nombre, telefono, segmento, ip: '0.0.0.0', userAgent: 'Meta Lead Ads', eventId: `leadgen_${leadgen_id}` });

        // VAPI — llamar de 9AM a 8PM ET
        if (process.env.VAPI_API_KEY && process.env.VAPI_PHONE_NUMBER_ID && telefono !== '—') {
          const horaET = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
          if (parseInt(horaET) >= 9 && parseInt(horaET) < 20) {
            try { programarLlamada({ nombre, telefono, segmento }); } catch {}
          }
        }

        console.log(`[Lead Ads] Lead recibido: ${nombre} — ${telefono} — Score: ${score.label}`);
      }
    }
  } catch (err) {
    console.error('[Lead Ads] Error procesando lead:', err.message);
  }
});

// ════════════════════════════════════════════════════
// Webhook de VAPI — recibe resultados de llamadas
// ════════════════════════════════════════════════════
app.post('/api/vapi/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const { message } = req.body;
    if (!message) return;

    // Solo procesar cuando la llamada termina
    if (message.type === 'end-of-call-report') {
      const assistantId = message.call?.assistantId;
      const anaId       = process.env.VAPI_ANA_ASSISTANT_ID;

      // ── Briefing de Ana → detectar aprobación de Eduardo ──
      if (anaId && assistantId === anaId) {
        const planAprobado  = message.analysis?.structuredData?.planAprobado;
        const notas         = message.analysis?.structuredData?.notasEduardo || '';
        const resumen       = message.analysis?.summary || '';
        const duracion      = message.durationSeconds ? `${Math.round(message.durationSeconds)}s` : '—';

        if (planAprobado === true) {
          // Eduardo aprobó — ejecutar plan automáticamente
          const plan = cargarPlan();
          if (plan) {
            await tgBot.sendMessage(CHAT_ID,
              `✅ <b>Eduardo aprobó el plan por voz</b>\n` +
              `⏱ Duración briefing: ${duracion}\n` +
              (notas ? `📝 Notas: ${notas}\n` : '') +
              `\n🚀 Ejecutando plan ahora...`,
              { parse_mode: 'HTML' }
            );
            marcarEjecutado();
            ejecutarPlan(plan).catch(e =>
              tgBot.sendMessage(CHAT_ID, `❌ Error ejecutando plan: <code>${e.message}</code>`, { parse_mode: 'HTML' })
            );
          }
        } else if (planAprobado === false) {
          await tgBot.sendMessage(CHAT_ID,
            `❌ <b>Eduardo rechazó el plan</b>\n` +
            `⏱ Duración briefing: ${duracion}\n` +
            (notas ? `📝 Sus notas: ${notas}\n` : '') +
            (resumen ? `\n💬 Resumen: ${resumen}` : ''),
            { parse_mode: 'HTML' }
          );
        } else {
          // No se capturó decisión — mandar resumen y dejar botones de Telegram
          await tgBot.sendMessage(CHAT_ID,
            `📞 <b>Briefing con Ana completado</b>\n` +
            `⏱ Duración: ${duracion}\n` +
            (resumen ? `\n💬 ${resumen}\n` : '') +
            `\nAprueba el plan en Telegram con los botones de arriba.`,
            { parse_mode: 'HTML' }
          );
        }
        return;
      }

      // ── Llamada a lead (Sofía) → procesar normalmente ──
      await procesarResultadoLlamada({
        id:                message.call?.id,
        status:            message.call?.status,
        endedReason:       message.endedReason,
        duration:          message.durationSeconds,
        transcript:        message.transcript,
        summary:           message.analysis?.summary || message.summary,
        appointmentBooked: message.analysis?.structuredData?.appointmentBooked ?? message.analysis?.appointmentBooked,
        successEval:       message.analysis?.structuredData?.successEvaluationNumericScale ?? message.analysis?.successEvaluationNumericScale,
        customer:          message.call?.customer
      });
    }
  } catch (err) {
    console.error('[VAPI Webhook] Error:', err.message);
  }
});

// ── Telegram webhook ──────────────────────────────────
const procesados = new Set(); // evita procesar el mismo update dos veces
app.post('/telegram/webhook', (req, res) => {
  res.sendStatus(200); // responder inmediato para que Telegram no reintente
  const update = req.body;
  if (!update?.update_id) return;
  if (procesados.has(update.update_id)) return; // duplicado, ignorar
  procesados.add(update.update_id);
  if (procesados.size > 200) procesados.clear(); // limpiar memoria ocasionalmente

  const msg = update.message || update.channel_post;
  if (msg && !msg.from?.is_bot && !msg.via_bot && msg.text?.startsWith('/')) {
    manejarMensaje(msg).catch(e => console.error('[Webhook] Error:', e.message));
  }
  // Botones inline de los agentes
  if (update.callback_query) {
    manejarCallback(update.callback_query).catch(e => console.error('[Webhook] Error callback:', e.message));
  }
});

// ── Agente Analista — 8 AM ET diario ─────────────────
cron.schedule('0 8 * * *', () => {
  console.log('[Cron] Ejecutando Analista...');
  ejecutarAnalista().catch(e => console.error('[Cron] Analista error:', e.message));
}, { timezone: 'America/New_York' });

// ── Agente Supervisor — cada 4 horas ─────────────────
cron.schedule('0 */4 * * *', () => {
  console.log('[Cron] Ejecutando Supervisor...');
  ejecutarSupervisor().catch(e => console.error('[Cron] Supervisor error:', e.message));
}, { timezone: 'America/New_York' });

// ── Iniciar servidor ─────────────────────────────────
app.listen(PORT, async () => {
  console.log(`✅ AutoAprobado Miami corriendo en http://localhost:${PORT}`);
  console.log(`📊 Monitor de campañas activo — reporte diario a las 8 AM ET`);

  // Registrar webhook de Telegram
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain) {
    const webhookUrl = `https://${domain}/telegram/webhook`;
    try {
      await tgBot.setWebHook(webhookUrl);
      console.log(`🤖 Telegram webhook activo: ${webhookUrl}`);
    } catch (e) {
      console.error('[Webhook] Error al registrar:', e.message);
    }
  } else {
    console.log('⚠️  RAILWAY_PUBLIC_DOMAIN no definido — webhook no registrado');
  }
});
