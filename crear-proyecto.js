#!/usr/bin/env node
// ════════════════════════════════════════════════════
// GENERADOR DE PROYECTOS — AutoAgencia
// Crea un proyecto completo de captación de leads con
// landing page personalizada + Meta Ads + Telegram Bot
//
// Uso: node crear-proyecto.js
// ════════════════════════════════════════════════════

import readline from 'readline';
import fs       from 'fs';
import path     from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Colores para la consola ───────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  blue:   '\x1b[34m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
};

function log(msg, color = C.reset) { console.log(`${color}${msg}${C.reset}`); }
function titulo(msg) { console.log(`\n${C.bold}${C.blue}${msg}${C.reset}\n`); }
function ok(msg)     { console.log(`${C.green}✅ ${msg}${C.reset}`); }
function info(msg)   { console.log(`${C.cyan}ℹ  ${msg}${C.reset}`); }
function warn(msg)   { console.log(`${C.yellow}⚠️  ${msg}${C.reset}`); }

// ── Preguntar en consola ──────────────────────────────
async function preguntar(rl, texto, defecto = '') {
  return new Promise(resolve => {
    const hint = defecto ? ` (${defecto})` : '';
    rl.question(`${C.cyan}→ ${texto}${hint}: ${C.reset}`, (resp) => {
      resolve(resp.trim() || defecto);
    });
  });
}

// ── Generar landing page con Claude ──────────────────
async function generarLanding(config) {
  info('Generando landing page con Claude...');

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Eres un experto en diseño web y marketing digital.
Genera un archivo HTML completo y listo para producción para una landing page de captación de leads.

NEGOCIO:
- Nombre: ${config.nombre}
- Tipo: ${config.tipo}
- Ciudad: ${config.ciudad}
- Servicios/Productos: ${config.servicios}
- Propuesta de valor: ${config.propuesta}
- Teléfono WhatsApp: ${config.whatsapp}
- Color principal: ${config.colorPrimario}
- Color secundario: ${config.colorSecundario}

SEGMENTOS DE CLIENTES (los que el negocio quiere captar):
${config.segmentos.map((s, i) => `${i + 1}. ${s.nombre}: ${s.descripcion}`).join('\n')}

REQUISITOS TÉCNICOS OBLIGATORIOS:
1. HTML + CSS + JavaScript en un solo archivo (sin dependencias externas excepto Google Fonts)
2. El formulario principal hace POST a /api/lead con estos campos JSON:
   { nombre, telefono, segmento, ...campos_extra_del_segmento }
3. Cuando el servidor responde { ok: true, whatsapp: "url" }, redirigir al usuario a esa URL
4. Cuando el servidor responde { ok: false }, mostrar mensaje de error
5. Pixel de Meta Ads: incluir este código exacto en el <head> reemplazando PIXEL_ID_AQUI:
   <script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.getElementsByTagName=s.parentNode;s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','PIXEL_ID_AQUI');fbq('track','PageView');</script>
6. Diseño mobile-first, moderno, profesional y de alta conversión
7. Incluir sección de problemas que resuelve el negocio
8. Incluir botones de WhatsApp que abran wa.me/${config.whatsapp}
9. El campo "segmento" del formulario debe ser uno de: ${config.segmentos.map(s => s.key).join(', ')}
10. Campos extra del formulario deben cambiar dinámicamente según el segmento seleccionado
11. Variables CSS en :root para los colores
12. Formulario con validación básica (nombre y teléfono requeridos)
13. Mostrar modal de éxito después de enviar

ESTILO VISUAL:
- Profesional pero accesible para público hispano
- Usar emojis con moderación para reforzar puntos clave
- CTA principal claro y urgente
- Social proof (testimonios o números de clientes)
- Sin exageraciones ni promesas falsas

Devuelve SOLO el código HTML completo, sin explicaciones, sin markdown, sin bloques de código.
Empieza directamente con <!DOCTYPE html>`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

// ── Generar segmentos para Meta Ads ──────────────────
async function generarSegmentosMeta(config) {
  info('Generando copies para Meta Ads con Claude...');

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Eres experto en publicidad en Facebook/Instagram para negocios hispanos en USA.

NEGOCIO: ${config.nombre} — ${config.tipo} en ${config.ciudad}
SERVICIOS: ${config.servicios}
PROPUESTA DE VALOR: ${config.propuesta}
LANDING URL: ${config.dominio}

Genera un objeto JavaScript para usar en Meta Ads con esta estructura exacta para ${config.segmentos.length} segmentos:

const SEGMENTOS = {
  '${config.segmentos[0]?.key}': {
    nombre: 'string — nombre del segmento para campaña',
    hook: 'string — pregunta gancho para el anuncio (máx 10 palabras)',
    copies: [
      'string — copy emocional (150-200 palabras, con emojis, historia)',
      'string — copy directo (100-150 palabras, beneficios claros)',
      'string — copy social proof (100-150 palabras, testimonios/números)'
    ],
    imagenPrompt: 'string — prompt detallado para DALL-E 3, foto documental realista, sin texto ni logos, formato cuadrado 1:1'
  },
  // ... resto de segmentos
};

Los segmentos son:
${config.segmentos.map(s => `- key: "${s.key}" | nombre: "${s.nombre}" | descripción: "${s.descripcion}"`).join('\n')}

Devuelve SOLO el código JavaScript del objeto SEGMENTOS, sin explicaciones.
Empieza con: const SEGMENTOS = {`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

// ── Copiar archivos base del proyecto ─────────────────
function copiarArchivosBase(destino, config) {
  // Archivos que se copian directamente
  const archivosDirectos = [
    'railway.json',
    'nixpacks.toml',
    'subir-fotos-videos.bat',
    'monitor-ads.js',
  ];

  for (const archivo of archivosDirectos) {
    const src = path.join(__dirname, archivo);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(destino, archivo));
    }
  }

  // Copiar carpeta agentes/
  const agentesDir = path.join(__dirname, 'agentes');
  const agentesDestino = path.join(destino, 'agentes');
  if (!fs.existsSync(agentesDestino)) fs.mkdirSync(agentesDestino);
  for (const f of fs.readdirSync(agentesDir)) {
    fs.copyFileSync(path.join(agentesDir, f), path.join(agentesDestino, f));
  }

  // Crear carpetas vacías
  for (const carpeta of ['photos', 'videos', 'public']) {
    const dir = path.join(destino, carpeta);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  }

  ok('Archivos base copiados');
}

