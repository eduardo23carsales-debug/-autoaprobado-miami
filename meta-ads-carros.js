// ════════════════════════════════════════════════════
// AutoAprobado Miami — meta-ads-carros.js
// Crea campañas en Meta Ads para cada segmento de la landing
// Uso: node meta-ads-carros.js <segmento> <presupuesto>
// Segmentos: mal-credito | sin-credito | urgente | upgrade | oferta-especial
// Ejemplo:   node meta-ads-carros.js mal-credito 20
// ════════════════════════════════════════════════════

import axios from 'axios';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PHOTOS_DIR = path.join(__dirname, 'photos');

const API          = 'https://graph.facebook.com/v25.0';
const TOKEN        = process.env.META_ACCESS_TOKEN?.trim();
const AD_ACCOUNT   = process.env.META_AD_ACCOUNT_ID?.trim();
const PAGE_ID      = process.env.META_PAGE_ID?.trim();
const PIXEL_ID     = process.env.META_PIXEL_ID?.trim();
const OPENAI_KEY   = process.env.OPENAI_API_KEY?.trim();
const LANDING_URL  = 'https://oferta.hyundaipromomiami.com';

// Disclaimer financiero requerido por Meta para categoría FINANCIAL_PRODUCTS_SERVICES
const DISCLAIMER = `*Pagos desde $299/mes. Sujeto a aprobación de crédito, plazo, inicial y tasa aplicable. Términos y condiciones en el dealer.`;

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// ── Datos por segmento ───────────────────────────────
const SEGMENTOS = {
  'mal-credito': {
    nombre:    'Mal Crédito — AutoAprobado Miami',
    hook:      '¿Te negaron el préstamo por mal crédito?',
    copies: [
      `😔 ¿Te negaron financiamiento por mal crédito?\n\nEn AutoAprobado Miami trabajamos CON tu situación, no contra ella.\n\n✅ Sin mínimo de score requerido\n✅ Respuesta en menos de 24 horas\n✅ Carros 2024-2026 disponibles\n\nMiles de familias hispanas en Miami ya manejan su carro nuevo. Tú puedes ser el próximo.\n\n👉 Llena el formulario en 30 segundos y te llamamos hoy.`,
      `⚠️ ¿Otros dealers te dijeron que NO?\n\nNosotros decimos: cuéntanos tu situación.\n\nEn AutoAprobado Miami nos especializamos en crédito difícil. No importa tu score, bancarrotas anteriores o deudas.\n\n🚗 Carros nuevos y usados\n💵 Inicial desde $500\n📱 Proceso 100% en español\n\n👉 Verifica si calificas GRATIS — sin afectar tu crédito. Tarda 30 segundos.`,
      `Tu crédito no define tu futuro 🚗\n\nHemos ayudado a cientos de familias en Miami a conseguir su carro aunque el banco los rechazó.\n\nNo necesitas crédito perfecto. Solo necesitas al dealer correcto.\n\n¿Cuándo fue la última vez que manejaste sin preocupaciones?\n\n👉 Empieza ahora — es gratis verificar y no te compromete a nada.`
    ],
    imagenPrompt: `Documentary photograph, Canon 5D, 50mm lens, f/2.0. A single Hispanic man in his late 30s sitting at a desk inside a bright modern car dealership showroom in Miami. He is signing a document, looking down at the paper, slight smile. One salesperson's hand visible across the desk handing a pen. Real dealership background: glass walls, one or two cars on the showroom floor out of focus. Natural daylight from windows, no flash. Realistic skin tones, no dramatic shadows. Square 1:1 crop. NO TEXT, NO WORDS, NO LOGOS in the image.`
  },
  'sin-credito': {
    nombre:    'Sin Historial — AutoAprobado Miami',
    hook:      '¿No tienes historial crediticio en USA?',
    copies: [
      `🆕 ¿Recién llegaste a USA o nunca tuviste crédito?\n\nNo necesitas historial crediticio para tener tu carro en Miami.\n\n✅ Aprobamos con ITIN o SSN\n✅ Si tienes trabajo o negocio propio, calificas\n✅ Proceso 100% en español\n\nTu carro propio es también tu primer paso para construir crédito en USA.\n\n👉 Verifica si calificas en 30 segundos — completamente gratis.`,
      `Llegaste a USA con ganas de crecer 💪\n\nEmpezar desde cero es difícil. Por eso en AutoAprobado Miami no te pedimos historial crediticio.\n\nSolo necesitas:\n🚗 Trabajo estable o negocio propio\n💵 Inicial accesible\n📱 Ganas de manejar tu propio carro\n\nYa ayudamos a cientos de inmigrantes hispanos en Miami a conseguir su primer carro.\n\n👉 ¿Cuándo empezamos? Llena el formulario ahora — es gratis.`,
      `Sin crédito en USA no significa sin carro 🚗\n\nCientos de nuestros clientes compraron su primer carro sin un solo punto de historial crediticio.\n\nEl secreto: encontrar el dealer que sabe cómo trabajar con tu situación.\n\nEn AutoAprobado Miami lo hacemos todos los días.\n\n👉 Tarda 2 minutos verificar si calificas. Sin costo, sin compromiso.`
    ],
    imagenPrompt: `Documentary photograph, Canon 5D, 35mm lens. A single young Hispanic man, early 20s, standing beside a white compact sedan in a sunny parking lot in Miami, Florida. He holds car keys in one hand, looking at them with a natural expression. Wearing casual everyday clothes — jeans and a t-shirt. Background: real Miami parking lot, palm trees, blue sky, other cars parked. Harsh midday sunlight, natural shadows. No posing, looks like a candid moment. Realistic colors. Square 1:1 crop. NO TEXT, NO WORDS, NO LOGOS.`
  },
  'urgente': {
    nombre:    'Urgente — AutoAprobado Miami',
    hook:      '¿Necesitas un carro YA en Miami?',
    copies: [
      `🚨 ¿Perdiste tu carro o necesitas uno URGENTE?\n\nEn AutoAprobado Miami podemos tenerte manejando en 24-48 horas.\n\n⚡ Aprobación express el mismo día\n🚗 Inventario disponible para entrega inmediata\n📱 Proceso sin vueltas, 100% en español\n\nNo pierdas más trabajo ni oportunidades por falta de transporte. Cada día cuenta.\n\n👉 Llena el formulario ahora — te llamamos en menos de 1 hora.`,
      `⏰ Cada día sin carro en Miami te cuesta dinero real.\n\nSin carro es casi imposible trabajar, llevar a los niños al colegio o manejar tu negocio en esta ciudad.\n\nEn AutoAprobado Miami entendemos la urgencia:\n✅ Respuesta en menos de 24 horas\n✅ Entrega inmediata del vehículo\n✅ Aprobamos aunque te hayan negado antes\n\n👉 Actúa ahora — llena el formulario en 30 segundos.`,
      `Si estás leyendo esto, necesitas un carro HOY 🚗⚡\n\nNo te vamos a hacer esperar semanas. Llamamos a nuestros bancos y encontramos quien te apruebe — sin importar tu situación de crédito.\n\nMiles de personas en Miami ya manejan gracias a nosotros.\n\nTú eres el siguiente. Pero hay que actuar rápido — el inventario es limitado.\n\n👉 Reserva tu lugar ahora. Es gratis y tarda 30 segundos.`
    ],
    imagenPrompt: `Documentary photograph, Canon 5D, 35mm lens, f/2.8. A single Hispanic woman in her 30s sitting in the driver's seat of a car, hands on the steering wheel, looking forward through the windshield with a calm confident expression. Shot from outside the car through the driver's window, slightly low angle. Miami street visible through the windshield — palm trees, buildings. Natural daylight. Realistic interior: car dashboard, steering wheel, seatbelt on. No exaggerated expression, real moment. Square 1:1. NO TEXT, NO WORDS, NO LOGOS.`
  },
  'upgrade': {
    nombre:    'Upgrade de Carro — AutoAprobado Miami',
    hook:      '¿Listo para cambiar tu carro en Miami?',
    copies: [
      `🔄 ¿Tu carro ya no te da lo que necesitas?\n\nEn AutoAprobado Miami hacemos el cambio fácil — usamos tu carro actual como parte del pago inicial del nuevo.\n\n✅ Sin gastar tu dinero de bolsillo\n✅ Más comodidad, más tecnología, menos reparaciones\n✅ Pagos que se adaptan a tu presupuesto actual\n\nNo esperes a que se dañe del todo.\n\n👉 Descubre cuánto vale tu carro hoy — es gratis y tarda 2 minutos.`,
      `Tu carro actual puede pagar el nuevo 🚗➡️🚗\n\nMuchos clientes en Miami hacen el upgrade sin poner ni un dólar de su bolsillo.\n\nUsamos el valor de tu carro como down payment del nuevo.\n\n✅ Modelos 2024-2026 disponibles\n✅ Pagos desde $299/mes*\n✅ Proceso rápido en español\n\n👉 Habla con nosotros hoy — cuéntanos qué tienes y te decimos exactamente qué opciones tienes.\n\n${DISCLAIMER}`,
      `¿Cuánto llevas con el mismo carro? 🤔\n\nSi ya tiene muchos miles, muchas reparaciones, o simplemente ya no va con tu vida actual — es señal.\n\nEn AutoAprobado Miami hacemos el cambio sin complicaciones y sin sorpresas.\n\nNuestros clientes salen con carro nuevo el mismo día que vienen.\n\n👉 Averigua cuánto vale tu carro en 2 minutos. Gratis, sin compromiso.`
    ],
    imagenPrompt: `Documentary photograph, Canon 5D, 50mm lens. Close-up of a single Hispanic man's hands, early 40s, holding two car keys — one old worn key on the left, one shiny new car key on the right. Real hands, real keys. Shallow depth of field, background slightly blurred showing a car dealership interior. Natural light. No people's faces visible, just the hands and keys. Realistic colors, no filters. Square 1:1. NO TEXT, NO WORDS, NO LOGOS.`
  },
  'oferta-especial': {
    nombre:    'Oferta Especial Hyundai — AutoAprobado Miami',
    hook:      '🔥 Hyundai 2026 — pagos desde $299/mes* en Miami',
    copies: [
      `🔥 OFERTA ESPECIAL — Hyundai 2026 con pagos desde $299/mes*\n\nDisponibles AHORA en Miami:\n🚗 Hyundai Venue 2026\n🚗 Hyundai Elantra 2026\n🚗 Hyundai Tucson 2026\n\n✅ Aprobamos aunque te hayan negado antes\n✅ Inicial accesible desde $500\n✅ Proceso 100% en español\n\nOferta por tiempo limitado — los carros se van rápido.\n\n👉 Llena el formulario en 30 segundos y reserva el tuyo hoy.\n\n${DISCLAIMER}`,
      `¿Sabías que puedes manejar un Hyundai 2026 NUEVO en Miami desde $299/mes*? 🚗\n\nTenemos Venue, Elantra, Tucson y Santa Fe 2026 — y aprobamos sin importar tu historial crediticio.\n\nYa ayudamos a cientos de familias hispanas en Miami a manejar carro nuevo.\n\n⚠️ El inventario es limitado y esta oferta no dura para siempre.\n\n👉 Reserva el tuyo ahora — verifica si calificas en 2 minutos, gratis.\n\n${DISCLAIMER}`,
      `Maneja un Hyundai NUEVO en 2026 sin arruinar tu presupuesto 💪\n\nLos mejores precios de Miami + la aprobación más fácil de la ciudad = tu carro nuevo esta semana.\n\nNo importa tu crédito. No importa si te negaron antes.\n\n🔥 Pagos desde $299/mes*\n⚡ Respuesta en menos de 24 horas\n🚗 Inventario disponible para entrega inmediata\n\n¿Para cuál Hyundai calificas tú?\n\n👉 Descúbrelo gratis en 2 minutos.\n\n${DISCLAIMER}`
    ],
    imagenPrompt: `Professional automotive photograph, Canon 5D, 35mm lens, f/8. A brand new white Hyundai Tucson SUV parked on clean asphalt outside a dealership in Miami on a sunny day. 3/4 front angle, eye level. Natural sunlight creating soft reflections on the hood and doors. Background: clear blue sky, one or two palm trees slightly blurred. No people. Realistic car proportions, accurate reflections, no CGI. Photo quality matching a real car dealership listing. Square 1:1. NO TEXT, NO WORDS, NO LOGOS, NO LICENSE PLATES.`
  }
};

