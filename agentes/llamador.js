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

// ID del asistente VAPI — se crea una vez y se reutiliza
// Se guarda en variable de entorno VAPI_ASSISTANT_ID después de la primera creación
let _assistantId = process.env.VAPI_ASSISTANT_ID || null;

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
          content: `Eres Carlos, un asesor de ventas de AutoAprobado Miami — un dealer de carros en Miami que ayuda a personas hispanas a conseguir financiamiento aunque tengan mal crédito o no tengan historial crediticio en USA.

Tu trabajo es llamar al cliente, presentarte brevemente, confirmar su interés y agendar una cita en el dealer.

PERSONALIDAD:
- Amable, cálido, natural — como un vendedor hispano de Miami
- Habla con confianza pero sin presionar
- Empático con la situación del cliente
- Directo y breve — respuestas cortas, máximo 2-3 oraciones

REGLAS IMPORTANTES:
- Habla SIEMPRE en español 100% — NUNCA mezcles inglés
- TODOS los números y precios en español (doscientos, trescientos)
- Nunca prometas aprobación garantizada — di "trabajamos con tu situación"
- Si preguntan por tasas o pagos exactos — "eso lo vemos en la cita con tu información"
- Si el cliente no puede hablar — pregunta cuándo es buen momento, agéndalo y despídete
- Máximo 3-4 minutos de llamada

OBJETIVO: Que el cliente confirme que quiere una cita en el dealer.

CIERRE IDEAL:
"Perfecto [nombre], te agendamos para [día] a las [hora]. Te mando la dirección por WhatsApp. ¿Alguna pregunta?"

Cuando confirmen cita: "¡Excelente! Nos vemos pronto. Que tengas buen día."`
        }]
      },
      voice: {
        provider:        '11labs',
        voiceId:         'TX3LPaxmHKxFdv7VOQHJ', // Roberto — voz masculina natural en español
        model:           'eleven_multilingual_v2',
        language:        'es',
        stability:       0.5,
        similarityBoost: 0.75,
      },
      transcriber: {
        provider: 'deepgram',
        model:    'nova-3',
        language: 'es',
      },
      firstMessage: `Hola, ¿hablo con {{nombre}}? Le llamo de AutoAprobado Miami. Vi que se registró para información sobre financiamiento de carros. ¿Tiene un momentito para hablar?`,
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
          firstMessage: `Hola, ¿hablo con ${nombre}? Le llamo de AutoAprobado Miami, vi que se registró para información sobre financiamiento de carros y que ${segmentoTexto}. ¿Tiene un momentito para hablar?`
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
    const { id, status, endedReason, duration, transcript, summary, customer } = callData;

    const nombre   = customer?.name || 'Lead';
    const telefono = customer?.number || '—';
    const duracion = duration ? `${Math.round(duration)}s` : '—';

    const iconos = {
      'ended':           '✅',
      'no-answer':       '📵',
      'busy':            '📵',
      'failed':          '❌',
      'voicemail':       '📬',
    };

    const icono = iconos[endedReason] || iconos[status] || '📞';

    let msg =
      `${icono} <b>Resultado llamada — ${nombre}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 ${telefono}\n` +
      `⏱ Duración: ${duracion}\n` +
      `📋 Estado: ${endedReason || status}\n`;

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
