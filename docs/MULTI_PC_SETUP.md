# Configuración Multi-PC con IP Pública Dinámica

Este documento explica cómo registrar múltiples PCs con IP pública dinámica en el gateway.

## Escenario

Tienes varias PCs en diferentes ubicaciones:
- PC 1: API de productos en puerto 3000
- PC 2: API de usuarios en puerto 4000  
- PC 3: API de inventario en puerto 5000

Cada PC tiene IP pública dinámica que puede cambiar. Quieres acceder a todas desde un gateway central en Deno Deploy.

## Arquitectura

```
PC 1 (IP dinámica A)        ┐
  └─ API:3000               │
                            ├─► KV Storage ◄── Gateway Deno Deploy
PC 2 (IP dinámica B)        │                   (URL unificado)
  └─ API:4000               │
                            │
PC 3 (IP dinámica C)        │
  └─ API:5000               ┘
```

## Paso 1: Configurar cada PC

### En PC 1 (Productos)

1. Edita `start-daemon.bat`:
```batch
set STORAGE_URL=https://tu-kv-storage.deno.dev
set API_KEY=clave-compartida-todas-las-pcs
set ENCRYPTION_KEY=clave-32-caracteres-compartida

set BACKEND_NAME=productos
set BACKEND_PORT=3000
set BACKEND_TOKEN=token-secreto-productos
set BACKEND_PREFIX=/productos
```

2. Asegúrate que tu router tenga **Port Forwarding**:
   - Puerto externo: 3000 → IP interna PC: 3000

3. Ejecuta:
```bash
start-daemon.bat
```

### En PC 2 (Usuarios)

1. Edita `start-daemon.bat`:
```batch
set STORAGE_URL=https://tu-kv-storage.deno.dev
set API_KEY=clave-compartida-todas-las-pcs
set ENCRYPTION_KEY=clave-32-caracteres-compartida

set BACKEND_NAME=usuarios
set BACKEND_PORT=4000
set BACKEND_TOKEN=token-secreto-usuarios
set BACKEND_PREFIX=/usuarios
```

2. Port Forwarding: 4000 → PC interna:4000

3. Ejecuta:
```bash
start-daemon.bat
```

### En PC 3 (Inventario)

1. Edita `start-daemon.bat`:
```batch
set STORAGE_URL=https://tu-kv-storage.deno.dev
set API_KEY=clave-compartida-todas-las-pcs
set ENCRYPTION_KEY=clave-32-caracteres-compartida

set BACKEND_NAME=inventario
set BACKEND_PORT=5000
set BACKEND_TOKEN=token-secreto-inventario
set BACKEND_PREFIX=/inventario
```

2. Port Forwarding: 5000 → PC interna:5000

3. Ejecuta:
```bash
start-daemon.bat
```

## Paso 2: Desplegar Gateway en Deno Deploy

1. En Deno Deploy, configura las **variables de entorno**:
```
STORAGE_URL=https://tu-kv-storage.deno.dev
API_KEY=clave-compartida-todas-las-pcs
ENCRYPTION_KEY=clave-32-caracteres-compartida
```

2. Despliega `src/simple-gateway.ts`

3. Tu gateway estará en: `https://tu-gateway.deno.dev`

## Paso 3: Acceder a las APIs

Todas las APIs están disponibles a través del gateway:

```bash
# API de productos (PC 1)
curl https://tu-gateway.deno.dev/productos/items

# API de usuarios (PC 2)  
curl https://tu-gateway.deno.dev/usuarios/list

# API de inventario (PC 3)
curl https://tu-gateway.deno.dev/inventario/stock
```

## Cómo Funciona

1. **Registro automático**: Cada 5 minutos, cada PC:
   - Detecta su IP pública actual usando api.ipify.org
   - Registra en KV Storage: nombre → {ip pública, puerto, token, prefix}
   - Si la IP cambió, actualiza el registro

2. **Gateway en Deno Deploy**:
   - Recibe petición: `GET /productos/items`
   - Busca en KV Storage el backend "productos"
   - Obtiene: IP pública, puerto, token
   - Hace proxy a: `http://<IP-publica>:3000/items`
   - Incluye el backend-token en la petición

