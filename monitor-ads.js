// ════════════════════════════════════════════════════
// AutoAprobado Miami — monitor-ads.js
// Monitorea campañas Meta Ads y reporta a Telegram
// Corre automáticamente cada día a las 8 AM ET
// También pausa campañas si no hay saldo en la cuenta
// ════════════════════════════════════════════════════

import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
dotenv.config();

const API        = 'https://graph.facebook.com/v25.0';
const TOKEN      = process.env.META_ACCESS_TOKEN?.trim();
const AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID?.trim() || 'act_2128062444705705';
const bot        = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const CHAT_ID    = process.env.TELEGRAM_CHAT_ID;

// Estados de cuenta Meta
const ACCOUNT_STATUS = {
  1:   'Activa',
  2:   'Desactivada',
  3:   'Sin saldo',
  7:   'En revisión',
  9:   'En período de gracia',
  101: 'No disponible',
  201: 'Pendiente de pago'
};

async function metaGet(endpoint, params = {}) {
  const { data } = await axios.get(`${API}${endpoint}`, {
    params: { ...params, access_token: TOKEN },
    timeout: 15000
  });
  return data;
}

async function metaPost(endpoint, params) {
  const url = `${API}${endpoint}?access_token=${TOKEN}`;
  const { data } = await axios.post(url, params, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' }
  });
  return data;
}

// ── Verificar saldo y estado de la cuenta ────────────
async function verificarCuenta() {
  const data = await metaGet(`/${AD_ACCOUNT}`, {
    fields: 'account_status,balance,amount_spent,spend_cap,currency'
  });

  return {
    status:      data.account_status,
    statusLabel: ACCOUNT_STATUS[data.account_status] || `Desconocido (${data.account_status})`,
    balance:     parseFloat(data.balance || 0) / 100,
    gastado:     parseFloat(data.amount_spent || 0) / 100,
    moneda:      data.currency || 'USD',
    sinSaldo:    data.account_status === 3 || parseFloat(data.balance || 0) <= 0
  };
}

// ── Obtener todas las campañas de AutoAprobado ───────
async function obtenerCampanas() {
  const data = await metaGet(`/${AD_ACCOUNT}/campaigns`, {
    fields: 'id,name,status,effective_status,daily_budget',
    filtering: JSON.stringify([{ field: 'name', operator: 'CONTAIN', value: 'AutoAprobado' }]),
    limit: 50
  });
  return data.data || [];
}

// ── Obtener métricas de hoy para una campaña ─────────
async function obtenerMetricas(campaignId) {
  try {
    const data = await metaGet(`/${campaignId}/insights`, {
      fields: 'spend,impressions,clicks,ctr,actions',
      date_preset: 'today'
    });

    if (!data.data?.length) return { spend: 0, clicks: 0, impressions: 0, leads: 0 };

    const m = data.data[0];
    const leads = m.actions?.find(a =>
      a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped'
    )?.value || 0;

    return {
      spend:       parseFloat(m.spend || 0),
      clicks:      parseInt(m.clicks || 0),
      impressions: parseInt(m.impressions || 0),
      leads:       parseInt(leads),
      ctr:         parseFloat(m.ctr || 0)
    };
  } catch {
    return { spend: 0, clicks: 0, impressions: 0, leads: 0, error: true };
  }
}

// ── Pausar todas las campañas de AutoAprobado ────────
async function pausarTodasLasCampanas(campanas) {
  const pausadas = [];
  for (const c of campanas) {
    if (c.status === 'ACTIVE') {
      try {
        await metaPost(`/${c.id}`, { status: 'PAUSED' });
        pausadas.push(c.name);
        console.log(`[Monitor] Pausada: ${c.name}`);
      } catch (e) {
        console.warn(`[Monitor] No se pudo pausar ${c.name}: ${e.message}`);
      }
    }
  }
  return pausadas;
}