// ── Helper Meta API ──────────────────────────────────
async function metaPost(endpoint, params) {
  try {
    const url = `${API}${endpoint}?access_token=${TOKEN}`;
    const { data } = await axios.post(url, params, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });
    return data;
  } catch (err) {
    const error = err.response?.data?.error;
    const msg   = error?.message || err.message;
    const code  = error?.code || err.response?.status;
    const sub   = error?.error_subcode ? ` (subcode ${error.error_subcode})` : '';
    const detail = error?.error_user_msg ? ` — ${error.error_user_msg}` : '';
    throw new Error(`Meta API error ${code}${sub}: ${msg}${detail}`);
  }
}

// ── Buscar video por segmento en carpeta videos/ ─────
const VIDEOS_DIR = path.join(__dirname, 'videos');
function buscarVideo(segmento) {
  if (!fs.existsSync(VIDEOS_DIR)) return null;
  const archivos = fs.readdirSync(VIDEOS_DIR)
    .filter(f => /\.(mp4|mov)$/i.test(f));
  const candidatos = archivos.filter(f => f.toLowerCase().startsWith(segmento.toLowerCase()));
  const generales  = archivos.filter(f => f.toLowerCase().startsWith('general'));
  const pool = candidatos.length > 0 ? candidatos : generales;
  if (!pool.length) return null;
  return path.join(VIDEOS_DIR, pool[Math.floor(Math.random() * pool.length)]);
}

