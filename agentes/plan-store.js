// ════════════════════════════════════════════════════
// PLAN STORE — AutoAprobado Miami
// Persiste el plan del Analista en disco para sobrevivir reinicios
// ════════════════════════════════════════════════════

import fs   from 'fs';
import os   from 'os';
import path from 'path';

const PLAN_FILE = path.join(os.tmpdir(), 'autoaprobado_plan.json');
const TTL_MS    = 24 * 60 * 60 * 1000; // 24 horas

export function guardarPlan(plan) {
  const registro = {
    plan,
    timestamp:  Date.now(),
    estado:     'PENDIENTE',
    expira_en:  Date.now() + TTL_MS
  };
  fs.writeFileSync(PLAN_FILE, JSON.stringify(registro, null, 2), 'utf8');
  console.log(`[PlanStore] Plan guardado en ${PLAN_FILE}`);
}

export function cargarPlan() {
  try {
    if (!fs.existsSync(PLAN_FILE)) return null;
    const registro = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
    if (Date.now() > registro.expira_en) {
      fs.unlinkSync(PLAN_FILE);
      console.log('[PlanStore] Plan expirado — eliminado');
      return null;
    }
    if (registro.estado !== 'PENDIENTE') return null;
    return registro.plan;
  } catch {
    return null;
  }
}

export function marcarEjecutado() {
  try {
    if (!fs.existsSync(PLAN_FILE)) return;
    const registro = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
    registro.estado = 'EJECUTADO';
    fs.writeFileSync(PLAN_FILE, JSON.stringify(registro, null, 2), 'utf8');
  } catch { /* no bloquear */ }
}

export function limpiarPlan() {
  try {
    if (fs.existsSync(PLAN_FILE)) fs.unlinkSync(PLAN_FILE);
  } catch { /* no bloquear */ }
}
