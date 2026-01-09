#!/usr/bin/env -S deno run --allow-net

/**
 * Test simple y rápido del gateway
 */

const GATEWAY = 'http://localhost:8000';

console.log('🧪 Test Simple del Gateway\n');

// Test 1: Health
console.log('1. Health check...');
try {
    const res = await fetch(`${GATEWAY}/gateway/health`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Body: ${await res.text()}\n`);
} catch (e) {
    console.error(`   ❌ Error: ${e instanceof Error ? e.message : e}\n`);
}

// Test 2: Login
console.log('2. Login...');
try {
    const res = await fetch(`${GATEWAY}/gateway/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    console.log(`   Status: ${res.status}`);
    const data = await res.json();
    console.log(`   Token: ${data.token?.substring(0, 30)}...`);
    
    // Test 3: Usar token
    console.log('\n3. Status con token...');
    const res2 = await fetch(`${GATEWAY}/gateway/status`, {
        headers: { 'Authorization': `Bearer ${data.token}` },
    });
    console.log(`   Status: ${res2.status}`);
    const status = await res2.json();
    console.log(`   Backends: ${status.total}`);
    
    // Test 4: Logout
    console.log('\n4. Logout...');
    const res3 = await fetch(`${GATEWAY}/gateway/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${data.token}` },
    });
    console.log(`   Status: ${res3.status}`);
    const logoutData = await res3.json();
    console.log(`   Message: ${logoutData.message}`);
    
    // Test 5: Intentar usar token revocado
    console.log('\n5. Intentar usar token después de logout...');
    const res4 = await fetch(`${GATEWAY}/gateway/status`, {
        headers: { 'Authorization': `Bearer ${data.token}` },
    });
    console.log(`   Status: ${res4.status} (debe ser 401)`);
    
    console.log('\n✅ Todos los tests pasaron!');
} catch (e) {
    console.error(`   ❌ Error: ${e instanceof Error ? e.message : e}\n`);
}
