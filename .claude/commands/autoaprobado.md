# AutoAprobado Miami — Skill de Contexto Completo

Eres un experto en el sistema AutoAprobado Miami. Cada vez que se invoque este skill, carga todo el contexto siguiente antes de responder.

---

## NEGOCIO

- **Marca:** AutoAprobado Miami
- **Objetivo:** Captar leads de hispanos en Miami que necesitan financiamiento de carro (mal crédito, sin crédito, urgente)
- **Cierre:** Manual — leads van a WhatsApp de Eduardo Ferrer (+17869167339) o Jorge Martínez (+17865809908) via round-robin
- **URL producción:** https://oferta.hyundaipromomiami.com
- **Deploy:** Railway — `git push` despliega automáticamente
- **Repo:** https://github.com/eduardo23carsales-debug/-autoaprobado-miami
- **Colores:** Azul oscuro #1a237e + Naranja #ff6600 + Blanco
- **Idioma:** Todo en español

---

## ARQUITECTURA DE ARCHIVOS

```
server.js                  ← Express + webhooks Meta + Telegram + crons
bot-telegram.js            ← Bot Telegram: comandos, botones inline, menú
meta-ads-carros.js         ← Creador de campañas Meta Ads
monitor-ads.js             ← Reporte de métricas
public/index.html          ← Landing page (HTML+CSS+JS vanilla, todo inline)
agentes/
  analista.js              ← 8 AM ET diario, Claude Sonnet, genera plan JSON
  ejecutor.js              ← Ejecuta plan aprobado por Eduardo
  supervisor.js            ← Cada 4h, pausa si gasta sin leads, escala máx 20%
  llamador.js              ← VAPI agente Sofía, horario 9AM-8PM ET
  plan-store.js            ← Persiste plan en disco (os.tmpdir()), TTL 24h
  leads-store.js           ← Registra leads y cierres, tasa de conversión
  utils.js                 ← Helpers Meta API compartidos
photos/                    ← 15 fotos reales Hyundai para ads
crear-proyecto.js          ← Generador CLI de proyectos nuevos para agencia
PLAN.md                    ← Estado del proyecto, pendientes, arquitectura
AGENCIA-SETUP.md           ← Manual onboarding + bugs documentados
INFRAESTRUCTURA.md         ← Visión multi-proyecto + roadmap agencia
```

---

## VARIABLES DE ENTORNO (Railway)

| Variable | Valor / Descripción |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot |
| `TELEGRAM_CHAT_ID` | Canal de leads |
| `META_ACCESS_TOKEN` | Token System User Meta |
| `META_AD_ACCOUNT_ID` | act_2128062444705705 |
| `META_PAGE_ID` | 1036158852917396 |
| `META_PIXEL_ID` | ID del pixel |
| `META_WEBHOOK_TOKEN` | autoaprobado2024 |
| `WHATSAPP_EDUARDO` | 17869167339 |
| `WHATSAPP_JORGE` | 17865809908 |
| `ANTHROPIC_API_KEY` | Para Agente Analista (Claude Sonnet) |
| `OPENAI_API_KEY` | Para DALL-E fallback |
| `PRESUPUESTO_MAX_DIA` | Límite diario para Analista |
| `LIMITE_ESCALAR_SOLO` | Máximo que Supervisor sube solo |
| `LIMITE_GASTO_SIN_LEAD` | Pausa automática si gasta sin leads |
| `RAILWAY_PUBLIC_DOMAIN` | Automático en Railway |
| `VAPI_API_KEY` | Token VAPI |
| `VAPI_PUBLIC_KEY` | Clave pública VAPI |
| `VAPI_PHONE_NUMBER_ID` | ID número VAPI (+17862043226) |
| `VAPI_ASSISTANT_ID` | c3fef418-2ae3-456e-b0e6-c943701929fc |

---

## FLUJO DE UN LEAD

1. Cliente llena formulario en landing → `server.js` recibe POST
2. `scoreLead()` califica: 🔥 Caliente / 🟡 Tibio / 🔵 Frío
3. `registrarLead()` guarda en `leads-store.js`
4. `enviarEventoCAPI()` envía evento Lead a Meta server-side (SHA256 hash)
5. Notificación a Telegram con score + botones: ✅ Vendido / 📵 No contestó / 💬 WhatsApp
6. Si hora entre 9AM-8PM ET → `programarLlamada()` llama en 5 min con VAPI
7. Resultado de llamada llega por webhook → resumen en Telegram con cita y score

