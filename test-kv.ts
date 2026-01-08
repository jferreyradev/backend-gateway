#!/usr/bin/env -S deno run --allow-net

/**
 * Test script para validar conexión con KV Storage API
 */

const API_KEY = 'pi3_141516';
const REGISTRY_URL = 'https://kv-storage-api.deno.dev';

async function testEndpoints() {
  console.log(`\n🧪 Probando KV Storage API: ${REGISTRY_URL}\n`);

  // Test 1: Health check
  console.log('1️⃣  GET /health');
  try {
    const res = await fetch(`${REGISTRY_URL}/health`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Body: ${await res.text()}\n`);
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
  }

  // Test 2: Listar colecciones
  console.log('2️⃣  GET /collections (sin auth)');
  try {
    const res = await fetch(`${REGISTRY_URL}/collections`);
    console.log(`   Status: ${res.status}`);
    const text = await res.text();
    console.log(`   Body: ${text.substring(0, 300)}\n`);
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
  }

  // Test 3: Listar colecciones con Bearer
  console.log('3️⃣  GET /collections (con Bearer)');
  try {
    const res = await fetch(`${REGISTRY_URL}/collections`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
    console.log(`   Status: ${res.status}`);
    const text = await res.text();
    console.log(`   Body: ${text.substring(0, 300)}\n`);
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
  }

  // Test 4: GET /collections/backends
  console.log('4️⃣  GET /collections/backends (con Bearer)');
  try {
    const res = await fetch(`${REGISTRY_URL}/collections/backends`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
    console.log(`   Status: ${res.status}`);
    const text = await res.text();
    console.log(`   Body: ${text.substring(0, 500)}\n`);
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
  }

  // Test 5: Intentar registrar un backend de prueba con POST (crear)
  console.log('5️⃣  POST /collections/backends (crear nuevo)');
  try {
    const res = await fetch(`${REGISTRY_URL}/collections/backends`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-Item-Key': 'test',
      },
      body: JSON.stringify({
        data: {
          name: 'test',
          url: 'http://localhost:3000',
          token: 'test-token',
          prefix: '/api/test',
        },
      }),
    });
    console.log(`   Status: ${res.status}`);
    const text = await res.text();
    console.log(`   Body: ${text.substring(0, 300)}\n`);
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
  }

  // Test 6: Recuperar el backend registrado
  console.log('6️⃣  GET /collections/backends (mostrar todos)');
  try {
    const res = await fetch(`${REGISTRY_URL}/collections/backends`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
    console.log(`   Status: ${res.status}`);
    const text = await res.text();
    console.log(`   Body: ${text.substring(0, 500)}\n`);
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
  }

  // Test 7: Intentar actualizar con PUT (debería funcionar ahora)
  console.log('7️⃣  PUT /collections/backends/test (actualizar)');
  try {
    const res = await fetch(`${REGISTRY_URL}/collections/backends/test`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          name: 'test',
          url: 'http://localhost:3001',
          token: 'test-token-updated',
          prefix: '/api/test-v2',
        },
      }),
    });
    console.log(`   Status: ${res.status}`);
    const text = await res.text();
    console.log(`   Body: ${text.substring(0, 300)}\n`);
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}\n`);
  }
}

testEndpoints();
