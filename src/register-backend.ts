#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Backend Auto-Registration para KV Storage API
 * 
 * Registra un backend en el servidor de registro de backends
 * 
 * Uso:
 *   deno run -A src/register-backend.ts \
 *     --name=prod \
 *     --backend-url=http://10.6.46.114:3013 \
 *     --backend-token=secret \
 *     --prefix=/prod \
 *     --registry-url=http://localhost:8000 \
 *     --api-key=test-token-123 \
 *     --daemon
 * 
 * Argumentos:
 *   --name: Nombre identificador del backend (requerido)
 *   --backend-url: URL del backend (requerido, o --use-public-ip)
 *   --backend-token: Token de autenticación del backend (requerido)
 *   --prefix: Prefijo de ruta para enrutamiento (requerido)
 *   --registry-url: URL del servidor de registro de backends (requerido)
 *   --api-key: API Key para acceder al registro (requerido)
 *   --backend-port: Puerto local (requerido con --use-public-ip)
 *   --use-public-ip: Detectar IP pública automáticamente
 *   --encryption-key: Clave de encriptación para tokens
 *   --daemon: Ejecutar en modo demonio (re-registra cada 5 minutos)
 * 
 * Variables de entorno:
 *   - BACKEND_NAME: Nombre del backend
 *   - BACKEND_URL: URL del backend
 *   - BACKEND_TOKEN: Token de autenticación
 *   - BACKEND_PREFIX: Prefijo de ruta
 *   - BACKENDS_REGISTRY_URL: URL del servidor de registro de backends
 *   - API_KEY: API Key para el registro
 *   - PORT: Puerto local
 *   - ENCRYPTION_KEY: Clave para encriptar tokens
 */

function parseArgs(): Record<string, string> {
    const args: Record<string, string> = {};
    for (const arg of Deno.args) {
        if (arg.startsWith('--') && arg.includes('=')) {
            const [key, value] = arg.slice(2).split('=');
            args[key] = value;
        }
    }
    return args;
}

const args = parseArgs();

const CONFIG = {
    name: args.name || Deno.env.get('BACKEND_NAME') || '',
    backendUrl: args['backend-url'] || Deno.env.get('BACKEND_URL') || '',
    backendToken: args['backend-token'] || Deno.env.get('BACKEND_TOKEN') || '',
    prefix: args.prefix || Deno.env.get('BACKEND_PREFIX') || '',
    backendsRegistryUrl: args['registry-url'] || Deno.env.get('BACKENDS_REGISTRY_URL') || '',
    apiKey: args['api-key'] || Deno.env.get('API_KEY') || '',
    usePublicIP: Deno.args.includes('--use-public-ip'),
    backendPort: args['backend-port'] || Deno.env.get('PORT') || '',
};

const DAEMON_INTERVAL = 5 * 60 * 1000;
const isDaemon = Deno.args.includes('--daemon');
const ENCRYPTION_KEY = args['encryption-key'] || Deno.env.get('ENCRYPTION_KEY') || 'go-oracle-api-secure-key-2026';

interface BackendConfig {
    name: string;
    url: string;
    token: string;
    prefix: string;
}

interface BackendMetadata {
    registeredAt: string;
    lastUpdate: string;
    system: { hostname: string; os: string; arch: string; denoVersion: string; publicIP: string };
}

// Funciones de encriptación
async function encryptToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(ENCRYPTION_KEY),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
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
        ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        derivedKey,
        data
    );
    
    const result = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encryptedData), salt.length + iv.length);
    
    return btoa(String.fromCharCode(...result));
}

function validateConfig(): void {
    if (CONFIG.usePublicIP && CONFIG.backendUrl) {
        console.error('❌ Error: No puedes usar --backend-url y --use-public-ip al mismo tiempo');
        Deno.exit(1);
    }
    
    const required = [
        { key: 'name', value: CONFIG.name, flag: '--name' },
        { key: 'backendToken', value: CONFIG.backendToken, flag: '--backend-token' },
        { key: 'prefix', value: CONFIG.prefix, flag: '--prefix' },
        { key: 'backendsRegistryUrl', value: CONFIG.backendsRegistryUrl, flag: '--registry-url' },
        { key: 'apiKey', value: CONFIG.apiKey, flag: '--api-key' },
    ];
    
    if (!CONFIG.usePublicIP) {
        required.push({ key: 'backendUrl', value: CONFIG.backendUrl, flag: '--backend-url' });
    } else {
        required.push({ key: 'backendPort', value: CONFIG.backendPort, flag: '--backend-port' });
    }
    
    const missing = required.filter(r => !r.value);
    
    if (missing.length > 0) {
        console.error(`❌ Faltan: ${missing.map(m => m.flag).join(', ')}`);
        console.error('\n💡 Ejemplo:');
        console.error('  deno run -A register-backend.ts \\');
        console.error('    --name=desarrollo \\');
        console.error('    --backend-url=http://localhost:3000 \\');
        console.error('    --backend-token=token123 \\');
        console.error('    --prefix=/desa \\');
        console.error('    --registry-url=http://localhost:8000 \\');
        console.error('    --api-key=test-token-123');
        Deno.exit(1);
    }
}

