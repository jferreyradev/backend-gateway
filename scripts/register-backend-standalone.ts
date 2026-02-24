#!/usr/bin/env deno run --allow-net --allow-env
/**
 * Script standalone para registrar backends en el gateway
 * Se puede descargar y ejecutar sin necesidad del proyecto completo
 * 
 * Uso:
 *   deno run -A https://raw.githubusercontent.com/.../register-backend-standalone.ts \
 *     --name=mi-api --use-public-ip --backend-port=3000 --backend-token=secret --daemon
 * 
 * O descargarlo y ejecutar localmente:
 *   curl -O https://raw.githubusercontent.com/.../register-backend-standalone.ts
 *   deno run -A register-backend-standalone.ts --name=mi-api --use-public-ip --daemon
 */

// ============================================================================
// CONFIGURACIÓN - Editar aquí o pasar por variables de entorno
// ============================================================================

const CONFIG = {
  STORAGE_URL: Deno.env.get("STORAGE_URL") || "",
  API_KEY: Deno.env.get("API_KEY") || "",
  ENCRYPTION_KEY: Deno.env.get("ENCRYPTION_KEY") || "",
};

// ============================================================================
// FUNCIONES DE ENCRIPTACIÓN
// ============================================================================

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function encryptToken(token: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(encryptionKey, salt);

  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );

  const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

// ============================================================================
// DETECCIÓN DE IP PÚBLICA
// ============================================================================

async function getPublicIP(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.ip;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timeout al obtener IP pública (5s)");
    }
    throw new Error(`Error al obtener IP pública: ${error}`);
  }
}

// ============================================================================
// REGISTRO EN KV STORAGE
// ============================================================================

interface BackendData {
  url: string;
  token: string;
  prefix?: string;
  metadata?: {
    registered_at: string;
    last_update: string;
    [key: string]: unknown;
  };
}

async function registerBackend(
  name: string,
  url: string,
  token: string,
  prefix: string | undefined,
  storageUrl: string,
  apiKey: string,
  encryptionKey: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const encryptedToken = await encryptToken(token, encryptionKey);

  const backendData: BackendData = {
    url,
    token: encryptedToken,
    prefix,
    metadata: {
      registered_at: metadata?.registered_at as string || new Date().toISOString(),
      last_update: new Date().toISOString(),
      ...metadata,
    },
  };

  const response = await fetch(`${storageUrl}/backends/${name}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(backendData),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error al registrar: ${response.status} - ${text}`);
  }

  console.log(`✅ Backend '${name}' registrado exitosamente`);
  console.log(`   URL: ${url}`);
  if (prefix) console.log(`   Prefix: ${prefix}`);
  console.log(`   Timestamp: ${backendData.metadata.last_update}`);
}

// ============================================================================
// ARGUMENTOS DE LÍNEA DE COMANDOS
// ============================================================================

interface ParsedArgs {
  name?: string;
  "backend-url"?: string;
  "backend-token"?: string;
  "backend-port"?: string;
  prefix?: string;
  "registry-url"?: string;
  "api-key"?: string;
  "encryption-key"?: string;
  "use-public-ip"?: boolean;
  daemon?: boolean;
  help?: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--use-public-ip") {
      parsed["use-public-ip"] = true;
      continue;
    }

    if (arg === "--daemon") {
      parsed.daemon = true;
      continue;
    }

    const match = arg.match(/^--([^=]+)=(.+)$/);
    if (match) {
      const [, key, value] = match;
      parsed[key as keyof ParsedArgs] = value as never;
    }
  }

  return parsed;
}

