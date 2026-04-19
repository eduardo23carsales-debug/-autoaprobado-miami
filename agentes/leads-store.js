// ════════════════════════════════════════════════════
// LEADS STORE — AutoAprobado Miami
// Registra leads y cierres para el loop de conversión
// ════════════════════════════════════════════════════

import fs   from 'fs';
import os   from 'os';
import path from 'path';

const LEADS_FILE = path.join(os.tmpdir(), 'autoaprobado_leads.json');

function cargarTodos() {
  try {
    if (!fs.existsSync(LEADS_FILE)) return {};
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  } catch { return {}; }
}

function guardarTodos(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

export function registrarLead({ nombre, telefono, segmento, score }) {
  const leads = cargarTodos();
  const tel   = telefono.replace(/\D/g, '');
  leads[tel]  = {
    nombre,
    telefono,
    segmento,
    score,
    estado:    'NUEVO',
    creado_en: new Date().toISOString(),
    cerrado_en: null
  };
  guardarTodos(leads);
}

export function marcarCerrado(telefono) {
  const leads = cargarTodos();
  const tel   = telefono.replace(/\D/g, '');

  // Buscar por teléfono exacto o parcial
  const key = Object.keys(leads).find(k => k.includes(tel) || tel.includes(k));
  if (!key) return null;

  leads[key].estado     = 'CERRADO';
  leads[key].cerrado_en = new Date().toISOString();
  guardarTodos(leads);
  return leads[key];
}

export function marcarNoContesto(telefono) {
  const leads = cargarTodos();
  const tel   = telefono.replace(/\D/g, '');
  const key   = Object.keys(leads).find(k => k.includes(tel) || tel.includes(k));
  if (!key) return null;
  leads[key].estado = 'NO_CONTESTO';
  guardarTodos(leads);
  return leads[key];
}

export function obtenerResumen() {
  const leads  = cargarTodos();
  const todos  = Object.values(leads);
  const hoy    = new Date().toISOString().slice(0, 10);

  const total      = todos.length;
  const cerrados   = todos.filter(l => l.estado === 'CERRADO').length;
  const noContesto = todos.filter(l => l.estado === 'NO_CONTESTO').length;
  const nuevos     = todos.filter(l => l.estado === 'NUEVO').length;
  const hoyCount   = todos.filter(l => l.creado_en?.startsWith(hoy)).length;

  const tasa = total > 0 ? ((cerrados / total) * 100).toFixed(1) : '0';

  return { total, cerrados, noContesto, nuevos, hoy: hoyCount, tasa };
}
