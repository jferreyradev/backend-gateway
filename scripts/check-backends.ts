#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Listar Backends Registrados
 * 
 * Muestra todos los backends configurados en el KV Storage
 * 
 * Uso:
 *   deno run -A scripts/check-backends.ts
 * 
 * Variables de entorno:
 *   STORAGE_URL - URL del almacenamiento KV (default: https://kv-storage-api.deno.dev)
 *   API_KEY - API Key del almacenamiento (default: desarrollo-api-key-2026)
 */

const STORAGE_URL = Deno.env.get('STORAGE_URL') || 'https://kv-storage-api.deno.dev';
const API_KEY = Deno.env.get('API_KEY') || 'desarrollo-api-key-2026';

console.log(' Listando Backends Registrados\n');
console.log(` Storage: ${STORAGE_URL}\n`);

try {
    console.log(' GET /collections/backend');
    const response = await fetch(`/collections/backend`, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log(` Status: ${response.status}\n`);
    
    if (data.items && data.items.length > 0) {
        console.log(` Total backends: ${data.items.length}\n`);
        
        data.items.forEach((item: any, index: number) => {
            console.log(`. `);
            console.log(`   URL: `);
            console.log(`   Prefix: `);
            console.log(`   Registrado: \n`);
        });
    } else {
        console.log('  No hay backends registrados\n');
    }
    
} catch (error) {
    console.error(' Error:', error.message);
    Deno.exit(1);
}