// ── Generar package.json ──────────────────────────────
function generarPackageJson(destino, config) {
  const pkg = {
    name: config.slug,
    version: '1.0.0',
    description: `Landing page de captación de leads — ${config.nombre}`,
    type: 'module',
    main: 'server.js',
    scripts: {
      start: 'node server.js',
      dev: 'node --watch server.js',
      ads: 'node meta-ads-carros.js'
    },
    dependencies: {
      '@anthropic-ai/sdk': '^0.88.0',
      'axios': '^1.15.0',
      'dotenv': '^16.4.0',
      'express': '^4.22.1',
      'express-rate-limit': '^8.3.2',
      'node-cron': '^4.2.1',
      'node-telegram-bot-api': '^0.66.0',
      'openai': '^6.34.0',
      'form-data': '^4.0.0'
    }
  };
  fs.writeFileSync(path.join(destino, 'package.json'), JSON.stringify(pkg, null, 2));
  ok('package.json generado');
}

// ── Generar server.js ─────────────────────────────────
function generarServerJs(destino, config) {
  const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf-8');
  fs.writeFileSync(path.join(destino, 'server.js'), serverContent);
  ok('server.js copiado');
}

// ── Generar bot-telegram.js ───────────────────────────
function generarBotTelegram(destino) {
  const content = fs.readFileSync(path.join(__dirname, 'bot-telegram.js'), 'utf-8');
  fs.writeFileSync(path.join(destino, 'bot-telegram.js'), content);
  ok('bot-telegram.js copiado');
}

// ── Generar meta-ads-carros.js con segmentos nuevos ───
function generarMetaAds(destino, config, segmentosCode) {
  let content = fs.readFileSync(path.join(__dirname, 'meta-ads-carros.js'), 'utf-8');

  // Reemplazar el objeto SEGMENTOS con el generado por Claude
  const inicio = content.indexOf('const SEGMENTOS = {');
  const fin    = content.indexOf('\n};\n\n// ── Helper Meta API');
  if (inicio !== -1 && fin !== -1) {
    content = content.substring(0, inicio) + segmentosCode + ';\n\n' + content.substring(fin + 4);
  }

  // Reemplazar LANDING_URL
  content = content.replace(
    `const LANDING_URL  = 'https://oferta.hyundaipromomiami.com';`,
    `const LANDING_URL  = '${config.dominio}';`
  );

  fs.writeFileSync(path.join(destino, 'meta-ads-carros.js'), content);
  ok('meta-ads-carros.js generado con segmentos personalizados');
}

