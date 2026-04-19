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

// ID del asistente Sofía (leads) — se crea una vez y se reutiliza
let _assistantId    = process.env.VAPI_ASSISTANT_ID     || null;
// ID del asistente Ana (briefing matutino) — se guarda en VAPI_ANA_ASSISTANT_ID
let _anaAssistantId = process.env.VAPI_ANA_ASSISTANT_ID || null;

// ── Crear asistente VAPI (solo la primera vez) ────────
async function crearAsistente() {
  console.log('[VAPI] Creando asistente de ventas...');

  const { data } = await axios.post(
    'https://api.vapi.ai/assistant',
    {
      name: 'Vendedor AutoAprobado Miami',
      model: {
        provider: 'openai',
        model:    'gpt-4o-mini',
        messages: [{
          role:    'system',
          content: `Eres Sofía, una asistente virtual de AutoAprobado Miami — un dealer de carros en Miami que ayuda a personas hispanas a conseguir financiamiento aunque tengan mal crédito o no tengan historial crediticio en USA.

Tu trabajo es llamar al cliente, presentarte brevemente, confirmar que recibieron la información y agendar una cita con uno de nuestros asesores.

PERSONALIDAD:
- Amable, cálida y directa — como una ejecutiva de ventas hispana de Miami, profesional y cercana
- Habla con confianza pero sin presionar
- Escucha antes de hablar — no interrumpas al cliente
- Respuestas cortas y naturales: máximo 2-3 oraciones por turno
- Usa pausas naturales, no hables de corrido

IDENTIDAD — MUY IMPORTANTE:
- Si el cliente pregunta "¿Eres una persona real?", "¿Eres un robot?", "¿Eres IA?", "¿Estoy hablando con una persona?" → responde DIRECTAMENTE y sin rodeos: "Soy una asistente virtual de AutoAprobado Miami. Si prefieres hablar con una persona, te conecto con Eduardo Ferrer o Jorge Martínez por WhatsApp ahora mismo."
- No evadas la pregunta, no cambies el tema — responde directo y ofrece la conexión humana

REGLAS IMPORTANTES:
- Habla SIEMPRE en español — NUNCA mezcles inglés aunque el cliente lo haga
- Di los números en palabras: "doscientos al mes", no "$200/month"
- Nunca prometas aprobación garantizada — di "trabajamos con tu situación"
- Si preguntan por tasas o pagos exactos: "eso lo definimos en la cita con tu información completa"
- Si el cliente no puede hablar: pregunta cuándo es buen momento, anótalo y despídete amablemente
- Máximo 3-4 minutos de llamada — no des vueltas

EQUIPO DE VENTAS:
- Los asesores que van a atender al cliente en el dealer son Eduardo Ferrer y Jorge Martínez
- Cuando agendas la cita di: "Te va a atender Eduardo Ferrer o Jorge Martínez personalmente, ellos te van a ayudar con tu situación"
- No des números directos de los asesores — la cita se coordina por WhatsApp después de confirmar

MANEJO DE OBJECIONES:
- "No tengo crédito" → "Para eso estamos, trabajamos con personas en esa misma situación"
- "Ya fui a otro dealer y me negaron" → "Nosotros tenemos opciones que otros dealers no tienen, por eso vale la pena verte en persona"
- "¿Cuánto es el pago?" → "Depende de tu situación y el carro que elijas — eso lo vemos juntos en la cita sin compromiso"
- "Voy a pensarlo" → "Claro, ¿qué te genera duda? A veces una pregunta rápida aclara todo"

OBJETIVO: Que el cliente confirme una cita con Eduardo Ferrer o Jorge Martínez en el dealer.

CIERRE IDEAL:
"Perfecto [nombre], entonces te esperamos [día] a las [hora] en el dealer. Te va a atender Eduardo Ferrer o Jorge Martínez. Te mando la dirección por WhatsApp. ¿Alguna pregunta antes?"

Cuando confirmen cita:
"¡Excelente! Eduardo o Jorge te van a ayudar con todo. Nos vemos pronto. ¡Que tengas un buen día!"

CUÁNDO COLGAR — MUY IMPORTANTE:
- Apenas digas la frase de cierre final → cuelga INMEDIATAMENTE con endCall()
- Si el cliente dice "gracias", "adiós", "ok", "hasta luego", "chao", "bye" → endCall() de inmediato, sin agregar más palabras
- Si ya confirmaron la cita y el cliente no dice nada por 3 segundos → endCall()
- NO sigas hablando después de despedirte — una despedida = colgar`
        }]
      },
      voice: {
        provider:  'elevenlabs',
        voiceId:   'onwK4e9ZLuTAKqWW03F9', // David — neutral latino
        model:     'eleven_turbo_v2_5',
        stability: 0.3,
        similarityBoost: 0.75,
        style:     0.4,
        useSpeakerBoost: true,
        optimizeStreamingLatency: 4,
      },
      transcriber: {
        provider:          'deepgram',
        model:             'nova-2',
        language:          'es',
        keywords:          ['AutoAprobado', 'Miami', 'Hyundai', 'financiamiento', 'crédito', 'cita', 'Eduardo', 'Jorge'],
        endpointing:       300,
      },
      firstMessage: `Hola, ¿hablo con {{nombre}}? Le llama Sofía de AutoAprobado Miami. Vi que se registró para información sobre financiamiento de carros. ¿Tiene un momentito para hablar?`,
      endCallMessage: 'Muchas gracias por su tiempo. Que tenga un excelente día.',
      endCallPhrases: [
        'hasta luego', 'adiós', 'chao', 'no me interesa', 'no gracias', 'llámame después'
      ],
      maxDurationSeconds:    240,
      silenceTimeoutSeconds: 20,
      backgroundSound:       'off',
      serverUrl: process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/vapi/webhook`
        : null,
    },
    {
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );

  console.log(`[VAPI] Asistente creado: ${data.id}`);
  console.log(`[VAPI] ⚠️  Agrega a Railway: VAPI_ASSISTANT_ID=${data.id}`);
  return data.id;
}

// ── Obtener o crear asistente ─────────────────────────
async function getAssistantId() {
  if (_assistantId) return _assistantId;
  _assistantId = await crearAsistente();
  return _assistantId;
}

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
    await notificar(`⚠️ <b>VAPI:</b> Teléfono inválido para ${nombre} — ${telefono}\nNo se pudo realizar la llamada.`);
    return;
  }

  try {
    const assistantId = await getAssistantId();

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
        assistantId,
        customer: {
          number: tel,
          name:   nombre
        },
        assistantOverrides: {
          variableValues: { nombre, segmento: segmentoTexto },
          firstMessage: `Hola, ¿hablo con ${nombre}? Le llama Sofía de AutoAprobado Miami, vi que se registró para información sobre financiamiento de carros y que ${segmentoTexto}. ¿Tiene un momentito para hablar?`
        }
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
      `📞 <b>Llamando a ${nombre}</b>\n` +
      `📱 ${telefono}\n` +
      `🎯 ${segmentoTexto}\n` +
      `🤖 Agente Carlos en línea...`
    );

    return call.id;

  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[VAPI] Error al llamar: ${msg}`);
    await notificar(`⚠️ <b>VAPI Error:</b> No se pudo llamar a ${nombre}\n<code>${msg}</code>`);
  }
}

