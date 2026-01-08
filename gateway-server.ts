/**
 * Gateway Server para Backends Registrados
 * Compatible con Deno Deploy
 * 
 * Administra y enruta peticiones a los backends registrados en el KV Storage
 * 
 * Uso Local:
 *   deno run -A gateway-server.ts
 * 
 * Variables de entorno:
 *   - BACKENDS_REGISTRY_URL: URL del servidor de registro de backends (requerido)
 *   - API_KEY: API Key para acceder al KV Storage (requerido)
 *   - ENCRYPTION_KEY: Clave para desencriptar tokens
 *   - PROXY_PORT: Puerto local (solo para ejecución local)
 *   - CACHE_TTL_MS: TTL del caché de backends (default: 30000)
 * 
 * Características:
 * - Auto-descubrimiento de backends desde KV Storage con caché
 * - Desencriptación automática de tokens
 * - Routing basado en prefijos
 * - Health checks on-demand
 * - Balanceo de carga round-robin
 */

const CONFIG = {
    port: parseInt(Deno.env.get('PROXY_PORT') || '8080'),
    backendsRegistryUrl: Deno.env.get('BACKENDS_REGISTRY_URL') || '',
    apiKey: Deno.env.get('API_KEY') || '',
    encryptionKey: Deno.env.get('ENCRYPTION_KEY') || 'go-oracle-api-secure-key-2026',
    cacheTTL: parseInt(Deno.env.get('CACHE_TTL_MS') || '30000'), // 30 segundos
    healthCheckTimeout: 5000, // 5 segundos
};

interface BackendConfig {
    name: string;
    url: string;
    token: string;
    prefix: string;
    metadata?: {
        registeredAt: string;
        lastUpdate: string;
        system: {
            hostname: string;
            os: string;
            arch: string;
            denoVersion: string;
            publicIP: string;
        };
    };
}

interface BackendStatus {
    config: BackendConfig;
    healthy: boolean;
    lastCheck: number;
    consecutiveFailures: number;
    decryptedToken?: string;
}

class GatewayServer {
    private backends: Map<string, BackendStatus> = new Map();
    private routingTable: Map<string, string[]> = new Map(); // prefix -> [backend names]
    private roundRobinCounters: Map<string, number> = new Map();
    private lastRefresh = 0;
    private refreshPromise: Promise<void> | null = null;

    // Actualización lazy: solo cuando se necesita y ha pasado el TTL
    private async ensureBackendsLoaded(): Promise<void> {
        const now = Date.now();
        
        // Si está dentro del TTL, no refrescar
        if (now - this.lastRefresh < CONFIG.cacheTTL) {
            return;
        }

        // Si ya hay un refresh en progreso, esperar a que termine
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        // Iniciar nuevo refresh
        this.refreshPromise = this.refreshBackends();
        await this.refreshPromise;
        this.refreshPromise = null;
    }

    private async refreshBackends() {
        try {
            console.log('🔄 Actualizando lista de backends...');
            const url = `${CONFIG.backendsRegistryUrl}/collections/backends`;
            console.log(`📡 Conectando a: ${url}`);
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${CONFIG.apiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.error(`❌ Error obteniendo backends: ${response.status} ${response.statusText}`);
                const text = await response.text();
                console.error(`   Respuesta: ${text.substring(0, 200)}`);
                return;
            }

            const data = await response.json();
            console.log(`✅ Datos recibidos:`, Object.keys(data).length, 'claves');
            
            const newBackends = new Map<string, BackendStatus>();
            const newRoutingTable = new Map<string, string[]>();

            // El servicio retorna items con estructura: { key: "nombre", data: {...}, metadata: {...} }
            for (const item of data as Array<{ key: string; data: BackendConfig }>) {
                const backendName = item.key;
                const config = item.data;
                console.log(`   ✅ Backend cargado: ${backendName}`);

                // Desencriptar token
                const decryptedToken = await this.decryptToken(config.token);

                const existingStatus = this.backends.get(backendName);
                newBackends.set(backendName, {
                    config,
                    healthy: existingStatus?.healthy ?? true,
                    lastCheck: existingStatus?.lastCheck ?? 0,
                    consecutiveFailures: existingStatus?.consecutiveFailures ?? 0,
                    decryptedToken,
                });

                // Actualizar tabla de enrutamiento
                const prefix = this.normalizePrefix(config.prefix || '/');
                if (!newRoutingTable.has(prefix)) {
                    newRoutingTable.set(prefix, []);
                }
                newRoutingTable.get(prefix)!.push(backendName);
            }

            this.backends = newBackends;
            this.routingTable = newRoutingTable;
            this.lastRefresh = Date.now();

            console.log(`✅ ${this.backends.size} backends cargados`);
            console.log('📍 Tabla de enrutamiento:');
            for (const [prefix, backends] of this.routingTable.entries()) {
                console.log(`   "${prefix}" -> [${backends.join(', ')}]`);
            }
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
            return encryptedToken; // Fallback al token original
        }
    }

