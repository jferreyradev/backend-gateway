#!/usr/bin/env -S deno run --allow-net
/**
 * Test Gateway Proxy
 * 
 * Script para probar el gateway con diferentes rutas
 */

const GATEWAY_URL = Deno.args[0] || 'http://localhost:8080';

interface TestResult {
    test: string;
    status: 'OK' | 'FAIL';
    details: string;
}

async function testRequest(
    name: string,
    path: string,
    method = 'GET'
): Promise<TestResult> {
    try {
        const url = `${GATEWAY_URL}${path}`;
        console.log(`\n🧪 ${name}`);
        console.log(`   ${method} ${url}`);

        const response = await fetch(url, { method });
        const contentType = response.headers.get('content-type') || '';
        
        let body: any;
        if (contentType.includes('application/json')) {
            body = await response.json();
        } else {
            body = await response.text();
        }

        const backend = response.headers.get('X-Backend');
        const proxied = response.headers.get('X-Proxied-By');

        if (response.ok) {
            console.log(`   ✅ Status: ${response.status}`);
            if (backend) console.log(`   📡 Backend: ${backend}`);
            if (proxied) console.log(`   🔀 Proxied-By: ${proxied}`);
            
            if (typeof body === 'object') {
                console.log(`   📦 Response:`, JSON.stringify(body, null, 2).split('\n').slice(0, 5).join('\n'));
            } else {
                console.log(`   📦 Response:`, body.substring(0, 200));
            }
            
            return {
                test: name,
                status: 'OK',
                details: `Status ${response.status}${backend ? ` - Backend: ${backend}` : ''}`,
            };
        } else {
            console.log(`   ❌ Status: ${response.status}`);
            console.log(`   📦 Error:`, body);
            
            return {
                test: name,
                status: 'FAIL',
                details: `Status ${response.status}: ${JSON.stringify(body)}`,
            };
        }
    } catch (error) {
        console.log(`   ❌ Error:`, error instanceof Error ? error.message : error);
        return {
            test: name,
            status: 'FAIL',
            details: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function main() {
    console.log(`
╔═══════════════════════════════════════════╗
║         Gateway Proxy Tests               ║
╠═══════════════════════════════════════════╣
║ 🎯 Gateway: ${GATEWAY_URL.padEnd(31)}║
╚═══════════════════════════════════════════╝
`);

    const results: TestResult[] = [];

    // Test 1: Gateway info
    results.push(await testRequest(
        'Gateway Info',
        '/'
    ));

    // Test 2: Health check
    results.push(await testRequest(
        'Health Check',
        '/gateway/health'
    ));

    // Test 3: Obtener backends disponibles
    console.log('\n📋 Obteniendo rutas disponibles...');
    try {
        const infoResponse = await fetch(GATEWAY_URL);
        const info = await infoResponse.json();
        
        if (info.routes && Array.isArray(info.routes)) {
            console.log('\n📍 Rutas configuradas:');
            info.routes.forEach((route: any) => {
                console.log(`   ${route.prefix} -> ${route.name} (${route.url})`);
            });

            // Test 4-N: Probar cada ruta
            for (const route of info.routes) {
                results.push(await testRequest(
                    `Backend: ${route.name}`,
                    `${route.prefix}/`
                ));
            }
        }
    } catch (error) {
        console.error('❌ No se pudieron obtener las rutas');
    }

    // Test ruta inexistente
    results.push(await testRequest(
        'Ruta inexistente (debe fallar)',
        '/ruta-que-no-existe'
    ));

    // Resumen
    console.log('\n\n' + '═'.repeat(50));
    console.log('📊 RESUMEN DE PRUEBAS');
    console.log('═'.repeat(50));

    const passed = results.filter(r => r.status === 'OK').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    results.forEach(result => {
        const icon = result.status === 'OK' ? '✅' : '❌';
        console.log(`${icon} ${result.test}: ${result.status}`);
        if (result.status === 'FAIL') {
            console.log(`   ${result.details}`);
        }
    });

    console.log('\n' + '═'.repeat(50));
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log('═'.repeat(50) + '\n');

    Deno.exit(failed > 0 ? 1 : 0);
}

main();