// ── Buscar foto real en carpeta photos/ ──────────────
function buscarFotoReal(segmento) {
  if (!fs.existsSync(PHOTOS_DIR)) return null;
  const archivos = fs.readdirSync(PHOTOS_DIR)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  // Buscar por segmento exacto o numeradas (mal-credito-1.jpg, mal-credito-2.jpg)
  const candidatos = archivos.filter(f =>
    f.toLowerCase().startsWith(segmento.toLowerCase())
  );

  // Fallback: foto genérica (general-, dealer- o cliente-)
  const genericas = archivos.filter(f =>
    f.toLowerCase().startsWith('general') || f.toLowerCase().startsWith('dealer') || f.toLowerCase().startsWith('cliente')
  );

  const pool = candidatos.length > 0 ? candidatos : genericas;
  if (!pool.length) return null;

  // Elegir al azar si hay varias
  const elegida = pool[Math.floor(Math.random() * pool.length)];
  return path.join(PHOTOS_DIR, elegida);
}

// ── Subir foto local a Meta (sin modificarla) ────────
async function subirFotoLocal(filePath) {
  const { default: FormData } = await import('form-data');
  const form = new FormData();
  form.append('filename', fs.createReadStream(filePath));
  const url = `${API}/${AD_ACCOUNT}/adimages?access_token=${TOKEN}`;
  const { data } = await axios.post(url, form, {
    headers: form.getHeaders(),
    timeout: 30000
  });
  const hash = Object.values(data.images || {})[0]?.hash;
  if (!hash) throw new Error('No se obtuvo hash de imagen');
  console.log(`[Foto] ${path.basename(filePath)} subida — hash: ${hash}`);
  return hash;
}