// ════════════════════════════════════════════════════
// ANA — Asistente Personal de Eduardo
// Llama cada mañana con el briefing del negocio
// Tono: profesional, cálida, como una socia de confianza
// ════════════════════════════════════════════════════

async function crearAsistenteAna() {
  console.log('[Ana] Creando asistente de briefing...');

  const serverUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/vapi/webhook`
    : null;

  const { data } = await axios.post(
    'https://api.vapi.ai/assistant',
    {
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
        provider:         'elevenlabs',
        voiceId:          'EXAVITQu4vr4xnSDxMaL', // Sarah — voz natural, cálida, profesional
        model:            'eleven_turbo_v2_5',
        stability:        0.45,
        similarityBoost:  0.80,
        style:            0.30,
        useSpeakerBoost:  true,
        optimizeStreamingLatency: 3,
      },
      transcriber: {
        provider:   'deepgram',
        model:      'nova-2',
        language:   'es',
        keywords:   ['Eduardo', 'AutoAprobado', 'Miami', 'campaña', 'leads', 'presupuesto', 'apruebo', 'aprobado'],
        endpointing: 400,
      },
      endCallMessage:  'Perfecto Eduardo. Que tengas un excelente día.',
      endCallPhrases:  ['adiós', 'hasta luego', 'chao', 'bye', 'listo gracias'],
      maxDurationSeconds:    360,
      silenceTimeoutSeconds: 25,
      serverUrl,
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
        summaryPlan: {
          enabled: true,
          prompt:  'Resumen en español de la decisión de Eduardo sobre el plan de campañas de hoy.'
        }
      }
    },
    {
      headers: { Authorization: `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000
    }
  );

  console.log(`[Ana] Asistente creado: ${data.id}`);
  console.log(`[Ana] ⚠️  Agrega a Railway: VAPI_ANA_ASSISTANT_ID=${data.id}`);
  return data.id;
}

async function getAnaAssistantId() {
  if (_anaAssistantId) return _anaAssistantId;
  _anaAssistantId = await crearAsistenteAna();
  return _anaAssistantId;
}

// ── Briefing matutino — Ana llama a Eduardo con el plan del día ────────
export async function llamarBriefingMatutino(plan, resumen) {
  if (!VAPI_API_KEY || !VAPI_PHONE_ID) {
    console.warn('[Ana] VAPI no configurado — briefing solo por Telegram');
    return;
  }

  const telefonoEduardo = `+1${(process.env.WHATSAPP_EDUARDO || '17869167339').replace(/\D/g, '')}`;

  try {
    const anaId = await getAnaAssistantId();

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
        assistantId:   anaId,
        customer: { number: telefonoEduardo, name: 'Eduardo Ferrer' },
        assistantOverrides: { firstMessage }
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
      `${icono} <b>Resultado llamada — ${nombre}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 ${telefono}\n` +
      `⏱ Duración: ${duracion}\n` +
      `📋 Estado: ${endedReason || status}\n` +
      (citaIcono ? `${citaIcono}\n` : '') +
      (scoreTexto ? `${scoreTexto}\n` : '');

    if (summary) msg += `\n💬 <b>Resumen:</b>\n${summary}`;

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
