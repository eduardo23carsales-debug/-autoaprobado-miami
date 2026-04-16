# AGENCIA — Guía de Onboarding de Cliente
## Objetivo: pasar de cero a cliente con campañas corriendo en menos de 30 minutos

---

## ERRORES COMETIDOS (no repetir)

### Meta API
- ❌ `thank_you_page.button_type: 'NO_BUTTON'` — NO existe. Usar `'NONE'`
- ❌ `conversion_domain` dentro de `promoted_object` — NO es un campo válido ahí, quitarlo
- ❌ `standard_enhancements` en `degrees_of_freedom_spec` — DEPRECADO por Meta, quitarlo
- ❌ `context_card` en leadgen_forms — causa "unknown error" en muchas cuentas, no usarlo
- ❌ Token de Usuario en vez de Token de Página — para crear formularios Lead Ads necesitas Page Access Token
- ❌ Usar `axios` en server.js sin importarlo — causa ReferenceError en producción
- ❌ Importar `@anthropic-ai/sdk` en archivos dentro de subdirectorios (agentes/) como import estático — usar `await import()` dinámico dentro de la función

### Telegram
- ❌ Usar polling en Railway — causa conflictos. Siempre webhook
- ❌ No responder 200 inmediato al webhook — Telegram reintenta y genera duplicados
- ❌ Filtrar mensajes con `msg.from &&` — los admins anónimos de canales no tienen `from`, se filtran por error

### Railway
- ❌ No agregar variable antes de intentar verificar webhook Meta — el servidor rechaza el challenge y falla
- ❌ Asumir que los archivos locales están en Railway — fotos/videos deben estar commiteados a git

---

## CHECKLIST — CLIENTE NUEVO (30 minutos)

### PARTE 1 — Meta Business (10 min)

**Requisitos del cliente:**
- [ ] Página de Facebook creada y verificada
- [ ] Acceso al Business Manager donde está la página
- [ ] Cuenta publicitaria activa con método de pago

**Configuración:**

1. Ir a `business.facebook.com/settings/system-users`
2. Crear usuario de sistema: **nombre-cliente-bot** / rol Admin
3. Asignar activos al usuario:
   - Página → Control total
   - Cuenta publicitaria → Control total
4. Generar token del usuario de sistema:
   - App: **Nexus Ads Manager** (o la app del cliente)
   - Permisos requeridos: `ads_management`, `ads_read`, `pages_manage_ads`, `pages_read_engagement`, `leads_retrieval`, `pages_show_list`
   - Copiar token (no expira si es System User token)
5. Obtener Page ID:
   - `business.facebook.com` → Configuración → Página → Identificador

**Variables que obtienes:**
```
META_ACCESS_TOKEN = token del sistema generado
META_AD_ACCOUNT_ID = act_XXXXXXXXXX (con el "act_")
META_PAGE_ID = XXXXXXXXXX (solo números)
META_PIXEL_ID = XXXXXXXXXX (si tiene pixel instalado)
```

---

### PARTE 2 — Webhook Meta Lead Ads (5 min)

1. Ir a `developers.facebook.com/apps/{APP_ID}/webhooks/`
2. Seleccionar objeto: **Page**
3. Configurar:
   - Callback URL: `https://{dominio}/api/meta/webhook`
   - Verify Token: `autoaprobado2024` (o el que definas)
4. Verificar → debe responder el challenge
5. Suscribir campos: `leadgen` y `leadgen_update`

**IMPORTANTE:** La variable `META_WEBHOOK_TOKEN` debe estar en Railway ANTES de hacer clic en verificar.

**Nota conocida:** Crear formularios nativos Lead Ads via API falla con "unknown error" en cuentas nuevas. Por ahora los leads llegan por landing. Investigar si Meta requiere aprobación adicional.

---

### PARTE 3 — Railway (10 min)

**Variables de entorno requeridas:**
```
TELEGRAM_BOT_TOKEN = token del bot del cliente (o usar el tuyo como admin)
TELEGRAM_CHAT_ID = ID del canal/grupo donde llegan los leads
META_ACCESS_TOKEN = token del sistema
META_AD_ACCOUNT_ID = act_XXXXXXXXXX
META_PAGE_ID = XXXXXXXXXX
META_PIXEL_ID = XXXXXXXXXX
META_WEBHOOK_TOKEN = autoaprobado2024
RAILWAY_PUBLIC_DOMAIN = dominio.railway.app (Railway lo pone automático)
WHATSAPP_PRINCIPAL = 1XXXXXXXXXX (teléfono del cliente)
OPENAI_API_KEY = (para DALL-E si no tiene fotos)
ANTHROPIC_API_KEY = (para el Analista IA)
PRESUPUESTO_MAX_DIA = 100
LIMITE_ESCALAR_SOLO = 20
LIMITE_GASTO_SIN_LEAD = 15
```

