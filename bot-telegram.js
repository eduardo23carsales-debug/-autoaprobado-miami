// ════════════════════════════════════════════════════
// AutoAprobado Miami — bot-telegram.js
// Bot Telegram con Claude como cerebro
// Interpreta mensajes en español y ejecuta en Meta Ads
// ════════════════════════════════════════════════════

import TelegramBot from 'node-telegram-bot-api';
import axios        from 'axios';
import fs           from 'fs';
import path         from 'path';
import { fileURLToPath } from 'url';
import { generarReporte } from './monitor-ads.js';
import { cargarPlan, marcarEjecutado, limpiarPlan } from './agentes/plan-store.js';
import dotenv from 'dotenv';
dotenv.config();

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const API        = 'https://graph.facebook.com/v25.0';
const TOKEN      = process.env.META_ACCESS_TOKEN?.trim();
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID?.trim();
const PAGE_ID    = process.env.META_PAGE_ID?.trim();
const CHAT_ID    = String(process.env.TELEGRAM_CHAT_ID);
const LANDING    = 'https://oferta.hyundaipromomiami.com';

// Sin polling — Railway usa webhook
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

const pendientes = new Map();

// ── Helpers Meta API ─────────────────────────────────
async function metaGet(endpoint, params = {}) {
  const { data } = await axios.get(`${API}${endpoint}`, {
    params: { ...params, access_token: TOKEN },
    timeout: 15000
  });
  return data;
}

async function metaPost(endpoint, body) {
  const { data } = await axios.post(`${API}${endpoint}?access_token=${TOKEN}`, body, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' }
  });
  return data;
}

// ── Obtener campañas AutoAprobado ────────────────────
async function getCampanas(soloActivas = false) {
  const filtering = [{ field: 'name', operator: 'CONTAIN', value: 'AutoAprobado' }];
  const data = await metaGet(`/${AD_ACCOUNT}/campaigns`, {
    fields: 'id,name,status,effective_status,daily_budget',
    filtering: JSON.stringify(filtering),
    limit: 50
  });
  const campanas = data.data || [];
  return soloActivas ? campanas.filter(c => c.effective_status === 'ACTIVE') : campanas;
}

// ── Limpiar nombre para mostrar ──────────────────────
function limpiarNombre(nombre) {
  return nombre
    .replace(/^AutoAprobado \| /, '')
    .replace(/ \| \d{4}-\d{2}-\d{2}(T\d{2}h\d{2})?$/, '')
    .replace(/ — AutoAprobado Miami$/, '')
    .trim();
}

// ── Buscar video por segmento en carpeta videos/ ─────
function buscarVideo(segmento) {
  const dir = path.join(__dirname, 'videos');
  if (!fs.existsSync(dir)) return null;
  const archivos = fs.readdirSync(dir)
    .filter(f => /\.(mp4|mov)$/i.test(f));

  // Buscar por segmento exacto o numerados
  const candidatos = archivos.filter(f =>
    f.toLowerCase().startsWith(segmento.toLowerCase())
  );

  // Fallback: video general
  const generales = archivos.filter(f =>
    f.toLowerCase().startsWith('general')
  );

  const pool = candidatos.length > 0 ? candidatos : generales;
  if (!pool.length) return null;

  const elegido = pool[Math.floor(Math.random() * pool.length)];
  return path.join(dir, elegido);
}

// ── Subir video a Meta ───────────────────────────────
async function subirVideo(videoPath) {
  const { default: FormData } = await import('form-data');
  const form = new FormData();
  form.append('source', fs.createReadStream(videoPath));
  const { data } = await axios.post(
    `${API}/${AD_ACCOUNT}/advideos?access_token=${TOKEN}`,
    form,
    { headers: form.getHeaders(), timeout: 120000 }
  );
  return data.id;
}


