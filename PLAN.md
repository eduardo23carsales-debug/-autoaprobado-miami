# PLAN — Landing Page AutoAprobado Miami
> Archivo vivo. Actualizar cada sesión. Última actualización: 2026-04-12

---

## CONTEXTO DEL NEGOCIO

Ayudar a personas en Miami a conseguir financiamiento de carro sin importar su situación crediticia.
Captamos leads que van a WhatsApp (Eduardo o Jorge) para cierre manual.

**Marca elegida:** AutoAprobado Miami  
**Colores:** Azul oscuro #1a237e (confianza) + Naranja #ff6600 (urgencia) + Blanco  
**Idioma:** Español  
**Mercado:** Miami — hispanos con crédito malo, sin crédito, o que necesitan carro urgente

---

## ARQUITECTURA DEL PROYECTO

```
Pagina para pagina y venta de autos/
├── PLAN.md               ← este archivo (memoria viva)
├── package.json          ← dependencias Node.js
├── server.js             ← Express: sirve landing + recibe leads + notifica
├── .env.example          ← variables de entorno necesarias
├── .env                  ← (NO subir a git) variables reales
└── public/
    └── index.html        ← Landing completa (HTML + CSS + JS inline)
```

---

## FLUJO DE UN LEAD

```
Usuario llega (desde Meta Ads)
    ↓
Landing → elige su situación (dinámico, sin recargar página)
    ↓
Llena formulario adaptado a su situación
    ↓
POST /api/lead → server.js
    ↓
┌─────────────────────────────────┐
│  Telegram: notificación al canal│  ← misma infra del bot principal
│  WhatsApp: redirect al cierre   │  ← 7869137339 o 7865809908
└─────────────────────────────────┘
```

---

## VARIABLES DE ENTORNO NECESARIAS (.env)

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default 3000) |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram (mismo del proyecto principal o uno nuevo) |
| `TELEGRAM_CHAT_ID` | ID del canal/chat donde llegan los leads |
| `WHATSAPP_EDUARDO` | 7869137339 |
| `WHATSAPP_JORGE` | 7865809908 |
| `DASHBOARD_SECRET` | Clave para proteger endpoints admin |

---

## SEGMENTOS DE USUARIO Y PERSONALIZACIÓN

| Segmento | Trigger | Mensaje clave | Campos extra en form |
|---|---|---|---|
| Mal crédito | Botón "Tengo mal crédito" | "Te aprobamos aunque te hayan negado antes" | ¿Te han negado? ¿Tienes ingreso estable? |
| Sin crédito | Botón "No tengo historial" | "No necesitas historial crediticio" | ¿Tienes trabajo o negocio? |
| Urgente | Botón "Necesito uno urgente" | "Respuesta en 24 horas garantizada" | ¿Cuándo lo necesitas? |
| Upgrade | Botón "Quiero cambiar mi carro" | "Te ayudamos a hacer el upgrade correcto" | ¿Qué carro tienes ahora? |

---

## ESTADO DE TAREAS

### ✅ COMPLETADO (Sesión 1 — 2026-04-11)
- [x] Análisis de requisitos y definición de marca
- [x] server.js — Express + Telegram + WhatsApp round-robin
- [x] public/index.html — Landing completa con JS dinámico
- [x] 5 segmentos: mal crédito, sin historial, urgente, upgrade, oferta especial
- [x] Dropdown oferta especial con precios reales Hyundai 2026 (de pagina doral promo.html)
- [x] Logo premium CSS dorado — "JE" en fuente Cinzel con efecto metálico
- [x] Sección vendedores — Eduardo y Jorge con fotos y botones WhatsApp directos
- [x] Bug fix — botón "Enviando" se reseteaba al cerrar modal
- [x] Número Eduardo corregido: 17869167339
- [x] Token Telegram propio: ver Railway dashboard (no escribir aquí)
- [x] Canal Telegram: "Clientes De Hyundai Doral" (ver Railway dashboard)
- [x] .env configurado y probado — leads llegan al canal correcto
- [x] Deploy en Railway — FUNCIONANDO
- [x] URL producción: https://autoaprobado-miami-production.up.railway.app
- [x] Repo GitHub: https://github.com/eduardo23carsales-debug/-autoaprobado-miami

### 🔄 PENDIENTE — PRÓXIMA SESIÓN
- [ ] **Dominio** — conectar subdominio de hyundaipromomiami.com (Namecheap)
  - Eduardo prefiere método más simple que Railway custom domain
  - Preguntarle cómo corrió landings antes (FTP, cPanel, otro hosting)
  - Opciones: redireccionamiento, Cloudflare proxy, o subir archivos directo al hosting
- [ ] Configurar pixel de Meta Ads en el HTML (descomentar bloque ya preparado)
- [ ] Conectar agente Meta Ads para crear campañas de autos automáticamente
- [ ] Sistema de videos — subir creativos a la landing para Meta Ads
- [ ] Inteligencia de competencia — agente analiza hooks virales del mercado de autos Miami

---

## DECISIONES TOMADAS

| Decisión | Razón |
|---|---|
| Una sola página HTML con JS dinámico | No recargar página = menor fricción = más conversión |
| Marca "AutoAprobado" | Ataca directamente el miedo #1: el rechazo |
| Redirect a WhatsApp post-submit | Cierre manual es más efectivo para este tipo de venta |
| Notificación Telegram al canal | Reutiliza infraestructura existente del bot principal |
| Testimonios placeholder | Reemplazar con reales en fase 2 |
| Azul oscuro + Naranja | Azul = confianza/profesionalismo. Naranja = urgencia/acción |

---

## NOTAS PARA LA PRÓXIMA IA

- El proyecto principal del bot está en `C:\dev\agentes de hacer dinero\` (NO tocar)
- Este proyecto es INDEPENDIENTE pero puede compartir TELEGRAM_BOT_TOKEN
- El patrón de notificación Telegram está en `core/telegram.js` del proyecto principal
- WhatsApp Eduardo: 7869137339 | Jorge: 7865809908
- Los leads se alternan entre Eduardo y Jorge (round-robin en server.js)
- Servidor de producción: Railway (ver INSTRUCCIONES_DEPLOY.md del bot principal para referencia)
- Próximo paso técnico: Deploy + pixel Meta Ads + dominio
