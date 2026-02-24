/**
 * Gestión de backends y proxy HTTP
 * Maneja carga, búsqueda y proxy de peticiones a backends
 */

import { Backend, KVStorageBackendResponse } from './types.ts';
import { CryptoManager } from './crypto.ts';
import type { GatewayConfig } from './config.ts';

export class BackendManager {
    private backends: Map<string, Backend> = new Map();
    private crypto: CryptoManager;
    private isInitialized = false;

    constructor(private config: GatewayConfig) {
        this.crypto = new CryptoManager(config.auth.encryptionKey);
    }

    /**
     * Inicializa cargando los backends
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;
        console.log('🔄 Inicializando backend manager...');
        await this.loadBackends();
        this.isInitialized = true;
    }

    /**
     * Carga backends desde el KV storage
     */
    async loadBackends(): Promise<void> {
        try {
            console.log('🔄 Cargando backends desde KV storage...');
            
            const response = await fetch(
                `${this.config.backends.registryUrl}/collections/backend`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.backends.apiKey}`,
                    },
                }
            );

            if (!response.ok) {
                console.error(`❌ Error: ${response.status}`);
                return;
            }

            const result = await response.json() as KVStorageBackendResponse;
            
            this.backends.clear();
            
            // Procesar items del KV storage
            if (result.items && Array.isArray(result.items)) {
                for (const item of result.items) {
                    if (item.data) {
                        this.backends.set(item.key, item.data);
                        console.log(`   ✓ ${item.key}: ${item.data.prefix} -> ${item.data.url}`);
                    }
                }
            }

            console.log(`✅ ${this.backends.size} backends cargados\n`);
        } catch (error) {
            console.error('❌ Error cargando backends:', error);
        }
    }

    /**
     * Busca el backend que coincide con la ruta
     */
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

    /**
     * Remueve el prefijo de la ruta
     */
    removePrefix(path: string, prefix: string): string {
        const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
        if (path.startsWith(normalizedPrefix)) {
            const remaining = path.slice(normalizedPrefix.length);
            return remaining || '/';
        }
        return path;
    }

    /**
     * Realiza el proxy de una petición a un backend
     */
    async proxyRequest(
        req: Request,
        backend: Backend,
        url: URL,
        requestId: string
    ): Promise<Response> {
        const pathWithoutPrefix = this.removePrefix(url.pathname, backend.prefix);
        const backendUrl = `${backend.url}${pathWithoutPrefix}${url.search}`;
        const startTime = Date.now();

        console.log(`[${requestId}] ➡️  ${req.method} ${url.pathname} -> ${backend.name} (${backendUrl})`);

        try {
            // Headers para el backend
            const headers = new Headers(req.headers);
            
            // Desencriptar el token del backend
            const decryptedToken = await this.crypto.decryptToken(backend.token);
            headers.set('Authorization', `Bearer ${decryptedToken}`);
            headers.delete('host'); // Evitar conflictos
            
            // Proxy request
            const backendResponse = await fetch(backendUrl, {
                method: req.method,
                headers,
                body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            });

            const latency = Date.now() - startTime;
            console.log(`[${requestId}] ✅ ${backendResponse.status} (${latency}ms)`);

            return {
                response: backendResponse,
                latency,
                backend,
            } as any;

        } catch (error) {
            const latency = Date.now() - startTime;
            console.error(`[${requestId}] ❌ Error proxying to ${backend.name} (${latency}ms):`, error);
            
            throw {
                error,
                latency,
                backend,
                url: backendUrl,
            };
        }
    }

    /**
     * Obtiene la lista de backends
     */
    getBackendsList(): Array<{ name: string; prefix: string; url: string }> {
        return Array.from(this.backends.values()).map(b => ({
            name: b.name,
            prefix: b.prefix,
            url: b.url,
        }));
    }

    /**
     * Obtiene la lista detallada de backends
     */
    getBackendsDetailedList(): Array<{ key: string; name: string; prefix: string; url: string; hasToken: boolean; tokenLength: number }> {
        return Array.from(this.backends.entries()).map(([key, b]) => ({
            key: key,
            name: b.name,
            prefix: b.prefix,
            url: b.url,
            hasToken: !!b.token,
            tokenLength: b.token?.length || 0,
        }));
    }

    /**
     * Obtiene el número de backends
     */
    getBackendsCount(): number {
        return this.backends.size;
    }
}