// ── Ejecutar acción confirmada ───────────────────────
async function ejecutar(chatId, accion, params) {
  try {
    switch (accion) {

      // ── Reporte ──────────────────────────────────
      case 'reporte': {
        await bot.sendMessage(chatId, '⏳ Generando reporte...');
        await generarReporte();
        break;
      }

      // ── Pausar campaña ───────────────────────────
      case 'pausa': {
        const campanas = await getCampanas(true);
        const targets = params.segmento === 'todas'
          ? campanas
          : campanas.filter(c => c.name.toLowerCase().includes(params.segmento));

        if (!targets.length) {
          await bot.sendMessage(chatId,
            `⚠️ No encontré campañas activas de <b>${params.segmento}</b>.`,
            { parse_mode: 'HTML' }
          );
          return;
        }
        for (const c of targets) await metaPost(`/${c.id}`, { status: 'PAUSED' });
        await bot.sendMessage(chatId,
          `⏸ <b>Pausadas correctamente:</b>\n` + targets.map(c => `• ${limpiarNombre(c.name)}`).join('\n'),
          { parse_mode: 'HTML' }
        );
        break;
      }

      // ── Activar campaña ──────────────────────────
      case 'activa': {
        const campanas = await getCampanas();
        const targets = params.segmento === 'todas'
          ? campanas.filter(c => c.effective_status === 'PAUSED')
          : campanas.filter(c => c.name.toLowerCase().includes(params.segmento) && c.effective_status === 'PAUSED');

        if (!targets.length) {
          await bot.sendMessage(chatId,
            `⚠️ No encontré campañas pausadas de <b>${params.segmento}</b>.`,
            { parse_mode: 'HTML' }
          );
          return;
        }
        for (const c of targets) await metaPost(`/${c.id}`, { status: 'ACTIVE' });
        await bot.sendMessage(chatId,
          `🟢 <b>Activadas correctamente:</b>\n` + targets.map(c => `• ${limpiarNombre(c.name)}`).join('\n'),
          { parse_mode: 'HTML' }
        );
        break;
      }

      // ── Cambiar presupuesto ──────────────────────
      case 'presupuesto': {
        const campanas = await getCampanas(true);
        const targets = campanas.filter(c => c.name.toLowerCase().includes(params.segmento));

        if (!targets.length) {
          await bot.sendMessage(chatId,
            `⚠️ No encontré campaña activa de <b>${params.segmento}</b>.`,
            { parse_mode: 'HTML' }
          );
          return;
        }
        const centavos = Math.round(params.monto * 100);
        for (const c of targets) await metaPost(`/${c.id}`, { daily_budget: centavos });
        await bot.sendMessage(chatId,
          `💵 <b>Presupuesto actualizado a $${params.monto}/día:</b>\n` +
          targets.map(c => `• ${limpiarNombre(c.name)}`).join('\n'),
          { parse_mode: 'HTML' }
        );
        break;
      }

      // ── Crear campaña ────────────────────────────
      case 'crear_campana': {
        const presupuesto = params.presupuesto || 10;
        let videoMsg = '';

        await bot.sendMessage(chatId,
          `⏳ Creando campaña <b>${params.segmento}</b> — $${presupuesto}/día...\nEsto tarda ~1 minuto.`,
          { parse_mode: 'HTML' }
        );

        // Video si pidió con_video
        // Buscar video automáticamente — video > foto > DALL-E
        let videoPath = buscarVideo(params.segmento);
        if (videoPath) {
          videoMsg = `\n🎬 Video: ${path.basename(videoPath)}`;
        } else if (params.con_video) {
          await bot.sendMessage(chatId, `⚠️ No encontré video para "${params.segmento}" en la carpeta videos/.\nPonle el nombre: ${params.segmento}.mp4`);
          return;
        }

        // Importar y ejecutar creador de campañas
        const { crearCampanaSegmento } = await import('./meta-ads-carros.js');
        const result = await crearCampanaSegmento(params.segmento, presupuesto, videoPath);

        await bot.sendMessage(chatId,
          `✅ <b>Campaña lista!</b>\n` +
          `• Segmento: <b>${params.segmento}</b>\n` +
          `• Presupuesto: <b>$${presupuesto}/día</b>\n` +
          `• Ads creados: <b>${result.ads.length}/3</b>` +
          videoMsg,
          { parse_mode: 'HTML' }
        );

        // Mandar preview de cada ad
        for (const ad of result.ads) {
          if (ad.previewUrl) {
            await bot.sendMessage(chatId,
              `👁 <b>Preview — Copy ${ad.copy}:</b>\n${ad.previewUrl}`,
              { parse_mode: 'HTML', disable_web_page_preview: false }
            );
          }
        }
        break;
      }

      // ── Mejor campaña ────────────────────────────
      case 'mejor_campana': {
        await bot.sendMessage(chatId, '⏳ Analizando campañas de los últimos 7 días...');
        const campanas = await getCampanas(true);

        if (!campanas.length) {
          await bot.sendMessage(chatId, '⚠️ No hay campañas activas para analizar.');
          return;
        }

        const metricas = [];
        for (const c of campanas) {
          const ins = await metaGet(`/${c.id}/insights`, {
            fields: 'spend,clicks,impressions,actions',
            date_preset: 'last_7d'
          });
          const m = ins.data?.[0] || {};
          const leads = parseInt(m.actions?.find(a =>
            a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
          )?.value || 0);
          const spend = parseFloat(m.spend || 0);
          metricas.push({
            nombre: limpiarNombre(c.name),
            spend,
            clicks: parseInt(m.clicks || 0),
            leads,
            cpl: leads > 0 ? spend / leads : Infinity
          });
        }

        metricas.sort((a, b) => a.cpl - b.cpl);

        let msg = `📊 <b>Análisis últimos 7 días:</b>\n\n`;
        for (let i = 0; i < metricas.length; i++) {
          const m = metricas[i];
          const cpl = m.cpl === Infinity ? '—' : `$${m.cpl.toFixed(2)}/lead`;
          const icono = i === 0 ? '🏆' : '•';
          msg += `${icono} <b>${m.nombre}</b>\n   $${m.spend.toFixed(2)} | ${m.clicks} clicks | ${m.leads} leads | CPL: ${cpl}\n\n`;
        }

        const ganadora = metricas[0];
        if (ganadora.leads > 0) {
          msg += `💡 <b>${ganadora.nombre}</b> es la ganadora con CPL de $${ganadora.cpl.toFixed(2)}.\n¿Quieres subir su presupuesto?`;
        } else {
          msg += `💡 Ninguna campaña tiene leads todavía. El algoritmo sigue aprendiendo — dale unos días más.`;
        }

        await bot.sendMessage(chatId, msg, { parse_mode: 'HTML' });
        break;
      }

      default:
        await bot.sendMessage(chatId, '❓ No supe cómo ejecutar esa acción. Intenta de nuevo.');
    }

  } catch (err) {
    console.error('[Bot] Error ejecutando:', err.message);
    await bot.sendMessage(chatId, `❌ Error: <code>${err.message}</code>`, { parse_mode: 'HTML' });
  }
}

