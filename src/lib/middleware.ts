/**
 * Middleware y utilidades HTTP
 * Gestión de CORS, headers de seguridad y respuestas JSON
 */

import type { GatewayConfig } from './config.ts';

export class MiddlewareManager {
    constructor(private config: GatewayConfig) {}

    /**
     * Obtiene headers CORS configurables
     */
    getCorsHeaders(origin: string | null): Record<string, string> {
        let allowedOrigin = '*';
        
        const allowedOrigins = this.config.cors.allowedOrigins;
        
        if (!allowedOrigins.includes('*') && origin) {
            allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
        }
        
        return {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };
    }

    /**
     * Obtiene headers de seguridad estándar
     */
    getSecurityHeaders(): Record<string, string> {
        return {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
        };
    }

    /**
     * Aplica headers al Response
     */
    applyHeaders(
        response: Response,
        requestId: string,
        latency?: number,
        origin?: string | null,
        backendName?: string
    ): Response {
        const headers = new Headers(response.headers);
        
        // Request tracking
        headers.set('X-Request-ID', requestId);
        if (latency !== undefined) {
            headers.set('X-Response-Time', `${latency}ms`);
        }
        
        // Backend info
        if (backendName) {
            headers.set('X-Proxied-By', 'simple-gateway');
            headers.set('X-Backend', backendName);
        }
        
        // CORS
        const corsHeaders = this.getCorsHeaders(origin || null);
        Object.entries(corsHeaders).forEach(([key, value]) => {
            headers.set(key, value);
        });
        
        // Security
        const securityHeaders = this.getSecurityHeaders();
        Object.entries(securityHeaders).forEach(([key, value]) => {
            headers.set(key, value);
        });

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    }

    /**
     * Crea una respuesta JSON con headers apropiados
     */
    jsonResponse(
        data: any,
        status = 200,
        requestId?: string,
        origin?: string | null
    ): Response {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (requestId) {
            headers['X-Request-ID'] = requestId;
        }

        // CORS
        const corsHeaders = this.getCorsHeaders(origin || null);
        Object.assign(headers, corsHeaders);

        // Security
        const securityHeaders = this.getSecurityHeaders();
        Object.assign(headers, securityHeaders);

        return new Response(JSON.stringify(data, null, 2), {
            status,
            headers,
        });
    }

    /**
     * Crea una respuesta de error JSON
     */
    errorResponse(
        error: string,
        message: string,
        status = 500,
        requestId?: string,
        origin?: string | null
    ): Response {
        return this.jsonResponse(
            { error, message, requestId },
            status,
            requestId,
            origin
        );
    }

    /**
     * Maneja peticiones OPTIONS (CORS preflight)
     */
    handleOptions(origin: string | null): Response {
        return new Response(null, {
            status: 204,
            headers: {
                ...this.getCorsHeaders(origin),
                ...this.getSecurityHeaders(),
            },
        });
    }
}
