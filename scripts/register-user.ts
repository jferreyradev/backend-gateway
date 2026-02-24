#!/usr/bin/env -S deno run --allow-net --allow-env --allow-sys

/**
 * Script para registrar usuarios en KV Storage
 * Los usuarios pueden autenticarse en el gateway
 */

import { parseArgs } from "https://deno.land/std@0.210.0/cli/parse_args.ts";

interface UserData {
    username: string;
    passwordHash: string;
    roles: string[];
    createdAt: string;
}

// Hash de password simple (SHA-256)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

async function registerUser(
    username: string,
    password: string,
    roles: string[],
    registryUrl: string,
    apiKey: string
) {
    console.log(`\n🔐 Registrando usuario: ${username}`);
    console.log(`📍 Registry: ${registryUrl}`);
    console.log(`👤 Roles: ${roles.join(', ')}\n`);

    // Hash del password
    const passwordHash = await hashPassword(password);

    const userData: UserData = {
        username,
        passwordHash,
        roles,
        createdAt: new Date().toISOString(),
    };

    try {
        const response = await fetch(`${registryUrl}/collections/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ key: username, data: userData }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ Error: ${response.status} ${response.statusText}`);
            console.error(`   ${error}`);
            Deno.exit(1);
        }

        const result = await response.json();
        console.log('✅ Usuario registrado exitosamente');
        console.log(`   Username: ${username}`);
        console.log(`   Roles: ${roles.join(', ')}`);
        console.log(`   Created: ${userData.createdAt}`);
        console.log(`\n💡 Hash generado: ${passwordHash.substring(0, 30)}...\n`);

        return result;
    } catch (error) {
        console.error('❌ Error registrando usuario:', error);
        Deno.exit(1);
    }
}

async function listUsers(registryUrl: string, apiKey: string) {
    console.log(`\n📋 Listando usuarios registrados...`);
    console.log(`📍 Registry: ${registryUrl}\n`);

    try {
        const response = await fetch(`${registryUrl}/collections/users`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ Error: ${response.status} ${response.statusText}`);
            console.error(`   ${error}`);
            Deno.exit(1);
        }

        const data = await response.json() as { items: Array<{ key: string; data: UserData }> };
        const items = data.items || [];

        if (items.length === 0) {
            console.log('⚠️  No hay usuarios registrados\n');
            return;
        }

        console.log(`✅ ${items.length} usuario(s) encontrado(s):\n`);
        
        for (const item of items) {
            console.log(`👤 ${item.key}`);
            console.log(`   Roles: ${item.data.roles.join(', ')}`);
            console.log(`   Creado: ${item.data.createdAt}`);
            console.log('');
        }
    } catch (error) {
        console.error('❌ Error listando usuarios:', error);
        Deno.exit(1);
    }
}

async function deleteUser(username: string, registryUrl: string, apiKey: string) {
    console.log(`\n🗑️  Eliminando usuario: ${username}`);
    console.log(`📍 Registry: ${registryUrl}\n`);

    try {
        const response = await fetch(`${registryUrl}/collections/users?key=${username}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ Error: ${response.status} ${response.statusText}`);
            console.error(`   ${error}`);
            Deno.exit(1);
        }

        console.log(`✅ Usuario eliminado: ${username}\n`);
    } catch (error) {
        console.error('❌ Error eliminando usuario:', error);
        Deno.exit(1);
    }
}

// Parsear argumentos
const args = parseArgs(Deno.args, {
    string: ['username', 'password', 'roles', 'registry-url', 'api-key', 'delete'],
    boolean: ['list', 'help'],
    alias: {
        u: 'username',
        p: 'password',
        r: 'roles',
        h: 'help',
        l: 'list',
        d: 'delete',
    },
    default: {
        'registry-url': Deno.env.get('STORAGE_URL') || Deno.env.get('KV_STORAGE_URL') || Deno.env.get('BACKENDS_REGISTRY_URL') || 'https://kv-storage-api.deno.dev',
        'api-key': Deno.env.get('API_KEY') || '',
        'roles': 'user',
    },
});

// Mostrar ayuda
if (args.help) {
    console.log(`
🔐 Register User - Registrar usuarios en KV Storage

Uso:
  deno run -A scripts/register-user.ts [opciones]

Opciones:
  -u, --username      Nombre de usuario (requerido)
  -p, --password      Contraseña (requerido)
  -r, --roles         Roles separados por coma (default: user)
  --registry-url      URL del KV Storage API
  --api-key          API Key para acceder
  -l, --list         Listar todos los usuarios
  -d, --delete       Eliminar usuario por nombre
  -h, --help         Mostrar esta ayuda

Variables de entorno:
  STORAGE_URL              URL de la API de almacenamiento (cualquier API compatible)
  API_KEY                  API Key del almacenamiento

Ejemplos:
  # Registrar usuario básico
  deno run -A scripts/register-user.ts \\
    --username john \\
    --password secret123

  # Registrar admin
  deno run -A scripts/register-user.ts \\
    --username admin \\
    --password admin123 \\
    --roles admin,user

  # Listar usuarios
  deno run -A scripts/register-user.ts --list

  # Eliminar usuario
  deno run -A scripts/register-user.ts --delete john

  # Con URL y API Key personalizadas
  deno run -A scripts/register-user.ts \\
    --username maria \\
    --password pass456 \\
    --registry-url https://mi-api.com \\
    --api-key mi-api-key
`);
    Deno.exit(0);
}

const registryUrl = args['registry-url'];
const apiKey = args['api-key'];

// Validar configuración
if (!registryUrl || !apiKey) {
    console.error('❌ Error: STORAGE_URL y API_KEY son requeridos');
    console.error('   Usa --registry-url y --api-key, o configura las variables de entorno');
    console.error('   Usa --help para ver las opciones\n');
    Deno.exit(1);
}

// Listar usuarios
if (args.list) {
    await listUsers(registryUrl, apiKey);
    Deno.exit(0);
}

// Eliminar usuario
if (args.delete) {
    await deleteUser(args.delete, registryUrl, apiKey);
    Deno.exit(0);
}

// Registrar usuario
const username = args.username;
const password = args.password;
const rolesStr = args.roles || 'user';
const roles = rolesStr.split(',').map(r => r.trim());

if (!username || !password) {
    console.error('❌ Error: username y password son requeridos');
    console.error('   Usa --help para ver las opciones\n');
    Deno.exit(1);
}

// Validar username
if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    console.error('❌ Error: username solo puede contener letras, números, guiones y guiones bajos');
    Deno.exit(1);
}

// Validar password
if (password.length < 6) {
    console.error('❌ Error: password debe tener al menos 6 caracteres');
    Deno.exit(1);
}

await registerUser(username, password, roles, registryUrl, apiKey);
