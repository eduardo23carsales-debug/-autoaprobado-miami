# INFRAESTRUCTURA MAESTRA — Eduardo
## Sistema escalable de agentes autónomos que generan dinero

---

## VISIÓN GENERAL

Eduardo es el CEO. Los agentes trabajan solos.
Cada proyecto es un módulo independiente que corre sobre la misma base.
Un solo Telegram para controlarlo todo.

```
TELEGRAM (centro de control)
        │
        ├── 🚗 AutoAprobado Miami (activo)
        ├── 📈 Bot de Opciones (futuro)
        ├── 🏥 Cliente Agencia #1 (futuro)
        ├── 🏥 Cliente Agencia #2 (futuro)
        └── ... más proyectos
```

---

## PROYECTOS ACTIVOS

### 🚗 Proyecto 1 — AutoAprobado Miami
**Repo:** github.com/eduardo23carsales-debug/-autoaprobado-miami
**Railway:** oferta.hyundaipromomiami.com
**Estado:** Producción ✅
**Genera:** Leads de clientes que quieren comprar carros en Miami
**Stack:** Express + Meta Ads API + Telegram + Claude Haiku + Railway

**Lo que hace solo:**
- Crea y optimiza campañas en Meta Ads desde Telegram
- Analista IA revisa métricas cada mañana a las 8 AM ET
- Supervisor pausa campañas malas cada 4 horas
- Leads llegan a Telegram en tiempo real

---

## PROYECTOS FUTUROS

### 📈 Proyecto 2 — Bot de Opciones (landing + ventas)
**Objetivo:** Vender acceso o señales del bot de opciones
**Lo que necesita:**
- Landing page mostrando resultados reales del bot
- Pasarela de pago Stripe (suscripción mensual o pago único)
- Agente que procesa pagos y da acceso automáticamente
- Reporte de ventas a Telegram

**Modelo de negocio:**
- Suscripción $97-$297/mes por acceso a señales
- O venta única del sistema $997-$2,997

**Reutiliza de Proyecto 1:**
- Railway (nuevo servicio en el mismo proyecto)
- Estructura Express + Telegram
- Framework de agentes

---

### 🏢 Proyecto 3 — Agencia de Bots (clientes)
**Objetivo:** Vender el sistema AutoAprobado a otros negocios
**Negocios objetivo:** Dentistas, clínicas, abogados, restaurantes, concesionarios
**Lo que necesita:**
- Sistema multi-tenant (un Railway, múltiples clientes)
- Dashboard para cada cliente
- Onboarding automático (ver AGENCIA-SETUP.md)

**Modelo de negocio:**
- Setup: $1,500 - $3,000 (una vez)
- Mensualidad: $500 - $1,500/mes
- % del presupuesto de ads: 15-20%

---

## INFRAESTRUCTURA COMPARTIDA

### Railway
- Todos los proyectos corren en Railway
- Cada proyecto = un servicio separado
- Variables de entorno por servicio (no se mezclan)
- Deploy automático con `git push`

### Telegram
- Un bot por proyecto O un bot maestro con múltiples módulos
- Webhooks, no polling
- Botones inline para aprobaciones
- Reporte diario automático

### Meta Ads
- Una App (Nexus Ads Manager) puede manejar múltiples cuentas publicitarias
- System User con token permanente por cliente
- Ver AGENCIA-SETUP.md para checklist completo

### Stripe
- Una cuenta Stripe para todos los proyectos
- Webhooks de Stripe → servidor Express → Telegram notifica pago
- Variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### Claude API
- Una API key compartida entre proyectos
- Haiku para análisis rápidos (barato)
- Sonnet para decisiones importantes

---

## CÓMO CREAR UN PROYECTO NUEVO

### Paso 1 — Clonar la base
```bash
# Copiar estructura del Proyecto 1
cp -r "Pagina para pagina y venta de autos" "nombre-proyecto-nuevo"
cd "nombre-proyecto-nuevo"
git init
git remote add origin {nuevo-repo}
```

### Paso 2 — Adaptar
- Cambiar `public/` por la nueva landing page
- Adaptar `server.js` para el nuevo negocio
- Mantener estructura de agentes en `agentes/`
- Actualizar variables de entorno

### Paso 3 — Railway
- Crear nuevo servicio en Railway
- Conectar al nuevo repo
- Agregar variables de entorno
- Dominio automático o custom

### Paso 4 — Telegram
- Crear nuevo bot con @BotFather O agregar módulo al bot existente
- Configurar webhook
- Probar con `/menu`

### Paso 5 — Verificar
```bash
curl https://{nuevo-dominio}/api/ping
# {"ok":true}
```

---

## STACK TECNOLÓGICO

| Capa | Tecnología | Para qué |
|------|-----------|----------|
| Servidor | Node.js + Express | API, webhooks, servir landing |
| Deploy | Railway | Hosting, variables, dominio |
| Base de datos | (pendiente) | Leads, métricas, clientes |
| Pagos | Stripe | Cobrar suscripciones y ventas |
| Publicidad | Meta Ads API | Crear y optimizar campañas |
| Mensajería | Telegram | Control y reportes |
| Voz | VAPI (pendiente) | Llamar a leads, aprobaciones por voz |
| IA análisis | Claude Haiku | Analista de campañas |
| IA decisiones | Claude Sonnet | Decisiones complejas |
| Imágenes | DALL-E 3 | Creativos cuando no hay fotos |
| Código | GitHub | Control de versiones, deploy |

---

## ROADMAP

### Ahora (Abril 2026)
- [x] AutoAprobado Miami en producción
- [x] 3 agentes autónomos funcionando
- [x] Menú Telegram con botones
- [x] Leads llegando en tiempo real
- [ ] Primer cliente real cerrado

### Próximo mes (Mayo 2026)
- [ ] VAPI — llamadas de voz a leads
- [ ] Agente calificador (llama al lead en 5 min)
- [ ] Landing de Bot de Opciones
- [ ] Stripe integrado

### En 3 meses
- [ ] Primer cliente de agencia
- [ ] Sistema multi-tenant
- [ ] Agente cerrador por voz
- [ ] Dashboard de métricas

### En 6 meses
- [ ] 5+ clientes de agencia activos
- [ ] Bot de opciones vendiendo suscripciones
- [ ] Sistema completamente autónomo
- [ ] Eduardo solo aprueba decisiones grandes

---

## PRINCIPIOS DEL SISTEMA

1. **Eduardo es CEO, no operador** — los agentes hacen el trabajo
2. **Todo por Telegram** — un solo lugar para controlar todo
3. **Modular** — cada proyecto es independiente pero comparte la base
4. **Paper first** — probar en sandbox antes de dinero real
5. **Documentar siempre** — cada error y solución se guarda en AGENCIA-SETUP.md
6. **Automatizar el onboarding** — cliente nuevo debe tomar 30 minutos máximo
