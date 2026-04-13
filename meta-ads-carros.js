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
dotenv.config();

const API          = 'https://graph.facebook.com/v25.0';
const TOKEN        = process.env.META_ACCESS_TOKEN?.trim();
const AD_ACCOUNT   = process.env.META_AD_ACCOUNT_ID?.trim();
const PAGE_ID      = process.env.META_PAGE_ID?.trim();
const PIXEL_ID     = process.env.META_PIXEL_ID?.trim();
const OPENAI_KEY   = process.env.OPENAI_API_KEY?.trim();
const LANDING_URL  = 'https://oferta.hyundaipromomiami.com';

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// ── Datos por segmento ───────────────────────────────
const SEGMENTOS = {
  'mal-credito': {
    nombre:    'Mal Crédito — AutoAprobado Miami',
    hook:      '¿Te negaron el préstamo por mal crédito?',
    copies: [
      `😔 ¿Te han negado financiamiento por mal crédito?\n\nEn AutoAprobado Miami trabajamos CON tu situación, no contra ella.\n\n✅ Sin mínimo de score requerido\n✅ Aprobación en 24 horas\n✅ Carros 2024-2026 disponibles\n\nMiles de familias hispanas en Miami ya tienen su carro. Tú puedes ser el próximo. 👇`,
      `⚠️ El banco te dijo NO. Nosotros decimos SÍ.\n\nEn AutoAprobado Miami especializamos en crédito difícil. No importa tu score, bancarrotas o deudas previas.\n\n🚗 Carros nuevos y usados\n💵 Inicial desde $500\n📱 Proceso 100% en español\n\nVe si calificas GRATIS 👇`,
      `Tu crédito no define tu futuro 🚗\n\nHemos ayudado a cientos de personas en Miami a conseguir su carro aunque el banco los rechazó.\n\nNo necesitas crédito perfecto. Solo necesitas hablar con nosotros.\n\n¿Cuándo fue la última vez que manejaste tranquilo? Empieza hoy. 👇`
    ],
    imagenPrompt: `Photorealistic Facebook ad image 1:1 for Hispanic market in Miami, Florida. Show a stressed Latino family outside a car dealership, a rejection letter in hand, worried expressions. Contrast with a hopeful look toward a new car. Urgent mood. Dark red and orange palette. Professional advertising quality. NO TEXT, NO WORDS, NO NUMBERS anywhere.`
  },
  'sin-credito': {
    nombre:    'Sin Historial — AutoAprobado Miami',
    hook:      '¿No tienes historial crediticio en USA?',
    copies: [
      `🆕 ¿Recién llegaste a USA o nunca tuviste crédito?\n\nNo necesitas historial crediticio para tener tu carro en Miami.\n\n✅ Aprobamos con ITIN o SSN\n✅ Si tienes trabajo o negocio, calificas\n✅ Proceso 100% en español\n\nEmpieza a construir tu crédito HOY con tu propio carro. 👇`,
      `Llegaste a USA con ganas de crecer 💪\n\nSabemos que empezar desde cero es difícil. Por eso en AutoAprobado Miami no pedimos historial.\n\n🚗 Solo necesitas: trabajo estable o negocio propio\n💵 Inicial accesible\n📱 Te guiamos en todo el proceso\n\n¿Cuándo empezamos? 👇`,
      `Sin crédito no significa sin carro 🚗\n\nMuchos de nuestros clientes compraron su primer carro en USA sin un solo punto de crédito.\n\nEl truco: trabajar con el dealer correcto. En AutoAprobado Miami sabemos cómo hacerlo.\n\nVe si calificas en 2 minutos. 👇`
    ],
    imagenPrompt: `Photorealistic Facebook ad image 1:1 for Hispanic market in Miami, Florida. Show a young Latino immigrant looking hopeful and determined, holding car keys for the first time, smiling confidently. New beginnings theme. Blue and white palette. Professional advertising quality. NO TEXT, NO WORDS, NO NUMBERS anywhere.`
  },
  'urgente': {
    nombre:    'Urgente — AutoAprobado Miami',
    hook:      '¿Necesitas un carro YA en Miami?',
    copies: [
      `🚨 ¿Perdiste tu carro o necesitas uno URGENTE?\n\nEn AutoAprobado Miami podemos tenerte manejando en 24-48 horas.\n\n⚡ Aprobación express\n🚗 Inventario disponible hoy\n📱 Proceso sin vueltas, 100% en español\n\nNo pierdas más trabajo ni oportunidades por falta de transporte. 👇`,
      `⏰ Cada día sin carro te cuesta dinero.\n\nEn Miami sin carro es casi imposible trabajar, llevar a los niños o manejar tu negocio.\n\nEn AutoAprobado Miami entendemos la urgencia:\n✅ Respuesta en menos de 24 horas\n✅ Carros disponibles para entrega inmediata\n✅ Financiamiento aunque te hayan negado antes\n\nActúa hoy. 👇`,
      `No esperes más 🚗⚡\n\nSi estás leyendo esto es porque necesitas un carro ahora mismo.\n\nLlamamos a decenas de bancos hasta encontrar quien te apruebe. Sin importar tu situación.\n\nMiles de personas en Miami ya manejan gracias a nosotros. Tú eres el siguiente. 👇`
    ],
    imagenPrompt: `Photorealistic Facebook ad image 1:1 for Hispanic market in Miami, Florida. Show a Latino person looking frustrated waiting for a bus or Uber in the Miami heat, while seeing others drive past comfortably. Strong urgency and contrast. Orange and red palette. Professional advertising quality. NO TEXT, NO WORDS, NO NUMBERS anywhere.`
  },
  'upgrade': {
    nombre:    'Upgrade de Carro — AutoAprobado Miami',
    hook:      '¿Listo para cambiar tu carro en Miami?',
    copies: [
      `🔄 ¿Tu carro ya no te da lo que necesitas?\n\nEn AutoAprobado Miami te ayudamos a hacer el cambio correcto.\n\n✅ Usamos tu carro actual como inicial\n✅ Más comodidad, más tecnología, menos problemas\n✅ Pagos que se adaptan a tu presupuesto\n\n¿Cuánto vale tu carro hoy? Descúbrelo gratis. 👇`,
      `Tu carro actual puede ser tu inicial 🚗➡️🚗\n\nMuchos clientes en Miami hacen el upgrade sin gastar un peso de su bolsillo.\n\nUsamos el valor de tu carro actual como down payment del nuevo.\n\n✅ Modelos 2024-2026 disponibles\n✅ Carros Hyundai desde $310/mes\n✅ Proceso rápido y en español\n\nHablemos hoy. 👇`,
      `¿Cuánto llevas con el mismo carro? 🤔\n\nSi tu carro ya tiene muchos miles encima, muchas reparaciones o simplemente ya no va con tu vida actual — es momento de hablar.\n\nEn AutoAprobado Miami hacemos el proceso de cambio fácil, rápido y sin sorpresas.\n\nVe cuánto vale tu carro en 2 minutos. 👇`
    ],
    imagenPrompt: `Photorealistic Facebook ad image 1:1 for Hispanic market in Miami, Florida. Show a split scene: on the left a worn-out old car, on the right a shiny new Hyundai 2026 in Miami. A confident Latino person choosing the new car. Aspirational mood. Blue and gold palette. Professional advertising quality. NO TEXT, NO WORDS, NO NUMBERS anywhere.`
  },
  'oferta-especial': {
    nombre:    'Oferta Especial Hyundai — AutoAprobado Miami',
    hook:      '🔥 Hyundai 2026 desde $310/mes en Miami',
    copies: [
      `🔥 OFERTA ESPECIAL — Hyundai 2026 desde $310/mes\n\nDisponibles ahora en Miami:\n🚗 Hyundai Venue 2026 — desde $310/mes\n🚗 Hyundai Elantra 2026 — desde $350/mes\n🚗 Hyundai Tucson 2026 — desde $420/mes\n\n✅ Aprobamos aunque te hayan negado antes\n✅ Inicial accesible\n✅ Proceso 100% en español\n\nOferta por tiempo limitado. 👇`,
      `¿Sabías que puedes manejar un Hyundai 2026 en Miami por menos de $400/mes? 🚗\n\nEn AutoAprobado Miami tenemos:\n• Venue 2026 — $310/mes\n• Elantra 2026 — $350/mes  \n• Tucson 2026 — $420/mes\n• Santa Fe 2026 — $480/mes\n\nSin importar tu historial crediticio.\n\nEl cupo es limitado. Reserva el tuyo hoy. 👇`,
      `Maneja un carro NUEVO en 2026 sin arruinarte 💪\n\nHyundai Doral tiene los mejores precios de Miami y nosotros tenemos la aprobación más fácil.\n\nJuntos hacemos que sea posible para ti, sin importar tu situación de crédito.\n\n🔥 Precios desde $310/mes\n⚡ Respuesta en 24 horas\n\n¿Para cuál calificas tú? 👇`
    ],
    imagenPrompt: `Photorealistic Facebook ad image 1:1 for Hispanic market in Miami, Florida. Show a beautiful brand new Hyundai 2026 SUV parked in front of a modern Miami dealership on a sunny day. Premium, aspirational mood. Show the car in detail — clean, shiny, impressive. Miami Blue sky background. NO TEXT, NO WORDS, NO NUMBERS anywhere.`
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
    throw new Error(`Meta API error ${code}: ${msg}`);
  }
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

// ── Crear campaña completa para un segmento ──────────
async function crearCampanaSegmento(segmento, presupuestoDiario = 20) {
  const data = SEGMENTOS[segmento];
  if (!data) {
    console.error(`Segmento inválido: ${segmento}`);
    console.error(`Opciones: ${Object.keys(SEGMENTOS).join(' | ')}`);
    process.exit(1);
  }

  const presupuestoCentavos = presupuestoDiario * 100;
  const fecha = new Date().toISOString().slice(0, 10);

  console.log(`\n🚗 AutoAprobado Miami — Campaña: ${data.nombre}`);
  console.log(`💵 Presupuesto: $${presupuestoDiario}/día`);
  console.log(`🌐 Landing: ${LANDING_URL}\n`);

  // 1. Generar imagen
  let imageHash = null;
  if (OPENAI_KEY) {
    try {
      imageHash = await generarYSubirImagen(data.imagenPrompt, segmento);
    } catch (e) {
      console.warn(`[Imagen] Falló — se usarán solo copies: ${e.message}`);
    }
  }

  // 2. Crear campaña CBO
  const campana = await metaPost(`/${AD_ACCOUNT}/campaigns`, {
    name: `AutoAprobado | ${data.nombre} | ${fecha}`,
    objective: 'OUTCOME_LEADS',
    status: 'ACTIVE',
    special_ad_categories: ['CREDIT'],   // requerido para anuncios de financiamiento
    daily_budget: presupuestoCentavos,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP'
  });
  console.log(`✅ Campaña creada: ${campana.id}`);
  await new Promise(r => setTimeout(r, 3000));

  // Targeting — Miami específico, hispanohablantes
  const targeting = {
    age_min: 21,
    age_max: 65,
    genders: [1, 2],
    geo_locations: {
      cities: [{ key: '2430536', radius: 40, distance_unit: 'mile' }] // Miami, FL
    },
    locales: [6], // Español
    targeting_automation: { advantage_audience: 1 }
  };

  const adsetBase = {
    campaign_id: campana.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'LEAD_GENERATION',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    dsa_beneficiary: 'AutoAprobado MiamiDoral',
    dsa_payor: 'AutoAprobado MiamiDoral',
    targeting,
    status: 'ACTIVE'
  };

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

      const linkData = {
        link: LANDING_URL,
        message: data.copies[i],
        name: data.hook,
        description: '✅ Verificación gratis — sin compromiso',
        call_to_action: { type: 'LEARN_MORE', value: { link: LANDING_URL } }
      };
      if (imageHash) linkData.image_hash = imageHash;

      const creative = await metaPost(`/${AD_ACCOUNT}/adcreatives`, {
        name: `AutoAprobado | ${segmento} | Creative-${etiquetas[i]}`,
        object_story_spec: { page_id: PAGE_ID, link_data: linkData }
      });

      const ad = await metaPost(`/${AD_ACCOUNT}/ads`, {
        name: `AutoAprobado | ${segmento} | Ad-${etiquetas[i]}`,
        adset_id: adset.id,
        creative: { creative_id: creative.id },
        status: 'ACTIVE'
      });

      adsCreados.push({ copy: etiquetas[i], adset_id: adset.id, ad_id: ad.id });
      console.log(`✅ Ad ${etiquetas[i]}: ${ad.id}`);

    } catch (e) {
      console.warn(`⚠️  Copy-${etiquetas[i]} falló: ${e.message}`);
    }
  }

  console.log(`\n🎉 Campaña lista!`);
  console.log(`   Campaña ID : ${campana.id}`);
  console.log(`   Ads creados: ${adsCreados.length}/3`);
  console.log(`   Imagen     : ${imageHash ? 'Generada con DALL-E 3' : 'Sin imagen (DALL-E falló)'}`);
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

// ── Punto de entrada ─────────────────────────────────
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
