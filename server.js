// ════════════════════════════════════════════════════
// AutoAprobado Miami — server.js
// Express: sirve landing + recibe leads + notifica
// ════════════════════════════════════════════════════

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { generarReporte } from './monitor-ads.js';
import { bot as tgBot, manejarMensaje, manejarCallback } from './bot-telegram.js';
import { ejecutarAnalista } from './agentes/analista.js';
import { ejecutarSupervisor } from './agentes/supervisor.js';
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

// ── Rate limiting — máx 5 leads por IP por minuto ────
const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos. Espera un momento.' },
});

// ── Middleware ───────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ════════════════════════════════════════════════════
// POST /api/lead — Recibe lead desde la landing
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

    // Mensaje Telegram
    const msg =
      `🚗 <b>NUEVO LEAD — AutoAprobado Miami</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Nombre:</b> ${nombre}\n` +
      `📱 <b>Teléfono:</b> ${telefono}\n` +
      `🎯 <b>Situación:</b> ${segmentoLabel}` +
      extras + '\n' +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🕐 ${ts}`;

    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML' });

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

        const msg =
          `🚗 <b>NUEVO LEAD — Facebook Lead Ads</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Nombre:</b> ${nombre}\n` +
          `📱 <b>Teléfono:</b> ${telefono}\n` +
          (califica ? `💬 <b>Calificación:</b> ${califica}\n` : '') +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📢 <b>Campaña:</b> ${campana}\n` +
          `🎯 <b>Anuncio:</b> ${adNombre}\n` +
          `🕐 ${ts}`;

        await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML' });
        console.log(`[Lead Ads] Lead recibido: ${nombre} — ${telefono}`);
      }
    }
  } catch (err) {
    console.error('[Lead Ads] Error procesando lead:', err.message);
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