---

## AGENTES AUTÓNOMOS

### Analista (8 AM ET diario)
- Lee métricas de Meta Ads (últimos 7 días)
- Lee tasa de cierre real de `leads-store.js`
- Analiza con **Claude Sonnet** (claude-sonnet-4-6)
- Genera plan JSON: pausar / escalar / crear campañas
- Envía a Telegram con botones ✅ Aprobar / ❌ Ignorar
- Plan persiste en disco via `plan-store.js` (TTL 24h)

### Supervisor (cada 4 horas)
- Si gasta `LIMITE_GASTO_SIN_LEAD` sin leads → pausa campaña
- Si CPL < $5 con leads → escala máximo **20%** (nunca más)
- Notifica a Telegram cada acción

### Ejecutor
- Solo corre cuando Eduardo aprueba el plan del Analista
- Ejecuta pausa / escala / creación de campañas via Meta API

### Llamador VAPI (agente Sofía)
- Voz: **ElevenLabs Belen**, modelo Eleven_turbo_v2_5
- Transcriber: **Deepgram Nova-2**, idioma español
- Horario: **9AM a 8PM ET** — fuera de horario solo Telegram
- Se identifica como asistente virtual si le preguntan
- Cuelga inmediatamente después de despedirse
- Webhook results → Telegram con resumen, cita agendada, score

---

## BOT TELEGRAM — COMANDOS

| Comando | Función |
|---|---|
| `/nueva segmento presupuesto` | Crea campaña Meta Ads |
| `/reporte` | Métricas del día |
| `/ventas` | Total leads, cerrados, tasa de cierre |
| `/cerrado <tel>` | Marca lead como vendido |
| Botón ✅ Vendido | Marca cerrado desde notificación |
| Botón 📵 No contestó | Marca no_contesto |
| Botón ✅ Aprobar plan | Ejecuta plan del Analista |

---

## META ADS — REGLAS IMPORTANTES

- **Categoría:** FINANCIAL_PRODUCTS_SERVICES — cumplimiento estricto
- **Disclaimer obligatorio:** `*Pagos desde $299/mes. Sujeto a aprobación de crédito, plazo, inicial y tasa aplicable.`
- **Prohibido:** precios específicos por modelo, lenguaje discriminatorio de crédito
- **Placements:** Solo Facebook Feed + Marketplace
- **Advantage+ Creative:** activado
- **UTM:** todos los links tienen parámetros UTM
- **CAPI:** evento Lead enviado server-side con teléfono y nombre hasheados (SHA256)

---

## BUGS CONOCIDOS — NO REPETIR

- `button_type` en leadgen_forms debe ser `'NONE'` no `'NO_BUTTON'`
- `conversion_domain` no va dentro de `promoted_object`
- `standard_enhancements` está deprecado — no usar
- `context_card` en leadgen_forms causa "unknown error" — no usar
- Siempre importar `axios` explícitamente en server.js
- Usar `await import()` dinámico para `@anthropic-ai/sdk` desde subdirectorios
- VAPI: `assistantId` debe coincidir con el de Railway (`VAPI_ASSISTANT_ID`)

---

## ESTADO VAPI (abril 2026)

- Asistente: **Vendedor AutoAprobado Miami** (Sofía)
- ID: `c3fef418-2ae3-456e-b0e6-c943701929fc`
- Voz: ElevenLabs Belen, Eleven_turbo_v2_5
- Structured Outputs: Call Summary, Appointment Booked, Success Eval Pass/Fail, Success Eval Numeric Scale
- Número inbound: +17862043226
- **Para reactivar llamadas salientes:** descomentar `programarLlamada` en server.js

---

## VISIÓN AGENCIA

Eduardo construye una agencia que vende sistemas de captación de leads a negocios locales.
- **Modelo A:** $1,500–$3,000 setup único
- **Modelo B:** $500–$1,500/mes + % de ads
- Cada cliente recibe: landing + Meta Ads + Agentes IA + reportes Telegram
- `crear-proyecto.js` genera proyectos nuevos desde CLI
- **Próximo:** landing web de onboarding para clientes nuevos (15-20 min desde navegador)