    private async checkBackendHealth(backend: BackendStatus): Promise<boolean> {
        // Health check on-demand con timeout
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.healthCheckTimeout);

            const response = await fetch(`${backend.config.url}/health`, {
                signal: controller.signal,
                headers: {
                    'Authorization': `Bearer ${backend.decryptedToken}`,
                },
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                backend.healthy = true;
                backend.consecutiveFailures = 0;
                backend.lastCheck = Date.now();
                return true;
            } else {
                backend.consecutiveFailures++;
                backend.healthy = backend.consecutiveFailures < 3;
                backend.lastCheck = Date.now();
                return false;
            }
        } catch (_error) {
            backend.consecutiveFailures++;
            backend.healthy = backend.consecutiveFailures < 3;
            backend.lastCheck = Date.now();
            return false;
        }
    }

    private normalizePrefix(prefix: string): string {
        // Normalizar prefijo: asegurar que empiece con / y no termine con /
        let normalized = prefix.trim();
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        if (normalized.endsWith('/') && normalized.length > 1) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    private removePrefix(path: string, prefix: string): string {
        // Normalizar ambos
        const normalizedPrefix = this.normalizePrefix(prefix);
        const normalizedPath = path.startsWith('/') ? path : '/' + path;

        // Eliminar prefix solo si está al inicio
        if (normalizedPath.startsWith(normalizedPrefix)) {
            const remaining = normalizedPath.slice(normalizedPrefix.length);
            // Asegurar que empiece con /
            return remaining.startsWith('/') ? remaining : '/' + remaining;
        }

        // Si no coincide, devolver el path original
        return normalizedPath;
    }

    private findBackendForPath(path: string): BackendStatus | null {
        // Buscar el prefijo más específico que coincida
        let bestMatch = '';
        let matchedBackends: string[] = [];

        for (const [prefix, backends] of this.routingTable.entries()) {
            if (path.startsWith(prefix) && prefix.length > bestMatch.length) {
                bestMatch = prefix;
                matchedBackends = backends;
            }
        }

        if (matchedBackends.length === 0) {
            return null;
        }

        // Filtrar solo backends saludables
        const healthyBackends = matchedBackends.filter(name => {
            const backend = this.backends.get(name);
            return backend && backend.healthy;
        });

        if (healthyBackends.length === 0) {
            console.warn(`⚠️  No hay backends saludables para ${path}`);
            return null;
        }

        // Round-robin entre backends saludables
        const counter = this.roundRobinCounters.get(bestMatch) || 0;
        const selectedName = healthyBackends[counter % healthyBackends.length];
        this.roundRobinCounters.set(bestMatch, counter + 1);

        return this.backends.get(selectedName) || null;
    }

    async handleRequest(req: Request): Promise<Response> {
        // Asegurar que los backends estén cargados (con caché)
        await this.ensureBackendsLoaded();

        const url = new URL(req.url);

        // Health check del proxy
        if (url.pathname === '/proxy/health' || url.pathname === '/gateway/health') {
            return new Response(JSON.stringify({
                status: 'ok',
                backends: this.backends.size,
                healthy: Array.from(this.backends.values()).filter(b => b.healthy).length,
                cacheAge: Date.now() - this.lastRefresh,
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Status del proxy
        if (url.pathname === '/proxy/status' || url.pathname === '/gateway/status') {
            const status = Array.from(this.backends.entries()).map(([name, backend]) => ({
                name,
                url: backend.config.url,
                prefix: backend.config.prefix,
                normalized_prefix: this.normalizePrefix(backend.config.prefix),
                healthy: backend.healthy,
                lastCheck: backend.lastCheck > 0 ? new Date(backend.lastCheck).toISOString() : 'never',
                consecutiveFailures: backend.consecutiveFailures,
            }));

            return new Response(JSON.stringify({
                total: this.backends.size,
                healthy: Array.from(this.backends.values()).filter(b => b.healthy).length,
                backends: status,
                cacheAge: Date.now() - this.lastRefresh,
            }, null, 2), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Routing table
        if (url.pathname === '/proxy/routing' || url.pathname === '/gateway/routing') {
            const routing = Array.from(this.routingTable.entries()).map(([prefix, backends]) => ({
                prefix,
                backends,
                example: `${url.protocol}//${url.host}${prefix}/example`,
            }));

            return new Response(JSON.stringify(routing, null, 2), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Buscar backend para la ruta
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

        // Construir URL del backend
        const pathWithoutPrefix = this.removePrefix(url.pathname, backend.config.prefix);
        const backendUrl = `${backend.config.url}${pathWithoutPrefix}${url.search}`;

        console.log(`➡️  ${req.method} ${url.pathname}`);
        console.log(`   Prefix: "${backend.config.prefix}" -> Path sin prefix: "${pathWithoutPrefix}"`);
        console.log(`   Backend: ${backend.config.name} -> ${backendUrl}`);

        try {
            // Copiar headers de la petición original
            const headers = new Headers(req.headers);
            headers.set('Authorization', `Bearer ${backend.decryptedToken}`);
            headers.set('X-Forwarded-For', req.headers.get('x-forwarded-for') || 'unknown');
            headers.set('X-Forwarded-Host', url.host);
            headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

            // Hacer la petición al backend
            const backendResponse = await fetch(backendUrl, {
                method: req.method,
                headers,
                body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            });

            // Copiar respuesta del backend
            const responseHeaders = new Headers(backendResponse.headers);
            responseHeaders.set('X-Proxied-By', 'gateway-server');
            responseHeaders.set('X-Backend-Name', backend.config.name);

            return new Response(backendResponse.body, {
                status: backendResponse.status,
                statusText: backendResponse.statusText,
                headers: responseHeaders,
            });
        } catch (error) {
            console.error(`❌ Error en petición a ${backend.config.name}:`, error);
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

// Instancia global del gateway
const gateway = new GatewayServer();

// Handler para Deno Deploy (exportado por defecto)
export default {
    fetch: async (req: Request): Promise<Response> => {
        // Validar configuración en cada request (para Deno Deploy)
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
    },
};

// Inicialización para ejecución local (solo si se ejecuta directamente)
if (import.meta.main) {
    // Solo validar en modo local
    if (!CONFIG.apiKey || !CONFIG.backendsRegistryUrl) {
        console.error('❌ Error: Se requiere BACKENDS_REGISTRY_URL y API_KEY como variables de entorno');
        throw new Error('Missing required environment variables');
    }
    
    console.log(`🚀 Gateway Server iniciando en puerto ${CONFIG.port}`);
    console.log(`📡 Backends Registry: ${CONFIG.backendsRegistryUrl}`);

    Deno.serve({
        port: CONFIG.port,
        onListen: ({ port, hostname }) => {
            console.log(`✅ Gateway Server ejecutándose en http://${hostname}:${port}`);
            console.log(`\n📊 Endpoints de monitoreo:`);
            console.log(`   - http://${hostname}:${port}/gateway/health`);
            console.log(`   - http://${hostname}:${port}/gateway/status`);
            console.log(`   - http://${hostname}:${port}/gateway/routing\n`);
        },
    }, (req) => gateway.handleRequest(req));
}
