# PLAN — AutoAprobado Miami + Infraestructura Agencia
> Archivo vivo. Actualizar cada sesión. Última actualización: 2026-04-18

---

## CONTEXTO DEL NEGOCIO

Ayudar a personas en Miami a conseguir financiamiento de carro sin importar su situación crediticia.
Captamos leads que van a WhatsApp (Eduardo o Jorge) para cierre manual.

**Marca:** AutoAprobado Miami  
**Colores:** Azul oscuro #1a237e + Naranja #ff6600 + Blanco  
**Idioma:** Español  
**Mercado:** Miami — hispanos con crédito malo, sin crédito, o que necesitan carro urgente  
**URL producción:** https://oferta.hyundaipromomiami.com  
**Repo:** https://github.com/eduardo23carsales-debug/-autoaprobado-miami  

---

## VISIÓN — AGENCIA DE BOTS

Eduardo construye una agencia que vende sistemas de captación de leads automatizados a negocios locales.
Cada cliente recibe: landing page + Meta Ads + Agentes IA + reportes a Telegram.
Eduardo solo supervisa — los agentes trabajan solos.

**Modelo A — Venta única:** $1,500-$3,000 setup  
**Modelo B — Mensualidad:** $500-$1,500/mes + % de ads  

---

## ESTADO ACTUAL — Completado al 2026-04-16

### ✅ Base del sistema
- Landing page en producción — https://oferta.hyundaipromomiami.com
- Bot Telegram con menú de botones interactivos
- Leads llegan a Telegram en tiempo real con nombre, teléfono y segmento
- WhatsApp round-robin entre Eduardo y Jorge
- Deploy automático en Railway con git push

### ✅ Meta Ads
- Creación de campañas desde Telegram (/nueva segmento presupuesto)
- 3 copies por campaña (A/B/C test automático)
- Fotos reales de Hyundai (15 fotos en photos/)
- Fallback DALL-E si no hay fotos
- Advantage+ Creative activado
- UTM parameters en landing URLs
- Solo Facebook Feed + Marketplace
- Webhook Meta configurado (leadgen suscrito)
- Script subir-fotos-videos.bat para nuevos assets

### ✅ 3 Agentes Autónomos
- **Analista** — 8 AM ET diario, analiza 7 días con Claude Haiku, genera plan con botones ✅/❌
- **Supervisor** — cada 4 horas, auto-pausa si gasta sin leads, auto-escala si CPL < $5
- **Ejecutor** — ejecuta el plan aprobado por Eduardo

### ✅ Generador de proyectos
- `crear-proyecto.js` — genera proyecto completo desde CLI
- Genera landing personalizada con Claude Sonnet
- Genera copies Meta Ads con Claude Haiku
- Copia todos los archivos base listos para Railway
- **Pendiente:** convertir en landing web bonita (no CMD)

---

## PENDIENTE — PRÓXIMAS SESIONES

### 🔥 Prioridad 1 — Datos reales (esta semana)
- [ ] Dejar campañas correr 3-5 días
- [ ] Primer lead real cerrado en venta

### 🔥 Prioridad 2 — Landing de Onboarding Web (próxima sesión)
Página web bonita y profesional donde Eduardo llena un formulario paso a paso:
- Datos del negocio (nombre, tipo, ciudad, servicios, segmentos, colores, WhatsApp)
- El sistema genera todo solo: landing con Claude, copies Meta Ads, archivos Railway
- Guía la configuración de Meta Ads paso a paso con verificación automática
- **Objetivo:** cliente nuevo listo en 15-20 minutos desde el navegador, sin CMD ni conocimiento de Meta
- **Valor:** esto es lo que vale $2,000-$3,000 por cliente

### ✅ Prioridad 3 — VAPI + Agente Vendedor por Voz (completado 2026-04-18)
- [x] VAPI llama al lead automáticamente en 5 minutos después de que llena el formulario
- [x] Habla en español, sabe el nombre y segmento del lead antes de llamar
- [x] Califica al cliente, responde preguntas básicas, agenda cita
- [x] Agente Carlos — prompt enriquecido con manejo de objeciones y equipo de ventas
- [x] Equipo de ventas: Eduardo Ferrer y Jorge Martínez mencionados por nombre
- [x] Voz: ElevenLabs David con modelo Turbo v2.5 — natural en español
- [x] Transcriber: Deepgram en español
- [x] Structured Outputs configurados en VAPI:
  - Call Summary (resumen en español)
  - Appointment Booked (boolean)
  - Success Evaluation Pass/Fail (boolean)
  - Success Evaluation Numeric Scale (1-10)
