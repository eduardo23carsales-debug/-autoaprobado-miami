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
    imagenPrompt: `Documentary photograph, Canon 5D, 50mm lens, f/2.0. A single Hispanic man in his late 30s sitting at a desk inside a bright modern car dealership showroom in Miami. He is signing a document, looking down at the paper, slight smile. One salesperson's hand visible across the desk handing a pen. Real dealership background: glass walls, one or two cars on the showroom floor out of focus. Natural daylight from windows, no flash. Realistic skin tones, no dramatic shadows. Square 1:1 crop. NO TEXT, NO WORDS, NO LOGOS in the image.`
  },
  'sin-credito': {
    nombre:    'Sin Historial — AutoAprobado Miami',
    hook:      '¿No tienes historial crediticio en USA?',
    copies: [
      `🆕 ¿Recién llegaste a USA o nunca tuviste crédito?\n\nNo necesitas historial crediticio para tener tu carro en Miami.\n\n✅ Aprobamos con ITIN o SSN\n✅ Si tienes trabajo o negocio, calificas\n✅ Proceso 100% en español\n\nEmpieza a construir tu crédito HOY con tu propio carro. 👇`,
      `Llegaste a USA con ganas de crecer 💪\n\nSabemos que empezar desde cero es difícil. Por eso en AutoAprobado Miami no pedimos historial.\n\n🚗 Solo necesitas: trabajo estable o negocio propio\n💵 Inicial accesible\n📱 Te guiamos en todo el proceso\n\n¿Cuándo empezamos? 👇`,
      `Sin crédito no significa sin carro 🚗\n\nMuchos de nuestros clientes compraron su primer carro en USA sin un solo punto de crédito.\n\nEl truco: trabajar con el dealer correcto. En AutoAprobado Miami sabemos cómo hacerlo.\n\nVe si calificas en 2 minutos. 👇`
    ],
    imagenPrompt: `Documentary photograph, Canon 5D, 35mm lens. A single young Hispanic man, early 20s, standing beside a white compact sedan in a sunny parking lot in Miami, Florida. He holds car keys in one hand, looking at them with a natural expression. Wearing casual everyday clothes — jeans and a t-shirt. Background: real Miami parking lot, palm trees, blue sky, other cars parked. Harsh midday sunlight, natural shadows. No posing, looks like a candid moment. Realistic colors. Square 1:1 crop. NO TEXT, NO WORDS, NO LOGOS.`
  },
  'urgente': {
    nombre:    'Urgente — AutoAprobado Miami',
    hook:      '¿Necesitas un carro YA en Miami?',
    copies: [
      `🚨 ¿Perdiste tu carro o necesitas uno URGENTE?\n\nEn AutoAprobado Miami podemos tenerte manejando en 24-48 horas.\n\n⚡ Aprobación express\n🚗 Inventario disponible hoy\n📱 Proceso sin vueltas, 100% en español\n\nNo pierdas más trabajo ni oportunidades por falta de transporte. 👇`,
      `⏰ Cada día sin carro te cuesta dinero.\n\nEn Miami sin carro es casi imposible trabajar, llevar a los niños o manejar tu negocio.\n\nEn AutoAprobado Miami entendemos la urgencia:\n✅ Respuesta en menos de 24 horas\n✅ Carros disponibles para entrega inmediata\n✅ Financiamiento aunque te hayan negado antes\n\nActúa hoy. 👇`,
      `No esperes más 🚗⚡\n\nSi estás leyendo esto es porque necesitas un carro ahora mismo.\n\nLlamamos a decenas de bancos hasta encontrar quien te apruebe. Sin importar tu situación.\n\nMiles de personas en Miami ya manejan gracias a nosotros. Tú eres el siguiente. 👇`
    ],
    imagenPrompt: `Documentary photograph, Canon 5D, 35mm lens, f/2.8. A single Hispanic woman in her 30s sitting in the driver's seat of a car, hands on the steering wheel, looking forward through the windshield with a calm confident expression. Shot from outside the car through the driver's window, slightly low angle. Miami street visible through the windshield — palm trees, buildings. Natural daylight. Realistic interior: car dashboard, steering wheel, seatbelt on. No exaggerated expression, real moment. Square 1:1. NO TEXT, NO WORDS, NO LOGOS.`
  },
  'upgrade': {
    nombre:    'Upgrade de Carro — AutoAprobado Miami',
    hook:      '¿Listo para cambiar tu carro en Miami?',
    copies: [
      `🔄 ¿Tu carro ya no te da lo que necesitas?\n\nEn AutoAprobado Miami te ayudamos a hacer el cambio correcto.\n\n✅ Usamos tu carro actual como inicial\n✅ Más comodidad, más tecnología, menos problemas\n✅ Pagos que se adaptan a tu presupuesto\n\n¿Cuánto vale tu carro hoy? Descúbrelo gratis. 👇`,
      `Tu carro actual puede ser tu inicial 🚗➡️🚗\n\nMuchos clientes en Miami hacen el upgrade sin gastar un peso de su bolsillo.\n\nUsamos el valor de tu carro actual como down payment del nuevo.\n\n✅ Modelos 2024-2026 disponibles\n✅ Carros Hyundai desde $310/mes\n✅ Proceso rápido y en español\n\nHablemos hoy. 👇`,
      `¿Cuánto llevas con el mismo carro? 🤔\n\nSi tu carro ya tiene muchos miles encima, muchas reparaciones o simplemente ya no va con tu vida actual — es momento de hablar.\n\nEn AutoAprobado Miami hacemos el proceso de cambio fácil, rápido y sin sorpresas.\n\nVe cuánto vale tu carro en 2 minutos. 👇`
    ],
    imagenPrompt: `Documentary photograph, Canon 5D, 50mm lens. Close-up of a single Hispanic man's hands, early 40s, holding two car keys — one old worn key on the left, one shiny new car key on the right. Real hands, real keys. Shallow depth of field, background slightly blurred showing a car dealership interior. Natural light. No people's faces visible, just the hands and keys. Realistic colors, no filters. Square 1:1. NO TEXT, NO WORDS, NO LOGOS.`
  },
  'oferta-especial': {
    nombre:    'Oferta Especial Hyundai — AutoAprobado Miami',
    hook:      '🔥 Hyundai 2026 desde $310/mes en Miami',
    copies: [
      `🔥 OFERTA ESPECIAL — Hyundai 2026 desde $310/mes\n\nDisponibles ahora en Miami:\n🚗 Hyundai Venue 2026 — desde $310/mes\n🚗 Hyundai Elantra 2026 — desde $350/mes\n🚗 Hyundai Tucson 2026 — desde $420/mes\n\n✅ Aprobamos aunque te hayan negado antes\n✅ Inicial accesible\n✅ Proceso 100% en español\n\nOferta por tiempo limitado. 👇`,
      `¿Sabías que puedes manejar un Hyundai 2026 en Miami por menos de $400/mes? 🚗\n\nEn AutoAprobado Miami tenemos:\n• Venue 2026 — $310/mes\n• Elantra 2026 — $350/mes  \n• Tucson 2026 — $420/mes\n• Santa Fe 2026 — $480/mes\n\nSin importar tu historial crediticio.\n\nEl cupo es limitado. Reserva el tuyo hoy. 👇`,
      `Maneja un carro NUEVO en 2026 sin arruinarte 💪\n\nHyundai Doral tiene los mejores precios de Miami y nosotros tenemos la aprobación más fácil.\n\nJuntos hacemos que sea posible para ti, sin importar tu situación de crédito.\n\n🔥 Precios desde $310/mes\n⚡ Respuesta en 24 horas\n\n¿Para cuál calificas tú? 👇`
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
  console.log(`🌐 Landing: ${LANDING_URL}\n`);

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

  // Targeting — solo Miami (40 millas cubre Miami-Dade + Broward + Palm Beach)
  // Categorías especiales: sin restricción por edad/género, solo geo permitido
  const targeting = {
    age_min: 18,
    age_max: 65,
    geo_locations: {
      custom_locations: [{
        latitude: 25.7617,
        longitude: -80.1918,
        radius: 40,
        distance_unit: 'mile'
      }]
    }
  };

  const adsetBase = {
    campaign_id: campana.id,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    destination_type: 'WEBSITE',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: {
      pixel_id: PIXEL_ID,
      custom_event_type: 'LEAD'
    },
    targeting: {
      ...targeting,
      // Placements: Facebook Feed + Marketplace + Instagram Feed
      // Marketplace es clave para carros — la gente busca carros ahí activamente
      publisher_platforms: ['facebook', 'instagram'],
      facebook_positions:  ['feed', 'marketplace'],
      instagram_positions: ['stream']
    },
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

      // Creative: video_data si hay video, link_data si hay foto/imagen
      let objectStorySpec;
      if (videoId) {
        objectStorySpec = {
          page_id: PAGE_ID,
          video_data: {
            video_id: videoId,
            message: data.copies[i],
            title: data.hook,
            description: '✅ Verificación gratis — sin compromiso',
            call_to_action: { type: 'LEARN_MORE', value: { link: LANDING_URL } }
          }
        };
      } else {
        const linkData = {
          link: LANDING_URL,
          message: data.copies[i],
          name: data.hook,
          description: '✅ Verificación gratis — sin compromiso',
          call_to_action: { type: 'LEARN_MORE', value: { link: LANDING_URL } }
        };
        if (imageHash) linkData.image_hash = imageHash;
        objectStorySpec = { page_id: PAGE_ID, link_data: linkData };
      }

      const creative = await metaPost(`/${AD_ACCOUNT}/adcreatives`, {
        name: `AutoAprobado | ${segmento} | Creative-${etiquetas[i]}`,
        object_story_spec: objectStorySpec
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
