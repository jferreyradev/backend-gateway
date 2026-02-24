#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * Registro masivo de backends desde archivo JSON
 * 
 * Uso:
 *   deno run -A scripts/register-backends-bulk.ts backends-config.json
 */

interface BackendConfig {
    name: string;
    url?: string;             // URL directa
    token: string;
    prefix?: string;          // Opcional, se genera automáticamente como /{name}
    usePublicIP?: boolean;    // Usar IP pública
    port?: number;            // Puerto si se usa IP pública
}

interface Config {
    storageUrl: string;
    apiKey: string;
    encryptionKey: string;
    backends: BackendConfig[];
}

async function encryptToken(token: string, encryptionKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(encryptionKey),
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
        true,
        ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        derivedKey,
        data
    );
    
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    return btoa(String.fromCharCode(...result));
}

async function getPublicIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json', { 
            signal: AbortSignal.timeout(5000) 
        });
        const data = await response.json();
        return data.ip || 'unknown';
    } catch (error) {
        console.error('⚠️  No se pudo detectar IP pública');
        return 'unknown';
    }
}

async function registerBackend(
    backend: BackendConfig,
    storageUrl: string,
    apiKey: string,
    encryptionKey: string
): Promise<void> {
    // Determinar URL final
    let finalUrl: string;
    
    if (backend.usePublicIP) {
        if (!backend.port) {
            throw new Error(`Backend ${backend.name}: port es requerido cuando usePublicIP es true`);
        }
        console.log(`🔍 Detectando IP pública para ${backend.name}...`);
        const publicIP = await getPublicIP();
        if (publicIP === 'unknown') {
            throw new Error(`No se pudo detectar IP pública para ${backend.name}`);
        }
        finalUrl = `http://${publicIP}:${backend.port}`;
        console.log(`   ✅ IP: ${publicIP}`);
    } else {
        if (!backend.url) {
            throw new Error(`Backend ${backend.name}: url es requerido cuando usePublicIP es false`);
        }
        finalUrl = backend.url;
    }
    
    const prefix = backend.prefix || `/${backend.name}`;
    const encryptedToken = await encryptToken(backend.token, encryptionKey);
    
    const backendData = {
        name: backend.name,
        url: finalUrl,
        token: encryptedToken,
        prefix: prefix,
        registeredAt: new Date().toISOString(),
    };
    
    console.log(`📤 Registrando ${backend.name} (${prefix} → ${finalUrl})...`);
    
    const response = await fetch(`${storageUrl}/backend:${backend.name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ value: backendData }),
    });
    
    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
    }
    
    console.log(`✅ ${backend.name} registrado exitosamente`);
}

// Main
const configFile = Deno.args[0] || 'backends-config.json';

console.log(`📖 Leyendo configuración de ${configFile}...\n`);

const config: Config = JSON.parse(await Deno.readTextFile(configFile));

console.log(`🚀 Registrando ${config.backends.length} backends...\n`);

for (const backend of config.backends) {
    try {
        await registerBackend(backend, config.storageUrl, config.apiKey, config.encryptionKey);
    } catch (error) {
        console.error(`❌ Error registrando ${backend.name}:`, error.message);
    }
}

console.log(`\n✅ Proceso completado`);
