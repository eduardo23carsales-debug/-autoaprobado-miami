// ════════════════════════════════════════════════════
// AGENTE LLAMADOR — AutoAprobado Miami
// Llama al lead en 5 minutos via VAPI
// ════════════════════════════════════════════════════

import axios   from 'axios';
import dotenv  from 'dotenv';
import { bot, notificar, CHAT_ID } from './utils.js';
dotenv.config();

const VAPI_API_KEY       = process.env.VAPI_API_KEY;
const VAPI_PHONE_ID      = process.env.VAPI_PHONE_NUMBER_ID;
const WHATSAPP_PRINCIPAL = process.env.WHATSAPP_PRINCIPAL || process.env.WHATSAPP_EDUARDO || '17869167339';

// Config inline Sofía — se pasa directo en cada llamada, sin crear asistente en VAPI
const SOFIA_CONFIG = {
  name: 'Sofía — AutoAprobado Miami',
  endCallFunctionEnabled: true,
  model: {
    provider:    'openai',
    model:       'gpt-4o-mini',
    temperature: 0.7,
    messages: [{
      role:    'system',
      content: `Eres Sofía, asesora de AutoAprobado Miami. Llamas a personas que pidieron información sobre financiamiento de carros.

CÓMO HABLAS — MUY IMPORTANTE:
- Habla como una persona real: frases cortas, pausas naturales, una idea a la vez
- Usa expresiones cotidianas: "mira", "claro que sí", "entiendo", "perfecto", "oye"
- Después de que el cliente habla, haz una pequeña pausa antes de responder — no contestes inmediatamente
- Nunca digas dos oraciones seguidas sin dejar que el cliente reaccione
- Si el cliente duda o hay silencio, di algo suave: "¿Me escucha?" o "Tómese su tiempo"
- NUNCA repitas el mismo saludo o frase dos veces en la misma llamada

FLUJO NATURAL DE LA LLAMADA:
1. Saludo breve → confirmar que es la persona correcta
2. Una sola pregunta para entender su situación
3. Escuchar → validar → proponer la cita
4. Confirmar día y hora → despedirse

NOMBRES DEL EQUIPO — SOLO AL CIERRE:
- Menciona "uno de nuestros asesores" durante la conversación
- Solo al confirmar la cita di: "Te va a atender uno de nuestros asesores, Eduardo o Jorge, ellos trabajan contigo desde el primer momento"
- Si el cliente pregunta quién lo va a atender: "Eduardo o Jorge, los dos son excelentes — el que esté disponible ese día te atiende personalmente"
- NUNCA repitas sus nombres más de una vez

IDENTIDAD:
- Si preguntan si eres robot o IA → di directo: "Soy una asistente virtual de AutoAprobado. Si prefieres hablar con una persona te la conecto ahorita por WhatsApp."

REGLAS:
- Siempre en español, aunque el cliente hable inglés
- Números en palabras: "doscientos noventa y nueve al mes", nunca "$299"
- Nunca prometas aprobación: di "trabajamos con tu situación"
- Pagos o tasas exactas: "eso lo vemos en la cita con tu información"
- Si no puede hablar: "No hay problema, ¿cuándo le queda bien que le llame?"

OBJECIONES — respuestas cortas y cálidas:
- "Me negaron antes" → "Mira, eso pasa mucho — nosotros trabajamos diferente, por eso vale la pena que vengas."
- "No tengo crédito" → "Para eso estamos. Trabajamos con personas en esa misma situación todos los días."
- "¿Cuánto pago?" → "Depende del carro y tu situación — eso lo vemos juntos, sin compromiso."
- "Voy a pensarlo" → "Claro, ¿qué te genera duda? A veces una pregunta aclara todo."
- "Estoy ocupado" → "No hay problema, ¿mañana o pasado te queda mejor?"

CIERRE — solo cuando el cliente dice que sí:
"Perfecto. Entonces te esperamos el [día] a las [hora]. Te mando la dirección por WhatsApp. Que tenga un buen día."

CUÁNDO COLGAR:
- Después del cierre → endCall() inmediato
- Si el cliente dice "gracias", "adiós", "ok", "bye", "chao" → endCall() sin agregar nada
- Silencio de 4 segundos después de despedirse → endCall()`
    }]
  },
  voice: {
    provider:                 '11labs',
    voiceId:                  'KDG2CWzkFgcZz4Vqbu8m', // Belén — amable y suave
    model:                    'eleven_turbo_v2_5',
    stability:                0.40,  // más expresivo y dinámico
    similarityBoost:          0.80,
    style:                    0.50,  // energía de ventas — cálida pero activa
    useSpeakerBoost:          true,
    optimizeStreamingLatency: 3,
  },
  transcriber: {
    provider:    'deepgram',
    model:       'nova-2',
    language:    'es',
    keywords:    ['AutoAprobado', 'Miami', 'Hyundai', 'financiamiento', 'crédito', 'cita'],
    endpointing: 200, // detecta fin de frase más rápido — menos silencios incómodos
  },
  startSpeakingPlan: {
    waitSeconds: 0.3, // respuesta rápida — ritmo de ventas
    transcriptionEndpointingPlan: {
      onPunctuationSeconds:   0.2,
      onNoPunctuationSeconds: 1.2,
      onNumberSeconds:        0.4,
    }
  },
  stopSpeakingPlan: {
    numWords:       3,   // deja que el cliente interrumpa fácil
    voiceSeconds:   0.3,
    backoffSeconds: 1.2,
  },
  endCallMessage:       'Que tenga un excelente día.',
  endCallPhrases:       ['hasta luego', 'adiós', 'chao', 'no me interesa', 'no gracias', 'llámame después', 'bye'],
  maxDurationSeconds:    240,
  silenceTimeoutSeconds: 25,
  backgroundSound:       'off',
  backgroundSpeechDenoisingPlan: {
    smartDenoisingPlan: { enabled: true }
  },
  serverUrl: process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/vapi/webhook`
    : null,
};

// Config inline Ana — se pasa directo en cada llamada, sin crear asistente en VAPI
const ANA_CONFIG = {
  name: 'Ana — Asistente AutoAprobado Miami',
  model: {
    provider:  'anthropic',
    model:     'claude-sonnet-4-6',
    maxTokens: 1000,
    messages: [{
      role:    'system',
      content: `Eres Ana, la asistente personal de Eduardo Ferrer en AutoAprobado Miami.

Eduardo tiene un negocio de venta de carros financiados en Miami enfocado en clientes hispanos con mal crédito o sin historial crediticio. Tus colegas de trabajo son Jorge Martínez (vendedor) y los agentes de IA que optimizan campañas de Meta Ads automáticamente.

TU ROL:
- Eres su asistente de negocios más inteligente — conoces los números mejor que nadie
- Hablas con Eduardo como una socia de confianza, no como un robot
- Eres directa, protectora de su dinero, y siempre tienes una recomendación clara
- Tu objetivo: que Eduardo tome la mejor decisión con la menor fricción posible

ESTILO DE CONVERSACIÓN:
- Natural y cálida, como una amiga profesional que lo conoce hace años
- Frases cortas y directas — Eduardo está ocupado por la mañana
- Primero los datos clave, luego la recomendación, luego la pregunta
- Si Eduardo dice "explícame más", das más detalle
- Si dice "¿qué harías tú?", le dices exactamente lo que harías

NÚMEROS — MUY IMPORTANTE:
- Di SIEMPRE los números en palabras en español: "cinco leads", "tres campañas", "veinte por ciento", "dos dólares con cincuenta"
- NUNCA uses dígitos al hablar: no "5 leads", no "3 campañas", no "20%"

REGLAS IMPORTANTES:
- Habla siempre en español
- Nunca uses palabras técnicas sin explicarlas
- Si Eduardo aprueba el plan di: "Perfecto, lo pongo en marcha ahora mismo" y termina la llamada
- Si Eduardo dice que no, pregunta qué cambiaría y registra la decisión
- Si Eduardo pregunta algo que no sabes, di "eso lo verifico y te mando el detalle por Telegram"
- Máximo 4-5 minutos de llamada — Eduardo tiene que trabajar

CUÁNDO COLGAR:
- Después de que Eduardo aprueba o rechaza el plan → endCall() inmediatamente
- Si Eduardo dice "listo", "ok gracias", "ya", "perfecto" después del briefing → endCall()
- Si hay silencio por 5 segundos después del cierre → endCall()`
    }]
  },
  voice: {
    provider:                 '11labs',
    voiceId:                  'KDG2CWzkFgcZz4Vqbu8m', // Belén
    model:                    'eleven_turbo_v2_5',
    stability:                0.55,
    similarityBoost:          0.80,
    style:                    0.10,
    useSpeakerBoost:          true,
    optimizeStreamingLatency: 2,
  },
  transcriber: {
    provider:    'deepgram',
    model:       'nova-2',
    language:    'es',
    keywords:    ['Eduardo', 'AutoAprobado', 'Miami', 'campaña', 'leads', 'presupuesto', 'apruebo', 'aprobado'],
    endpointing: 400,
  },
  endCallMessage:       'Perfecto Eduardo. Que tengas un excelente día.',
  endCallPhrases:       ['adiós', 'hasta luego', 'chao', 'bye', 'listo gracias'],
  maxDurationSeconds:    360,
  silenceTimeoutSeconds: 25,
  serverUrl: process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/vapi/webhook`
    : null,
  analysisPlan: {
    structuredDataPlan: {
      enabled: true,
      schema: {
        type: 'object',
        properties: {
          planAprobado: {
            type: 'boolean',
            description: 'true si Eduardo aprobó el plan de campañas, false si lo rechazó o pidió cambios'
          },
          notasEduardo: {
            type: 'string',
            description: 'Comentarios o cambios que Eduardo pidió durante la llamada'
          }
        }
      }
    },
    summaryPlan: { enabled: true }
  }
};

