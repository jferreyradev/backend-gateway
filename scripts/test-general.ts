#!/usr/bin/env -S deno run --allow-net

/**
 * Test General del Backend Gateway
 * Prueba todas las funcionalidades del sistema
 */

const GATEWAY_URL = Deno.args[0] || 'http://localhost:8000';
const USERNAME = Deno.args[1] || 'admin';
const PASSWORD = Deno.args[2] || 'admin123';

let token = '';
let testsPassed = 0;
let testsFailed = 0;

function printHeader(title: string) {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60) + '\n');
}

function printTest(num: number, name: string) {
    console.log(`\n${num}️⃣  ${name}`);
    console.log('-'.repeat(60));
}

function printSuccess(message: string) {
    console.log(`   ✅ ${message}`);
    testsPassed++;
}

function printError(message: string) {
    console.error(`   ❌ ${message}`);
    testsFailed++;
}

function printInfo(message: string) {
    console.log(`   ℹ️  ${message}`);
}

printHeader('🧪 BACKEND GATEWAY - TEST GENERAL');
console.log(`Gateway: ${GATEWAY_URL}`);
console.log(`Usuario: ${USERNAME}`);

// ============================================
// FASE 1: ENDPOINTS PÚBLICOS
// ============================================
printHeader('FASE 1: Endpoints Públicos (sin autenticación)');

// Test 1: Health check
printTest(1, 'Health Check Público');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/health`);
    if (res.status === 200) {
        const data = await res.json();
        printSuccess(`Health check respondió: ${JSON.stringify(data)}`);
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 200)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// Test 2: CORS preflight
printTest(2, 'CORS Preflight (OPTIONS)');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/status`, {
        method: 'OPTIONS',
    });
    if (res.status === 204) {
        const corsHeader = res.headers.get('Access-Control-Allow-Origin');
        if (corsHeader) {
            printSuccess(`CORS configurado correctamente: ${corsHeader}`);
        } else {
            printError('Falta header Access-Control-Allow-Origin');
        }
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 204)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// ============================================
// FASE 2: SEGURIDAD Y AUTENTICACIÓN
// ============================================
printHeader('FASE 2: Seguridad y Autenticación');

// Test 3: Acceso sin token (debe fallar)
printTest(3, 'Intento de acceso sin token (debe ser bloqueado)');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/status`);
    if (res.status === 401) {
        const wwwAuth = res.headers.get('WWW-Authenticate');
        printSuccess(`Acceso bloqueado correctamente (401)`);
        if (wwwAuth === 'Bearer') {
            printSuccess(`Header WWW-Authenticate presente: ${wwwAuth}`);
        }
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 401)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// Test 4: Login con credenciales incorrectas
printTest(4, 'Login con credenciales incorrectas');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'wrong', password: 'wrong' }),
    });
    if (res.status === 401) {
        printSuccess('Login rechazado correctamente');
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 401)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// Test 5: Login con credenciales correctas
printTest(5, 'Login con credenciales correctas');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    if (res.status === 200) {
        const data = await res.json();
        token = data.token;
        printSuccess(`Token obtenido: ${token.substring(0, 20)}...`);
        printInfo(`Expira en: ${data.expiresIn} segundos`);
        printInfo(`Tipo: ${data.tokenType}`);
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 200)`);
        console.log(await res.text());
        Deno.exit(1);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
    Deno.exit(1);
}

