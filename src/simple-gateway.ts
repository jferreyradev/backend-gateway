#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Simple Gateway Proxy - Versión Refactorizada
 * 
 * Proxy que enruta peticiones a backends según su prefijo
 * Con autenticación mediante login/tokens
 * Compatible con Deno local y Deno Deploy
 * 
 * Variables de entorno:
 *   - STORAGE_URL: URL de la API de almacenamiento (cualquier API compatible)
 *   - API_KEY: API Key para acceder al almacenamiento
 *   - PORT: Puerto del gateway (default: 8080)
 *   - CACHE_TTL_MS: TTL del caché en ms
 *   - TOKEN_TTL_MS: TTL de tokens de autenticación en ms
 *   - ENCRYPTION_KEY: Clave para desencriptar tokens de backend
 *   - ALLOWED_ORIGINS: Orígenes CORS permitidos separados por comas
 */

import { loadConfig, validateConfig } from './lib/config.ts';
import { AuthManager } from './lib/auth.ts';
import { BackendManager } from './lib/backends.ts';
import { MiddlewareManager } from './lib/middleware.ts';
import { CryptoManager } from './lib/crypto.ts';
import type { LoginRequest } from './lib/types.ts';

class SimpleGateway {
    private config = loadConfig();
    private auth = new AuthManager(this.config);
    private backends = new BackendManager(this.config);
    private middleware = new MiddlewareManager(this.config);
    private crypto = new CryptoManager(this.config.auth.encryptionKey);

