#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write

/**
 * Simple Registry Server (KV Storage)
 * Almacena y recupera configuraciones de backends
 */

const PORT = parseInt(Deno.env.get('REGISTRY_PORT') || '8001');
const API_KEY = Deno.env.get('API_KEY') || 'desarrollo-api-key-2026';
const BACKENDS_FILE = 'backends.json';
const USERS_FILE = 'users.json';

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

// Cargar usuarios del archivo
function loadUsers(): Record<string, unknown> {
  try {
    const content = Deno.readTextFileSync(USERS_FILE);
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Guardar usuarios en archivo
function saveUsers(users: Record<string, unknown>): void {
  Deno.writeTextFileSync(USERS_FILE, JSON.stringify(users, null, 2));
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

  // POST /collections/backend - Crear nuevo backend
  if (method === 'POST' && path === '/collections/backend') {
    try {
      const body = await request.json() as { key: string; data: unknown; metadata: unknown };
      const backends = loadBackends();
      
      if (!body.key) {
        return new Response(JSON.stringify({ error: 'El campo "key" es requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (backends[body.key]) {
        return new Response(JSON.stringify({ error: 'El backend ya existe' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      backends[body.key] = body;
      saveBackends(backends);
      
      console.log(`✓ Backend creado: ${body.key}`);
      
      return new Response(JSON.stringify({ 
        success: true,
        data: body
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error creando backend:', error);
      return new Response(JSON.stringify({ error: 'Error al crear' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // PUT /collections/backend/{name} - Actualizar backend existente
  const putBackendMatch = path.match(/^\/collections\/backend\/([^/]+)$/);
  if (method === 'PUT' && putBackendMatch) {
    try {
      const name = decodeURIComponent(putBackendMatch[1]);
      const body = await request.json() as { key: string; data: unknown; metadata: unknown };
      const backends = loadBackends();
      
      backends[name] = body;
      saveBackends(backends);
      
      console.log(`✓ Backend actualizado: ${name}`);
      
      return new Response(JSON.stringify({ 
        success: true,
        data: body
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error actualizando backend:', error);
      return new Response(JSON.stringify({ error: 'Error al actualizar' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /collections/backend/{name} - Obtener backend específico
  const getBackendMatch = path.match(/^\/collections\/backend\/([^/]+)$/);
  if (method === 'GET' && getBackendMatch) {
    try {
      const name = decodeURIComponent(getBackendMatch[1]);
      const backends = loadBackends();
      
      if (!backends[name]) {
        return new Response(JSON.stringify({ error: 'Backend no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`✓ Backend recuperado: ${name}`);
      
      return new Response(JSON.stringify(backends[name]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error recuperando backend:', error);
      return new Response(JSON.stringify({ error: 'Error al recuperar' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // DELETE /collections/backend/{name} - Eliminar backend
  const deleteBackendMatch = path.match(/^\/collections\/backend\/([^/]+)$/);
  if (method === 'DELETE' && deleteBackendMatch) {
    try {
      const name = decodeURIComponent(deleteBackendMatch[1]);
      const backends = loadBackends();
      
      if (!backends[name]) {
        return new Response(JSON.stringify({ error: 'Backend no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      delete backends[name];
      saveBackends(backends);
      
      console.log(`✓ Backend eliminado: ${name}`);
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error eliminando backend:', error);
      return new Response(JSON.stringify({ error: 'Error al eliminar' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /collections/backend - Listar todos los backends
  if (method === 'GET' && path === '/collections/backend') {
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

  // POST /collections/users - Crear nuevo usuario
  if (method === 'POST' && path === '/collections/users') {
    try {
      const body = await request.json() as { key: string; data: unknown };
      const users = loadUsers();
      
      if (!body.key) {
        return new Response(JSON.stringify({ error: 'El campo "key" es requerido' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      if (users[body.key]) {
        return new Response(JSON.stringify({ error: 'El usuario ya existe' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      users[body.key] = body;
      saveUsers(users);
      
      console.log(`✓ Usuario creado: ${body.key}`);
      
      return new Response(JSON.stringify({ 
        success: true,
        data: body
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error creando usuario:', error);
      return new Response(JSON.stringify({ error: 'Error al crear' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // GET /collections/users/{username} - Obtener usuario específico
  const getUserMatch = path.match(/^\/collections\/users\/([^/]+)$/);
  if (method === 'GET' && getUserMatch) {
    try {
      const username = decodeURIComponent(getUserMatch[1]);
      const users = loadUsers();
      
      const user = users[username];
      
      if (!user) {
        return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`✓ Usuario recuperado: ${username}`);
      
      return new Response(JSON.stringify(user), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error recuperando usuario:', error);
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
