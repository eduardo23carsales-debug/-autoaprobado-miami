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

// ── Monitor de campañas — reporte diario 8 AM ET ─────
// Cron: "0 8 * * *" = todos los días a las 8:00 AM
// Timezone America/New_York = Miami
cron.schedule('0 8 * * *', () => {
  console.log('[Monitor] Ejecutando reporte diario...');
  generarReporte();
}, { timezone: 'America/New_York' });

// ── Iniciar servidor ─────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AutoAprobado Miami corriendo en http://localhost:${PORT}`);
  console.log(`📊 Monitor de campañas activo — reporte diario a las 8 AM ET`);
});
