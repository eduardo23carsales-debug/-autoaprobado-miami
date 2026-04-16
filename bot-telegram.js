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

const AYUDA =
`📋 <b>Comandos disponibles:</b>

/reporte — métricas de hoy
/mejor — qué campaña va mejor
/analista — análisis IA + plan de acción
/supervisor — revisión inmediata de campañas

/nueva mal-credito 5 — crear campaña ($5/día)
/nueva sin-credito 5
/nueva urgente 5
/nueva upgrade 5
/nueva oferta-especial 5

/pausa mal-credito — pausar campaña
/pausa todas — pausar todas
/activa mal-credito — activar campaña
/activa todas — activar todas

/presupuesto mal-credito 10 — cambiar presupuesto

Segmentos: mal-credito | sin-credito | urgente | upgrade | oferta-especial`;

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

  const partes = texto.toLowerCase().trim().split(/\s+/);
  const cmd    = partes[0];

  try {
    // /start o /ayuda
    if (cmd === '/start' || cmd === '/ayuda' || cmd === '/help') {
      await bot.sendMessage(chatId, AYUDA, { parse_mode: 'HTML' });
      return;
    }

    // /reporte
    if (cmd === '/reporte' || cmd === 'reporte') {
      await bot.sendMessage(chatId, '⏳ Generando reporte...');
      await generarReporte();
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

    // /nueva <segmento> <presupuesto>
    if (cmd === '/nueva' || cmd === 'nueva') {
      const segmento   = partes[1];
      const presupuesto = parseFloat(partes[2]) || 5;
      const validos = ['mal-credito','sin-credito','urgente','upgrade','oferta-especial'];
      if (!validos.includes(segmento)) {
        await bot.sendMessage(chatId,
          `⚠️ Segmento inválido. Usa uno de:\n${validos.join(' | ')}`, { parse_mode: 'HTML' });
        return;
      }
      await ejecutar(chatId, 'crear_campana', { segmento, presupuesto, con_video: false });
      return;
    }

    // /pausa <segmento|todas>
    if (cmd === '/pausa' || cmd === 'pausa') {
      const segmento = partes[1] || 'todas';
      await ejecutar(chatId, 'pausa', { segmento });
      return;
    }

    // /activa <segmento|todas>
    if (cmd === '/activa' || cmd === 'activa') {
      const segmento = partes[1] || 'todas';
      await ejecutar(chatId, 'activa', { segmento });
      return;
    }

    // /presupuesto <segmento> <monto>
    if (cmd === '/presupuesto' || cmd === 'presupuesto') {
      const segmento = partes[1];
      const monto    = parseFloat(partes[2]);
      if (!segmento || !monto) {
        await bot.sendMessage(chatId, '⚠️ Uso: /presupuesto mal-credito 10');
        return;
      }
      await ejecutar(chatId, 'presupuesto', { segmento, monto });
      return;
    }

    // No reconocido
    await bot.sendMessage(chatId, AYUDA, { parse_mode: 'HTML' });

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
    // ── Aprobar plan del Analista ────────────────────
    if (data === 'aprobar_plan') {
      await bot.answerCallbackQuery(queryId, { text: '✅ Ejecutando plan...' });
      const plan = global._planPendiente;
      if (!plan) {
        await bot.sendMessage(chatId, '⚠️ No hay plan pendiente (el bot se reinició). Ejecuta /analista para generar uno nuevo.');
        return;
      }
      await bot.sendMessage(chatId, '⚡ Ejecutando plan aprobado...');
      const { ejecutarPlan } = await import('./agentes/ejecutor.js');
      await ejecutarPlan(plan);
      global._planPendiente = null;
      return;
    }

    // ── Ignorar plan del Analista ────────────────────
    if (data === 'ignorar_plan') {
      await bot.answerCallbackQuery(queryId, { text: '❌ Plan ignorado' });
      global._planPendiente = null;
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

    await bot.answerCallbackQuery(queryId);

  } catch (err) {
    console.error('[Bot] Error callback:', err.message);
    try { await bot.answerCallbackQuery(queryId, { text: 'Error' }); } catch {}
  }
}

export { bot, manejarMensaje, manejarCallback };

console.log('🤖 Bot AutoAprobado cargado — modo webhook');