3. **Actualización dinámica**:
   - Si la IP de una PC cambia (reinicio del router, etc)
   - El daemon la detecta en la siguiente iteración (máx 5 min)
   - Actualiza KV Storage automáticamente
   - El gateway usa la nueva IP sin configuración manual

## Consideraciones Importantes

### Port Forwarding
Cada PC debe tener configurado port forwarding en su router:
- PC 1: Puerto 3000 abierto
- PC 2: Puerto 4000 abierto
- PC 3: Puerto 5000 abierto

### Credenciales Compartidas
- `STORAGE_URL`: Mismo para todas las PCs y el gateway
- `API_KEY`: Mismo para todas las PCs y el gateway
- `ENCRYPTION_KEY`: Mismo para todas las PCs y el gateway

### Tokens por Backend
- `BACKEND_TOKEN`: Diferente para cada PC (productos, usuarios, inventario)
- Solo el gateway conoce estos tokens
- Las APIs los validan en cada petición

## Verificar Registros

Desde cualquier PC:

```bash
deno run -A scripts/check-backends.ts
```

Deberías ver:
```
productos → http://<IP-PC1>:3000 [/productos]
usuarios → http://<IP-PC2>:4000 [/usuarios]
inventario → http://<IP-PC3>:5000 [/inventario]
```

## Iniciar Daemon como Servicio Windows

Para que el daemon se ejecute automáticamente al iniciar Windows:

1. Abre **Programador de Tareas** (Task Scheduler)

2. Crea una nueva tarea:
   - Nombre: "API Gateway Daemon"
   - Ejecutar aunque el usuario no haya iniciado sesión
   - Ejecutar con privilegios más altos

3. Desencadenador:
   - Al iniciar el sistema

4. Acción:
   - Programa: `cmd.exe`
   - Argumentos: `/c "cd /d D:\proyectos\backend-infrastructure\backend-gateway && start-daemon.bat"`

5. Guarda la tarea

Ahora el registro se ejecutará automáticamente en cada inicio.

## Solución de Problemas

### El gateway no encuentra el backend
1. Verifica que el daemon esté corriendo: `tasklist | findstr deno`
2. Verifica registros: `deno run -A scripts/check-backends.ts`
3. Verifica que `STORAGE_URL`, `API_KEY` sean iguales en PC y gateway

### El gateway no puede conectar
1. Verifica port forwarding en el router
2. Prueba acceso directo: `curl http://<IP-publica>:<puerto>/ruta`
3. Verifica firewall de Windows (permitir puerto)

### La IP no se actualiza
1. Verifica que el daemon esté corriendo (debe decir "Daemon mode")
2. Revisa logs en la consola del daemon
3. Verifica conectividad a api.ipify.org

### Error 401 Unauthorized
1. Verifica que `BACKEND_TOKEN` coincida en registro y en la API
2. El gateway envía el token en header `Authorization: Bearer <token>`
3. Tu API debe validar este token

## Ejemplo Completo

### PC 1 - API de Productos
```typescript
// api.ts en PC 1
Deno.serve({ port: 3000 }, (req) => {
  const auth = req.headers.get("authorization");
  if (auth !== "Bearer token-secreto-productos") {
    return new Response("Unauthorized", { status: 401 });
  }
  
  return Response.json({ productos: ["A", "B", "C"] });
});
```

### Registro PC 1
```bash
# start-daemon.bat configurado con BACKEND_NAME=productos
start-daemon.bat
```

### Gateway en Deno Deploy
```bash
# Se despliega automáticamente con las env vars
# No requiere configuración manual de IPs
```

### Cliente Final
```bash
# Accede sin conocer la IP de PC 1
curl https://tu-gateway.deno.dev/productos/list
# El gateway automáticamente usa la IP actual de PC 1
```

## Resumen

✅ **Ventajas de este enfoque**:
- IPs dinámicas manejadas automáticamente
- Configuración centralizada en KV Storage
- Un solo punto de acceso (gateway)
- Tokens seguros por backend
- Sin hardcodear IPs

✅ **Lo que necesitas**:
- Port forwarding en cada router
- Daemon corriendo en cada PC
- Gateway desplegado en Deno Deploy
- Credenciales compartidas (STORAGE_URL, API_KEY, ENCRYPTION_KEY)
