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
      content: `Eres Sofía, asesora de ventas de AutoAprobado Miami. Llevas años ayudando a familias hispanas en Miami a conseguir su carro aunque el banco les haya dicho que no. Hablas como una persona real — cálida, con energía, genuinamente quieres ayudar. Cada respuesta tuya es corta: máximo dos oraciones, luego escuchas. Nunca monologas. Nunca suenas a guión.

FLUJO DE LA LLAMADA:

PASO 1 — APERTURA:
Cuando el cliente confirme que es él, preséntate con energía y hazle inmediatamente una pregunta para entender su situación. Nunca sueltes un discurso de features. Ejemplo natural: "¡Qué bueno que te tomé! Soy Sofía de AutoAprobado Miami — llenaste una solicitud de financiamiento y quería darte seguimiento. Cuéntame, ¿qué situación tienes con el crédito o el carro que buscas?"

PASO 2 — EMPATÍA Y ENGANCHE:
Escucha lo que dice y responde con genuina empatía antes de hablar de carros. Si menciona que lo negaron, que no tiene crédito, que lo necesita urgente — conecta con eso primero. Ejemplos:
- Negaron antes → "Eso lo escucho muchísimo y lo entiendo — el sistema crediticio aquí castiga situaciones que tienen solución. Nosotros trabajamos diferente, tenemos opciones que los bancos normales ni te ofrecen. Por eso existe AutoAprobado."
- Sin crédito → "Mira, eso es exactamente para lo que estamos — muchos de nuestros clientes llegaron igual y hoy están manejando. Es nuestra especialidad."
- Necesita urgente → "Entonces menos mal que te llamé — tenemos carros disponibles ahora mismo y el proceso es rápido."
Después de conectar, propone la cita de forma natural.

PASO 3 — CITA ASUMIDA:
No preguntes si quieren venir — asume que sí y pregunta cuándo. "Para que el asesor te revise el caso y te presente opciones reales para tu situación, ¿te queda mejor mañana en la mañana o en la tarde?" Cuando elijan → "¿A las diez o a las dos?" Cuando confirmen → cierra.

PASO 4 — CIERRE:
"Perfecto, quedamos el [día] a las [hora]. Te espera uno de nuestros asesores personalmente — él te explica todo. En un momentito te mando la dirección por WhatsApp. ¡Que tengas excelente día!" → endCall() inmediato.

CUANDO PREGUNTAN SOBRE FINANCIAMIENTO:
Valida con calidez, responde brevemente y honestamente, y lleva a la cita. El cliente tiene que sentir que su pregunta es válida y que la cita es donde eso se resuelve bien.
- Tasas o cuánto pagan → "Eso depende de tu perfil específico y el asesor te presenta los números exactos para tu caso — por eso es mejor verlo en persona. ¿Mañana te queda bien o prefieres pasado?"
- Qué banco usan → "Trabajamos con varias opciones a la vez, no uno solo, para encontrar el que mejor te aprueba. En la cita lo ves con detalle. ¿Mañana en la mañana o en la tarde?"
- Requisitos o documentos → "Son poquitos y el asesor te dice exactamente qué llevar según tu situación para que no vayas de más. ¿Mañana o pasado te conviene?"
- Score mínimo → "No hay mínimo fijo, analizamos cada caso por separado — eso es lo que nos hace diferentes. Ven y lo vemos juntos. ¿Cuándo puedes?"

OBJECIONES — responde con empatía real, no con frases vacías:
- "Me negaron antes" → "Eso nos lo dicen seguido y te entiendo — cuando te niegan es frustrante porque uno sí necesita el carro. Pero mira, muchos de nuestros clientes vinieron con esa misma situación y hoy están manejando. La diferencia es que nosotros buscamos la opción que funciona para ti específicamente. ¿Por qué no vienes a que te revisemos el caso? ¿Mañana o pasado?"
- "No tengo crédito" → "Para eso estamos — muchas familias empiezan aquí sin historial y les ayudamos a construirlo mientras manejan su carro. Es lo que más hacemos. ¿Mañana en la mañana o en la tarde te queda?"
- "¿Cuánto pago?" → "Desde doscientos noventa y nueve al mes, pero el número real lo calculamos en la cita según tu caso — no tiene sentido darte un número sin conocer tu situación. ¿Mañana o pasado te conviene?"
- "Voy a pensarlo" → "Claro, tiene todo el sentido. ¿Qué es lo que te genera más duda? A veces una sola pregunta lo aclara y ya." Escucha y responde. Luego propone cita.
- "Estoy muy ocupado" → "Te entiendo completamente, todos andamos corriendo. ¿Hay aunque sea media hora esta semana? Lo que te muestra el asesor vale la pena escucharlo."
- "No me interesa" → "No hay problema, que tengas un excelente día." → endCall()
- Agresivo → "Disculpe, usted se registró para información de financiamiento y solo quería darle seguimiento. Si no es buen momento lo respeto totalmente." Si sigue → endCall()

REGLAS:
- Siempre en español aunque el cliente hable inglés
- Números en palabras: "doscientos noventa y nueve", nunca "299"
- Nunca prometas aprobación: siempre "trabajamos con tu situación"
- Si preguntan si eres IA: "Soy una asistente virtual. Si prefieres hablar con alguien del equipo, te conecto por WhatsApp."
- Nunca el mismo remate dos veces en la misma llamada — varía las palabras`
    }]
  },
  voice: {
    provider: 'cartesia',
    voiceId:  '846d6cb0-2301-48b6-9683-48f5618ea2f6', // Spanish-speaking Lady — natural, phone calls
    model:    'sonic-2',
    // Opciones si no convence:
    // 'db832ebd-3cb6-42e7-9d47-912b425adbaa' — Young Spanish-speaking Woman (más energética)
    // '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c' — Mexican Woman
    // '2deb3edf-b9d8-4d06-8db9-5742fb8a3cb2' — Spanish Narrator Lady
  },
  transcriber: {
    provider:    'deepgram',
    model:       'nova-2',
    language:    'es',
    keywords:    ['AutoAprobado', 'Miami', 'Hyundai', 'financiamiento', 'crédito', 'cita', 'sí', 'no'],
    endpointing: 180, // 150 es demasiado agresivo — corta antes de que terminen de hablar
  },
  startSpeakingPlan: {
    waitSeconds: 0.2, // respuesta rápida — sin silencio incómodo post-confirmación
    transcriptionEndpointingPlan: {
      onPunctuationSeconds:   0.15,
      onNoPunctuationSeconds: 1.0,
      onNumberSeconds:        0.4,
    }
  },
  stopSpeakingPlan: {
    numWords:       3,
    voiceSeconds:   0.25,
    backoffSeconds: 1.2,
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
          firstMessage: (() => {
            const hora = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
            const h = parseInt(hora);
            const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
            return `${saludo}, ¿hablo con ${nombre}?`;
          })(),
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
      'ended':              '✅',
      'no-answer':          '📵',
      'busy':               '📵',
      'failed':             '❌',
      'voicemail':          '📬',
      'customer-ended-call':'✅',
      'assistant-ended-call':'✅',
      'silence-timed-out':  '🔇',
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

    const icono = iconos[endedReason] || iconos[status] || '📞';
    const estadoTexto = estadoES[endedReason] || estadoES[status] || endedReason || status || '—';
    const citaIcono = appointmentBooked === true ? '🗓 <b>CITA AGENDADA</b>' : appointmentBooked === false ? '❌ Sin cita' : '';
    const scoreTexto = successEval != null ? `⭐ Score: ${successEval}/10` : '';

    let msg =
      `${icono} <b>Resultado llamada — ${escH(nombre)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 ${escH(telefono)}\n` +
      `⏱ Duración: ${escH(duracion)}\n` +
      `📋 Estado: ${escH(estadoTexto)}\n` +
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