// ── Preguntas de calificación por segmento ───────────
const FORM_PREGUNTAS = {
  'mal-credito':     { label: '¿Te han negado financiamiento antes?',        opciones: ['Sí, me han negado', 'No, es mi primera vez'] },
  'sin-credito':     { label: '¿Tienes trabajo o negocio propio?',           opciones: ['Sí, tengo trabajo estable', 'Tengo negocio propio', 'Estoy buscando trabajo'] },
  'urgente':         { label: '¿Cuándo necesitas el carro?',                 opciones: ['Esta semana', 'Este mes', 'Solo explorando opciones'] },
  'upgrade':         { label: '¿Cuánto tiempo llevas con tu carro actual?',  opciones: ['Menos de 2 años', '2 a 5 años', 'Más de 5 años'] },
  'oferta-especial': { label: '¿Cuánto tienes disponible de inicial?',       opciones: ['$0 - $500', '$500 - $2,000', 'Más de $2,000'] }
};

// ── Crear formulario nativo de Facebook Lead Ads ─────
async function crearFormulario(segmento, nombreCampana) {
  const pq = FORM_PREGUNTAS[segmento];
  const form = await metaPost(`/${PAGE_ID}/leadgen_forms`, {
    name: `AutoAprobado Miami — ${segmento} — ${new Date().toISOString().slice(0,10)}`,
    locale: 'es_ES',
    questions: [
      { type: 'FULL_NAME',     key: 'full_name'    },
      { type: 'PHONE',         key: 'phone_number' },
      {
        type: 'CUSTOM',
        key:  'pregunta_calificacion',
        label: pq.label,
        options: pq.opciones.map(v => ({ value: v }))
      }
    ],
    privacy_policy: { url: `${LANDING_URL}/#privacidad` },
    thank_you_page: {
      title:       '¡Gracias! Te llamamos pronto 🚗',
      body:        'Un asesor de AutoAprobado Miami te contactará en menos de 24 horas. ¡Prepárate para manejar!',
      button_type: 'NONE'
    },
  });
  console.log(`[Form] Formulario creado: ${form.id}`);
  return form.id;
}

// ── Generar imagen con DALL-E y subirla a Meta ───────
async function generarYSubirImagen(prompt, etiqueta) {
  console.log(`[Imagen] Generando ${etiqueta} con DALL-E 3...`);
  const res = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json'
  });
  const b64 = res.data[0].b64_json;
  const upload = await metaPost(`/${AD_ACCOUNT}/adimages`, { bytes: b64 });
  const hash = Object.values(upload.images || {})[0]?.hash;
  if (!hash) throw new Error('No se obtuvo hash de imagen');
  console.log(`[Imagen] ${etiqueta} subida — hash: ${hash}`);
  return hash;
}

// ── Subir video local a Meta ─────────────────────────
async function subirVideoLocal(videoPath) {
  const { default: FormData } = await import('form-data');
  const form = new FormData();
  form.append('source', fs.createReadStream(videoPath));
  const { data } = await axios.post(
    `${API}/${AD_ACCOUNT}/advideos?access_token=${TOKEN}`,
    form,
    { headers: form.getHeaders(), timeout: 120000 }
  );
  const videoId = data.id;
  if (!videoId) throw new Error('No se obtuvo ID de video');
  console.log(`[Video] ${path.basename(videoPath)} subido — id: ${videoId}`);
  return videoId;
}