**Deploy:**
```bash
git push origin main
# Railway deploya automáticamente
```

---

### PARTE 4 — Verificar que todo funciona (5 min)

```bash
# 1. Servidor vivo
curl https://{dominio}/api/ping
# Debe responder: {"ok":true}

# 2. Webhook Meta verificado
curl "https://{dominio}/api/meta/webhook?hub.mode=subscribe&hub.verify_token=autoaprobado2024&hub.challenge=test123"
# Debe responder: test123

# 3. Telegram funcionando
# Escribe /menu en el canal — debe aparecer el menú con botones

# 4. Primera campaña
# Escribe /nueva mal-credito 10 — debe crear campaña en Meta Ads
```

---

## ESTRUCTURA DEL SISTEMA

```
Cliente llena formulario en landing
        ↓
POST /api/lead
        ↓
Telegram → lead con nombre, teléfono, segmento
        ↓
WhatsApp → cliente redirigido automáticamente

Facebook Lead Ad (futuro)
        ↓
Meta webhook POST /api/meta/webhook
        ↓
Telegram → lead con nombre, teléfono, calificación
```

```
Cron 8 AM ET → Agente Analista
        ↓
Analiza 7 días de métricas con Claude Haiku
        ↓
Plan JSON → Telegram con botones ✅ Aprobar / ❌ Ignorar
        ↓
Si aprueba → Agente Ejecutor pausa/escala/crea campañas

Cron cada 4h → Agente Supervisor
        ↓
Revisa gasto vs leads en tiempo real
        ↓
Auto-pausa si gasto >= LIMITE_GASTO_SIN_LEAD sin leads
Auto-escala si CPL < $5 y aumento <= LIMITE_ESCALAR_SOLO
Consulta Eduardo con botones para decisiones grandes
```

---

## MODELO DE NEGOCIO — AGENCIA

### Opción A — Venta única
- Cliente paga una vez
- Recibe el sistema completo instalado
- Sube sus fotos/videos, los agentes hacen el resto
- Precio sugerido: $1,500 - $3,000

### Opción B — Mensualidad
- Eduardo administra todo
- Cliente recibe reporte diario en su Telegram
- Precio sugerido: $500 - $1,500/mes + presupuesto de ads

### Onboarding del cliente (Opción B):
1. Cliente entrega: acceso Business Manager + fotos/videos
2. Correr checklist de arriba (30 min)
3. Crear primeras 2-3 campañas con `/nueva`
4. Cliente empieza a recibir leads en 24-48h

---

## ASSETS — FOTOS Y VIDEOS

- Carpeta `photos/` — fotos reales del negocio
- Carpeta `videos/` — videos del negocio
- Nomenclatura: `general-nombre.jpg` o `segmento-nombre.jpg`
- Para subir nuevos assets: doble clic en `subir-fotos-videos.bat`
- Prioridad en campañas: video > foto real > DALL-E (generado por IA)

---

## PRÓXIMAS AUTOMATIZACIONES (pendientes)

- [ ] Script que crea el System User de Meta automáticamente via API
- [ ] Script que configura el webhook automáticamente via API
- [ ] Comando `/onboarding` en Telegram que guía todo el proceso
- [ ] VAPI — llamadas de voz para leads y decisiones del Supervisor
- [ ] Agente calificador — llama al lead en 5 minutos
- [ ] Agente cerrador — agenda cita o cierra venta por voz
- [ ] Multi-tenant — un Railway, múltiples clientes con sus propios tokens
- [ ] Dashboard web para el cliente ver sus leads y métricas

---

## NOTAS TÉCNICAS IMPORTANTES

- Railway usa Node.js con ES modules — imports estáticos desde subdirectorios pueden fallar, usar `await import()` dinámico
- El token de System User de Meta NO expira (a diferencia del User token que expira en 60 días)
- `procesados` Set en Telegram webhook se limpia al reiniciar Railway — si el servidor crashea puede procesar duplicados
- Meta Ads Manager tarda 24-48h en mostrar métricas reales
- Primeros leads pueden ser de baja calidad (bots) mientras el algoritmo aprende (1-3 días)
- Special Ad Category `FINANCIAL_PRODUCTS_SERVICES` limita targeting — no se puede segmentar por edad/género, solo por geo