// ── Teclados reutilizables ────────────────────────────
const KB_SEGMENTOS = {
  inline_keyboard: [
    [
      { text: '⚠️ Mal crédito',    callback_data: 'seg:mal-credito' },
      { text: '🆕 Sin crédito',    callback_data: 'seg:sin-credito' },
    ],
    [
      { text: '🚨 Urgente',        callback_data: 'seg:urgente' },
      { text: '🔄 Upgrade',        callback_data: 'seg:upgrade' },
    ],
    [
      { text: '🔥 Oferta especial', callback_data: 'seg:oferta-especial' },
    ]
  ]
};

function kbPresupuesto(segmento, accion) {
  return {
    inline_keyboard: [
      [
        { text: '$5/día',  callback_data: `${accion}:${segmento}:5` },
        { text: '$10/día', callback_data: `${accion}:${segmento}:10` },
        { text: '$20/día', callback_data: `${accion}:${segmento}:20` },
      ],
      [
        { text: '$30/día', callback_data: `${accion}:${segmento}:30` },
        { text: '$50/día', callback_data: `${accion}:${segmento}:50` },
        { text: '$100/día', callback_data: `${accion}:${segmento}:100` },
      ]
    ]
  };
}

function kbSegmentosAccion(accion) {
  return {
    inline_keyboard: [
      [
        { text: '⚠️ Mal crédito',    callback_data: `${accion}:mal-credito` },
        { text: '🆕 Sin crédito',    callback_data: `${accion}:sin-credito` },
      ],
      [
        { text: '🚨 Urgente',        callback_data: `${accion}:urgente` },
        { text: '🔄 Upgrade',        callback_data: `${accion}:upgrade` },
      ],
      [
        { text: '🔥 Oferta especial', callback_data: `${accion}:oferta-especial` },
        { text: '⏹ Todas',           callback_data: `${accion}:todas` },
      ]
    ]
  };
}

