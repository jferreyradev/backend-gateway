#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Simple Gateway Proxy
 * 
 * Proxy que enruta peticiones a backends según su prefijo
 * Con autenticación básica mediante login/tokens
 * Compatible con Deno local y Deno Deploy
 * 
 * Variables de entorno:
 *   - BACKENDS_REGISTRY_URL: URL del servidor de registro (default: http://localhost:8001)
 *   - API_KEY: API Key para acceder al registro (default: desarrollo-api-key-2026)
 *   - PORT: Puerto del gateway (default: 8080, ignorado en Deno Deploy)
 *   - CACHE_TTL_MS: TTL del caché en ms (default: 30000)
 *   - TOKEN_TTL_MS: TTL de tokens de autenticación en ms (default: 3600000)
 */

const PORT = parseInt(Deno.env.get('PORT') || '8080');
const BACKENDS_REGISTRY_URL = Deno.env.get('BACKENDS_REGISTRY_URL') || 'https://kv-storage-api.deno.dev';
const API_KEY = Deno.env.get('API_KEY') || 'desarrollo-api-key-2026';
const TOKEN_TTL = parseInt(Deno.env.get('TOKEN_TTL_MS') || '3600000'); // 1 hora
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'go-oracle-api-secure-key-2026';

interface Backend {
    name: string;
    url: string;
    prefix: string;
    token: string;
}

interface AuthToken {
    token: string;
    expiresAt: number;
    createdAt: number;
}

class SimpleGateway {
    private backends: Map<string, Backend> = new Map();
    private tokens: Map<string, AuthToken> = new Map();
    private isInitialized = false;

    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        console.log('🔄 Inicializando gateway y cargando backends...');
        await this.loadBackends();
        this.isInitialized = true;
    }

    private async decryptToken(encryptedToken: string): Promise<string> {
        try {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();
            
            // Decodificar de base64
            const encryptedData = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
            
            // Validar longitud mínima (salt + iv = 28 bytes)
            if (encryptedData.length < 28) {
                console.warn('⚠️  Token muy corto, usando sin desencriptar');
                return encryptedToken;
            }
            
            // Extraer salt (16 bytes), iv (12 bytes) y datos encriptados
            const salt = encryptedData.slice(0, 16);
            const iv = encryptedData.slice(16, 28);
            const data = encryptedData.slice(28);
            
            // Derivar la clave con PBKDF2
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(ENCRYPTION_KEY),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );
            
            const derivedKey = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256',
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt']
            );
            
            // Desencriptar
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                derivedKey,
                data
            );
            
            return decoder.decode(decryptedData);
        } catch (error) {
            console.error('❌ Error desencriptando token:', error.message);
            console.warn('⚠️  Usando token sin desencriptar como fallback');
            return encryptedToken; // Fallback: retornar el token original
        }
    }

    private generateToken(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '');
    }

    private validateToken(authHeader: string | null): boolean {
        if (!authHeader) return false;
        
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!match) return false;
        
        const token = match[1];
        const tokenData = this.tokens.get(token);
        
        if (!tokenData) return false;
        if (Date.now() > tokenData.expiresAt) {
            this.tokens.delete(token);
            return false;
        }
        
        return true;
    }

    private async hashPassword(password: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    }

    private async validateUser(username: string, password: string): Promise<boolean> {
        try {
            const response = await fetch(`${BACKENDS_REGISTRY_URL}/collections/users/${username}`, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                },
            });

            if (!response.ok) return false;

            const result = await response.json() as { data: { passwordHash: string } };
            if (!result.data?.passwordHash) return false;
            
            const passwordHash = await this.hashPassword(password);
            return result.data.passwordHash === passwordHash;
        } catch (error) {
            console.error('Error validando usuario:', error);
            return false;
        }
    }

    private async login(username: string, password: string): Promise<{ token: string; expiresIn: number } | null> {
        const isValid = await this.validateUser(username, password);
        
        if (!isValid) return null;
        
        const token = this.generateToken();
        const expiresAt = Date.now() + TOKEN_TTL;
        
        this.tokens.set(token, {
            token,
            expiresAt,
            createdAt: Date.now(),
        });
        
        this.cleanupExpiredTokens();
        
        return {
            token,
            expiresIn: TOKEN_TTL / 1000, // en segundos
        };
    }

    private cleanupExpiredTokens(): void {
        const now = Date.now();
        for (const [token, data] of this.tokens.entries()) {
            if (now > data.expiresAt) {
                this.tokens.delete(token);
            }
        }
    }

    private logout(authHeader: string | null): boolean {
        if (!authHeader) return false;
        
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!match) return false;
        
        const token = match[1];
        if (this.tokens.has(token)) {
            this.tokens.delete(token);
            return true;
        }
        
        return false;
    }

    async loadBackends(): Promise<void> {
        try {
            console.log('🔄 Cargando backends desde KV storage...');
            
            const response = await fetch(`${BACKENDS_REGISTRY_URL}/collections/backend`, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                },
            });

            if (!response.ok) {
                console.error(`❌ Error: ${response.status}`);
                return;
            }

            const result = await response.json() as { items?: Array<{ key: string; data: Backend; metadata?: any }> };
            
            this.backends.clear();
            
            // Si tiene items (respuesta del KV storage)
            if (result.items && Array.isArray(result.items)) {
                for (const item of result.items) {
                    if (item.data) {
                        this.backends.set(item.key, item.data);
                        console.log(`   ✓ ${item.key}: ${item.data.prefix} -> ${item.data.url}`);
                    }
                }
            } else {
                // Formato legacy (objeto directo)
                const data = result as any;
                if ('key' in data && 'data' in data) {
                    this.backends.set(data.key, data.data);
                    console.log(`   ✓ ${data.key}: ${data.data.prefix} -> ${data.data.url}`);
                } else {
                    for (const [key, value] of Object.entries(data)) {
                        if (typeof value === 'object' && value !== null && 'data' in value) {
                            const backend = (value as any).data;
                            this.backends.set(key, backend);
                            console.log(`   ✓ ${key}: ${backend.prefix} -> ${backend.url}`);
                        }
                    }
                }
            }

            console.log(`✅ ${this.backends.size} backends cargados\n`);
        } catch (error) {
            console.error('❌ Error cargando backends:', error);
        }
    }

    findBackend(path: string): Backend | null {
        let bestMatch: Backend | null = null;
        let bestLength = 0;

        for (const backend of this.backends.values()) {
            const prefix = backend.prefix.endsWith('/') 
                ? backend.prefix.slice(0, -1) 
                : backend.prefix;

            if (path === prefix || path.startsWith(prefix + '/')) {
                if (prefix.length > bestLength) {
                    bestMatch = backend;
                    bestLength = prefix.length;
                }
            }
        }

        return bestMatch;
    }

    removePrefix(path: string, prefix: string): string {
        const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
        if (path.startsWith(normalizedPrefix)) {
            const remaining = path.slice(normalizedPrefix.length);
            return remaining || '/';
        }
        return path;
    }

    async handleRequest(req: Request): Promise<Response> {
        const url = new URL(req.url);

        // CORS
        if (req.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        // Endpoint de login (sin autenticación)
        if (url.pathname === '/gateway/login' && req.method === 'POST') {
            try {
                const body = await req.json() as { username: string; password: string };
                const result = await this.login(body.username, body.password);
                
                if (!result) {
                    return new Response(JSON.stringify({
                        error: 'Invalid credentials',
                    }), {
                        status: 401,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                
                return new Response(JSON.stringify({
                    token: result.token,
                    expiresIn: result.expiresIn,
                    tokenType: 'Bearer',
                }), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            } catch {
                return new Response(JSON.stringify({
                    error: 'Invalid request body',
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Endpoint de logout (requiere token)
        if (url.pathname === '/gateway/logout' && req.method === 'POST') {
            const authHeader = req.headers.get('Authorization');
            const success = this.logout(authHeader);
            
            if (success) {
                return new Response(JSON.stringify({
                    message: 'Logout successful',
                }), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            } else {
                return new Response(JSON.stringify({
                    error: 'Invalid or missing token',
                }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Health check (sin autenticación)
        if (url.pathname === '/gateway/health') {
            return new Response(JSON.stringify({ 
                status: 'ok',
                timestamp: new Date().toISOString(),
                backends: this.backends.size,
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Endpoint para forzar recarga de backends (sin autenticación para facilitar pruebas)
        if (url.pathname === '/gateway/reload' && req.method === 'POST') {
            console.log('🔄 Recarga manual de backends solicitada...');
            await this.loadBackends();
            return new Response(JSON.stringify({ 
                message: 'Backends reloaded',
                backends: this.backends.size,
                routes: Array.from(this.backends.values()).map(b => ({
                    name: b.name,
                    prefix: b.prefix,
                    url: b.url,
                })),
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Inicializar gateway si es la primera petición
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Validar token para todas las demás rutas
        const authHeader = req.headers.get('Authorization');
        if (!this.validateToken(authHeader)) {
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: 'Valid Bearer token required. Use POST /gateway/login to obtain a token.',
            }), {
                status: 401,
                headers: { 
                    'Content-Type': 'application/json',
                    'WWW-Authenticate': 'Bearer',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Info del gateway
        if (url.pathname === '/' || url.pathname === '/gateway') {
            const acceptHeader = req.headers.get('Accept') || '';
            const backendList = Array.from(this.backends.values()).map(b => ({
                name: b.name,
                prefix: b.prefix,
                url: b.url,
            }));

            // Si es una petición de navegador (HTML), mostrar página de documentación
            if (acceptHeader.includes('text/html')) {
                const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Gateway Proxy</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            padding: 20px;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            text-align: center;
        }
        h1 { color: #667eea; margin-bottom: 10px; }
        .subtitle { color: #666; font-size: 14px; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-value { font-size: 32px; font-weight: bold; color: #667eea; }
        .stat-label { color: #666; font-size: 14px; margin-top: 5px; }
        .section {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h2 { color: #667eea; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .endpoint {
            padding: 15px;
            margin: 10px 0;
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            border-radius: 4px;
        }
        .method {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
            margin-right: 10px;
        }
        .method.get { background: #28a745; color: white; }
        .method.post { background: #007bff; color: white; }
        .method.put { background: #ffc107; color: black; }
        .method.delete { background: #dc3545; color: white; }
        .endpoint-path { font-family: monospace; color: #333; font-weight: 600; }
        .endpoint-desc { color: #666; font-size: 14px; margin-top: 5px; }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            margin-left: 10px;
        }
        .badge.public { background: #28a745; color: white; }
        .badge.private { background: #dc3545; color: white; }
        .backend-item {
            padding: 12px;
            margin: 8px 0;
            background: #f8f9fa;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .backend-name { font-weight: bold; color: #667eea; }
        .backend-prefix { 
            font-family: monospace; 
            background: #667eea; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 4px;
            font-size: 12px;
        }
        .backend-url { color: #666; font-size: 14px; }
        code {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .footer {
            text-align: center;
            color: white;
            margin-top: 30px;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Simple Gateway Proxy</h1>
            <p class="subtitle">API Gateway con Autenticación y Enrutamiento Dinámico</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${this.backends.size}</div>
                <div class="stat-label">Backends Activos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.tokens.size}</div>
                <div class="stat-label">Sesiones Activas</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">✓</div>
                <div class="stat-label">Sistema Operacional</div>
            </div>
        </div>

        <div class="section">
            <h2>📡 Backends Registrados</h2>
            ${backendList.length > 0 ? backendList.map(b => `
                <div class="backend-item">
                    <div>
                        <div class="backend-name">${b.name}</div>
                        <div class="backend-url">${b.url}</div>
                    </div>
                    <div class="backend-prefix">${b.prefix}</div>
                </div>
            `).join('') : '<p style="color: #666;">No hay backends registrados</p>'}
        </div>

        <div class="section">
            <h2>🔐 Endpoints de Autenticación</h2>
            
            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="endpoint-path">/gateway/login</span>
                <span class="badge public">PÚBLICO</span>
                <div class="endpoint-desc">Obtener token de acceso. Body: <code>{"username": "user", "password": "pass"}</code></div>
            </div>

            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="endpoint-path">/gateway/logout</span>
                <span class="badge private">REQUIERE TOKEN</span>
                <div class="endpoint-desc">Cerrar sesión y revocar token</div>
            </div>
        </div>

        <div class="section">
            <h2>🛠️ Endpoints de Gestión</h2>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="endpoint-path">/gateway/health</span>
                <span class="badge public">PÚBLICO</span>
                <div class="endpoint-desc">Verificar estado del gateway</div>
            </div>

            <div class="endpoint">
                <span class="method post">POST</span>
                <span class="endpoint-path">/gateway/reload</span>
                <span class="badge public">PÚBLICO</span>
                <div class="endpoint-desc">Recargar backends desde el storage</div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="endpoint-path">/gateway/backends</span>
                <span class="badge private">REQUIERE TOKEN</span>
                <div class="endpoint-desc">Ver detalles de todos los backends cargados</div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="endpoint-path">/gateway/users</span>
                <span class="badge private">REQUIERE TOKEN</span>
                <div class="endpoint-desc">Ver lista de usuarios registrados</div>
            </div>
        </div>

        <div class="section">
            <h2>🔀 Proxy a Backends</h2>
            <div class="endpoint">
                <span class="method get">GET/POST/PUT/DELETE</span>
                <span class="endpoint-path">/{prefix}/*</span>
                <span class="badge private">REQUIERE TOKEN</span>
                <div class="endpoint-desc">
                    Todas las peticiones se redirigen al backend correspondiente según el prefijo.<br>
                    Ejemplo: <code>GET /desa/usuarios</code> → <code>http://181.87.6.200:3004/desa/usuarios</code>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📝 Ejemplo de Uso</h2>
            <pre style="background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto;">
# 1. Login
curl -X POST ${url.origin}/gateway/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"admin","password":"tu-password"}'

# Respuesta: {"token":"...", "expiresIn":3600}

# 2. Usar el token en peticiones
curl ${url.origin}/desa/usuarios \\
  -H "Authorization: Bearer TOKEN"

# 3. Recargar backends
curl -X POST ${url.origin}/gateway/reload
            </pre>
        </div>

        <div class="footer">
            <p>Gateway Proxy v1.0.0 | Powered by Deno 🦕</p>
            <p style="font-size: 12px; margin-top: 10px;">
                KV Storage: ${BACKENDS_REGISTRY_URL}
            </p>
        </div>
    </div>
</body>
</html>`;

                return new Response(html, {
                    headers: { 
                        'Content-Type': 'text/html; charset=utf-8',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            // Si es una petición API (JSON), devolver JSON
            return new Response(JSON.stringify({
                service: 'Simple Gateway Proxy',
                version: '1.0.0',
                backends: this.backends.size,
                routes: backendList,
                activeTokens: this.tokens.size,
                endpoints: {
                    login: 'POST /gateway/login (public)',
                    logout: 'POST /gateway/logout (requires token)',
                    health: 'GET /gateway/health (public)',
                    reload: 'POST /gateway/reload (public)',
                    info: 'GET / (requires token)',
                    backends: 'GET /gateway/backends (requires token)',
                    users: 'GET /gateway/users (requires token)',
                },
            }, null, 2), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Ver backends cargados con detalles
        if (url.pathname === '/gateway/backends') {
            const backendList = Array.from(this.backends.entries()).map(([key, b]) => ({
                key: key,
                name: b.name,
                prefix: b.prefix,
                url: b.url,
                hasToken: !!b.token,
                tokenLength: b.token?.length || 0,
            }));

            return new Response(JSON.stringify({
                backends: backendList,
                total: this.backends.size,
                timestamp: new Date().toISOString(),
            }, null, 2), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Ver usuarios (sin mostrar passwords)
        if (url.pathname === '/gateway/users') {
            try {
                const response = await fetch(`${BACKENDS_REGISTRY_URL}/collections/users`, {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                    },
                });

                if (!response.ok) {
                    return new Response(JSON.stringify({
                        error: 'Failed to fetch users',
                        status: response.status,
                    }), {
                        status: response.status,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                const result = await response.json() as { items?: Array<{ key: string; data: any }> };
                
                const userList = result.items?.map(item => ({
                    username: item.key,
                    email: item.data?.email,
                    role: item.data?.role,
                    active: item.data?.active,
                })) || [];

                return new Response(JSON.stringify({
                    users: userList,
                    total: userList.length,
                    timestamp: new Date().toISOString(),
                }, null, 2), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            } catch (error) {
                return new Response(JSON.stringify({
                    error: 'Failed to fetch users',
                    message: error instanceof Error ? error.message : 'Unknown error',
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Health check
        if (url.pathname === '/gateway/health') {
            return new Response(JSON.stringify({ 
                status: 'ok',
                timestamp: new Date().toISOString(),
                backends: this.backends.size,
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Buscar backend
        let backend = this.findBackend(url.pathname);

        // Si no se encuentra, intentar recargar backends y buscar nuevamente
        if (!backend) {
            console.log(`⚠️  Backend no encontrado para ${url.pathname}, recargando...`);
            await this.loadBackends();
            backend = this.findBackend(url.pathname);
        }

        if (!backend) {
            return new Response(JSON.stringify({
                error: 'No backend found',
                path: url.pathname,
                availableRoutes: Array.from(this.backends.values()).map(b => b.prefix),
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Construir URL del backend (remover prefijo)
        const pathWithoutPrefix = this.removePrefix(url.pathname, backend.prefix);
        const backendUrl = `${backend.url}${pathWithoutPrefix}${url.search}`;

        console.log(`➡️  ${req.method} ${url.pathname} -> ${backend.name} (${backendUrl})`);

        try {
            // Headers para el backend
            const headers = new Headers(req.headers);
            
            // Desencriptar el token del backend (viene encriptado con AES-GCM)
            const decryptedToken = await this.decryptToken(backend.token);
            headers.set('Authorization', `Bearer ${decryptedToken}`);
            headers.delete('host'); // Evitar conflictos
            
            // console.log(`🔑 Token encriptado: ${backend.token.substring(0, 30)}...`);
            // console.log(`🔓 Token desencriptado: ${decryptedToken.substring(0, 30)}...`);
            
            // Proxy request;
            
            // Proxy request
            const backendResponse = await fetch(backendUrl, {
                method: req.method,
                headers,
                body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            });

            // Copiar headers de respuesta
            const responseHeaders = new Headers(backendResponse.headers);
            responseHeaders.set('X-Proxied-By', 'simple-gateway');
            responseHeaders.set('X-Backend', backend.name);
            responseHeaders.set('Access-Control-Allow-Origin', '*');

            return new Response(backendResponse.body, {
                status: backendResponse.status,
                statusText: backendResponse.statusText,
                headers: responseHeaders,
            });

        } catch (error) {
            console.error(`❌ Error proxying to ${backend.name}:`, error);
            
            return new Response(JSON.stringify({
                error: 'Backend error',
                backend: backend.name,
                url: backendUrl,
                message: error instanceof Error ? error.message : 'Unknown error',
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }
}

// Iniciar servidor
const gateway = new SimpleGateway();

console.log(`
╔═══════════════════════════════════════════╗
║       Simple Gateway Proxy                ║
╠═══════════════════════════════════════════╣
║ 🚀 Puerto: ${PORT}                            ║
║ 📡 Registry: ${BACKENDS_REGISTRY_URL.padEnd(27)}║
║ � Con autenticación (login requerido)   ║
╚═══════════════════════════════════════════╝
`);

console.log(`✅ Gateway escuchando en http://localhost:${PORT}\n`);

// Servidor compatible con local y Deno Deploy
const handler = (req: Request) => {
    // Validar configuración
    if (!BACKENDS_REGISTRY_URL || !API_KEY) {
        return new Response(JSON.stringify({
            error: 'Configuration error',
            message: 'BACKENDS_REGISTRY_URL and API_KEY are required',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    return gateway.handleRequest(req);
};

// Para Deno Deploy (export)
export default { fetch: handler };

// Para ejecución local
if (import.meta.main) {
    await Deno.serve({ 
        port: PORT,
        hostname: '0.0.0.0',
    }, handler).finished;
}
