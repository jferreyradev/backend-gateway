#!/usr/bin/env -S deno run --allow-net

const API_KEY = 'pi3_141516';
const BASE_URL = 'https://kv-storage-api.deno.dev';

console.log('🧪 Testing KV Storage Backend Collection\n');

console.log('1️⃣  GET /collections/backend (singular)');
let r = await fetch(`${BASE_URL}/collections/backend`, {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
  }
});
console.log(`Status: ${r.status}`);
let data = await r.json();
console.log(`Items: ${JSON.stringify(data).substring(0, 800)}\n`);

console.log('2️⃣  GET /collections/backends (plural)');
r = await fetch(`${BASE_URL}/collections/backends`, {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
  }
});
console.log(`Status: ${r.status}`);
data = await r.json();
console.log(`Items: ${JSON.stringify(data).substring(0, 800)}\n`);

console.log('3️⃣  GET /collections');
r = await fetch(`${BASE_URL}/collections`, {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
  }
});
console.log(`Status: ${r.status}`);
data = await r.json();
console.log(`Collections: ${JSON.stringify(data, null, 2)}\n`);