const MENU_PRINCIPAL = {
  inline_keyboard: [
    [
      { text: '🚀 Nueva campaña',   callback_data: 'menu:nueva' },
      { text: '📊 Reporte',         callback_data: 'menu:reporte' },
    ],
    [
      { text: '⏸ Pausar',          callback_data: 'menu:pausa' },
      { text: '▶️ Activar',         callback_data: 'menu:activa' },
    ],
    [
      { text: '💵 Cambiar presupuesto', callback_data: 'menu:presupuesto' },
      { text: '🏆 Mejor campaña',   callback_data: 'menu:mejor' },
    ],
    [
      { text: '🧠 Analista',        callback_data: 'menu:analista' },
      { text: '👁 Supervisor',      callback_data: 'menu:supervisor' },
    ]
  ]
};

const AYUDA = `📋 <b>Menú AutoAprobado Miami</b>\n\nEscribe /menu para ver los botones, o usa los comandos directos abajo.\n\n/nueva — crear campaña\n/retargeting [presupuesto] — campaña visitantes que no convirtieron\n/lookalike — audiencia lookalike del 1% más similar a tus leads\n/pausa — pausar campaña\n/activa — activar campaña\n/presupuesto — cambiar presupuesto\n/reporte — métricas de hoy\n/mejor — mejor campaña\n/ventas — tasa de cierre y leads\n/venta &lt;tel&gt; [valor] — registra venta y entrena algoritmo Meta\n/analista — análisis IA\n/supervisor — revisar campañas`;

