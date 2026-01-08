#!/usr/bin/env -S deno run --allow-net

const API_KEY = 'pi3_141516';

console.log('1. GET /collections/backends?limit=100');
let r = await fetch('https://kv-storage-api.deno.dev/collections/backends?limit=100', {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'X-API-Key': API_KEY,
  }
});
console.log(`Status: ${r.status}`);
console.log(JSON.stringify(await r.json(), null, 2));

console.log('\n2. GET /collections/backends?filter=*');
r = await fetch('https://kv-storage-api.deno.dev/collections/backends?filter=*', {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
  }
});
console.log(`Status: ${r.status}`);
console.log(JSON.stringify(await r.json(), null, 2));

console.log('\n3. POST /collections/backends (query)');
r = await fetch('https://kv-storage-api.deno.dev/collections/backends', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'X-List-All': 'true',
  }
});
console.log(`Status: ${r.status}`);
console.log(JSON.stringify(await r.json(), null, 2));



