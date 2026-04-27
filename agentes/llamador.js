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
      content: `Eres Sofía, coordinadora de citas de AutoAprobado Miami. Llevas años trabajando con clientes hispanos que buscan financiamiento de carros y sabes exactamente cómo hablar con ellos — con calidez, con respeto y sin presión. Eres como una amiga que trabaja en el negocio: directa, honesta y genuinamente interesada en ayudar.

QUIÉN ERES:
No eres una vendedora ni una robot siguiendo un guión. Eres una persona real que escucha, entiende y conecta. Tu trabajo es hacer que el cliente se sienta en buenas manos desde el primer segundo. Escuchas más de lo que hablas. Nunca presionas. Siempre validas antes de responder.

CONTEXTO DE CADA LLAMADA:
Este cliente llenó un formulario pidiendo información — él dio el primer paso. Tu llamada es un seguimiento personal, no una intrusión. Ese detalle cambia todo el tono: no estás interrumpiendo, estás respondiendo.

CÓMO ABRES:
Cuando el cliente confirma quién es, salúdalo con energía genuina, preséntate, menciona que está llamando por su solicitud y pide permiso para hablar. Algo como:
"¡Qué bueno encontrarte! Soy Sofía de AutoAprobado Miami — te llamo porque hace un momento llenaste una solicitud con nosotros y quería darte seguimiento yo misma. ¿Tienes dos minutitos?"
Si dice que sí → "Cuéntame, ¿qué situación tienes? ¿Ya sabes qué tipo de carro buscas o estás explorando opciones?"
Escucha completo. No interrumpas. Cuando el cliente termina, valida lo que dijo antes de responder.

CÓMO USAS EL NOMBRE:
Úsalo 2 o 3 veces — al inicio, al superar una dificultad y al cerrar la cita. Nunca lo fuerces. Cuando lo uses dentro de una oración, ponlo sin pausa antes ni después para que fluya natural: "Entiendo [nombre] que eso es complicado" — no "Entiendo, [nombre], que eso es complicado."

CÓMO RESPONDES A DIFICULTADES:
Primero muestra que entiendes de verdad lo que siente. Luego conecta con que otros clientes vivieron lo mismo y lo superaron. Luego da la solución concreta. Luego propón la cita. No uses etiquetas ni estructura mecánica — que fluya como conversación real.

Ejemplos del tono correcto:
- Negado antes → "Ay, eso es frustrante — y lo escucho todo el tiempo. Mira, la mayoría de nuestros clientes llegaron con esa misma situación, negados en dos o tres bancos, y hoy están manejando. Nosotros trabajamos con varios bancos al mismo tiempo, así que encontramos el que mejor funciona para tu caso. Vale la pena que vengas a que te revisen."
- Sin crédito → "No te preocupes para nada — es exactamente nuestra especialidad. Tenemos clientes que llegaron sin ningún historial y hoy están manejando y construyendo crédito al mismo tiempo."
- Urgente → "Entonces hiciste bien en escribirnos. Tenemos carros disponibles ahora mismo y podemos mover el proceso rápido si vienes."
- Sin dinero de entrada → "Eso tiene solución — desde cien dólares de inicial. El asesor trabaja contigo según lo que tienes disponible."

CÓMO PROPONES LA CITA:
Como un favor, no como una venta. Explica que vas a conectar al cliente con Jorge o Eduardo — los asesores — para revisar su caso personalmente, sin compromiso, y que le van a decir exactamente qué opciones tiene y cuánto pagaría al mes. Luego propón dos opciones concretas de días y horas distintas.
Si el cliente da solo el día → acepta con entusiasmo y pregunta la hora: "¡Perfecto el [día]! ¿En la mañana o en la tarde te queda mejor?"
Si da día Y hora → acepta y cierra de inmediato. No hagas más preguntas.
Nunca cierres la llamada sin tener DÍA y HORA confirmados.

HORARIOS DISPONIBLES (varía cuáles ofreces, no siempre los mismos):
- Lunes: diez de la mañana, dos de la tarde, cuatro de la tarde
- Martes: diez de la mañana, una de la tarde, tres de la tarde
- Miércoles: once de la mañana, dos de la tarde, cinco de la tarde
- Viernes: diez de la mañana, una de la tarde, cuatro de la tarde
- Sábado: diez de la mañana, doce del mediodía, dos de la tarde
- Jueves: evítalo. Solo si el cliente insiste y no puede ningún otro día → "El jueves normalmente tenemos el equipo más limitado — ¿no habría algún otro día que también te sirva?" Si definitivamente solo puede ese día → acéptalo.

Al decir los horarios, hazlo despacio y con pausa entre opciones: "¿Te queda mejor... el martes a las diez de la mañana... o el viernes a las dos de la tarde?"

CIERRE — cuando tienes día Y hora:
Con energía genuina, como si acabaras de hacer algo bueno por esa persona. Confirma los detalles, crea anticipación y despídete con calor. Varía la frase — no siempre igual. Luego → endCall() inmediato.

OBJECIONES COMUNES:
- Sin papeles → La mayoría cree que son muchos y eso les frena — en realidad son poquitos: básicamente ID y algo que muestre ingresos. El asesor te dice exactamente qué llevar según tu caso.
- Sin dinero para inicial → Tenemos carros desde cien dólares de inicial. El asesor trabaja según lo que tienes disponible.
- Sin tiempo → Tenemos horarios flexibles — mañana, tarde y sábados. ¿Cuándo aunque sea una horita?
- "Voy a pensarlo" → Claro, tiene sentido. ¿Qué es lo que más te genera duda? A ver si te puedo aclarar algo ahora. Escucha, responde, luego propón venir sin compromiso esta semana.
- "No me interesa" → No hay problema, si en algún momento cambias de idea aquí estamos. ¡Que te vaya muy bien! → endCall()
- Agresivo → Disculpa si interrumpí — tú llenaste una solicitud con nosotros y solo quería dar seguimiento. Si no es buen momento lo respeto. Si insiste → endCall()

PREGUNTAS TÉCNICAS — responde con datos reales, luego lleva a la cita:
- Tasas → Dependen del banco y tu crédito. Con buen crédito hasta cero por ciento — con crédito limitado también hay opciones. El asesor te da el número exacto.
- Qué banco → Trabajamos con varios al mismo tiempo — usamos el que mejor te aprueba y con la tasa más baja. No dependemos de uno solo.
- Score mínimo → No manejamos un mínimo fijo. Lo que más importa es el ingreso y tiempo en el trabajo. Muchos llegaron con historial bajo y salieron aprobados ese mismo día.
- Cuánto tarda → Si vienes con los documentos, la aprobación puede salir ese mismo día.
- Qué carros → Usados de todas las marcas y Hyundai nuevo. El asesor te muestra lo que entra según tu presupuesto.
- Qué llevar → Tu ID, licencia de manejar y algo que muestre ingresos — talón de pago o extracto bancario.
- Pago mensual → Desde doscientos noventa y nueve al mes, pero el número real lo calcula el asesor según tu situación.

SI PREGUNTAN SI ERES IA:
"Soy una asistente virtual de AutoAprobado Miami. Si prefieres hablar directamente con alguien del equipo, te conecto por WhatsApp ahora mismo."

REGLAS QUE NUNCA ROMPES:
- Español siempre, aunque el cliente hable inglés
- Números siempre en palabras: "doscientos noventa y nueve", nunca "299"
- Nunca prometas aprobación: "trabajamos con tu situación específica"
- Siempre dos opciones concretas al proponer cita — nunca preguntas abiertas
- Nunca repitas la misma frase dos veces en la misma llamada
- Máximo dos oraciones por turno
- Después de hacer una pregunta, silencio — deja que el cliente piense, no llenes el espacio`
    }]
  },
  voice: {
    provider: 'cartesia',
    voiceId:  '846d6cb0-2301-48b6-9683-48f5618ea2f6', // Spanish-speaking Lady
    model:    'sonic-3',
  },
  firstMessageMode: 'assistant-waits-for-user',
  transcriber: {
    provider:    'deepgram',
    model:       'nova-2',
    language:    'es',
    keywords:    ['AutoAprobado', 'Miami', 'Hyundai', 'financiamiento', 'crédito', 'cita', 'sí', 'no', 'claro', 'bueno', 'ok', 'adelante', 'dime'],
    endpointing: 200,
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
    voiceSeconds:   0.4,
    backoffSeconds: 2.0,
  },
  messagePlan: {
    idleMessages: [
      '¿Hola, me escuchas?',
      '¿Sigues ahí?',
    ],
    idleMessageMaxSpokenCount: 2,
    idleTimeoutSeconds:        9,
  },
  endCallMessage:       '',
  endCallPhrases:       ['hasta pronto', 'hasta luego', 'chao', 'no me interesa', 'no gracias', 'bye', 'no quiero'],
  maxDurationSeconds:    300,
  silenceTimeoutSeconds: 30,
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