function showHelp(): void {
  console.log(`
Script Standalone de Registro de Backend
=========================================

Uso:
  deno run -A register-backend-standalone.ts [opciones]

Opciones obligatorias:
  --name=<nombre>              Nombre del backend
  --backend-token=<token>      Token secreto del backend
  --backend-port=<puerto>      Puerto del backend (si --use-public-ip)
  O
  --backend-url=<url>          URL completa del backend

Opciones de configuración (o vía variables de entorno):
  --registry-url=<url>         URL del KV Storage (env: STORAGE_URL)
  --api-key=<key>             API key (env: API_KEY)
  --encryption-key=<key>      Clave de encriptación (env: ENCRYPTION_KEY)

Opciones adicionales:
  --prefix=<prefix>           Prefix para el enrutamiento (ej: /miapi)
  --use-public-ip             Detectar IP pública automáticamente
  --daemon                    Modo daemon: re-registrar cada 5 minutos
  --help, -h                  Mostrar esta ayuda

Ejemplos:

1. Registro simple con URL completa:
   deno run -A register-backend-standalone.ts \\
     --name=mi-api \\
     --backend-url=http://192.168.1.100:3000 \\
     --backend-token=secret123 \\
     --prefix=/miapi

2. Registro con IP pública (para PC detrás de NAT):
   deno run -A register-backend-standalone.ts \\
     --name=mi-api \\
     --use-public-ip \\
     --backend-port=3000 \\
     --backend-token=secret123 \\
     --daemon

3. Con variables de entorno:
   export STORAGE_URL=https://kv-storage.deno.dev
   export API_KEY=mi-api-key
   export ENCRYPTION_KEY=mi-clave-de-32-caracteres
   
   deno run -A register-backend-standalone.ts \\
     --name=productos \\
     --use-public-ip \\
     --backend-port=3000 \\
     --backend-token=token-productos \\
     --daemon

Variables de entorno:
  STORAGE_URL      URL del KV Storage
  API_KEY          API key para autenticación
  ENCRYPTION_KEY   Clave para encriptar tokens
`);
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);

  if (args.help) {
    showHelp();
    Deno.exit(0);
  }

  // Validar configuración
  const storageUrl = args["registry-url"] || CONFIG.STORAGE_URL;
  const apiKey = args["api-key"] || CONFIG.API_KEY;
  const encryptionKey = args["encryption-key"] || CONFIG.ENCRYPTION_KEY;

  if (!storageUrl || !apiKey || !encryptionKey) {
    console.error("❌ Error: Faltan credenciales");
    console.error("   Proporciona: --registry-url, --api-key, --encryption-key");
    console.error("   O configura: STORAGE_URL, API_KEY, ENCRYPTION_KEY");
    console.error("");
    console.error("   Usa --help para más información");
    Deno.exit(1);
  }

  if (!args.name) {
    console.error("❌ Error: --name es obligatorio");
    Deno.exit(1);
  }

  if (!args["backend-token"]) {
    console.error("❌ Error: --backend-token es obligatorio");
    Deno.exit(1);
  }

  // Construir URL del backend
  let backendUrl: string;

  if (args["use-public-ip"]) {
    if (!args["backend-port"]) {
      console.error("❌ Error: --backend-port es obligatorio con --use-public-ip");
      Deno.exit(1);
    }

    console.log("🌍 Detectando IP pública...");
    const publicIP = await getPublicIP();
    console.log(`✅ IP pública detectada: ${publicIP}`);
    
    backendUrl = `http://${publicIP}:${args["backend-port"]}`;
  } else if (args["backend-url"]) {
    backendUrl = args["backend-url"];
  } else {
    console.error("❌ Error: Debes proporcionar --backend-url o --use-public-ip + --backend-port");
    Deno.exit(1);
  }

  // Función de registro
  const doRegister = async () => {
    // Si usa IP pública, detectar en cada iteración
    let currentUrl = backendUrl;
    if (args["use-public-ip"] && args["backend-port"]) {
      const publicIP = await getPublicIP();
      currentUrl = `http://${publicIP}:${args["backend-port"]}`;
    }

    await registerBackend(
      args.name!,
      currentUrl,
      args["backend-token"]!,
      args.prefix,
      storageUrl,
      apiKey,
      encryptionKey,
      {
        hostname: Deno.hostname(),
        os: Deno.build.os,
        arch: Deno.build.arch,
      }
    );
  };

  // Registro inicial
  console.log("🚀 Registrando backend...");
  await doRegister();

  // Modo daemon
  if (args.daemon) {
    console.log("");
    console.log("🔄 Modo daemon activado");
    console.log("   Re-registro cada 5 minutos");
    console.log("   Presiona Ctrl+C para detener");
    console.log("");

    // Re-registrar cada 5 minutos
    setInterval(async () => {
      try {
        console.log(`[${new Date().toISOString()}] 🔄 Re-registrando...`);
        await doRegister();
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Error en re-registro:`, error);
      }
    }, 5 * 60 * 1000);

    // Mantener el proceso vivo
    await new Promise(() => {});
  }
}

// ============================================================================
// EJECUTAR
// ============================================================================

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error("❌ Error fatal:", error);
    Deno.exit(1);
  }
}
