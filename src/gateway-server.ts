/**
 * Gateway Server Simplificado
 * 
 * Enruta peticiones a backends registrados
 * 
 * Variables de entorno:
 *   - BACKENDS_REGISTRY_URL: URL del servidor de registro (requerido)
 *   - API_KEY: API Key para acceder al KV Storage (requerido)
 *   - ENCRYPTION_KEY: Clave para desencriptar tokens (opcional)
 *   - CACHE_TTL_MS: TTL del caché en ms (default: 30000)
 *   - TOKEN_TTL_MS: TTL de tokens de autenticación en ms (default: 3600000)
 */

const CONFIG = {
    backendsRegistryUrl: Deno.env.get('BACKENDS_REGISTRY_URL') || '',
    apiKey: Deno.env.get('API_KEY') || '',
    encryptionKey: Deno.env.get('ENCRYPTION_KEY') || 'go-oracle-api-secure-key-2026',
    cacheTTL: parseInt(Deno.env.get('CACHE_TTL_MS') || '30000'),
    tokenTTL: parseInt(Deno.env.get('TOKEN_TTL_MS') || '3600000'), // 1 hora por defecto
};

interface BackendConfig {
    name: string;
    url: string;
    token: string;
    prefix: string;
}

interface BackendStatus {
    config: BackendConfig;
    healthy: boolean;
    decryptedToken?: string;
}

interface AuthToken {
    token: string;
    expiresAt: number;
    createdAt: number;
}

class GatewayServer {
    private backends: Map<string, BackendStatus> = new Map();
    private routingTable: Map<string, string[]> = new Map();
    private roundRobinCounters: Map<string, number> = new Map();
    private lastRefresh = 0;
    private refreshPromise: Promise<void> | null = null;
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

