#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

/**
 * Simple Registry Server (KV Storage)
 * Almacena y recupera configuraciones de backends
 */

const PORT = parseInt(Deno.env.get('REGISTRY_PORT') || '8001');
const API_KEY = Deno.env.get('API_KEY') || 'desarrollo-api-key-2026';
const BACKENDS_FILE = 'backends.json';

// Cargar backends del archivo
function loadBackends(): Record<string, unknown> {
  try {
    const content = Deno.readTextFileSync(BACKENDS_FILE);
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Guardar backends en archivo
function saveBackends(backends: Record<string, unknown>): void {
  Deno.writeTextFileSync(BACKENDS_FILE, JSON.stringify(backends, null, 2));
}

// Validar API Key
function validateApiKey(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  return token === API_KEY;
}

// Manejador de requests
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  console.log(`[${new Date().toISOString()}] ${method} ${path}`);

  // Validar API Key en todos los endpoints
  if (!validateApiKey(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // PUT /collections/backends - Guardar/actualizar backend
  if (method === 'PUT' && path === '/collections/backends') {
    try {
      const body = await request.json() as Record<string, unknown>;
      const backends = loadBackends();
      
      // Merging new backends with existing ones
      const updated = { ...backends, ...body };
      saveBackends(updated);
      
      console.log(`✓ Backends guardados: ${Object.keys(updated).length} registros`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        count: Object.keys(updated).length,
        data: updated 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error guardando backends:', error);
      return new Response(JSON.stringify({ error: 'Error al guardar' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /kv/backends:* - Recuperar todos los backends
  if (method === 'GET' && path === '/kv/backends:*') {
    try {
      const backends = loadBackends();
      console.log(`✓ Recuperados ${Object.keys(backends).length} backends`);
      
      return new Response(JSON.stringify(backends), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error recuperando backends:', error);
      return new Response(JSON.stringify({ error: 'Error al recuperar' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /health - Health check
  if (method === 'GET' && path === '/health') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Endpoint no encontrado
  return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Iniciar servidor
console.log(`
╔═══════════════════════════════════════════╗
║    Registry Server (KV Storage)           ║
╠═══════════════════════════════════════════╣
║ 🚀 Escuchando en: http://localhost:${PORT}    ║
║ 🔐 API Key requerida en Authorization      ║
║ 📁 Almacenamiento: ${BACKENDS_FILE}           ║
╚═══════════════════════════════════════════╝
`);

Deno.serve({ port: PORT }, handleRequest);
