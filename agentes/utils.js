// ════════════════════════════════════════════════════
// Utilidades compartidas entre los 3 agentes
// ════════════════════════════════════════════════════

import axios       from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import dotenv      from 'dotenv';
dotenv.config();

export const API        = 'https://graph.facebook.com/v25.0';
export const TOKEN      = process.env.META_ACCESS_TOKEN?.trim();
export const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID?.trim();
export const CHAT_ID    = process.env.TELEGRAM_CHAT_ID;

const _botRaw = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const _origSendU = _botRaw.sendMessage.bind(_botRaw);
_botRaw.sendMessage = (chatId, text, opts) => {
  console.log(`[TG-utils] sendMessage → "${String(text).slice(0,80)}"`);
  return _origSendU(chatId, text, opts);
};
export const bot = _botRaw;

// ── Meta API helpers ─────────────────────────────────
export async function metaGet(endpoint, params = {}) {
  const { data } = await axios.get(`${API}${endpoint}`, {
    params: { ...params, access_token: TOKEN },
    timeout: 15000
  });
  return data;
}

export async function metaPost(endpoint, body) {
  const { data } = await axios.post(`${API}${endpoint}?access_token=${TOKEN}`, body, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' }
  });
  return data;
}

// ── Obtener campañas AutoAprobado ────────────────────
export async function getCampanas(soloActivas = false) {
  const data = await metaGet(`/${AD_ACCOUNT}/campaigns`, {
    fields: 'id,name,status,effective_status,daily_budget',
    filtering: JSON.stringify([{ field: 'name', operator: 'CONTAIN', value: 'AutoAprobado' }]),
    limit: 50
  });
  const campanas = data.data || [];
  return soloActivas ? campanas.filter(c => c.effective_status === 'ACTIVE') : campanas;
}

// ── Obtener métricas de una campaña ──────────────────
export async function getMetricas(campanaId, preset = 'today') {
  try {
    const data = await metaGet(`/${campanaId}/insights`, {
      fields: 'spend,impressions,clicks,ctr,actions,cost_per_action_type',
      date_preset: preset
    });
    if (!data.data?.length) return { spend: 0, clicks: 0, impressions: 0, leads: 0, ctr: 0 };
    const m = data.data[0];
    const leads = parseInt(m.actions?.find(a =>
      a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
    )?.value || 0);
    return {
      spend:       parseFloat(m.spend || 0),
      clicks:      parseInt(m.clicks || 0),
      impressions: parseInt(m.impressions || 0),
      leads,
      ctr:         parseFloat(m.ctr || 0),
      cpl:         leads > 0 ? parseFloat(m.spend || 0) / leads : null
    };
  } catch {
    return { spend: 0, clicks: 0, impressions: 0, leads: 0, ctr: 0, cpl: null };
  }
}

// ── Limpiar nombre de campaña ─────────────────────────
export function limpiarNombre(nombre) {
  return nombre
    .replace(/^AutoAprobado \| /, '')
    .replace(/ \| \d{4}-\d{2}-\d{2}(T\d{2}h\d{2})?$/, '')
    .replace(/ — AutoAprobado Miami$/, '')
    .trim();
}

// ── Detectar segmento de campaña ─────────────────────
export function getSegmento(nombre) {
  const n = nombre.toLowerCase();
  if (n.includes('mal-credito') || n.includes('mal cr'))  return 'mal-credito';
  if (n.includes('sin-credito') || n.includes('sin cr'))  return 'sin-credito';
  if (n.includes('urgente'))                              return 'urgente';
  if (n.includes('upgrade'))                              return 'upgrade';
  if (n.includes('oferta'))                               return 'oferta-especial';
  return 'mal-credito';
}

// ── Enviar mensaje a Telegram ─────────────────────────
export async function notificar(texto, opciones = {}) {
  return bot.sendMessage(CHAT_ID, texto, { parse_mode: 'HTML', ...opciones });
}