    private async validateUserFromKV(username: string, password: string): Promise<boolean> {
        try {
            // Obtener usuario específico por su key
            const response = await fetch(`${CONFIG.backendsRegistryUrl}/collections/users/${username}`, {
                headers: {
                    'Authorization': `Bearer ${CONFIG.apiKey}`,
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.error(`❌ Usuario ${username} no encontrado en KV`);
                } else {
                    console.error(`❌ Error obteniendo usuario ${username}: ${response.status}`);
                }
                return false;
            }

            const result = await response.json() as { data: { passwordHash: string } };
            
            if (!result.data || !result.data.passwordHash) {
                console.error(`❌ Datos de usuario ${username} incompletos`);
                return false;
            }
            
            const passwordHash = await this.hashPassword(password);
            const isValid = result.data.passwordHash === passwordHash;
            
            if (isValid) {
                console.log(`✅ Usuario ${username} autenticado correctamente`);
            } else {
                console.error(`❌ Password incorrecto para usuario ${username}`);
            }
            
            return isValid;
        } catch (error) {
            console.error('Error validando usuario desde KV:', error);
            return false;
        }
    }

    private async login(username: string, password: string): Promise<{ token: string; expiresIn: number } | null> {
        // Validar únicamente contra usuarios en KV Storage
        const isValid = await this.validateUserFromKV(username, password);
        
        if (!isValid) {
            return null;
        }
        
        const token = this.generateToken();
        const expiresAt = Date.now() + CONFIG.tokenTTL;
        
        this.tokens.set(token, {
            token,
            expiresAt,
            createdAt: Date.now(),
        });
        
        // Limpiar tokens expirados
        this.cleanupExpiredTokens();
        
        return {
            token,
            expiresIn: CONFIG.tokenTTL / 1000, // en segundos
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

    private async ensureBackendsLoaded(): Promise<void> {
        const now = Date.now();
        
        if (now - this.lastRefresh < CONFIG.cacheTTL) {
            return;
        }

        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this.refreshBackends();
        await this.refreshPromise;
        this.refreshPromise = null;
    }

    private async refreshBackends() {
        try {
            console.log('🔄 Actualizando backends...');
            const response = await fetch(`${CONFIG.backendsRegistryUrl}/collections/backend`, {
                headers: {
                    'Authorization': `Bearer ${CONFIG.apiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.error(`❌ Error obteniendo backends: ${response.status}`);
                return;
            }

            const data = await response.json() as { items: Array<{ key: string; data: BackendConfig }> };
            const items = data.items || [];
            
            const newBackends = new Map<string, BackendStatus>();
            const newRoutingTable = new Map<string, string[]>();

            for (const item of items) {
                if (!item?.key || !item?.data) continue;
                
                const backendName = item.key;
                const config = item.data;
                
                if (!config.token || !config.url || !config.prefix) continue;

                const decryptedToken = await this.decryptToken(config.token);
                const existingStatus = this.backends.get(backendName);
                
                newBackends.set(backendName, {
                    config,
                    healthy: existingStatus?.healthy ?? true,
                    decryptedToken,
                });

                const prefix = this.normalizePrefix(config.prefix || '/');
                if (!newRoutingTable.has(prefix)) newRoutingTable.set(prefix, []);
                newRoutingTable.get(prefix)!.push(backendName);
            }

            this.backends = newBackends;
            this.routingTable = newRoutingTable;
            this.lastRefresh = Date.now();

            console.log(`✅ ${this.backends.size} backends cargados`);
        } catch (error) {
            console.error('❌ Error actualizando backends:', error);
        }
    }

    private async decryptToken(encryptedToken: string): Promise<string> {
        try {
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();

            const encrypted = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));

            const salt = encrypted.slice(0, 16);
            const iv = encrypted.slice(16, 28);
            const data = encrypted.slice(28);

            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(CONFIG.encryptionKey),
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

            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                derivedKey,
                data
            );

            return decoder.decode(decryptedData);
        } catch (error) {
            console.error('❌ Error desencriptando token:', error);
            return encryptedToken;
        }
    }

    private normalizePrefix(prefix: string): string {
        let normalized = prefix.trim();
        if (!normalized.startsWith('/')) normalized = '/' + normalized;
        if (normalized.endsWith('/') && normalized.length > 1) normalized = normalized.slice(0, -1);
        return normalized;
    }

    private removePrefix(path: string, prefix: string): string {
        const normalizedPrefix = this.normalizePrefix(prefix);
        const normalizedPath = path.startsWith('/') ? path : '/' + path;

        if (normalizedPath.startsWith(normalizedPrefix)) {
            const remaining = normalizedPath.slice(normalizedPrefix.length);
            return remaining.startsWith('/') ? remaining : '/' + remaining;
        }

        return normalizedPath;
    }

    private findBackendForPath(path: string): BackendStatus | null {
        let bestMatch = '';
        let matchedBackends: string[] = [];

        for (const [prefix, backends] of this.routingTable.entries()) {
            const prefixMatch = prefix === '/' 
                ? true 
                : path === prefix || path.startsWith(prefix + '/');
            
            if (prefixMatch && prefix.length > bestMatch.length) {
                bestMatch = prefix;
                matchedBackends = backends;
            }
        }

        if (matchedBackends.length === 0) return null;

        const healthyBackends = matchedBackends.filter(name => {
            const backend = this.backends.get(name);
            return backend && backend.healthy;
        });

        if (healthyBackends.length === 0) return null;

        const counter = this.roundRobinCounters.get(bestMatch) || 0;
        const selectedName = healthyBackends[counter % healthyBackends.length];
        this.roundRobinCounters.set(bestMatch, counter + 1);

        return this.backends.get(selectedName) || null;
    }

    async handleRequest(req: Request): Promise<Response> {
        const url = new URL(req.url);

        // CORS preflight
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
                    headers: { 'Content-Type': 'application/json' },
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
                    headers: { 'Content-Type': 'application/json' },
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

        // Health check público (sin autenticación)
        if (url.pathname === '/gateway/health') {
            return new Response(JSON.stringify({
                status: 'ok',
            }), {
                headers: { 'Content-Type': 'application/json' },
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
                },
            });
        }

        await this.ensureBackendsLoaded();

        // Info del gateway
        if (url.pathname === '/' || url.pathname === '/gateway') {
            return new Response(JSON.stringify({
                service: 'Backend Gateway',
                backends: this.backends.size,
                healthy: Array.from(this.backends.values()).filter(b => b.healthy).length,
                endpoints: {
                    login: 'POST /gateway/login (public)',
                    logout: 'POST /gateway/logout (requires token)',
                    health: 'GET /gateway/health (public)',
                    status: 'GET /gateway/status (requires token)',
                    routing: 'GET /gateway/routing (requires token)',
                },
            }, null, 2), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Status
        if (url.pathname === '/gateway/status') {
            const status = Array.from(this.backends.entries()).map(([name, backend]) => ({
                name,
                url: backend.config.url,
                prefix: backend.config.prefix,
                healthy: backend.healthy,
            }));

            return new Response(JSON.stringify({
                total: this.backends.size,
                healthy: Array.from(this.backends.values()).filter(b => b.healthy).length,
                backends: status,
            }, null, 2), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Routing table
        if (url.pathname === '/gateway/routing') {
            const routing = Array.from(this.routingTable.entries()).map(([prefix, backends]) => ({
                prefix,
                backends,
                example: `${url.protocol}//${url.host}${prefix}/example`,
            }));

            return new Response(JSON.stringify({
                routes: routing,
            }, null, 2), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Buscar backend
        const backend = this.findBackendForPath(url.pathname);

        if (!backend) {
            return new Response(JSON.stringify({
                error: 'No backend found',
                path: url.pathname,
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Proxy al backend
        const pathWithoutPrefix = this.removePrefix(url.pathname, backend.config.prefix);
        const backendUrl = `${backend.config.url}${pathWithoutPrefix}${url.search}`;

        console.log(`➡️  ${req.method} ${url.pathname} -> ${backend.config.name}`);

        try {
            const headers = new Headers(req.headers);
            headers.set('Authorization', `Bearer ${backend.decryptedToken}`);
            headers.set('X-Forwarded-For', req.headers.get('x-forwarded-for') || 'unknown');
            headers.set('X-Forwarded-Host', url.host);
            headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

            const backendResponse = await fetch(backendUrl, {
                method: req.method,
                headers,
                body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            });

            const responseHeaders = new Headers(backendResponse.headers);
            responseHeaders.set('X-Proxied-By', 'gateway');
            responseHeaders.set('X-Backend-Name', backend.config.name);
            responseHeaders.set('Access-Control-Allow-Origin', '*');

            return new Response(backendResponse.body, {
                status: backendResponse.status,
                statusText: backendResponse.statusText,
                headers: responseHeaders,
            });
        } catch (error) {
            console.error(`❌ Error en ${backend.config.name}:`, error);
            return new Response(JSON.stringify({
                error: 'Backend error',
                backend: backend.config.name,
                message: error instanceof Error ? error.message : 'Unknown error',
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }
}

const gateway = new GatewayServer();

async function handleRequest(req: Request): Promise<Response> {
    if (!CONFIG.apiKey || !CONFIG.backendsRegistryUrl) {
        return new Response(JSON.stringify({
            error: 'Configuration error',
            message: 'BACKENDS_REGISTRY_URL and API_KEY environment variables are required',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return gateway.handleRequest(req);
}

// Para ejecutar localmente: deno serve --allow-net --allow-env gateway-server.ts

export default {
    fetch: handleRequest,
};