// ── Crear campaña completa para un segmento ──────────
async function crearCampanaSegmento(segmento, presupuestoDiario = 20, videoPathParam = null) {
  const data = SEGMENTOS[segmento];
  if (!data) {
    console.error(`Segmento inválido: ${segmento}`);
    console.error(`Opciones: ${Object.keys(SEGMENTOS).join(' | ')}`);
    process.exit(1);
  }

  const presupuestoCentavos = presupuestoDiario * 100;
  const ahora = new Date();
  const fecha = ahora.toISOString().slice(0, 10) + 'T' +
    String(ahora.getUTCHours()).padStart(2, '0') + 'h' +
    String(ahora.getUTCMinutes()).padStart(2, '0');

  console.log(`\n🚗 AutoAprobado Miami — Campaña: ${data.nombre}`);
  console.log(`💵 Presupuesto: $${presupuestoDiario}/día`);
  console.log(`📋 Tipo: Lead Ads nativo (formulario dentro de Facebook)\n`);

  // 0. Crear formulario nativo de Lead Ads
  let formId = null;
  try {
    formId = await crearFormulario(segmento, data.nombre);
  } catch (e) {
    console.warn(`[Form] No se pudo crear formulario — usando landing: ${e.message}`);
  }

  // 1. Asset: video > foto real > DALL-E
  let videoId   = null;
  let imageHash = null;

  // Buscar video: primero el que pasó el bot, luego buscar en carpeta
  const videoPath = videoPathParam || buscarVideo(segmento);

  if (videoPath) {
    try {
      console.log(`[Video] Usando video real: ${path.basename(videoPath)}`);
      videoId = await subirVideoLocal(videoPath);
    } catch (e) {
      console.warn(`[Video] No se pudo subir — intentando foto: ${e.message}`);
    }
  }

  if (!videoId) {
    const fotoReal = buscarFotoReal(segmento);
    if (fotoReal) {
      try {
        console.log(`[Foto] Usando foto real: ${path.basename(fotoReal)}`);
        imageHash = await subirFotoLocal(fotoReal);
      } catch (e) {
        console.warn(`[Foto] No se pudo subir — intentando DALL-E: ${e.message}`);
      }
    }
  }

  if (!videoId && !imageHash && OPENAI_KEY) {
    try {
      console.log(`[DALL-E] No hay video ni foto para "${segmento}" — generando con IA...`);
      imageHash = await generarYSubirImagen(data.imagenPrompt, segmento);
    } catch (e) {
      console.warn(`[DALL-E] Falló — campaña sin imagen: ${e.message}`);
    }
  }

  // 2. Crear campaña CBO — objetivo conversiones (leads reales)
  const campana = await metaPost(`/${AD_ACCOUNT}/campaigns`, {
    name: `AutoAprobado | ${data.nombre} | ${fecha}`,
    objective: 'OUTCOME_LEADS',
    status: 'ACTIVE',
    special_ad_categories: ['FINANCIAL_PRODUCTS_SERVICES'],
    daily_budget: presupuestoCentavos,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
  });
  console.log(`✅ Campaña creada: ${campana.id}`);
  await new Promise(r => setTimeout(r, 3000));

  // Edad óptima por segmento — no desperdiciar en rango equivocado
  const EDAD_POR_SEGMENTO = {
    'sin-credito':     { min: 18, max: 40 }, // inmigrantes jóvenes, recién llegados
    'upgrade':         { min: 30, max: 65 }, // gente establecida con carro actual
    'mal-credito':     { min: 22, max: 55 },
    'urgente':         { min: 22, max: 55 },
    'oferta-especial': { min: 22, max: 60 },
  };
  const edad = EDAD_POR_SEGMENTO[segmento] || { min: 22, max: 55 };

  // Audiencia de exclusión — no gastar en quien ya convirtió
  // Excluye a personas que ya dispararon el evento Lead en el pixel
  const exclusiones = PIXEL_ID ? [{
    inclusions: { operator: 'or', rules: [{
      event_sources: [{ id: PIXEL_ID, type: 'pixel' }],
      retention_seconds: 5184000, // 60 días
      filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'Lead' }] }
    }]}
  }] : [];

  // Horario de ads — solo 7AM a 11PM ET (horas 7-23)
  // Meta usa minutos desde medianoche en zona UTC — convertir ET a UTC (+4 o +5 según DST)
  // Usamos franja amplia: 7AM-11PM = 420min a 1380min en zona del ad account
  const horasActivas = [];
  for (let dia = 0; dia <= 6; dia++) {
    horasActivas.push({ start_minute: 420, end_minute: 1380, days: [dia] });
  }

  // Targeting — Miami DMA + hispanohablantes + móvil
  // FINANCIAL_PRODUCTS_SERVICES no permite custom_locations con radio — usar DMA o ciudad
  const targeting = {
    age_min: edad.min,
    age_max: edad.max,
    geo_locations: {
      geo_markets: [{ key: '528' }], // Miami-Ft. Lauderdale-Hollywood DMA
      location_types: ['home', 'recent']
    },
    locales:          [27],
    device_platforms: ['mobile'],
    ...(exclusiones.length ? { excluded_custom_audiences: exclusiones } : {})
  };

  // Si hay formulario → Lead Ads nativo. Si no → website con pixel
  const esLeadAd = !!formId;

  const adsetBase = {
    campaign_id: campana.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: esLeadAd ? 'LEAD_GENERATION' : 'OFFSITE_CONVERSIONS',
    destination_type:  esLeadAd ? 'ON_AD'           : 'WEBSITE',
    promoted_object: esLeadAd
      ? { page_id: PAGE_ID }
      : { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
    // Frecuencia máxima: 3 veces por semana — evita fatiga y dinero perdido
    frequency_control_specs: [{
      event: 'IMPRESSIONS',
      interval_days: 7,
      max_frequency: 3
    }],
    // Horario: solo 7AM-11PM — no gastar de madrugada
    adset_schedule:   horasActivas,
    pacing_type:      ['standard'],
    targeting: {
      ...targeting,
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions:  ['feed', 'marketplace'],
      instagram_positions: ['stream'],
    },
    status: 'ACTIVE'
  };

  // CTAs por tipo de copy
  const CTAS = esLeadAd
    ? ['SIGN_UP', 'SIGN_UP', 'SIGN_UP']       // Lead Ads siempre SIGN_UP
    : ['APPLY_NOW', 'GET_QUOTE', 'LEARN_MORE']; // Website: CTAs variados

  // 3. Crear un adset + ad por cada copy (3 copies = 3 adsets para A/B/C test)
  const etiquetas = ['Emocional', 'Directo', 'Social'];
  const adsCreados = [];

  for (let i = 0; i < data.copies.length; i++) {
    try {
      await new Promise(r => setTimeout(r, 2000));

      const adset = await metaPost(`/${AD_ACCOUNT}/adsets`, {
        ...adsetBase,
        name: `AutoAprobado | ${segmento} | Copy-${etiquetas[i]}`
      });
      console.log(`✅ Adset ${etiquetas[i]}: ${adset.id}`);

      await new Promise(r => setTimeout(r, 1000));

      const landingUTM = `${LANDING_URL}?utm_source=facebook&utm_medium=cpc&utm_campaign=${segmento}&utm_content=${etiquetas[i].toLowerCase()}`;
      const cta = CTAS[i] || 'SIGN_UP';

      // Valor del CTA: formulario nativo o URL de landing
      const ctaValue = esLeadAd
        ? { lead_gen_form_id: formId }
        : { link: landingUTM };

      // Creative: video o imagen
      let objectStorySpec;
      if (videoId) {
        objectStorySpec = {
          page_id: PAGE_ID,
          video_data: {
            video_id: videoId,
            message: data.copies[i],
            title: data.hook,
            description: '✅ Verificación gratis — sin compromiso',
            call_to_action: { type: cta, value: ctaValue }
          }
        };
      } else {
        const linkData = {
          message: data.copies[i],
          name: data.hook,
          description: '✅ Verificación gratis — sin compromiso',
          call_to_action: { type: cta, value: ctaValue }
        };
        if (!esLeadAd) linkData.link = landingUTM;
        if (imageHash)  linkData.image_hash = imageHash;
        objectStorySpec = { page_id: PAGE_ID, link_data: linkData };
      }

      const creative = await metaPost(`/${AD_ACCOUNT}/adcreatives`, {
        name: `AutoAprobado | ${segmento} | Creative-${etiquetas[i]}`,
        object_story_spec: objectStorySpec,
      });

      const ad = await metaPost(`/${AD_ACCOUNT}/ads`, {
        name: `AutoAprobado | ${segmento} | Ad-${etiquetas[i]}`,
        adset_id: adset.id,
        creative: { creative_id: creative.id },
        status: 'ACTIVE'
      });

      // Obtener URL de preview del ad
      let previewUrl = null;
      try {
        await new Promise(r => setTimeout(r, 2000));
        const prev = await axios.get(`${API}/${ad.id}/previews`, {
          params: { ad_format: 'MOBILE_FEED_STANDARD', access_token: TOKEN },
          timeout: 10000
        });
        const iframe = prev.data?.data?.[0]?.body || '';
        const match  = iframe.match(/src="([^"]+)"/);
        if (match) previewUrl = match[1].replace(/&amp;/g, '&');
      } catch { /* preview opcional, no bloquea */ }

      adsCreados.push({ copy: etiquetas[i], adset_id: adset.id, ad_id: ad.id, previewUrl });
      console.log(`✅ Ad ${etiquetas[i]}: ${ad.id}`);

    } catch (e) {
      console.warn(`⚠️  Copy-${etiquetas[i]} falló: ${e.message}`);
    }
  }

  const tipoAsset = videoId   ? `🎬 Video real (${path.basename(videoPath || '')})` :
                    imageHash ? (buscarFotoReal(segmento) ? `📷 Foto real` : `🤖 DALL-E 3`) :
                                '⚠️  Sin imagen';

  console.log(`\n🎉 Campaña lista!`);
  console.log(`   Campaña ID : ${campana.id}`);
  console.log(`   Ads creados: ${adsCreados.length}/3`);
  console.log(`   Asset      : ${tipoAsset}`);
  console.log(`   Landing    : ${LANDING_URL}`);
  console.log(`\nRevisa en Meta Ads Manager → ${AD_ACCOUNT}\n`);

  return { campaign_id: campana.id, ads: adsCreados };
}

