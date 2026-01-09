#!/usr/bin/env -S deno run --allow-net

/**
 * Script de prueba para autenticación del Gateway
 */

const GATEWAY_URL = Deno.args[0] || 'http://localhost:8000';
const USERNAME = Deno.args[1] || 'admin';
const PASSWORD = Deno.args[2] || 'admin123';

console.log('🔐 Prueba de Autenticación del Gateway\n');
console.log(`Gateway: ${GATEWAY_URL}`);
console.log(`Usuario: ${USERNAME}\n`);

// 1. Health check (público)
console.log('1️⃣  GET /gateway/health (público)');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/health`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Body: ${await res.text()}\n`);
} catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
}

// 2. Intentar acceder sin token
console.log('2️⃣  GET /gateway/status (sin token)');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/status`);
    console.log(`   Status: ${res.status} (debe ser 401)`);
    const body = await res.text();
    console.log(`   Body: ${body.substring(0, 200)}\n`);
} catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
}

// 3. Login con credenciales incorrectas
console.log('3️⃣  POST /gateway/login (credenciales incorrectas)');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'wrong', password: 'wrong' }),
    });
    console.log(`   Status: ${res.status} (debe ser 401)`);
    console.log(`   Body: ${await res.text()}\n`);
} catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
}

// 4. Login correcto
console.log('4️⃣  POST /gateway/login (credenciales correctas)');
let token = '';
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    console.log(`   Status: ${res.status}`);
    const data = await res.json();
    console.log(`   Token: ${data.token?.substring(0, 20)}...`);
    console.log(`   Expira en: ${data.expiresIn} segundos`);
    console.log(`   Tipo: ${data.tokenType}\n`);
    token = data.token;
} catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
    Deno.exit(1);
}

// 5. Usar el token
console.log('5️⃣  GET /gateway/status (con token válido)');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log(`   Status: ${res.status}`);
    const body = await res.text();
    console.log(`   Body: ${body.substring(0, 300)}...\n`);
} catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
}

// 6. Info del gateway
console.log('6️⃣  GET /gateway (con token válido)');
try {
    const res = await fetch(`${GATEWAY_URL}/gateway`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log(`   Status: ${res.status}`);
    const data = await res.json();
    console.log(`   Service: ${data.service}`);
    console.log(`   Backends: ${data.backends}`);
    console.log(`   Endpoints:`, data.endpoints);
} catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
}

console.log('\n✅ Pruebas completadas');
console.log(`\n💡 Para usar el token:\ncurl ${GATEWAY_URL}/gateway/status \\\n  -H "Authorization: Bearer ${token.substring(0, 20)}..."`);
