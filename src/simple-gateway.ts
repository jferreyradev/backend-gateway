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
const BACKENDS_REGISTRY_URL = Deno.env.get('BACKENDS_REGISTRY_URL') || 'http://localhost:8001';
const API_KEY = Deno.env.get('API_KEY') || 'desarrollo-api-key-2026';
const CACHE_TTL = parseInt(Deno.env.get('CACHE_TTL_MS') || '30000');
const TOKEN_TTL = parseInt(Deno.env.get('TOKEN_TTL_MS') || '3600000'); // 1 hora

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
    private lastRefresh = 0;
    private tokens: Map<string, AuthToken> = new Map();

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

    async refreshBackends(): Promise<void> {
        const now = Date.now();
        if (now - this.lastRefresh < CACHE_TTL) return;

        try {
            console.log('🔄 Actualizando backends...');
            
            const response = await fetch(`${BACKENDS_REGISTRY_URL}/collections/backend`, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                },
            });

            if (!response.ok) {
                console.error(`❌ Error: ${response.status}`);
                return;
            }

            const data = await response.json() as Record<string, { key: string; data: Backend; metadata?: any }>;
            
            this.backends.clear();
            
            // El registry puede devolver un objeto directo o un objeto con múltiples backends
            // Si tiene 'key' y 'data', es un solo backend
            if ('key' in data && 'data' in data) {
                const singleBackend = data as any;
                this.backends.set(singleBackend.key, singleBackend.data);
                console.log(`   ✓ ${singleBackend.key}: ${singleBackend.data.prefix} -> ${singleBackend.data.url}`);
            } else {
                // Es un objeto con múltiples backends
                for (const [key, value] of Object.entries(data)) {
                    if (value?.data) {
                        this.backends.set(key, value.data);
                        console.log(`   ✓ ${key}: ${value.data.prefix} -> ${value.data.url}`);
                    }
                }
            }

            this.lastRefresh = now;
            console.log(`✅ ${this.backends.size} backends cargados\n`);
        } catch (error) {
            console.error('❌ Error actualizando backends:', error);
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

        // Actualizar backends
        await this.refreshBackends();

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
                endpoints: {
                    login: 'POST /gateway/login (public)',
                    logout: 'POST /gateway/logout (requires token)',
                    health: 'GET /gateway/health (public)',
                    info: 'GET / (requires token)',
                },
            }, null, 2), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
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
        const backend = this.findBackend(url.pathname);

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

        // Construir URL del backend
        const pathWithoutPrefix = this.removePrefix(url.pathname, backend.prefix);
        const backendUrl = `${backend.url}${pathWithoutPrefix}${url.search}`;

        console.log(`➡️  ${req.method} ${url.pathname} -> ${backend.name} (${backendUrl})`);

        try {
            // Headers para el backend
            const headers = new Headers(req.headers);
            headers.set('Authorization', `Bearer ${backend.token}`);
            headers.delete('host'); // Evitar conflictos
            
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