// ── Verificar credenciales antes de lanzar ───────────
async function preflight() {
  const faltantes = [];
  if (!TOKEN)      faltantes.push('META_ACCESS_TOKEN');
  if (!AD_ACCOUNT) faltantes.push('META_AD_ACCOUNT_ID');
  if (!PAGE_ID)    faltantes.push('META_PAGE_ID');

  if (faltantes.length > 0) {
    console.error(`❌ Faltan variables en .env: ${faltantes.join(', ')}`);
    process.exit(1);
  }

  try {
    const { data } = await axios.get(`${API}/me`, {
      params: { fields: 'id,name', access_token: TOKEN },
      timeout: 10000
    });
    console.log(`✅ Token válido — cuenta: ${data.name}`);
  } catch {
    console.error('❌ META_ACCESS_TOKEN inválido o expirado');
    process.exit(1);
  }
}

// ── Crear audiencia Lookalike desde leads del pixel ──────────────────
export async function crearLookalike() {
  if (!PIXEL_ID) {
    console.warn('[Lookalike] META_PIXEL_ID no configurado');
    return null;
  }

  const fecha = new Date().toISOString().slice(0, 10);

  // 1. Audiencia fuente: personas que dispararon evento Lead (tus convertidos)
  const fuente = await metaPost(`/${AD_ACCOUNT}/customaudiences`, {
    name: `AutoAprobado — Leads Convertidos — ${fecha}`,
    subtype: 'WEBSITE',
    retention_days: 180,
    rule: JSON.stringify({
      inclusions: { operator: 'or', rules: [{
        event_sources: [{ id: PIXEL_ID, type: 'pixel' }],
        retention_seconds: 15552000, // 180 días
        filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'Lead' }] }
      }]}
    })
  });
  console.log(`[Lookalike] Audiencia fuente: ${fuente.id}`);
  await new Promise(r => setTimeout(r, 3000));

  // 2. Lookalike 1% — el 1% de Miami más parecido a tus leads
  const lookalike = await metaPost(`/${AD_ACCOUNT}/customaudiences`, {
    name: `AutoAprobado — Lookalike 1% Miami — ${fecha}`,
    subtype: 'LOOKALIKE',
    origin_audience_id: fuente.id,
    lookalike_spec: JSON.stringify({
      type:     'similarity',
      ratio:    0.01,
      country:  'US',
      location: { geo_locations: { custom_locations: [{
        latitude: 25.7617, longitude: -80.1918, radius: 40, distance_unit: 'mile'
      }]}}
    })
  });
  console.log(`[Lookalike] Audiencia lookalike: ${lookalike.id}`);
  return { fuenteId: fuente.id, lookalikeId: lookalike.id };
}