// ── Manejador principal de mensajes ──────────────────
async function manejarMensaje(msg) {
  const chatId = String(msg.chat.id);
  const texto  = msg.text?.trim();

  if (!texto) return;

  // Solo responde al chat autorizado
  const idNormalizado = CHAT_ID.replace('-100', '');
  if (chatId !== CHAT_ID && chatId !== idNormalizado && `-100${chatId}` !== CHAT_ID) {
    console.log(`[Bot] IGNORADO — chatId ${chatId} vs config ${CHAT_ID}`);
    return;
  }

  const partes = texto.trim().split(/\s+/);
  const cmd    = partes[0].toLowerCase();
  const args   = partes.slice(1);

  try {
    // /start o /ayuda o /menu
    if (cmd === '/start' || cmd === '/ayuda' || cmd === '/help' || cmd === '/menu') {
      await bot.sendMessage(chatId, '🤖 <b>AutoAprobado Miami</b> — ¿Qué hacemos?', {
        parse_mode: 'HTML', reply_markup: MENU_PRINCIPAL
      });
      return;
    }

    // /reporte
    if (cmd === '/reporte' || cmd === 'reporte') {
      await bot.sendMessage(chatId, '⏳ Generando reporte...');
      await generarReporte();
      return;
    }

    // /cerrado — marcar lead como vendido manualmente
    if (cmd === '/cerrado') {
      const telefono = args[0];
      if (!telefono) {
        await bot.sendMessage(chatId, '📱 Uso: /cerrado <teléfono>\nEjemplo: /cerrado 7861234567');
        return;
      }
      const { marcarCerrado } = await import('./agentes/leads-store.js');
      const lead = marcarCerrado(telefono);
      if (lead) {
        await bot.sendMessage(chatId, `✅ <b>¡Venta cerrada!</b> — ${lead.nombre}\n📱 ${lead.telefono}`, { parse_mode: 'HTML' });
      } else {
        await bot.sendMessage(chatId, `⚠️ No encontré un lead con ese teléfono.`);
      }
      return;
    }

    // /venta — registra venta + manda Purchase a Meta CAPI (entrena algoritmo)
    // Uso: /venta 7861234567 [valor]
    if (cmd === '/venta') {
      const telefono = args[0];
      const valor    = parseFloat(args[1]) || 15000;
      if (!telefono) {
        await bot.sendMessage(chatId,
          `🎉 <b>Registrar venta cerrada</b>\n\nUso: /venta &lt;teléfono&gt; [valor]\n\nEjemplo: <code>/venta 7861234567 18000</code>\n\n<i>Esto manda evento Purchase a Meta — el algoritmo aprende quién compra y mejora la calidad de los próximos leads.</i>`,
          { parse_mode: 'HTML' }
        );
        return;
      }
      try {
        await axios.post(`http://localhost:${process.env.PORT || 3000}/api/venta`, { telefono, valor });
        await bot.sendMessage(chatId,
          `🎉 <b>¡Venta registrada!</b>\n📱 ${telefono}\n💵 $${valor}\n\n📊 <i>Purchase enviado a Meta — en 2-3 días el algoritmo mejora la calidad de leads</i>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        await bot.sendMessage(chatId, `⚠️ Error registrando venta: ${e.message}`);
      }
      return;
    }

    // /ventas — resumen de leads y cierres
    if (cmd === '/ventas') {
      const { obtenerResumen } = await import('./agentes/leads-store.js');
      const r = obtenerResumen();
      await bot.sendMessage(chatId,
        `📊 <b>Resumen de Leads</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📥 Total leads: <b>${r.total}</b>\n` +
        `📅 Hoy: <b>${r.hoy}</b>\n` +
        `✅ Ventas cerradas: <b>${r.cerrados}</b>\n` +
        `📵 No contestaron: <b>${r.noContesto}</b>\n` +
        `🆕 Pendientes: <b>${r.nuevos}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📈 Tasa de cierre: <b>${r.tasa}%</b>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // /lookalike — crear audiencia lookalike basada en leads convertidos
    if (cmd === '/lookalike') {
      await bot.sendMessage(chatId,
        `🎯 Creando audiencia Lookalike 1%...\n\n` +
        `Meta va a encontrar el 1% de Miami más parecido a tus leads convertidos.\n` +
        `⚠️ Necesitas mínimo 100 leads en el pixel para que funcione bien.`,
        { parse_mode: 'HTML' }
      );
      try {
        const { crearLookalike } = await import('./meta-ads-carros.js');
        const result = await crearLookalike();
        if (!result) {
          await bot.sendMessage(chatId, '❌ Falta META_PIXEL_ID configurado en Railway.');
          return;
        }
        await bot.sendMessage(chatId,
          `✅ <b>Lookalike lista!</b>\n\n` +
          `👥 Audiencia fuente ID: <code>${result.fuenteId}</code>\n` +
          `🎯 Lookalike 1% ID: <code>${result.lookalikeId}</code>\n\n` +
          `Úsala en tu próxima campaña desde Meta Ads Manager → Audiencias.\n` +
          `<b>Tip:</b> Con 100+ leads el lookalike empieza a ser muy efectivo.`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        await bot.sendMessage(chatId, `❌ Error lookalike: <code>${e.message}</code>`, { parse_mode: 'HTML' });
      }
      return;
    }

    // /retargeting — crear campaña para visitantes que no convirtieron
    if (cmd === '/retargeting') {
      const presupuesto = parseInt(args[0]) || 10;
      await bot.sendMessage(chatId, `🎯 Creando campaña de retargeting — $${presupuesto}/día...`);
      try {
        const { crearCampanaRetargeting } = await import('./meta-ads-carros.js');
        const result = await crearCampanaRetargeting(presupuesto);
        await bot.sendMessage(chatId,
          `✅ <b>Retargeting listo!</b>\n` +
          `🎯 Audiencia: visitantes web últimos 30 días\n` +
          `💵 Presupuesto: $${presupuesto}/día\n` +
          `📱 Placements: Facebook Feed + Instagram Feed\n` +
          `🌐 Idioma: Español\n\n` +
          `Campaña ID: <code>${result.campaign_id}</code>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        await bot.sendMessage(chatId, `❌ Error retargeting: <code>${e.message}</code>`, { parse_mode: 'HTML' });
      }
      return;
    }

    // /analista — lanzar análisis IA manualmente
    if (cmd === '/analista' || cmd === 'analista') {
      await bot.sendMessage(chatId, '🧠 Iniciando análisis con IA...');
      const { ejecutarAnalista } = await import('./agentes/analista.js');
      ejecutarAnalista().catch(e => bot.sendMessage(chatId, `❌ Error analista: <code>${e.message}</code>`, { parse_mode: 'HTML' }));
      return;
    }

    // /supervisor — lanzar supervisor manualmente
    if (cmd === '/supervisor' || cmd === 'supervisor') {
      await bot.sendMessage(chatId, '👁 Revisando campañas ahora...');
      const { ejecutarSupervisor } = await import('./agentes/supervisor.js');
      ejecutarSupervisor().catch(e => bot.sendMessage(chatId, `❌ Error supervisor: <code>${e.message}</code>`, { parse_mode: 'HTML' }));
      return;
    }

    // /mejor
    if (cmd === '/mejor' || cmd === 'mejor') {
      await ejecutar(chatId, 'mejor_campana', {});
      return;
    }

    // /nueva — con o sin parámetros
    if (cmd === '/nueva' || cmd === 'nueva') {
      const segmento    = partes[1];
      const presupuesto = parseFloat(partes[2]);
      const validos     = ['mal-credito','sin-credito','urgente','upgrade','oferta-especial'];
      if (segmento && validos.includes(segmento) && presupuesto) {
        // Comando completo — ejecutar directo
        await ejecutar(chatId, 'crear_campana', { segmento, presupuesto });
      } else if (segmento && validos.includes(segmento)) {
        // Tiene segmento pero falta presupuesto — mostrar montos
        await bot.sendMessage(chatId,
          `🚀 <b>${segmento}</b> — ¿Cuánto presupuesto por día?`,
          { parse_mode: 'HTML', reply_markup: kbPresupuesto(segmento, 'nueva') }
        );
      } else {
        // Sin parámetros — mostrar segmentos
        await bot.sendMessage(chatId,
          '🚀 <b>Nueva campaña</b> — ¿Qué segmento?',
          { parse_mode: 'HTML', reply_markup: kbSegmentosAccion('nueva_seg') }
        );
      }
      return;
    }

    // /pausa — con o sin parámetros
    if (cmd === '/pausa' || cmd === 'pausa') {
      if (partes[1]) {
        await ejecutar(chatId, 'pausa', { segmento: partes[1] });
      } else {
        await bot.sendMessage(chatId,
          '⏸ <b>Pausar campaña</b> — ¿Cuál?',
          { parse_mode: 'HTML', reply_markup: kbSegmentosAccion('pausa') }
        );
      }
      return;
    }

    // /activa — con o sin parámetros
    if (cmd === '/activa' || cmd === 'activa') {
      if (partes[1]) {
        await ejecutar(chatId, 'activa', { segmento: partes[1] });
      } else {
        await bot.sendMessage(chatId,
          '▶️ <b>Activar campaña</b> — ¿Cuál?',
          { parse_mode: 'HTML', reply_markup: kbSegmentosAccion('activa') }
        );
      }
      return;
    }

    // /presupuesto — con o sin parámetros
    if (cmd === '/presupuesto' || cmd === 'presupuesto') {
      const segmento = partes[1];
      const monto    = parseFloat(partes[2]);
      if (segmento && monto) {
        await ejecutar(chatId, 'presupuesto', { segmento, monto });
      } else if (segmento) {
        await bot.sendMessage(chatId,
          `💵 <b>${segmento}</b> — ¿Nuevo presupuesto por día?`,
          { parse_mode: 'HTML', reply_markup: kbPresupuesto(segmento, 'presu') }
        );
      } else {
        await bot.sendMessage(chatId,
          '💵 <b>Cambiar presupuesto</b> — ¿Qué campaña?',
          { parse_mode: 'HTML', reply_markup: kbSegmentosAccion('presu_seg') }
        );
      }
      return;
    }

    // /testvoz — llamada de prueba inmediata para verificar voz de Sofía
    if (cmd === '/testvoz') {
      await bot.sendMessage(chatId, '📞 Llamando ahora con Sofía (voz Belén)...');
      try {
        const { llamarLead } = await import('./agentes/llamador.js');
        const tel = (process.env.WHATSAPP_EDUARDO || '17869167339').replace(/\D/g, '');
        const telE164 = tel.startsWith('1') && tel.length === 11 ? `+${tel}` : `+1${tel}`;
        await llamarLead({ nombre: 'Eduardo', telefono: telE164, segmento: 'oferta-especial' });
      } catch (e) {
        await bot.sendMessage(chatId, `❌ Error: <code>${e.message}</code>`, { parse_mode: 'HTML' });
      }
      return;
    }

    // No reconocido — mostrar menú
    await bot.sendMessage(chatId, '🤖 <b>AutoAprobado Miami</b> — ¿Qué hacemos?', {
      parse_mode: 'HTML', reply_markup: MENU_PRINCIPAL
    });

  } catch (err) {
    console.error('[Bot] Error:', err.message);
    await bot.sendMessage(chatId, `❌ Error: <code>${err.message}</code>`, { parse_mode: 'HTML' });
  }
}

// ── Manejador de botones inline (callback_query) ─────
async function manejarCallback(query) {
  const chatId   = String(query.message?.chat?.id);
  const data     = query.data;
  const queryId  = query.id;

  // Verificar chat autorizado
  const idNormalizado = CHAT_ID.replace('-100', '');
  if (chatId !== CHAT_ID && chatId !== idNormalizado && `-100${chatId}` !== CHAT_ID) return;

  try {
    // ── Menú principal ───────────────────────────────
    if (data.startsWith('menu:')) {
      const accion = data.split(':')[1];
      await bot.answerCallbackQuery(queryId);
      const acciones = {
        nueva:       () => bot.sendMessage(chatId, '🚀 <b>Nueva campaña</b> — ¿Qué segmento?', { parse_mode: 'HTML', reply_markup: kbSegmentosAccion('nueva_seg') }),
        pausa:       () => bot.sendMessage(chatId, '⏸ <b>Pausar campaña</b> — ¿Cuál?',        { parse_mode: 'HTML', reply_markup: kbSegmentosAccion('pausa') }),
        activa:      () => bot.sendMessage(chatId, '▶️ <b>Activar campaña</b> — ¿Cuál?',      { parse_mode: 'HTML', reply_markup: kbSegmentosAccion('activa') }),
        presupuesto: () => bot.sendMessage(chatId, '💵 <b>Cambiar presupuesto</b> — ¿Qué campaña?', { parse_mode: 'HTML', reply_markup: kbSegmentosAccion('presu_seg') }),
        reporte:     () => { bot.sendMessage(chatId, '⏳ Generando reporte...'); generarReporte(); },
        mejor:       () => ejecutar(chatId, 'mejor_campana', {}),
        analista:    () => { bot.sendMessage(chatId, '🧠 Iniciando análisis con IA...'); import('./agentes/analista.js').then(m => m.ejecutarAnalista()); },
        supervisor:  () => { bot.sendMessage(chatId, '👁 Revisando campañas ahora...'); import('./agentes/supervisor.js').then(m => m.ejecutarSupervisor()); },
      };
      if (acciones[accion]) await acciones[accion]();
      return;
    }

    // ── Nueva campaña: elegir segmento ───────────────
    if (data.startsWith('nueva_seg:')) {
      const segmento = data.split(':')[1];
      await bot.answerCallbackQuery(queryId);
      await bot.sendMessage(chatId,
        `🚀 <b>${segmento}</b> — ¿Cuánto presupuesto por día?`,
        { parse_mode: 'HTML', reply_markup: kbPresupuesto(segmento, 'nueva') }
      );
      return;
    }

    // ── Nueva campaña: elegir presupuesto ────────────
    if (data.startsWith('nueva:')) {
      const [, segmento, monto] = data.split(':');
      await bot.answerCallbackQuery(queryId, { text: `Creando ${segmento} $${monto}/día...` });
      await ejecutar(chatId, 'crear_campana', { segmento, presupuesto: parseFloat(monto) });
      return;
    }

    // ── Pausar campaña ───────────────────────────────
    if (data.startsWith('pausa:')) {
      const segmento = data.split(':')[1];
      await bot.answerCallbackQuery(queryId, { text: `Pausando ${segmento}...` });
      await ejecutar(chatId, 'pausa', { segmento });
      return;
    }

    // ── Activar campaña ──────────────────────────────
    if (data.startsWith('activa:')) {
      const segmento = data.split(':')[1];
      await bot.answerCallbackQuery(queryId, { text: `Activando ${segmento}...` });
      await ejecutar(chatId, 'activa', { segmento });
      return;
    }

    // ── Presupuesto: elegir segmento ─────────────────
    if (data.startsWith('presu_seg:')) {
      const segmento = data.split(':')[1];
      await bot.answerCallbackQuery(queryId);
      await bot.sendMessage(chatId,
        `💵 <b>${segmento}</b> — ¿Nuevo presupuesto por día?`,
        { parse_mode: 'HTML', reply_markup: kbPresupuesto(segmento, 'presu') }
      );
      return;
    }

    // ── Presupuesto: elegir monto ────────────────────
    if (data.startsWith('presu:')) {
      const [, segmento, monto] = data.split(':');
      await bot.answerCallbackQuery(queryId, { text: `Actualizando presupuesto...` });
      await ejecutar(chatId, 'presupuesto', { segmento, monto: parseFloat(monto) });
      return;
    }

    // ── Aprobar plan del Analista ────────────────────
    if (data === 'aprobar_plan') {
      await bot.answerCallbackQuery(queryId, { text: '✅ Ejecutando plan...' });
      const plan = cargarPlan() || global._planPendiente;
      if (!plan) {
        await bot.sendMessage(chatId, '⚠️ No hay plan pendiente o ya expiró (24h). Ejecuta /analista para generar uno nuevo.');
        return;
      }
      await bot.sendMessage(chatId, '⚡ Ejecutando plan aprobado...');
      const { ejecutarPlan } = await import('./agentes/ejecutor.js');
      await ejecutarPlan(plan);
      marcarEjecutado();
      global._planPendiente = null;
      return;
    }

    // ── Ignorar plan del Analista ────────────────────
    if (data === 'ignorar_plan') {
      await bot.answerCallbackQuery(queryId, { text: '❌ Plan ignorado' });
      limpiarPlan();
      global._planPendiente = null;
      return;
    }

    // ── Cerrar lead — vendido ────────────────────────
    if (data.startsWith('cerrado:')) {
      const telefono = data.split(':')[1];
      const { marcarCerrado } = await import('./agentes/leads-store.js');
      const lead = marcarCerrado(telefono);
      if (lead) {
        await bot.answerCallbackQuery(queryId, { text: '✅ Lead marcado como vendido' });
        await bot.sendMessage(chatId,
          `✅ <b>¡Venta cerrada!</b> — ${lead.nombre}\n📱 ${lead.telefono}\n🎯 ${lead.segmento}`,
          { parse_mode: 'HTML' }
        );
      } else {
        await bot.answerCallbackQuery(queryId, { text: '⚠️ Lead no encontrado' });
      }
      return;
    }

    // ── Lead no contestó ────────────────────────────
    if (data.startsWith('no_contesto:')) {
      const telefono = data.split(':')[1];
      const { marcarNoContesto } = await import('./agentes/leads-store.js');
      const lead = marcarNoContesto(telefono);
      await bot.answerCallbackQuery(queryId, { text: lead ? '📵 Marcado como no contestó' : '⚠️ Lead no encontrado' });
      return;
    }

    // ── Escalar campaña específica (del Supervisor) ──
    if (data.startsWith('escalar:')) {
      const [, campanaId, presupuestoNuevo] = data.split(':');
      await bot.answerCallbackQuery(queryId, { text: '✅ Escalando...' });
      try {
        await metaPost(`/${campanaId}`, { daily_budget: Math.round(parseFloat(presupuestoNuevo) * 100) });
        await bot.sendMessage(chatId,
          `📈 <b>Campaña escalada</b> — presupuesto actualizado a $${parseFloat(presupuestoNuevo).toFixed(2)}/día`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {
        await bot.sendMessage(chatId, `❌ Error al escalar: <code>${e.message}</code>`, { parse_mode: 'HTML' });
      }
      global._consultaPendiente = null;
      return;
    }

    // ── Ignorar escalar (del Supervisor) ────────────
    if (data === 'ignorar_escalar') {
      await bot.answerCallbackQuery(queryId, { text: 'Ok, sin cambios' });
      global._consultaPendiente = null;
      return;
    }

    // ── Rellamar lead ────────────────────────────────
    if (data.startsWith('rellamar:')) {
      const [, telefono, ...nombreParts] = data.split(':');
      const nombre = nombreParts.join(':') || 'Lead';
      await bot.answerCallbackQuery(queryId, { text: '📞 Llamando...' });
      const { llamarLead } = await import('./agentes/llamador.js');
      await llamarLead({ nombre, telefono, segmento: 'oferta-especial' });
      return;
    }

    await bot.answerCallbackQuery(queryId);

  } catch (err) {
    console.error('[Bot] Error callback:', err.message);
    try { await bot.answerCallbackQuery(queryId, { text: 'Error' }); } catch {}
  }
}

export { bot, manejarMensaje, manejarCallback };

console.log('🤖 Bot AutoAprobado cargado — modo webhook');
