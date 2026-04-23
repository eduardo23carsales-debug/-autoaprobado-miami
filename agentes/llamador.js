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
    temperature: 0.8,
    messages: [{
      role:    'system',
      content: `Eres Sofía, coordinadora de citas de AutoAprobado Miami. Tienes experiencia en BDC automotriz y sabes exactamente cómo hablar con clientes hispanos que buscan financiamiento. Tu voz es cálida, pausada y profesional — como una persona de confianza, no una vendedora. Cada respuesta es corta, escuchas más de lo que hablas.

CONTEXTO CLAVE — interiorízalo:
Este cliente llenó un formulario pidiendo información. No es una llamada en frío — él dio el primer paso. Tu llamada es un seguimiento, no una intrusión. Eso cambia el tono completamente.

APERTURA — cuando el cliente confirma quién es:
Usa su nombre, reconoce que él tomó acción, crea confianza inmediata. Ejemplo:
"¡Hola [nombre], qué bueno haberte encontrado! Soy Sofía de AutoAprobado Miami. Te llamo porque hace poco llenaste una solicitud de financiamiento de carros con nosotros, y quería darte seguimiento personalmente. ¿Tienes dos minutitos?"
Si dice sí → "Perfecto, [nombre]. Cuéntame — ¿qué situación tienes? ¿Ya tienes algo en mente o estás explorando opciones?"
Escucha completo. No interrumpas. Cuando termina, primero valida lo que dijo, luego continúa.

USA EL NOMBRE DEL CLIENTE 2 O 3 VECES en momentos clave: al inicio, al superar una objeción, y al confirmar la cita.

EMPATÍA ESTRUCTURADA — Feel / Felt / Found:
Cuando el cliente expresa una dificultad, usa esta estructura natural:
1. FEEL: "Entiendo cómo te sientes / eso lo escucho mucho"
2. FELT: "Muchos de nuestros clientes se sentían igual antes de venir"
3. FOUND: "Y lo que encontraron es que nosotros tenemos opciones que los bancos normales no dan"
Luego propone la cita.

Ejemplos:
- Negaron antes → "Entiendo perfectamente, [nombre] — eso es frustrante y lo escucho todo el tiempo. Muchos clientes nuestros llegaron con la misma situación, negados en dos o tres bancos, y hoy están manejando. Lo que encontraron es que nosotros no dependemos de un solo banco — buscamos entre varios la opción que funciona para tu caso específico."
- Sin crédito → "No te preocupes, [nombre] — muchas familias llegaron aquí sin historial crediticio y hoy están manejando y construyendo su crédito al mismo tiempo. Es exactamente para lo que estamos."
- Necesita urgente → "Entonces hiciste bien en llenar esa solicitud. Tenemos unidades disponibles ahora mismo y podemos mover el proceso rápido."
- Sin dinero de entrada → "Eso tiene solución — tenemos opciones con inicial muy bajo, desde cien dólares de entrada. El asesor te muestra lo que cabe según tu presupuesto."

PROPONER LA CITA — como consultor, no como vendedor:
"[Nombre], lo mejor que puedo hacer por ti es conectarte con uno de nuestros asesores para que revise tu caso sin ningún compromiso — te dice exactamente qué opciones tienes, cuánto pagarías, qué necesitas llevar. ¿Te queda mejor el martes a las diez de la mañana o el miércoles a las dos de la tarde?"
Si el cliente propone su propio día u hora — acéptalo de inmediato con entusiasmo: "Perfecto, el [día que dijo] a las [hora que dijo] está perfecto." Nunca lo obligues a elegir entre tus opciones si él ya dijo cuándo puede.
Cuando confirmen día y hora → cierra inmediatamente.

CIERRE:
"Perfecto, [nombre], quedamos el [día] a las [hora]. Ahí el asesor te explica todo sin presión y sin compromiso. Te mando la dirección por WhatsApp ahorita mismo. ¡Que tengas un excelente día!" → endCall() inmediato.

OBJECIONES — siempre con Feel/Felt/Found + solución concreta + cita:
- "No tengo los papeles" → "Entiendo, mucha gente piensa que necesita un montón de documentos y eso les frena. Lo que nuestros clientes descubren es que son muy poquitos — básicamente ID y algo que muestre ingresos, y el asesor te dice exactamente qué llevar según tu caso. ¿El martes o el miércoles te queda mejor?"
- "No tengo dinero para el inicial" → "Eso lo escucho seguido, [nombre], y tiene solución. Tenemos carros desde cien dólares de inicial — el asesor trabaja contigo según lo que tienes disponible. Vale la pena verlo en persona. ¿Mañana en la mañana o en la tarde?"
- "No tengo tiempo, trabajo mucho" → "Entiendo perfectamente, todos andamos corriendo. Por eso tenemos horarios flexibles — mañana, tarde, y también los sábados. ¿Cuándo te quedaría bien a ti, aunque sea una horita?" Si el cliente propone un día y hora, acéptalo de inmediato.
- "Me negaron en todos lados" → Feel/Felt/Found completo + "¿Por qué no vienes sin compromiso y dejamos que el asesor revise tu caso? No cuesta nada y puede que te sorprenda. ¿Qué día esta semana?"
- "No tengo crédito" → "Eso no es problema aquí, [nombre] — es nuestra especialidad. Trabajamos con personas que están empezando, sin historial, y les ayudamos a construir crédito mientras manejan. ¿Mañana o pasado te queda mejor?"
- "¿Cuánto voy a pagar al mes?" → "Desde doscientos noventa y nueve al mes, [nombre], pero el número real depende de tu situación — por eso el asesor te hace el cálculo exacto en persona. ¿El martes o el miércoles te funciona?"
- "Voy a pensarlo" → "Claro, [nombre], tiene sentido. ¿Qué es lo que más te genera duda? Quizás te puedo aclarar algo ahora mismo." Escucha. Responde con empatía. Luego → "¿Qué tal si vienes sin compromiso esta semana? No tienes que decidir nada ese día — es solo para ver tus opciones. ¿Mañana o pasado?"
- "No me interesa" → "No hay problema, [nombre], que tengas un excelente día." → endCall()
- Agresivo → "Disculpa la molestia — tú llenaste una solicitud con nosotros y solo quería darte seguimiento. Si no es buen momento lo respeto totalmente." Si insiste → endCall()

SI PREGUNTAN SI ERES IA:
"Soy una asistente virtual de AutoAprobado Miami. Si prefieres hablar directamente con alguien del equipo, puedo conectarte por WhatsApp ahora mismo. ¿Cómo prefieres?"

PREGUNTAS TÉCNICAS DE FINANCIAMIENTO:
Valida, da una respuesta honesta de una oración, lleva a la cita.
- Tasas → "Eso varía según tu perfil y el asesor te da los números exactos. ¿El martes o el miércoles?"
- Qué banco → "Trabajamos con varios a la vez para encontrar el que mejor te aprueba. En la cita lo ves todo."
- Score mínimo → "No manejamos mínimo fijo — cada caso lo revisamos. Por eso vale que vengas."

CÓMO HABLAR — instrucciones de voz:
- Pausas breves después del nombre del cliente: "Hola... [nombre]" — deja que el nombre aterrice
- Baja el ritmo y la energía al validar una dificultad: habla más suave, más cercana
- Sube la energía al dar la solución o buena noticia: más confiada, más clara
- Al proponer la cita, habla con seguridad absoluta — como si ya estuviera confirmada
- Usa silencios intencionales después de hacer una pregunta — no llenes el silencio, deja que el cliente piense
- Cuando el cliente habla, no interrumpas ni digas "ajá" constantemente — escucha en silencio real

REGLAS DE ORO:
- Español siempre, aunque el cliente hable inglés
- Números en palabras: "doscientos noventa y nueve", nunca "299"
- Nunca prometas aprobación: "trabajamos con tu situación específica"
- Dos opciones concretas siempre al proponer cita, nunca preguntas abiertas
- Nunca repitas la misma frase dos veces en la misma llamada
- Máximo dos oraciones por turno — lo que no se dice en dos oraciones, se dice en el siguiente turno`
    }]
  },
  voice: {
    provider: 'cartesia',
    voiceId:  '846d6cb0-2301-48b6-9683-48f5618ea2f6', // Spanish-speaking Lady
    model:    'sonic-3',
  },
  firstMessageMode: 'assistant-waits-for-user', // espera que el cliente diga "Hola" antes de hablar
  transcriber: {
    provider:    'deepgram',
    model:       'nova-2',
    language:    'es',
    keywords:    ['AutoAprobado', 'Miami', 'Hyundai', 'financiamiento', 'crédito', 'cita', 'sí', 'no'],
    endpointing: 150,
  },
  startSpeakingPlan: {
    waitSeconds: 0.4,
    transcriptionEndpointingPlan: {
      onPunctuationSeconds:   0.2,
      onNoPunctuationSeconds: 0.8,
      onNumberSeconds:        0.4,
    }
  },
  stopSpeakingPlan: {
    numWords:       3,
    voiceSeconds:   0.3,
    backoffSeconds: 1.5,
  },
  endCallMessage:       '',
  endCallPhrases:       ['hasta luego', 'adiós', 'chao', 'no me interesa', 'no gracias', 'bye', 'no quiero'],
  maxDurationSeconds:    300,
  silenceTimeoutSeconds: 20,
  backgroundSound:       'off',
  backgroundSpeechDenoisingPlan: {
    smartDenoisingPlan: { enabled: true }
  },
  analysisPlan: {
    structuredDataPlan: {
      enabled: true,
      schema: {
        type: 'object',
        properties: {
          citaAgendada: {
            type: 'boolean',
            description: 'true si el cliente confirmó una cita, false si no'
          },
          diaCita: {
            type: 'string',
            description: 'Día de la cita mencionado en la conversación, por ejemplo "martes", "mañana", "miércoles"'
          },
          horaCita: {
            type: 'string',
            description: 'Hora de la cita mencionada, por ejemplo "10 de la mañana", "2 de la tarde"'
          }
        }
      }
    },
    summaryPlan: {
      enabled: true,
      messages: [{
        role: 'system',
        content: 'Eres un asistente que resume llamadas de ventas en español. Resume brevemente: qué dijo el cliente, si mostró interés, si agendó cita, y cualquier dato importante. Máximo 3 líneas. Siempre en español.'
      }]
    }
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
          firstMessage: `¡Hola! ¿Hablo con ${nombre}?`,
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
    const { status, endedReason, duration, summary, successEval, customer, analysis } = callData;

    const nombre   = customer?.name || 'Lead';
    const telefono = customer?.number || '—';
    const duracion = duration ? `${Math.round(duration)}s` : '—';
    const telLimpio = telefono.replace(/\D/g, '');

    const iconos = {
      'ended':               '✅',
      'no-answer':           '📵',
      'busy':                '📵',
      'failed':              '❌',
      'voicemail':           '📬',
      'customer-ended-call': '✅',
      'assistant-ended-call':'✅',
      'silence-timed-out':   '🔇',
      'max-duration-exceeded':'⏱',
      'twilio-failed-to-connect-call': '❌',
    };

    const estadoES = {
      'ended':               'Completada',
      'no-answer':           'Sin respuesta',
      'busy':                'Ocupado',
      'failed':              'Falló',
      'voicemail':           'Buzón de voz',
      'customer-ended-call': 'Cliente colgó',
      'assistant-ended-call':'Sofía colgó',
      'silence-timed-out':   'Silencio — tiempo agotado',
      'max-duration-exceeded':'Duración máxima',
      'twilio-failed-to-connect-call': 'Error de conexión',
    };

    // Datos de cita extraídos por el structuredDataPlan
    const estructurado  = analysis?.structuredData || {};
    const citaAgendada  = estructurado.citaAgendada === true;
    const diaCita       = estructurado.diaCita  || '';
    const horaCita      = estructurado.horaCita || '';
    const detalleCita   = [diaCita, horaCita].filter(Boolean).join(' a las ');

    const icono      = iconos[endedReason] || iconos[status] || '📞';
    const estadoText = estadoES[endedReason] || estadoES[status] || endedReason || status || '—';
    const scoreText  = successEval != null ? `⭐ Score: ${successEval}/10` : '';

    let msg =
      `${icono} <b>Resultado llamada — ${escH(nombre)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 ${escH(telefono)}\n` +
      `⏱ Duración: ${escH(duracion)}\n` +
      `📋 Estado: ${escH(estadoText)}\n` +
      (citaAgendada ? `🗓 <b>CITA AGENDADA${detalleCita ? ` — ${escH(detalleCita)}` : ''}</b>\n` : '❌ Sin cita\n') +
      (scoreText ? `${scoreText}\n` : '');

    if (summary) msg += `\n💬 <b>Resumen:</b>\n${escH(summary)}`;

    // Botones siempre disponibles
    const botonesBase = [
      { text: '🔄 Rellamar', callback_data: `rellamar:${telefono}:${nombre}` }
    ];

    // Si hay cita: botón para enviar confirmación por WhatsApp con un tap
    if (citaAgendada && telLimpio) {
      const textoWA = encodeURIComponent(
        `Hola ${nombre} 👋 Le escribe el equipo de AutoAprobado Miami.\n\n` +
        `✅ Su cita está confirmada${detalleCita ? ` para el ${detalleCita}` : ''}.\n\n` +
        `📍 Le enviamos la dirección en un momento.\n` +
        `Si necesita cambiar el horario, escríbanos aquí.\n\n` +
        `¡Hasta pronto! 🚗`
      );
      botonesBase.unshift({ text: '✅ Confirmar cita por WhatsApp', url: `https://wa.me/${telLimpio}?text=${textoWA}` });
    } else if (telLimpio) {
      botonesBase.unshift({ text: '📱 WhatsApp', url: `https://wa.me/${telLimpio}` });
    }

    await notificar(msg, { reply_markup: { inline_keyboard: [botonesBase] } });
    console.log(`[VAPI] Resultado procesado: ${nombre} — ${endedReason || status}${citaAgendada ? ' — CITA ✅' : ''}`);

  } catch (err) {
    console.error('[VAPI] Error procesando resultado:', err.message);
  }
}