// ── Campaña de retargeting — visitantes que no llenaron el formulario ──
export async function crearCampanaRetargeting(presupuestoDiario = 10) {
  if (!PIXEL_ID) {
    console.warn('[Retargeting] META_PIXEL_ID no configurado — saltando');
    return;
  }

  const ahora = new Date();
  const fecha = ahora.toISOString().slice(0, 10);

  console.log(`\n🎯 Creando campaña de retargeting — $${presupuestoDiario}/día`);

  // 1. Crear audiencia personalizada: visitantes del sitio últimos 30 días
  let audienciaId = null;
  try {
    const audiencia = await metaPost(`/${AD_ACCOUNT}/customaudiences`, {
      name: `AutoAprobado — Visitantes Web 30 días — ${fecha}`,
      subtype: 'WEBSITE',
      retention_days: 30,
      rule: JSON.stringify({
        inclusions: {
          operator: 'or',
          rules: [{
            event_sources: [{ id: PIXEL_ID, type: 'pixel' }],
            retention_seconds: 2592000, // 30 días
            filter: {
              operator: 'and',
              filters: [{
                field: 'event',
                operator: 'eq',
                value: 'PageView'
              }]
            }
          }]
        }
      })
    });
    audienciaId = audiencia.id;
    console.log(`✅ Audiencia retargeting creada: ${audienciaId}`);
    await new Promise(r => setTimeout(r, 3000));
  } catch (e) {
    console.warn(`[Retargeting] No se pudo crear audiencia: ${e.message}`);
    return;
  }

  // 2. Campaña
  const campana = await metaPost(`/${AD_ACCOUNT}/campaigns`, {
    name: `AutoAprobado | Retargeting Visitantes | ${fecha}`,
    objective: 'OUTCOME_LEADS',
    status: 'ACTIVE',
    special_ad_categories: ['FINANCIAL_PRODUCTS_SERVICES'],
    daily_budget: presupuestoDiario * 100,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
  });
  console.log(`✅ Campaña retargeting: ${campana.id}`);
  await new Promise(r => setTimeout(r, 3000));

  // 3. Adset con audiencia personalizada
  const adset = await metaPost(`/${AD_ACCOUNT}/adsets`, {
    campaign_id: campana.id,
    name: 'AutoAprobado | Retargeting | Visitantes 30d',
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    destination_type: 'WEBSITE',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: PIXEL_ID, custom_event_type: 'LEAD' },
    targeting: {
      age_min: 18,
      age_max: 65,
      geo_locations: {
        geo_markets: [{ key: '528' }],
        location_types: ['home', 'recent']
      },
      locales: [27],
      device_platforms: ['mobile'],
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions: ['feed', 'marketplace'],
      instagram_positions: ['stream'],
      custom_audiences: [{ id: audienciaId }]
    },
    status: 'ACTIVE'
  });
  console.log(`✅ Adset retargeting: ${adset.id}`);
  await new Promise(r => setTimeout(r, 2000));

  // 4. Copy específico para retargeting — ya te conocen, más directo
  const copies = [
    `👋 ¿Estuviste viendo opciones de financiamiento?\n\nSabemos que tomar esta decisión no es fácil.\n\nPero hay algo que queremos que sepas: en AutoAprobado Miami no te vamos a juzgar por tu crédito. Solo queremos ayudarte a manejar.\n\n✅ Proceso sin presión\n✅ Respuesta en menos de 24 horas\n✅ 100% en español\n\n👉 ¿Le damos una oportunidad? Llena el formulario — tarda 30 segundos.`,
    `⏰ Todavía estás a tiempo 🚗\n\nViste nuestras opciones pero no diste el paso. Entendemos — es una decisión grande.\n\nPero cada día sin carro en Miami es dinero que pierdes.\n\nHoy mismo podemos revisar tu situación y darte una respuesta honesta. Sin costo, sin compromiso.\n\n👉 Un solo formulario. 30 segundos. Te llamamos hoy.`
  ];

  const fotoReal = buscarFotoReal('general') || buscarFotoReal('mal-credito');
  let imageHash = null;
  if (fotoReal) {
    try { imageHash = await subirFotoLocal(fotoReal); } catch {}
  }

  for (let i = 0; i < copies.length; i++) {
    try {
      await new Promise(r => setTimeout(r, 1500));
      const landingUTM = `${LANDING_URL}?utm_source=facebook&utm_medium=cpc&utm_campaign=retargeting&utm_content=copy${i+1}`;
      const linkData = {
        message: copies[i],
        name: '¿Todavía buscas financiamiento para tu carro?',
        description: '✅ Aprobamos aunque te hayan negado antes — 100% en español',
        link: landingUTM,
        call_to_action: { type: 'APPLY_NOW', value: { link: landingUTM } }
      };
      if (imageHash) linkData.image_hash = imageHash;

      const creative = await metaPost(`/${AD_ACCOUNT}/adcreatives`, {
        name: `AutoAprobado | Retargeting | Creative-${i+1}`,
        object_story_spec: { page_id: PAGE_ID, link_data: linkData }
      });
      const ad = await metaPost(`/${AD_ACCOUNT}/ads`, {
        name: `AutoAprobado | Retargeting | Ad-${i+1}`,
        adset_id: adset.id,
        creative: { creative_id: creative.id },
        status: 'ACTIVE'
      });
      console.log(`✅ Ad retargeting ${i+1}: ${ad.id}`);
    } catch (e) {
      console.warn(`[Retargeting] Ad ${i+1} falló: ${e.message}`);
    }
  }

  console.log(`\n🎯 Campaña retargeting lista — ID: ${campana.id}`);
  return { campaign_id: campana.id };
}

// ── Exportar para uso desde bot-telegram.js ──────────
export { crearCampanaSegmento };

// ── Punto de entrada CLI ─────────────────────────────
const esDirecto = process.argv[1]?.replace(/\\/g, '/').endsWith('meta-ads-carros.js');

if (esDirecto) {
  const [,, segmento, presupuesto] = process.argv;

  if (!segmento) {
    console.log(`
AutoAprobado Miami — Crear campaña Meta Ads

Uso: node meta-ads-carros.js <segmento> [presupuesto]

Segmentos disponibles:
  mal-credito      → personas con mal historial
  sin-credito      → sin historial en USA
  urgente          → necesitan carro ya
  upgrade          → quieren cambiar su carro
  oferta-especial  → interesados en Hyundai 2026

Presupuesto: en dólares por día (default: 20)

Ejemplos:
  node meta-ads-carros.js mal-credito 20
  node meta-ads-carros.js oferta-especial 30
    `);
    process.exit(0);
  }

  await preflight();
  await crearCampanaSegmento(segmento, parseInt(presupuesto) || 20);
}