// ── Generar .env.example ──────────────────────────────
function generarEnvExample(destino, config) {
  const envContent = `# ════════════════════════════════════════════════
# ${config.nombre} — Variables de entorno
# Copia este archivo como .env y llena los valores
# ════════════════════════════════════════════════

# Telegram
TELEGRAM_BOT_TOKEN=         # Token del bot (@BotFather)
TELEGRAM_CHAT_ID=           # ID del canal/grupo donde llegan los leads

# Meta Ads
META_ACCESS_TOKEN=          # Token del System User (ver AGENCIA-SETUP.md)
META_AD_ACCOUNT_ID=         # act_XXXXXXXXXX
META_PAGE_ID=               # ID de la página de Facebook
META_PIXEL_ID=              # ID del Pixel de Meta
META_WEBHOOK_TOKEN=autoaprobado2024

# WhatsApp
WHATSAPP_PRINCIPAL=${config.whatsapp}

# IA
ANTHROPIC_API_KEY=          # Para el Agente Analista
OPENAI_API_KEY=             # Para DALL-E (opcional si hay fotos)

# Agentes — Límites de control
PRESUPUESTO_MAX_DIA=50      # Máximo que el Analista puede proponer
LIMITE_ESCALAR_SOLO=15      # Máximo que el Supervisor puede subir solo
LIMITE_GASTO_SIN_LEAD=10    # Pausa si gasta esto sin leads

# Railway (se pone automático en Railway)
# RAILWAY_PUBLIC_DOMAIN=
`;

  fs.writeFileSync(path.join(destino, '.env.example'), envContent);
  ok('.env.example generado');
}

// ── Generar README con instrucciones ─────────────────
function generarReadme(destino, config) {
  const readme = `# ${config.nombre} — Sistema de Leads Automatizado

## Qué es esto
Landing page + Meta Ads + Agentes IA para captar leads de ${config.tipo} en ${config.ciudad}.
Los leads llegan directo a Telegram con nombre, teléfono y segmento.

## Setup en Railway (10 minutos)

1. Crear nuevo servicio en Railway
2. Conectar este repositorio
3. Agregar variables de entorno (ver .env.example)
4. Deploy automático

## Variables requeridas
Ver \`.env.example\` — todas las variables con descripción.

## Comandos Telegram
- \`/menu\` — menú principal con botones
- \`/nueva [segmento] [presupuesto]\` — crear campaña
- \`/pausa [segmento]\` — pausar campaña
- \`/activa [segmento]\` — activar campaña
- \`/presupuesto [segmento] [monto]\` — cambiar presupuesto
- \`/reporte\` — métricas del día
- \`/analista\` — análisis IA manual
- \`/supervisor\` — revisar campañas ahora

## Segmentos disponibles
${config.segmentos.map(s => `- \`${s.key}\` — ${s.nombre}`).join('\n')}

## Para subir fotos/videos
Doble clic en \`subir-fotos-videos.bat\`

## Generado con AutoAgencia
Sistema creado automáticamente. Ver AGENCIA-SETUP.md para documentación completa.
`;

  fs.writeFileSync(path.join(destino, 'README.md'), readme);
  ok('README.md generado');
}