// ── Generar y enviar reporte a Telegram ──────────────
export async function generarReporte() {
  console.log('[Monitor] Generando reporte...');

  try {
    // 1. Estado de la cuenta
    const cuenta = await verificarCuenta();

    // 2. Campañas
    const todasCampanas = await obtenerCampanas();
    const campanas = todasCampanas.filter(c => c.effective_status === 'ACTIVE');

    // 3. Si no hay saldo → pausar todo y notificar
    if (cuenta.sinSaldo && campanas.length > 0) {
      const pausadas = await pausarTodasLasCampanas(campanas);

      const alerta =
        `🔴 <b>ALERTA — Sin saldo en Meta Ads</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💳 Estado de cuenta: <b>${cuenta.statusLabel}</b>\n` +
        `💵 Saldo disponible: <b>$${cuenta.balance.toFixed(2)}</b>\n\n` +
        `⏸ Campañas pausadas automáticamente:\n` +
        pausadas.map(n => `• ${n}`).join('\n') +
        `\n\n⚡ Deposita saldo en Meta Ads Manager y reactiva las campañas cuando estés listo.\n` +
        `🕐 ${new Date().toLocaleString('es-US', { timeZone: 'America/New_York' })}`;

      await bot.sendMessage(CHAT_ID, alerta, { parse_mode: 'HTML' });
      console.log('[Monitor] Alerta de sin saldo enviada a Telegram');
      return;
    }

    // 4. Métricas por campaña
    let totalGasto = 0;
    let totalLeads = 0;
    let totalClicks = 0;
    const lineas = [];

    for (const c of campanas) {
      const m = await obtenerMetricas(c.id);
      totalGasto  += m.spend;
      totalLeads  += m.leads;
      totalClicks += m.clicks;

      const estado  = c.effective_status === 'ACTIVE' ? '🟢' : '⏸';
      const cpl     = m.leads > 0 ? `$${(m.spend / m.leads).toFixed(2)}/lead` : m.spend > 0 ? '⚠️ 0 leads' : '—';
      const nombre  = c.name
        .replace(/^AutoAprobado \| /, '')
        .replace(/ \| \d{4}-\d{2}-\d{2}(T\d{2}h\d{2})?$/, '')
        .replace(/ — AutoAprobado Miami$/, '')
        .trim()
        + ` [${c.id.slice(-6)}]`;

      lineas.push(`${estado} <b>${nombre}</b>\n   💵 $${m.spend.toFixed(2)} | 👆 ${m.clicks} clicks | 🎯 ${m.leads} leads | ${cpl}`);
    }

    if (campanas.length === 0) {
      lineas.push('📭 No hay campañas activas todavía.');
    }

    // 5. Alertas automáticas + preguntas de acción
    const alertas = [];
    for (const c of campanas) {
      const m = await obtenerMetricas(c.id);
      const presupuesto = parseFloat(c.daily_budget || 0) / 100;
      if (m.spend >= presupuesto * 0.8 && m.leads === 0 && c.effective_status === 'ACTIVE') {
        const alertaNombre = c.name
          .replace(/^AutoAprobado \| /, '')
          .replace(/ \| \d{4}-\d{2}-\d{2}(T\d{2}h\d{2})?$/, '')
          .replace(/ — AutoAprobado Miami$/, '')
          .trim();

        // Detectar segmento de la campaña
        const segmento = ['mal-credito','sin-credito','urgente','upgrade','oferta-especial']
          .find(s => c.name.toLowerCase().includes(s)) || 'mal-credito';

        alertas.push(
          `🚨 <b>${alertaNombre}</b> gastó $${m.spend.toFixed(2)} sin ningún lead hoy.\n` +
          `¿Qué hacemos?\n` +
          `👉 /pausa ${segmento} — pausar esta campaña\n` +
          `👉 /nueva ${segmento} 5 — crear nueva versión`
        );
      }
    }

    // 6. Armar mensaje
    const ts = new Date().toLocaleString('es-US', { timeZone: 'America/New_York' });
    const cplTotal = totalLeads > 0 ? `$${(totalGasto / totalLeads).toFixed(2)}` : '—';

    let msg =
      `📊 <b>Reporte AutoAprobado Miami</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💳 Cuenta: <b>${cuenta.statusLabel}</b> | Saldo: <b>$${cuenta.balance.toFixed(2)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      lineas.join('\n\n') +
      `\n\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📈 <b>Total hoy:</b> $${totalGasto.toFixed(2)} | ${totalClicks} clicks | ${totalLeads} leads | CPL: ${cplTotal}\n` +
      `🕐 ${ts}`;

    if (alertas.length > 0) {
      msg += `\n\n🚨 <b>Alertas:</b>\n` + alertas.join('\n');
    }

    await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML' });
    console.log('[Monitor] Reporte enviado a Telegram');

  } catch (err) {
    console.error('[Monitor] Error:', err.message);
    try {
      await bot.sendMessage(CHAT_ID,
        `⚠️ <b>Monitor AutoAprobado</b> — Error al generar reporte:\n<code>${err.message}</code>`,
        { parse_mode: 'HTML' }
      );
    } catch {}
  }
}
