// ════════════════════════════════════════════════════
// AGENTE EJECUTOR — AutoAprobado Miami
// Recibe plan aprobado y lo implementa en Meta Ads
// ════════════════════════════════════════════════════

import { metaPost, getCampanas, limpiarNombre, notificar, AD_ACCOUNT } from './utils.js';
import { crearCampanaSegmento } from '../meta-ads-carros.js';

// ── Ejecutar plan aprobado ───────────────────────────
export async function ejecutarPlan(plan) {
  console.log('[Ejecutor] Ejecutando plan aprobado...');
  const acciones = [];

  try {
    // 1. Pausar campañas
    if (plan.pausar?.length) {
      for (const p of plan.pausar) {
        try {
          await metaPost(`/${p.id}`, { status: 'PAUSED' });
          acciones.push(`⏸ Pausada: <b>${p.nombre}</b>`);
          console.log(`[Ejecutor] Pausada: ${p.nombre}`);
        } catch (e) {
          acciones.push(`⚠️ No pude pausar ${p.nombre}: ${e.message}`);
        }
      }
    }

    // 2. Escalar presupuesto
    if (plan.escalar?.length) {
      for (const e of plan.escalar) {
        try {
          const centavos = Math.round(e.presupuesto_nuevo * 100);
          await metaPost(`/${e.id}`, { daily_budget: centavos });
          acciones.push(`📈 Escalada: <b>${e.nombre}</b> → $${e.presupuesto_nuevo}/día`);
          console.log(`[Ejecutor] Escalada: ${e.nombre} a $${e.presupuesto_nuevo}/día`);
        } catch (e2) {
          acciones.push(`⚠️ No pude escalar ${e.nombre}: ${e2.message}`);
        }
      }
    }

    // 3. Crear campañas nuevas
    if (plan.crear?.length) {
      for (const c of plan.crear) {
        try {
          acciones.push(`⏳ Creando campaña <b>${c.segmento}</b> $${c.presupuesto}/día...`);
          const result = await crearCampanaSegmento(c.segmento, c.presupuesto);
          acciones.push(`🚀 Creada: <b>${c.segmento}</b> — ${result.ads.length} ads activos`);
          console.log(`[Ejecutor] Creada: ${c.segmento}`);
        } catch (e) {
          acciones.push(`⚠️ No pude crear ${c.segmento}: ${e.message}`);
        }
      }
    }

    // Reporte final
    const ts = new Date().toLocaleString('es-US', { timeZone: 'America/New_York' });
    const resumen =
      `⚡ <b>Ejecutor — Plan implementado</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      acciones.join('\n') +
      `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🕐 ${ts}`;

    await notificar(resumen);
    console.log('[Ejecutor] Plan completado');

    return {
      ok: true,
      acciones,
      resumen_voz: `Plan ejecutado. ${acciones.length} acciones completadas.`
    };

  } catch (err) {
    console.error('[Ejecutor] Error:', err.message);
    await notificar(`❌ <b>Ejecutor</b> — Error:\n<code>${err.message}</code>`);
    return { ok: false, error: err.message };
  }
}
