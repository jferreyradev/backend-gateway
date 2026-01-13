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
 *   - ENCRYPTION_KEY: Clave para desencriptar tokens de backend
 *   - ALLOWED_ORIGINS: Orígenes CORS permitidos separados por comas (default: *)
 * 
 * Mejoras implementadas:
 *   ✅ CORS configurable por variable de entorno
 *   ✅ Headers de seguridad (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
 *   ✅ Request IDs únicos para trazabilidad (X-Request-ID)
 *   ✅ Medición de latencia (X-Response-Time)
 *   ✅ Logging estructurado con request IDs
 *   ✅ Validación de configuración al inicio
 */

const PORT = parseInt(Deno.env.get('PORT') || '8080');
const BACKENDS_REGISTRY_URL = Deno.env.get('BACKENDS_REGISTRY_URL') || 'https://kv-storage-api.deno.dev';
const API_KEY = Deno.env.get('API_KEY') || 'desarrollo-api-key-2026';
const TOKEN_TTL = parseInt(Deno.env.get('TOKEN_TTL_MS') || '3600000'); // 1 hora
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'go-oracle-api-secure-key-2026';
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*'];

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

    private generateRequestId(): string {
        return crypto.randomUUID();
    }

    private getCorsHeaders(origin: string | null): Record<string, string> {
        let allowedOrigin = '*';
        
        if (!ALLOWED_ORIGINS.includes('*') && origin) {
            allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
        }
        
        return {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
    }

    private getSecurityHeaders(): Record<string, string> {
        return {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
        };
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
            const origin = req.headers.get('Origin');
            return new Response(null, {
                status: 204,
                headers: {
                    ...this.getCorsHeaders(origin),
                    ...this.getSecurityHeaders(),
                },
            });
        }

        // Endpoint de login (sin autenticación)
        if (url.pathname === '/gateway/login' && req.method === 'POST') {
            const requestId = this.generateRequestId();
            const origin = req.headers.get('Origin');
            try {
                const body = await req.json() as { username: string; password: string };
                console.log(`[${requestId}] 🔐 Login attempt: ${body.username}`);
                const result = await this.login(body.username, body.password);
                
                if (!result) {
                    console.log(`[${requestId}] ❌ Login failed: ${body.username}`);
                    return new Response(JSON.stringify({
                        error: 'Invalid credentials',
                    }), {
                        status: 401,
                        headers: { 
                            'Content-Type': 'application/json',
                            'X-Request-ID': requestId,
                            ...this.getCorsHeaders(origin),
                        },
                    });
                }
                
                console.log(`[${requestId}] ✅ Login successful: ${body.username}`);
                return new Response(JSON.stringify({
                    token: result.token,
                    expiresIn: result.expiresIn,
                    tokenType: 'Bearer',
                }), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Request-ID': requestId,
                        ...this.getCorsHeaders(origin),
                        ...this.getSecurityHeaders(),
                    },
                });
            } catch {
                console.log(`[${requestId}] ⚠️  Invalid login request body`);
                return new Response(JSON.stringify({
                    error: 'Invalid request body',
                }), {
                    status: 400,
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Request-ID': requestId,
                        ...this.getCorsHeaders(origin),
                    },
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
            const origin = req.headers.get('Origin');
            return new Response(JSON.stringify({ 
                status: 'ok',
                timestamp: new Date().toISOString(),
                backends: this.backends.size,
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    ...this.getCorsHeaders(origin),
                    ...this.getSecurityHeaders(),
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

        // Ver backends cargados con detalles (sin autenticación - público)
        if (url.pathname === '/gateway/backends') {
            const origin = req.headers.get('Origin');
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
                    ...this.getCorsHeaders(origin),
                    ...this.getSecurityHeaders(),
                },
            });
        }

        // Inicializar gateway si es la primera petición
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Buscar backend ANTES de validar autenticación del gateway
        // Las rutas de backend no requieren autenticación del gateway, solo del backend mismo
        let backend = this.findBackend(url.pathname);

        // Si no se encuentra, intentar recargar backends y buscar nuevamente
        if (!backend && url.pathname !== '/' && url.pathname !== '/gateway' && 
            !url.pathname.startsWith('/gateway/')) {
            console.log(`⚠️  Backend no encontrado para ${url.pathname}, recargando...`);
            await this.loadBackends();
            backend = this.findBackend(url.pathname);
        }

        // Si encontramos un backend, hacer el proxy SIN validar token del gateway
        if (backend) {
            // Construir URL del backend (remover prefijo)
            const pathWithoutPrefix = this.removePrefix(url.pathname, backend.prefix);
            const backendUrl = `${backend.url}${pathWithoutPrefix}${url.search}`;
            const requestId = this.generateRequestId();
            const startTime = Date.now();

            console.log(`[${requestId}] ➡️  ${req.method} ${url.pathname} -> ${backend.name} (${backendUrl})`);

            try {
                // Headers para el backend
                const headers = new Headers(req.headers);
                
                // Desencriptar el token del backend (viene encriptado con AES-GCM)
                const decryptedToken = await this.decryptToken(backend.token);
                headers.set('Authorization', `Bearer ${decryptedToken}`);
                headers.delete('host'); // Evitar conflictos
                
                // Proxy request
                const backendResponse = await fetch(backendUrl, {
                    method: req.method,
                    headers,
                    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
                });

                // Copiar headers de respuesta
                const responseHeaders = new Headers(backendResponse.headers);
                const latency = Date.now() - startTime;
                const origin = req.headers.get('Origin');
                
                responseHeaders.set('X-Proxied-By', 'simple-gateway');
                responseHeaders.set('X-Backend', backend.name);
                responseHeaders.set('X-Request-ID', requestId);
                responseHeaders.set('X-Response-Time', `${latency}ms`);
                
                // CORS configurable
                const corsHeaders = this.getCorsHeaders(origin);
                Object.entries(corsHeaders).forEach(([key, value]) => {
                    responseHeaders.set(key, value);
                });
                
                // Headers de seguridad
                const securityHeaders = this.getSecurityHeaders();
                Object.entries(securityHeaders).forEach(([key, value]) => {
                    responseHeaders.set(key, value);
                });

                console.log(`[${requestId}] ✅ ${backendResponse.status} (${latency}ms)`);

                return new Response(backendResponse.body, {
                    status: backendResponse.status,
                    statusText: backendResponse.statusText,
                    headers: responseHeaders,
                });

            } catch (error) {
                const latency = Date.now() - startTime;
                console.error(`[${requestId}] ❌ Error proxying to ${backend.name} (${latency}ms):`, error);
                
                return new Response(JSON.stringify({
                    error: 'Backend error',
                    backend: backend.name,
                    url: backendUrl,
                    message: error instanceof Error ? error.message : 'Unknown error',
                    requestId: requestId,
                }), {
                    status: 502,
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Request-ID': requestId,
                    },
                });
            }
        }

        // Validar token SOLO para rutas del gateway (no para backends)
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
            const backendList = Array.from(this.backends.values()).map(b => ({
                name: b.name,
                prefix: b.prefix,
                url: b.url,
            }));

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
                    backends: 'GET /gateway/backends (public)',
                    info: 'GET / (requires token)',
                    users: 'GET /gateway/users (requires token)',
                },
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

        // Si no se encontró ninguna ruta (ni backend ni gateway), devolver 404
        return new Response(JSON.stringify({
            error: 'Route not found',
            path: url.pathname,
            availableRoutes: Array.from(this.backends.values()).map(b => b.prefix),
            gatewayRoutes: ['/gateway', '/gateway/login', '/gateway/logout', '/gateway/health', '/gateway/reload', '/gateway/backends', '/gateway/users'],
        }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

// Validación de configuración al inicio
function validateConfig(): void {
    const errors: string[] = [];
    
    if (!BACKENDS_REGISTRY_URL) {
        errors.push('BACKENDS_REGISTRY_URL es requerido');
    }
    
    if (!API_KEY) {
        errors.push('API_KEY es requerido');
    }
    
    if (!ENCRYPTION_KEY) {
        errors.push('ENCRYPTION_KEY es requerido');
    } else if (ENCRYPTION_KEY.length < 32) {
        console.warn('⚠️  ENCRYPTION_KEY muy corta (recomendado: 32+ caracteres)');
    }
    
    if (errors.length > 0) {
        console.error('❌ Errores de configuración:');
        errors.forEach(err => console.error(`   - ${err}`));
        console.error('\n💡 Configura las variables de entorno requeridas\n');
        Deno.exit(1);
    }
    
    // Info de configuración
    console.log('✅ Configuración validada:');
    console.log(`   - Registry: ${BACKENDS_REGISTRY_URL}`);
    console.log(`   - Port: ${PORT}`);
    console.log(`   - Token TTL: ${TOKEN_TTL / 1000}s`);
    console.log(`   - CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log('');
}

// Validar antes de iniciar
validateConfig();

// Iniciar servidor
const gateway = new SimpleGateway();

console.log(`
╔═══════════════════════════════════════════╗
║       Simple Gateway Proxy                ║
╠═══════════════════════════════════════════╣
║ 🚀 Puerto: ${PORT}                            ║
║ 📡 Registry: ${BACKENDS_REGISTRY_URL.padEnd(27)}║
║ 🔒 Con autenticación (login requerido)   ║
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