- [x] Scorecard configurado: Cita agendada 50pts + Pass/Fail 30pts + Escala 20pts
- [x] Webhook VAPI activo — resultados llegan a Telegram con resumen y botones
- [ ] Pendiente: cuando llega VAPI_ASSISTANT_ID en logs de Railway, guardarlo como variable de entorno
- [ ] Pendiente: si no contesta, reintentar en 30 minutos (no implementado aún)

### Prioridad 4 — Reactivación de Base de Datos (después de VAPI)
- [ ] Estructura CSV de clientes: nombre, teléfono, correo, carro actual, año, pago mensual, descuento disponible, último contacto
- [ ] Agente Clasificador — analiza la base y prioriza quién llamar primero (upgrade listo, pagos al día, 3+ años con el carro)
- [ ] Agente que llama con VAPI — personalizado con nombre y carro específico del cliente
- [ ] Script de llamada: "Hola [nombre], tienes el [carro] [año]. Hoy podemos bajarte $50/mes con el [modelo nuevo]"
- [ ] Agente Agendador — propone horario, confirma cita, la registra
- [ ] Reporte a Telegram: "Cita agendada: [nombre], [día] [hora], interesado en [carro]"
- [ ] Base de datos vacía lista con estructura correcta para cuando Eduardo la tenga

### Prioridad 5 — Stripe + Monetización
- [ ] Integrar Stripe para cobros automáticos
- [ ] Landing del Bot de Opciones (vender señales/acceso)
- [ ] Agente Contador — reporte diario de ingresos y gastos

### Pendiente técnico menor
- [ ] Formulario nativo Lead Ads — Meta API error 1 desconocido (no bloqueante)
- [ ] Reemplazar testimonios placeholder con clientes reales

---

## BUGS DOCUMENTADOS (no repetir)

Ver **AGENCIA-SETUP.md** para lista completa de errores y soluciones.

Resumen rápido:
- `button_type` en leadgen_forms debe ser `'NONE'` no `'NO_BUTTON'`
- `conversion_domain` no va dentro de `promoted_object`
- `standard_enhancements` está deprecado en Meta Ads API
- `context_card` en leadgen_forms causa "unknown error" — no usar
- Siempre importar `axios` en server.js
- Usar `await import()` dinámico para `@anthropic-ai/sdk` desde subdirectorios

---

## ARQUITECTURA TÉCNICA

```
public/index.html          ← Landing (HTML+CSS+JS inline, vanilla)
server.js                  ← Express + webhooks Meta + webhook Telegram + crons
bot-telegram.js            ← Comandos + botones inline + menú
meta-ads-carros.js         ← Creador de campañas Meta Ads
monitor-ads.js             ← Reporte de métricas
agentes/
  ├── analista.js          ← 8 AM ET, Claude Haiku, plan JSON
  ├── ejecutor.js          ← Ejecuta plan aprobado
  ├── supervisor.js        ← Cada 4h, reglas automáticas
  └── utils.js             ← Helpers Meta API compartidos
photos/                    ← 15 fotos reales Hyundai
videos/                    ← Videos (vacío, listo para agregar)
crear-proyecto.js          ← Generador CLI de proyectos nuevos
AGENCIA-SETUP.md           ← Manual de onboarding + errores documentados
INFRAESTRUCTURA.md         ← Visión completa multi-proyecto + roadmap
```

---

## VARIABLES DE ENTORNO (Railway)

| Variable | Descripción |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot |
| `TELEGRAM_CHAT_ID` | Canal donde llegan los leads |
| `META_ACCESS_TOKEN` | Token del System User de Meta |
| `META_AD_ACCOUNT_ID` | act_2128062444705705 |
| `META_PAGE_ID` | 1036158852917396 |
| `META_PIXEL_ID` | ID del pixel |
| `META_WEBHOOK_TOKEN` | autoaprobado2024 |
| `WHATSAPP_EDUARDO` | 17869167339 |
| `WHATSAPP_JORGE` | 17865809908 |
| `ANTHROPIC_API_KEY` | Para Agente Analista |
| `OPENAI_API_KEY` | Para DALL-E |
| `PRESUPUESTO_MAX_DIA` | Límite diario Analista |
| `LIMITE_ESCALAR_SOLO` | Máximo que Supervisor sube solo |
| `LIMITE_GASTO_SIN_LEAD` | Pausa automática si gasta esto sin leads |
| `RAILWAY_PUBLIC_DOMAIN` | Automático en Railway |
