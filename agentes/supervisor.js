// ════════════════════════════════════════════════════
// AGENTE SUPERVISOR — AutoAprobado Miami
// Corre cada 4 horas
// Vigila campañas, actúa dentro de límites, consulta lo grande
// ════════════════════════════════════════════════════

import { getCampanas, getMetricas, limpiarNombre, getSegmento,
         metaPost, notificar, AD_ACCOUNT } from './utils.js';

// Límites de autonomía — el Supervisor actúa solo dentro de estos
const LIMITE_ESCALAR_SOLO   = parseFloat(process.env.LIMITE_ESCALAR_SOLO   || '10'); // máx $/día que puede subir solo
const LIMITE_GASTO_SIN_LEAD = parseFloat(process.env.LIMITE_GASTO_SIN_LEAD || '4');  // pausa si gasta esto sin leads

// Helper para escapar texto dinámico en mensajes HTML de Telegram
const escSup = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export async function ejecutarSupervisor() {
  console.log('[Supervisor] Revisando campañas...');

  try {
    const campanas = await getCampanas(true); // solo activas
    if (!campanas.length) {
      await notificar('👁 <b>Supervisor:</b> No hay campañas activas en este momento.');
      return;
    }

    const acciones    = [];
    const consultas   = []; // decisiones que superan el límite

    for (const c of campanas) {
      const m          = await getMetricas(c.id, 'today');
      const presupuesto = parseFloat(c.daily_budget || 0) / 100;
      const nombre     = limpiarNombre(c.name);
      const segmento   = getSegmento(c.name);
      const nombreEsc  = escSup(nombre);

      // ── Regla 1: Pausa automática si gasta sin leads ──
      if (m.spend >= LIMITE_GASTO_SIN_LEAD && m.leads === 0) {
        try {
          await metaPost(`/${c.id}`, { status: 'PAUSED' });
          acciones.push(
            `⏸ <b>Pausé ${nombreEsc}</b> — gastó $${m.spend.toFixed(2)} sin leads.\n` +
            `   👉 /activa ${segmento} para reactivar | /nueva ${segmento} 5 para nueva versión`
          );
        } catch (e) {
          acciones.push(`⚠️ No pude pausar ${nombreEsc}: ${escSup(e.message)}`);
        }
        continue;
      }

      // ── Regla 2: Escalar si tiene leads con buen CPL ──
      // Máximo 20% por ajuste — Meta reinicia la fase de aprendizaje con saltos bruscos
      if (m.leads > 0 && m.cpl !== null && m.cpl < 5) {
        const presupuestoNuevo = Math.round((presupuesto * 1.20) * 100) / 100;
        const aumento = presupuestoNuevo - presupuesto;

        if (aumento <= LIMITE_ESCALAR_SOLO) {
          // Escala solo — está dentro del límite
          try {
            await metaPost(`/${c.id}`, { daily_budget: Math.round(presupuestoNuevo * 100) });
            acciones.push(
              `📈 <b>Escalé ${nombreEsc}</b> — ${m.leads} leads a $${m.cpl.toFixed(2)} c/u.\n` +
              `   Presupuesto: $${presupuesto} → $${presupuestoNuevo.toFixed(2)}/día`
            );
          } catch (e) {
            acciones.push(`⚠️ No pude escalar ${nombreEsc}: ${escSup(e.message)}`);
          }
        } else {
          // Supera el límite — consulta a Eduardo
          consultas.push({
            nombre,
            nombreEsc,
            segmento,
            campana_id:        c.id,
            presupuesto_actual: presupuesto,
            presupuesto_nuevo:  presupuestoNuevo,
            leads_hoy:         m.leads,
            cpl:               m.cpl,
            resumen_voz: `Eduardo, ${nombre} tiene ${m.leads} leads hoy a $${m.cpl.toFixed(2)} cada uno. ` +
                         `Propongo subir el presupuesto de $${presupuesto} a $${presupuestoNuevo.toFixed(2)} por día. ¿Apruebas?`
          });
        }
      }
    }

    // Notificar acciones automáticas
    if (acciones.length > 0) {
      const ts = new Date().toLocaleString('es-US', { timeZone: 'America/New_York' });
      await notificar(
        `👁 <b>Supervisor — Acciones automáticas</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        acciones.join('\n\n') +
        `\n━━━━━━━━━━━━━━━━━━━━━━\n🕐 ${ts}`
      );
    }

    // Consultar decisiones que superan el límite
    for (const c of consultas) {
      global._consultaPendiente = c; // guarda para que el bot lo ejecute si aprueban

      const keyboard = {
        inline_keyboard: [[
          { text: `✅ Aprobar $${c.presupuesto_nuevo.toFixed(2)}/día`, callback_data: `escalar:${c.campana_id}:${c.presupuesto_nuevo}` },
          { text: '❌ No por ahora', callback_data: 'ignorar_escalar' }
        ]]
      };

      await notificar(
        `🤔 <b>Supervisor necesita tu aprobación:</b>\n\n` +
        `📊 <b>${escSup(c.nombre)}</b>\n` +
        `• Leads hoy: <b>${c.leads_hoy}</b>\n` +
        `• Costo por lead: <b>$${c.cpl.toFixed(2)}</b>\n` +
        `• Propuesta: $${c.presupuesto_actual}/día → <b>$${c.presupuesto_nuevo.toFixed(2)}/día</b>\n\n` +
        `💬 <i>${escSup(c.resumen_voz)}</i>`,
        { reply_markup: keyboard }
      );
    }

    if (acciones.length === 0 && consultas.length === 0) {
      await notificar(
        `👁 <b>Supervisor:</b> Todo en orden ✅\n` +
        `${campanas.length} campaña(s) revisada(s) — sin acciones necesarias.`
      );
    }

  } catch (err) {
    console.error('[Supervisor] Error:', err.message);
    await notificar(`⚠️ <b>Supervisor</b> — Error:\n<code>${err.message}</code>`);
  }
}

// ── Punto de entrada directo ─────────────────────────
const esDirecto = process.argv[1]?.replace(/\\/g, '/').endsWith('supervisor.js');
if (esDirecto) ejecutarSupervisor();