    async handleRequest(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const origin = req.headers.get('Origin');
        const requestId = this.crypto.generateRequestId();

        // CORS preflight
        if (req.method === 'OPTIONS') {
            return this.middleware.handleOptions(origin);
        }

        // === RUTAS PÚBLICAS (sin autenticación) ===

        // Login
        if (url.pathname === '/gateway/login' && req.method === 'POST') {
            return this.handleLogin(req, requestId, origin);
        }

        // Health check
        if (url.pathname === '/gateway/health') {
            return this.middleware.jsonResponse({
                status: 'ok',
                timestamp: new Date().toISOString(),
                backends: this.backends.getBackendsCount(),
            }, 200, requestId, origin);
        }

        // Ver backends (público)
        if (url.pathname === '/gateway/backends') {
            return this.middleware.jsonResponse({
                backends: this.backends.getBackendsDetailedList(),
                total: this.backends.getBackendsCount(),
                timestamp: new Date().toISOString(),
            }, 200, requestId, origin);
        }

        // Recargar backends (público para facilitar desarrollo)
        if (url.pathname === '/gateway/reload' && req.method === 'POST') {
            console.log('🔄 Recarga manual de backends solicitada...');
            await this.backends.loadBackends();
            return this.middleware.jsonResponse({
                message: 'Backends reloaded',
                backends: this.backends.getBackendsCount(),
                routes: this.backends.getBackendsList(),
            }, 200, requestId, origin);
        }

        // === PROXY A BACKENDS (sin autenticación del gateway) ===

        // Inicializar si es necesario
        await this.backends.initialize();

        // Buscar backend
        let backend = this.backends.findBackend(url.pathname);

        // Si no se encuentra, recargar y buscar nuevamente
        if (!backend && url.pathname !== '/' && url.pathname !== '/gateway' && 
            !url.pathname.startsWith('/gateway/')) {
            console.log(`⚠️  Backend no encontrado para ${url.pathname}, recargando...`);
            await this.backends.loadBackends();
            backend = this.backends.findBackend(url.pathname);
        }

        // Si hay backend, hacer proxy
        if (backend) {
            try {
                const proxyResult: any = await this.backends.proxyRequest(req, backend, url, requestId);
                return this.middleware.applyHeaders(
                    proxyResult.response,
                    requestId,
                    proxyResult.latency,
                    origin,
                    proxyResult.backend.name
                );
            } catch (err: any) {
                return this.middleware.errorResponse(
                    'Backend error',
                    err.error?.message || 'Unknown error',
                    502,
                    requestId,
                    origin
                );
            }
        }

        // === RUTAS DEL GATEWAY (requieren autenticación) ===

        // Logout
        if (url.pathname === '/gateway/logout' && req.method === 'POST') {
            const authHeader = req.headers.get('Authorization');
            const success = this.auth.logout(authHeader);
            
            if (success) {
                return this.middleware.jsonResponse({
                    message: 'Logout successful',
                }, 200, requestId, origin);
            } else {
                return this.middleware.errorResponse(
                    'Unauthorized',
                    'Invalid or missing token',
                    401,
                    requestId,
                    origin
                );
            }
        }

        // Validar token para rutas restringidas
        const authHeader = req.headers.get('Authorization');
        if (!this.auth.validateToken(authHeader)) {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'Bearer',
                'X-Request-ID': requestId,
            };
            Object.assign(headers, this.middleware.getCorsHeaders(origin));
            
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: 'Valid Bearer token required. Use POST /gateway/login to obtain a token.',
            }), {
                status: 401,
                headers,
            });
        }

        // Info del gateway (autenticado)
        if (url.pathname === '/' || url.pathname === '/gateway') {
            return this.middleware.jsonResponse({
                service: 'Simple Gateway Proxy',
                version: '2.0.0',
                backends: this.backends.getBackendsCount(),
                routes: this.backends.getBackendsList(),
                activeTokens: this.auth.getActiveTokensCount(),
                endpoints: {
                    login: 'POST /gateway/login (public)',
                    logout: 'POST /gateway/logout (requires token)',
                    health: 'GET /gateway/health (public)',
                    reload: 'POST /gateway/reload (public)',
                    backends: 'GET /gateway/backends (public)',
                    info: 'GET / (requires token)',
                },
            }, 200, requestId, origin);
        }

        // 404 - No encontrado
        return this.middleware.jsonResponse({
            error: 'Route not found',
            path: url.pathname,
            availableRoutes: this.backends.getBackendsList().map(b => b.prefix),
            gatewayRoutes: ['/gateway', '/gateway/login', '/gateway/logout', '/gateway/health', '/gateway/reload', '/gateway/backends'],
        }, 404, requestId, origin);
    }

    private async handleLogin(req: Request, requestId: string, origin: string | null): Promise<Response> {
        try {
            const body = await req.json() as LoginRequest;
            console.log(`[${requestId}] 🔐 Login attempt: ${body.username}`);
            
            const result = await this.auth.login(body.username, body.password);
            
            if (!result) {
                console.log(`[${requestId}] ❌ Login failed: ${body.username}`);
                return this.middleware.errorResponse(
                    'Unauthorized',
                    'Invalid credentials',
                    401,
                    requestId,
                    origin
                );
            }
            
            console.log(`[${requestId}] ✅ Login successful: ${body.username}`);
            return this.middleware.jsonResponse(result, 200, requestId, origin);
            
        } catch {
            console.log(`[${requestId}] ⚠️  Invalid login request body`);
            return this.middleware.errorResponse(
                'Bad Request',
                'Invalid request body',
                400,
                requestId,
                origin
            );
        }
    }
}

// Crear instancia del gateway
let gateway: SimpleGateway | null = null;
let config: ReturnType<typeof loadConfig> | null = null;

function init() {
    if (gateway) return { gateway, config: config! };
    
    config = loadConfig();
    validateConfig(config);
    gateway = new SimpleGateway();
    
    // Banner
    console.log(`
╔═══════════════════════════════════════════╗
║       Simple Gateway Proxy v2.0           ║
╠═══════════════════════════════════════════╣
║ 🚀 Puerto: ${config.port.toString().padEnd(31)}║
║ 📡 Registry: ${config.backends.registryUrl.padEnd(27)}║
║ 🔒 Con autenticación (login requerido)   ║
╚═══════════════════════════════════════════╝
`);

    console.log(`✅ Gateway escuchando\n`);
    
    return { gateway, config };
}

// Handler principal
const handler = (req: Request) => {
    const { gateway, config } = init();
    console.log(`📥 Request received: ${req.method} ${new URL(req.url).pathname}`);
    
    // Validar configuración
    if (!config.backends.registryUrl || !config.backends.apiKey) {
        return new Response(JSON.stringify({
            error: 'Configuration error',
            message: 'STORAGE_URL and API_KEY are required',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    return gateway.handleRequest(req);
};

// ✅ CRÍTICO: Export para Deno Deploy
export default { fetch: handler };

// Para ejecución local con deno serve
// Solo ejecutar si no es import
// deno serve usará el export default automáticamente