async function getPublicIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json', { 
            signal: AbortSignal.timeout(5000) 
        });
        const data = await response.json();
        return data.ip || 'unknown';
    } catch {
        return 'unknown';
    }
}

function buildPublicURL(publicIP: string, port: string): string {
    return `http://${publicIP}:${port}`;
}

async function registerBackend(): Promise<boolean> {
    try {
        const publicIP = await getPublicIP();
        const finalURL = CONFIG.usePublicIP 
            ? buildPublicURL(publicIP, CONFIG.backendPort)
            : CONFIG.backendUrl;
        
        const systemInfo = {
            hostname: Deno.hostname?.() || 'unknown',
            os: Deno.build.os,
            arch: Deno.build.arch,
            denoVersion: Deno.version.deno,
            publicIP: publicIP,
        };
        const timestamp = new Date().toISOString();
        
        const encryptedToken = await encryptToken(CONFIG.backendToken);
        
        // Formato con metadata separado
        const kvPayload = {
            key: CONFIG.name,
            data: {
                name: CONFIG.name,
                url: finalURL,
                token: encryptedToken,
                prefix: CONFIG.prefix,
            },
            metadata: {
                registeredAt: timestamp,
                lastUpdate: timestamp,
                system: systemInfo,
            },
        };
        
        if (CONFIG.usePublicIP) {
            console.log(`🔄 Registrando "${CONFIG.name}" - IP: ${publicIP}:${CONFIG.backendPort}`);
        } else {
            console.log(`🔄 Registrando "${CONFIG.name}" - URL: ${CONFIG.backendUrl}`);
        }
        
        console.log(`   Prefix: ${CONFIG.prefix}`);
        console.log(`   Token: ${CONFIG.backendToken.substring(0, 4)}***`);
        console.log(`   Backends Registry: ${CONFIG.backendsRegistryUrl}`);
        
        // Intentar GET primero para ver si existe
        let existsResponse;
        try {
            existsResponse = await fetch(`${CONFIG.backendsRegistryUrl}/collections/backend/${CONFIG.name}`, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${CONFIG.apiKey}`,
                },
            });
        } catch {
            existsResponse = { ok: false, status: 404 } as Response;
        }
        
        let response;
        
        // Si existe (200), actualizar con PUT
        if (existsResponse.ok) {
            console.log(`   ℹ️  Backend existe, actualizando...`);
            response = await fetch(`${CONFIG.backendsRegistryUrl}/collections/backend/${CONFIG.name}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.apiKey}`,
                },
                body: JSON.stringify(kvPayload),
            });
        } else {
            // Si no existe (404), crear con POST
            console.log(`   ℹ️  Backend no existe, creando nuevo...`);
            response = await fetch(`${CONFIG.backendsRegistryUrl}/collections/backend`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.apiKey}`,
                },
                body: JSON.stringify(kvPayload),
            });
        }
        
        if (!response.ok) {
            console.error(`❌ Error registrando: ${response.status} ${response.statusText}`);
            const error = await response.text();
            console.error('Respuesta:', error);
            return false;
        }
        
        const result = await response.json();
        console.log(`✅ Backend registrado exitosamente`);
        console.log(`\n📋 Detalles:`);
        console.log(`   Key: ${kvPayload.key}`);
        console.log(`   Nombre: ${kvPayload.data.name}`);
        console.log(`   URL: ${kvPayload.data.url}`);
        console.log(`   Prefix: ${kvPayload.data.prefix}`);
        console.log(`   Registrado: ${timestamp}`);
        
        return true;
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function main() {
    console.log('\x1b[1m\x1b[36m📝 Backend Registration\x1b[0m\n');
    
    validateConfig();
    
    if (isDaemon) {
        console.log(`⏰ Modo daemon activado (cada ${DAEMON_INTERVAL / 1000 / 60} minutos)\n`);
        
        while (true) {
            const success = await registerBackend();
            if (success) {
                console.log(`\n⏳ Próximo intento en ${DAEMON_INTERVAL / 1000 / 60} minutos...\n`);
            } else {
                console.log(`\n⏳ Reintentando en ${DAEMON_INTERVAL / 1000 / 60} minutos...\n`);
            }
            await new Promise(resolve => setTimeout(resolve, DAEMON_INTERVAL));
        }
    } else {
        const success = await registerBackend();
        Deno.exit(success ? 0 : 1);
    }
}

main();
