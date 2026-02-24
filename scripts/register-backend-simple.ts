#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Versión simplificada de register-backend
 * 
 * Uso simple (prefix se genera automáticamente):
 *   deno run -A scripts/register-backend-simple.ts \
 *     usuarios \
 *     https://api-usuarios.com \
 *     token-123
 * 
 * Uso con prefix personalizado:
 *   deno run -A scripts/register-backend-simple.ts \
 *     pagos \
 *     https://api-pagos.com \
 *     token-456 \
 *     /payments
 * 
 * Uso con IP pública (auto-detección):
 *   deno run -A scripts/register-backend-simple.ts \
 *     desarrollo \
 *     --public-ip \
 *     token-123 \
 *     /dev \
 *     3000
 */

// Obtener argumentos
const [name, urlOrFlag, token, customPrefix, port] = Deno.args;
const usePublicIP = urlOrFlag === '--public-ip';

// Obtener argumentos
const [name, urlOrFlag, token, customPrefix, port] = Deno.args;
const usePublicIP = urlOrFlag === '--public-ip';

// Validar argumentos mínimos
if (!name || !token || (!usePublicIP && !urlOrFlag)) {
    console.error(`
❌ Uso incorrecto

Uso:
  deno run -A scripts/register-backend-simple.ts <name> <url> <token> [prefix]
  deno run -A scripts/register-backend-simple.ts <name> --public-ip <token> [prefix] <port>

Ejemplos:
  # Prefix automático (/usuarios)
  deno run -A scripts/register-backend-simple.ts usuarios https://api.com token-123

  # Prefix personalizado
  deno run -A scripts/register-backend-simple.ts pagos https://api.com token-456 /payments

  # IP pública automática (requiere puerto)
  deno run -A scripts/register-backend-simple.ts dev --public-ip token-123 /dev 3000

Variables de entorno requeridas:
  STORAGE_URL     - URL del almacenamiento KV
  API_KEY         - API Key del almacenamiento
  ENCRYPTION_KEY  - Clave de encriptación (32+ chars)
`);
    Deno.exit(1);
}

// Validar puerto si se usa IP pública
if (usePublicIP && !port) {
    console.error('❌ Error: --public-ip requiere especificar el puerto como último argumento');
    Deno.exit(1);
}

// Configuración desde variables de entorno
const STORAGE_URL = Deno.env.get('STORAGE_URL');
const API_KEY = Deno.env.get('API_KEY');
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY') || 'go-oracle-api-secure-key-2026';

if (!STORAGE_URL || !API_KEY) {
    console.error('❌ Error: STORAGE_URL y API_KEY son requeridos');
    console.error('   Configúralos como variables de entorno');
    Deno.exit(1);
}

// Prefix automático si no se especifica
const prefix = customPrefix || `/${name}`;

// Función para obtener IP pública
async function getPublicIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json', { 
            signal: AbortSignal.timeout(5000) 
        });
        const data = await response.json();
        return data.ip || 'unknown';
    } catch (error) {
        console.error('⚠️  No se pudo detectar IP pública:', error.message);
        return 'unknown';
    }
}

// Determinar URL final
let finalUrl: string;
if (usePublicIP) {
    console.log('🔍 Detectando IP pública...');
    const publicIP = await getPublicIP();
    if (publicIP === 'unknown') {
        console.error('❌ No se pudo detectar la IP pública');
        Deno.exit(1);
    }
    finalUrl = `http://${publicIP}:${port}`;
    console.log(`✅ IP pública detectada: ${publicIP}`);
} else {
    finalUrl = urlOrFlag;
}

console.log(`
📝 Configuración:
   Nombre:  ${name}
   URL:     ${finalUrl}
   Prefix:  ${prefix}
   Storage: ${STORAGE_URL}
`);

// Función de encriptación
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

// Registrar backend
try {
    console.log('🔐 Encriptando token...');
    const encryptedToken = await encryptToken(token);
    
    const backendData = {
        name,
        url: finalUrl,
        token: encryptedToken,
        prefix,
        registeredAt: new Date().toISOString(),
    };
    
    console.log('📤 Registrando backend...');
    
    const response = await fetch(`${STORAGE_URL}/backend:${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ value: backendData }),
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    console.log(`
✅ Backend registrado exitosamente

   Gateway URL: https://tu-gateway.com${prefix}/*
   Backend URL: ${finalUrl}
   
🧪 Probar:
   curl https://tu-gateway.com${prefix}/endpoint
`);
    
} catch (error) {
    console.error('\n❌ Error al registrar backend:', error.message);
    Deno.exit(1);
}