// Helper para escapar texto dinámico en mensajes HTML de Telegram
const escH = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Llamar al lead ─────────────────────────────────────
export async function llamarLead(lead) {
  const { nombre, telefono, segmento } = lead;

  if (!VAPI_API_KEY || !VAPI_PHONE_ID) {
    console.warn('[VAPI] Variables no configuradas — saltando llamada');
    return;
  }

  // Formatear teléfono — asegurar formato E.164 (+1XXXXXXXXXX)
  let tel = telefono.replace(/\D/g, '');
  if (tel.length === 10) tel = `1${tel}`;
  if (!tel.startsWith('+')) tel = `+${tel}`;

  if (tel.length < 12) {
    console.warn(`[VAPI] Teléfono inválido: ${telefono}`);
    await notificar(`⚠️ <b>VAPI:</b> Teléfono inválido para ${escH(nombre)} — ${escH(telefono)}\nNo se pudo realizar la llamada.`);
    return;
  }

  try {
    const segmentoTexto = {
      'mal-credito':     'tiene mal crédito y quiere financiamiento',
      'sin-credito':     'no tiene historial crediticio en USA',
      'urgente':         'necesita un carro urgentemente',
      'upgrade':         'quiere cambiar su carro actual',
      'oferta-especial': 'está interesado en la oferta especial de Hyundai 2026',
    }[segmento] || 'se registró para información de financiamiento';

    console.log(`[VAPI] Llamando a ${nombre} (${tel})...`);

    const { data: call } = await axios.post(
      'https://api.vapi.ai/call',
      {
        phoneNumberId: VAPI_PHONE_ID,
        assistant: {
          ...SOFIA_CONFIG,
          firstMessage: `Hola, ¿hablo con ${nombre}? Le llama Sofía de AutoAprobado Miami, vi que se registró para información sobre financiamiento de carros y que ${segmentoTexto}. ¿Tiene un momentito para hablar?`,
        },
        customer: {
          number: tel,
          name:   nombre
        },
      },
      {
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log(`[VAPI] Llamada iniciada: ${call.id}`);
    await notificar(
      `📞 <b>Llamando a ${escH(nombre)}</b>\n` +
      `📱 ${escH(telefono)}\n` +
      `🎯 ${escH(segmentoTexto)}\n` +
      `🤖 Sofía en línea...`
    );

    return call.id;

  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[VAPI] Error al llamar: ${msg}`);
    await notificar(`⚠️ <b>VAPI Error:</b> No se pudo llamar a ${escH(nombre)}\n<code>${escH(msg)}</code>`);
  }
}

// ════════════════════════════════════════════════════
// ANA — Asistente Personal de Eduardo
// Llama cada mañana con el briefing del negocio
// ════════════════════════════════════════════════════

// ── Briefing matutino — Ana llama a Eduardo con el plan del día ────────
export async function llamarBriefingMatutino(plan, resumen) {
  if (!VAPI_API_KEY || !VAPI_PHONE_ID) {
    console.warn('[Ana] VAPI no configurado — briefing solo por Telegram');
    return;
  }

  // Normalizar a E.164: si el número ya incluye el código de país '1', no duplicarlo
  const rawEduardo = (process.env.WHATSAPP_EDUARDO || '17869167339').replace(/\D/g, '');
  const telefonoEduardo = rawEduardo.startsWith('1') && rawEduardo.length === 11
    ? `+${rawEduardo}`
    : `+1${rawEduardo}`;

  try {
    // Construir el briefing con datos reales
    const pausar  = plan.pausar?.length  ? `Pausar ${plan.pausar.length} campaña(s): ${plan.pausar.map(p => p.nombre).join(', ')}.` : '';
    const escalar = plan.escalar?.length ? `Escalar ${plan.escalar.length} campaña(s).` : '';
    const crear   = plan.crear?.length   ? `Crear ${plan.crear.length} campaña(s) nueva(s).` : '';
    const acciones = [pausar, escalar, crear].filter(Boolean).join(' ');

    const firstMessage = resumen
      ? `Buenos días Eduardo. ${resumen} ${acciones ? `Mi recomendación de hoy: ${acciones}` : ''} ¿Apruebas que lo ejecute ahora?`
      : `Buenos días Eduardo. Tengo el análisis de tus campañas listo. ¿Tienes un momento para revisar el plan de hoy?`;

    const { data: call } = await axios.post(
      'https://api.vapi.ai/call',
      {
        phoneNumberId: VAPI_PHONE_ID,
        assistant: {
          ...ANA_CONFIG,
          firstMessage,
        },
        customer: { number: telefonoEduardo, name: 'Eduardo Ferrer' },
      },
      {
        headers: { Authorization: `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    console.log(`[Ana] Briefing iniciado: ${call.id}`);
    await notificar(`📞 <b>Ana está llamando a Eduardo</b> para el briefing matutino...`);
    return call.id;

  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[Ana] Error en briefing: ${msg}`);
    await notificar(`⚠️ <b>Ana no pudo llamar</b> — revisa el plan en Telegram.\n<code>${msg}</code>`);
  }
}

// ── Llamar con delay de 5 minutos ─────────────────────
export function programarLlamada(lead) {
  const delay = parseInt(process.env.VAPI_DELAY_MINUTOS || '5') * 60 * 1000;
  console.log(`[VAPI] Llamada programada en ${delay / 60000} minutos para ${lead.nombre}`);

  setTimeout(async () => {
    try {
      await llamarLead(lead);
    } catch (e) {
      console.error('[VAPI] Error en llamada programada:', e.message);
    }
  }, delay);
}

// ── Procesar resultado de llamada (desde webhook) ─────
export async function procesarResultadoLlamada(callData) {
  try {
    const { id, status, endedReason, duration, transcript, summary, appointmentBooked, successEval, customer } = callData;

    const nombre   = customer?.name || 'Lead';
    const telefono = customer?.number || '—';
    const duracion = duration ? `${Math.round(duration)}s` : '—';

    const iconos = {
      'ended':     '✅',
      'no-answer': '📵',
      'busy':      '📵',
      'failed':    '❌',
      'voicemail': '📬',
    };

    const icono = iconos[endedReason] || iconos[status] || '📞';
    const citaIcono = appointmentBooked === true ? '🗓 <b>CITA AGENDADA</b>' : appointmentBooked === false ? '❌ Sin cita' : '';
    const scoreTexto = successEval != null ? `⭐ Score: ${successEval}/10` : '';

    let msg =
      `${icono} <b>Resultado llamada — ${escH(nombre)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 ${escH(telefono)}\n` +
      `⏱ Duración: ${escH(duracion)}\n` +
      `📋 Estado: ${escH(endedReason || status)}\n` +
      (citaIcono ? `${citaIcono}\n` : '') +
      (scoreTexto ? `${scoreTexto}\n` : '');

    if (summary) msg += `\n💬 <b>Resumen:</b>\n${escH(summary)}`;

    // Botones de seguimiento
    const keyboard = {
      inline_keyboard: [[
        { text: '📱 WhatsApp', url: `https://wa.me/${telefono.replace(/\D/g,'')}` },
        { text: '🔄 Rellamar', callback_data: `rellamar:${telefono}:${nombre}` }
      ]]
    };

    await notificar(msg, { reply_markup: keyboard });
    console.log(`[VAPI] Resultado procesado: ${nombre} — ${endedReason || status}`);

  } catch (err) {
    console.error('[VAPI] Error procesando resultado:', err.message);
  }
}