// Test 6: Token inválido
printTest(6, 'Intento con token inválido');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/status`, {
        headers: { 'Authorization': 'Bearer TOKEN_INVALIDO_123' },
    });
    if (res.status === 401) {
        printSuccess('Token inválido rechazado correctamente');
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 401)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// ============================================
// FASE 3: ENDPOINTS PROTEGIDOS
// ============================================
printHeader('FASE 3: Endpoints Protegidos (con token válido)');

// Test 7: Información del gateway
printTest(7, 'GET /gateway - Información del gateway');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 200) {
        const data = await res.json();
        printSuccess(`Service: ${data.service}`);
        printInfo(`Backends registrados: ${data.backends}`);
        printInfo(`Backends healthy: ${data.healthy}`);
        printInfo(`Endpoints disponibles: ${Object.keys(data.endpoints).join(', ')}`);
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 200)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// Test 8: Status de backends
printTest(8, 'GET /gateway/status - Estado de backends');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 200) {
        const data = await res.json();
        printSuccess(`Total backends: ${data.total}`);
        printSuccess(`Backends healthy: ${data.healthy}`);
        if (data.backends && data.backends.length > 0) {
            printInfo(`Primer backend: ${data.backends[0].name} (${data.backends[0].prefix})`);
        } else {
            printInfo('No hay backends registrados');
        }
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 200)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// Test 9: Tabla de routing
printTest(9, 'GET /gateway/routing - Tabla de enrutamiento');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/routing`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 200) {
        const data = await res.json();
        printSuccess(`Rutas configuradas: ${data.routes?.length || 0}`);
        if (data.routes && data.routes.length > 0) {
            data.routes.forEach((route: { prefix: string; backends: string[] }) => {
                printInfo(`  ${route.prefix} -> [${route.backends.join(', ')}]`);
            });
        } else {
            printInfo('No hay rutas configuradas');
        }
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 200)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// Test 10: Logout
printTest(10, 'POST /gateway/logout - Cerrar sesión');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 200) {
        const data = await res.json();
        printSuccess(`Logout exitoso: ${data.message}`);
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 200)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// Test 11: Token revocado después de logout
printTest(11, 'Verificar que el token está revocado después de logout');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status === 401) {
        printSuccess('Token revocado correctamente (401)');
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 401)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// ============================================
// FASE 4: VALIDACIÓN DE FORMATO DE RESPUESTAS
// ============================================
printHeader('FASE 4: Validación de Formato de Respuestas');

// Re-login para continuar con los tests
let newToken = '';
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    const data = await res.json();
    newToken = data.token;
} catch (e) {
    printError('No se pudo obtener nuevo token para continuar tests');
}

// Test 12: Content-Type correcto
printTest(12, 'Headers de respuesta correctos');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/status`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
    });
    const contentType = res.headers.get('Content-Type');
    if (contentType?.includes('application/json')) {
        printSuccess(`Content-Type correcto: ${contentType}`);
    } else {
        printError(`Content-Type incorrecto: ${contentType}`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// Test 13: CORS en respuestas protegidas
printTest(13, 'CORS headers en respuestas protegidas');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/status`, {
        headers: { 
            'Authorization': `Bearer ${newToken}`,
            'Origin': 'http://example.com'
        },
    });
    const corsOrigin = res.headers.get('Access-Control-Allow-Origin');
    if (corsOrigin) {
        printSuccess(`CORS presente: ${corsOrigin}`);
    } else {
        printError('Falta header CORS en respuesta protegida');
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// ============================================
// FASE 5: MANEJO DE ERRORES
// ============================================
printHeader('FASE 5: Manejo de Errores');

// Test 14: Ruta no encontrada con token válido
printTest(14, 'Ruta no existente (debe retornar 404)');
try {
    const res = await fetch(`${GATEWAY_URL}/ruta/inexistente`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
    });
    if (res.status === 404) {
        const data = await res.json();
        printSuccess('Error 404 retornado correctamente');
        if (data.error) {
            printInfo(`Mensaje: ${data.error}`);
        }
    } else {
        printError(`Status incorrecto: ${res.status} (esperado: 404)`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// Test 15: Request malformado al login
printTest(15, 'Login con JSON malformado');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
    });
    if (res.status === 400 || res.status === 401) {
        printSuccess(`Error manejado correctamente (${res.status})`);
    } else {
        printError(`Status incorrecto: ${res.status}`);
    }
} catch (e) {
    printError(`Error en request: ${e instanceof Error ? e.message : 'Unknown'}`);
}

// ============================================
// RESUMEN
// ============================================
printHeader('📊 RESUMEN DE PRUEBAS');

const total = testsPassed + testsFailed;
const percentage = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : '0.0';

console.log(`Total de pruebas: ${total}`);
console.log(`✅ Exitosas: ${testsPassed}`);
console.log(`❌ Fallidas: ${testsFailed}`);
console.log(`📈 Porcentaje de éxito: ${percentage}%`);

if (testsFailed === 0) {
    console.log('\n🎉 ¡Todos los tests pasaron exitosamente!');
    console.log('\n💡 Comandos útiles:');
    console.log(`   curl ${GATEWAY_URL}/gateway/status \\`);
    console.log(`     -H "Authorization: Bearer ${newToken.substring(0, 30)}..."`);
} else {
    console.log(`\n⚠️  ${testsFailed} test(s) fallaron. Revisa los errores arriba.`);
    Deno.exit(1);
}
