/**
 * Configuración centralizada del Gateway
 * Carga y valida variables de entorno
 */

/// <reference lib="deno.ns" />

export interface GatewayConfig {
    port: number;
    backends: {
        registryUrl: string;
        apiKey: string;
        cacheTTL: number;
    };
    auth: {
        tokenTTL: number;
        encryptionKey: string;
    };
    cors: {
        allowedOrigins: string[];
    };
}

export function loadConfig(): GatewayConfig {
    return {
        port: parseInt(Deno.env.get('PORT') || '8080'),
        backends: {
            registryUrl: Deno.env.get('STORAGE_URL') || Deno.env.get('KV_STORAGE_URL') || Deno.env.get('BACKENDS_REGISTRY_URL') || 'https://kv-storage-api.deno.dev',
            apiKey: Deno.env.get('API_KEY') || 'desarrollo-api-key-2026',
            cacheTTL: parseInt(Deno.env.get('CACHE_TTL_MS') || '30000'),
        },
        auth: {
            tokenTTL: parseInt(Deno.env.get('TOKEN_TTL_MS') || '3600000'), // 1 hora
            encryptionKey: Deno.env.get('ENCRYPTION_KEY') || 'go-oracle-api-secure-key-2026',
        },
        cors: {
            allowedOrigins: Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*'],
        },
    };
}

export function validateConfig(config: GatewayConfig): void {
    const errors: string[] = [];
    
    if (!config.backends.registryUrl) {
        errors.push('STORAGE_URL es requerido');
    }
    
    if (!config.backends.apiKey) {
        errors.push('API_KEY es requerido');
    }
    
    if (!config.auth.encryptionKey) {
        errors.push('ENCRYPTION_KEY es requerido');
    } else if (config.auth.encryptionKey.length < 32) {
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
    console.log(`   - Registry: ${config.backends.registryUrl}`);
    console.log(`   - Port: ${config.port}`);
    console.log(`   - Token TTL: ${config.auth.tokenTTL / 1000}s`);
    console.log(`   - CORS Origins: ${config.cors.allowedOrigins.join(', ')}`);
    console.log('');
}
