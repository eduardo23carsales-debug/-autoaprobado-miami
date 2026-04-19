// ════════════════════════════════════════════════════
// AGENTE ANALISTA — AutoAprobado Miami
// Corre diario a las 8 AM
// Analiza campañas, genera plan y pide aprobación
// ════════════════════════════════════════════════════

import { getCampanas, getMetricas, limpiarNombre, getSegmento,
         notificar, CHAT_ID, bot } from './utils.js';
import { guardarPlan } from './plan-store.js';
import { obtenerResumen } from './leads-store.js';

const PRESUPUESTO_MAXIMO_DIA = parseFloat(process.env.PRESUPUESTO_MAX_DIA || '30');

// ── Analizar campañas con Claude ─────────────────────
async function analizarConIA(datos) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: `Eres el analista senior de campañas de Meta Ads para AutoAprobado Miami, un dealer de carros en Miami que ayuda a hispanos con mal crédito o sin historial crediticio.

Tu trabajo es analizar métricas reales y tomar decisiones de negocio concretas — no solo optimizar CPL, sino maximizar ventas cerradas.

Criterios de decisión:
- CPL < $5 con leads = escalar (máximo 20% de aumento)
- Gasto sin leads = pausar
- Segmentos con mejor tasa de cierre histórica = priorizar
- No crear campañas duplicadas del mismo segmento

Responde SOLO con JSON válido, sin texto adicional.`,
    messages: [{
      role: 'user',
      content: `Métricas de los últimos 7 días:
${JSON.stringify(datos, null, 2)}

Resumen de conversión real (leads → ventas):
${JSON.stringify(obtenerResumen(), null, 2)}

Presupuesto máximo disponible por día: $${PRESUPUESTO_MAXIMO_DIA}

Genera un plan con esta estructura exacta:
{
  "pausar": [{"id": "...", "nombre": "...", "razon": "..."}],
  "escalar": [{"id": "...", "nombre": "...", "presupuesto_actual": 0, "presupuesto_nuevo": 0, "razon": "..."}],
  "crear": [{"segmento": "...", "presupuesto": 0, "razon": "..."}],
  "resumen_telegram": "resumen corto en español para Eduardo (máx 3 líneas)",
  "resumen_voz": "frase natural para leer en voz alta, máx 2 oraciones, directa y clara"
}`
    }]
  });

  const raw = msg.content[0].text.trim().replace(/```json|```/g, '');
  return JSON.parse(raw);
}

// ── Ejecutar análisis y enviar plan ──────────────────
export async function ejecutarAnalista() {
  console.log('[Analista] Iniciando análisis...');

  try {
    const campanas = await getCampanas();

    if (!campanas.length) {
      await notificar('📊 <b>Analista:</b> No hay campañas activas para analizar.');
      return;
    }

    // Recopilar métricas 7 días
    const datos = [];
    for (const c of campanas) {
      const m7 = await getMetricas(c.id, 'last_7d');
      const mhoy = await getMetricas(c.id, 'today');
      datos.push({
        id:               c.id,
        nombre:           limpiarNombre(c.name),
        segmento:         getSegmento(c.name),
        estado:           c.effective_status,
        presupuesto_dia:  parseFloat(c.daily_budget || 0) / 100,
        ultimos_7_dias:   m7,
        hoy:              mhoy
      });
    }

    // Analizar con IA
    const plan = await analizarConIA(datos);

    // Armar mensaje para Telegram
    const lineas = [];
    lineas.push(`🧠 <b>Plan del Analista — ${new Date().toLocaleDateString('es-US', { timeZone: 'America/New_York' })}</b>`);
    lineas.push(`━━━━━━━━━━━━━━━━━━━━━━`);
    lineas.push(plan.resumen_telegram);
    lineas.push(`━━━━━━━━━━━━━━━━━━━━━━`);

    if (plan.pausar?.length) {
      lineas.push(`\n⏸ <b>Pausar (${plan.pausar.length}):</b>`);
      plan.pausar.forEach(p => lineas.push(`• ${p.nombre} — ${p.razon}`));
    }
    if (plan.escalar?.length) {
      lineas.push(`\n📈 <b>Escalar (${plan.escalar.length}):</b>`);
      plan.escalar.forEach(e => lineas.push(`• ${e.nombre}: $${e.presupuesto_actual}→$${e.presupuesto_nuevo}/día — ${e.razon}`));
    }
    if (plan.crear?.length) {
      lineas.push(`\n🚀 <b>Crear nueva (${plan.crear.length}):</b>`);
      plan.crear.forEach(c => lineas.push(`• ${c.segmento} $${c.presupuesto}/día — ${c.razon}`));
    }

    // Calcular costo total del plan
    const costoEscalar = plan.escalar?.reduce((s, e) => s + (e.presupuesto_nuevo - e.presupuesto_actual), 0) || 0;
    const costoCrear   = plan.crear?.reduce((s, c) => s + c.presupuesto, 0) || 0;
    const costoTotal   = costoEscalar + costoCrear;
    if (costoTotal > 0) lineas.push(`\n💵 <b>Inversión adicional:</b> $${costoTotal.toFixed(2)}/día`);

    // Guardar plan para el Ejecutor
    plan._datos_campanas = datos;
    plan._resumen_voz    = plan.resumen_voz;
    const planStr = Buffer.from(JSON.stringify(plan)).toString('base64');

    // Botones inline para aprobación
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Aprobar plan', callback_data: `aprobar:${planStr.slice(0, 200)}` },
        { text: '❌ Ignorar',      callback_data: 'ignorar' }
      ]]
    };

    // Persistir plan en disco (sobrevive reinicios de Railway)
    guardarPlan(plan);
    global._planPendiente = plan; // compatibilidad hacia atrás

    const keyboardSimple = {
      inline_keyboard: [[
        { text: '✅ Aprobar plan', callback_data: 'aprobar_plan' },
        { text: '❌ Ignorar',      callback_data: 'ignorar_plan' }
      ]]
    };

    await notificar(lineas.join('\n'), { reply_markup: keyboardSimple });
    console.log('[Analista] Plan enviado a Telegram');

  } catch (err) {
    console.error('[Analista] Error:', err.message);
    await notificar(`⚠️ <b>Analista</b> — Error en análisis:\n<code>${err.message}</code>`);
  }
}

// ── Punto de entrada directo ─────────────────────────
const esDirecto = process.argv[1]?.replace(/\\/g, '/').endsWith('analista.js');
if (esDirecto) ejecutarAnalista();
