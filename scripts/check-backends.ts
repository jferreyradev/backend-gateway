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

console.log(`${JSON.stringify(data)}`);





