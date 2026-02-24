#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Delete Backend from KV Storage
 * 
 * Elimina un backend del registro de backends
 * 
 * Uso:
 *   deno run -A scripts/delete-backend.ts --name=Desarrollo
 *   deno run -A scripts/delete-backend.ts --name=Desarrollo --registry-url=https://kv-storage-api.deno.dev --api-key=tu-api-key
 * 
 * Argumentos:
 *   --name: Nombre del backend a eliminar (requerido)
 *   --registry-url: URL de la API de almacenamiento (opcional, default: env o https://kv-storage-api.deno.dev)
 *   --api-key: API Key para acceder al almacenamiento (opcional, default: env o desarrollo-api-key-2026)
 * 
 * Variables de entorno:
 *   - STORAGE_URL: URL de la API de almacenamiento (cualquier API compatible)
 *   - API_KEY: API Key para el almacenamiento
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
    name: args.name || '',
    backendsRegistryUrl: args['registry-url'] || Deno.env.get('STORAGE_URL') || Deno.env.get('KV_STORAGE_URL') || Deno.env.get('BACKENDS_REGISTRY_URL') || 'https://kv-storage-api.deno.dev',
    apiKey: args['api-key'] || Deno.env.get('API_KEY') || 'desarrollo-api-key-2026',
};

// Validación de configuración
function validateConfig(): void {
    const errors: string[] = [];
    
    if (!CONFIG.name) {
        errors.push('--name es requerido (nombre del backend a eliminar)');
    }
    
    if (!CONFIG.backendsRegistryUrl) {
        errors.push('STORAGE_URL es requerido');
    }
    
    if (!CONFIG.apiKey) {
        errors.push('API_KEY es requerido');
    }
    
    if (errors.length > 0) {
        console.error('❌ Errores de configuración:');
        errors.forEach(err => console.error(`   - ${err}`));
        console.error('\nUso:');
        console.error('  deno run -A scripts/delete-backend.ts --name=Desarrollo');
        console.error('\nArgumentos disponibles:');
        console.error('  --name: Nombre del backend a eliminar (requerido)');
        console.error('  --registry-url: URL del servidor de registro (opcional)');
        console.error('  --api-key: API Key para el registro (opcional)');
        Deno.exit(1);
    }
}

// Listar backends disponibles
async function listBackends(): Promise<string[]> {
    try {
        const response = await fetch(`${CONFIG.backendsRegistryUrl}/collections/backend`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.apiKey}`,
            },
        });

        if (!response.ok) {
            console.error(`❌ Error al listar backends: ${response.status}`);
            return [];
        }

        const result = await response.json() as { items?: Array<{ key: string }> };
        
        if (result.items && Array.isArray(result.items)) {
            return result.items.map(item => item.key);
        }
        
        return [];
    } catch (error) {
        console.error('❌ Error al listar backends:', error.message);
        return [];
    }
}

// Verificar si el backend existe
async function backendExists(name: string): Promise<boolean> {
    try {
        const response = await fetch(`${CONFIG.backendsRegistryUrl}/collections/backend/${name}`, {
            headers: {
                'Authorization': `Bearer ${CONFIG.apiKey}`,
            },
        });

        return response.ok;
    } catch {
        return false;
    }
}

// Eliminar backend (método alternativo: marcar como inactivo o vaciar datos)
async function deleteBackend(): Promise<void> {
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║     Delete Backend from Registry         ║');
    console.log('╚═══════════════════════════════════════════╝\n');

    console.log('📋 Configuración:');
    console.log(`   - Registry: ${CONFIG.backendsRegistryUrl}`);
    console.log(`   - Backend: ${CONFIG.name}`);
    console.log('');

    // Verificar si el backend existe
    console.log(`🔍 Verificando si el backend '${CONFIG.name}' existe...`);
    const exists = await backendExists(CONFIG.name);
    
    if (!exists) {
        console.log(`❌ El backend '${CONFIG.name}' no existe en el registro\n`);
        
        // Listar backends disponibles
        console.log('📋 Backends disponibles:');
        const backends = await listBackends();
        if (backends.length === 0) {
            console.log('   (ninguno)');
        } else {
            backends.forEach(name => console.log(`   - ${name}`));
        }
        console.log('');
        Deno.exit(1);
    }

    console.log(`✅ Backend encontrado\n`);

    // Intentar método DELETE primero
    try {
        console.log(`🗑️  Intentando eliminar backend '${CONFIG.name}' (DELETE)...`);
        
        const deleteResponse = await fetch(`${CONFIG.backendsRegistryUrl}/collections/backend/${CONFIG.name}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${CONFIG.apiKey}`,
            },
        });

        if (deleteResponse.ok) {
            console.log(`✅ Backend '${CONFIG.name}' eliminado exitosamente\n`);
            
            // Listar backends restantes
            console.log('📋 Backends restantes:');
            const remainingBackends = await listBackends();
            if (remainingBackends.length === 0) {
                console.log('   (ninguno)');
            } else {
                remainingBackends.forEach(name => console.log(`   - ${name}`));
            }
            console.log('');
            return;
        }

        // Si DELETE falla, usar método alternativo
        console.log(`⚠️  DELETE falló (${deleteResponse.status}), usando método alternativo...`);
        
    } catch (error) {
        console.log(`⚠️  DELETE falló: ${error.message}, usando método alternativo...`);
    }

    // Método alternativo: marcar como inactivo
    try {
        console.log(`📝 Marcando backend '${CONFIG.name}' como inactivo...`);
        
        const updateResponse = await fetch(`${CONFIG.backendsRegistryUrl}/collections/backend/${CONFIG.name}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${CONFIG.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: CONFIG.name,
                data: {
                    name: CONFIG.name,
                    url: '',
                    token: '',
                    prefix: '',
                    status: 'DELETED',
                    deletedAt: new Date().toISOString(),
                },
            }),
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error(`❌ Error al marcar como inactivo: ${updateResponse.status}`);
            console.error(`   Respuesta: ${errorText}`);
            Deno.exit(1);
        }

        console.log(`✅ Backend '${CONFIG.name}' marcado como DELETED\n`);
        console.log('ℹ️  El backend sigue en el registro pero con datos vacíos y estado DELETED');
        console.log('   El gateway lo ignorará al cargar backends activos\n');

    } catch (error) {
        console.error('❌ Error durante la eliminación:', error.message);
        Deno.exit(1);
    }
}

// Validar y ejecutar
validateConfig();
await deleteBackend();