// ── MAIN ──────────────────────────────────────────────
async function main() {
  console.clear();
  titulo('═══════════════════════════════════════════');
  titulo('   AUTOAGENCIA — Generador de Proyectos   ');
  titulo('═══════════════════════════════════════════');
  log('Responde las preguntas y el sistema genera todo solo.\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    warn('ANTHROPIC_API_KEY no encontrada en .env — se necesita para generar la landing y los copies.');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ── Preguntas ────────────────────────────────────────
  titulo('1. DATOS DEL NEGOCIO');
  const nombre        = await preguntar(rl, 'Nombre del negocio');
  const tipo          = await preguntar(rl, 'Tipo de negocio (ej: concesionario de carros, clínica dental, etc.)');
  const ciudad        = await preguntar(rl, 'Ciudad y estado (ej: Miami, Florida)');
  const servicios     = await preguntar(rl, 'Servicios o productos principales (separados por coma)');
  const propuesta     = await preguntar(rl, '¿Cuál es el diferenciador principal? (ej: aprobamos aunque te hayan negado)');
  const whatsapp      = await preguntar(rl, 'Número de WhatsApp (solo números, con código de país, ej: 17865551234)');
  const dominio       = await preguntar(rl, 'Dominio de la landing (ej: https://oferta.midominio.com)', 'https://midominio.railway.app');

  titulo('2. DISEÑO');
  const colorPrimario   = await preguntar(rl, 'Color primario en hex', '#1a237e');
  const colorSecundario = await preguntar(rl, 'Color secundario en hex', '#ff6600');

  titulo('3. SEGMENTOS DE CLIENTES');
  info('Define los tipos de clientes que quieres captar (mínimo 2, máximo 5).');
  info('Ejemplo para dental: tratamiento-urgente, blanqueamiento, implantes, ortodoncia\n');

  const segmentos = [];
  let agregarMas  = true;
  let i = 1;

  while (agregarMas && segmentos.length < 5) {
    log(`\n--- Segmento ${i} ---`, C.yellow);
    const segNombre = await preguntar(rl, 'Nombre del segmento (ej: Tratamiento urgente)');
    if (!segNombre) { agregarMas = false; break; }
    const segKey    = segNombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const segDesc   = await preguntar(rl, 'Descripción corta (ej: personas con dolor de muela que necesitan atención hoy)');

    segmentos.push({ nombre: segNombre, key: segKey, descripcion: segDesc });

    if (segmentos.length < 5) {
      const mas = await preguntar(rl, '¿Agregar otro segmento? (s/n)', 's');
      agregarMas = mas.toLowerCase() === 's';
    }
    i++;
  }

  rl.close();

  if (!segmentos.length) {
    warn('Necesitas al menos un segmento. Intenta de nuevo.');
    process.exit(1);
  }

  // ── Slug del proyecto ────────────────────────────────
  const slug = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const config = {
    nombre, tipo, ciudad, servicios, propuesta,
    whatsapp, dominio, colorPrimario, colorSecundario,
    segmentos, slug
  };

  // ── Crear directorio del proyecto ────────────────────
  const destino = path.join(path.dirname(__dirname), slug);

  titulo('4. GENERANDO PROYECTO...');

  if (fs.existsSync(destino)) {
    warn(`La carpeta "${slug}" ya existe. Se sobreescribirán los archivos.`);
  } else {
    fs.mkdirSync(destino, { recursive: true });
  }

  // ── Generar todos los archivos ───────────────────────
  try {
    // Crear carpetas necesarias antes de escribir archivos
    for (const carpeta of ['public', 'photos', 'videos', 'agentes']) {
      fs.mkdirSync(path.join(destino, carpeta), { recursive: true });
    }

    // Landing page (Claude Sonnet)
    info('Generando landing page personalizada...');
    const landingHtml = await generarLanding(config);
    fs.writeFileSync(path.join(destino, 'public', 'index.html'), landingHtml);
    ok('Landing page generada');

    // Segmentos Meta Ads (Claude Haiku)
    info('Generando copies para Meta Ads...');
    const segmentosCode = await generarSegmentosMeta(config);
    generarMetaAds(destino, config, segmentosCode);

    // Archivos base
    copiarArchivosBase(destino, config);
    generarServerJs(destino, config);
    generarBotTelegram(destino);
    generarPackageJson(destino, config);
    generarEnvExample(destino, config);
    generarReadme(destino, config);

    // Guardar config del proyecto
    fs.writeFileSync(
      path.join(destino, 'proyecto.json'),
      JSON.stringify(config, null, 2)
    );

  } catch (err) {
    log(`\n❌ Error generando proyecto: ${err.message}`, C.red);
    process.exit(1);
  }

  // ── Instrucciones finales ────────────────────────────
  console.log('\n');
  titulo('5. ¡PROYECTO LISTO!');
  ok(`Carpeta: ${destino}`);

  console.log(`
${C.bold}PRÓXIMOS PASOS:${C.reset}

${C.yellow}1. Configurar variables en Railway:${C.reset}
   - Abre ${destino}/.env.example
   - Llena todas las variables
   - Pégalas en Railway → Variables

${C.yellow}2. Subir a GitHub y conectar a Railway:${C.reset}
   cd "${destino}"
   git init
   git add .
   git commit -m "proyecto inicial — ${nombre}"
   git remote add origin https://github.com/TU-USUARIO/${slug}.git
   git push -u origin main

${C.yellow}3. Configurar Meta Webhook:${C.reset}
   URL: ${dominio}/api/meta/webhook
   Token: autoaprobado2024
   (Ver AGENCIA-SETUP.md para el paso a paso completo)

${C.yellow}4. Crear primera campaña desde Telegram:${C.reset}
   /nueva ${config.segmentos[0]?.key} 10

${C.bold}${C.green}El sistema genera leads solo desde el primer día.${C.reset}
`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
