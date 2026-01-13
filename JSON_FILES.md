# 📦 Archivos de Datos de Ejemplo

Este directorio contiene archivos JSON de ejemplo utilizados por el **mock server** (`scripts/registry-server.ts`) para desarrollo local.

## 📄 Archivos

### `backends.json`
Ejemplo de backend registrado. Usado por el mock server para simular el KV Storage.

```json
{
  "key": "Desarrollo",
  "data": {
    "name": "Desarrollo",
    "url": "http://localhost:3000",
    "token": "token-encriptado...",
    "prefix": "/api/desa"
  }
}
```

### `users.json`
Ejemplos de usuarios registrados. Usado por el mock server.

**Usuario incluido:**
- Username: `admin`
- Password: `admin123`
- Hash: `JAvlGPq9JyTdtvBO6x2llnRI1+gxwIyPqCKAn3THIKk=`
- Roles: `["admin"]`

### `user-admin.json`
Formato alternativo del usuario admin para referencia.

### `deno.json`
⚠️ **IMPORTANTE** - Este archivo SÍ se usa en producción.

Contiene la configuración de Deno (tareas, imports, etc).

## 🎭 ¿Cuándo se usan?

### ✅ Desarrollo Local (Mock Server)

```bash
# Terminal 1: Mock server (usa los JSON)
deno run -A scripts/registry-server.ts

# Terminal 2: Gateway apuntando al mock
BACKENDS_REGISTRY_URL=http://localhost:8001 \
deno run -A src/simple-gateway.ts
```

Los archivos JSON se leen/escriben automáticamente por el mock server.

### ❌ Producción (KV Storage Real)

```bash
# Gateway apunta al KV Storage en la nube
BACKENDS_REGISTRY_URL=https://kv-storage-api.deno.dev \
deno run -A src/simple-gateway.ts
```

Los archivos JSON **NO se usan** en producción. Todo está en la nube.

## 🔧 Modificar Datos de Ejemplo

### Cambiar Password del Usuario Admin

1. Generar nuevo hash:
```bash
deno run -A src/register-user.ts \
  --username admin \
  --password tu-nueva-password \
  --registry-url http://localhost:8001 \
  --api-key desarrollo-api-key-2026
```

2. El mock server actualizará automáticamente `users.json`

### Agregar Nuevo Backend

```bash
deno run -A src/register-backend.ts \
  --name=mi-backend \
  --backend-url=http://localhost:4000 \
  --backend-token=mi-token \
  --prefix=/mi-api \
  --registry-url http://localhost:8001 \
  --api-key desarrollo-api-key-2026
```

El mock server agregará el backend a `backends.json`

## 🗑️ ¿Puedo Eliminarlos?

### NO elimines:
- ✅ `deno.json` - **Requerido siempre**

### Puedes eliminar si NO usas el mock server:
- `backends.json`
- `users.json`
- `user-admin.json`

**Pero se recomienda mantenerlos** como ejemplos para nuevos desarrolladores.

## 📚 Más Información

- Ver [scripts/registry-server.ts](scripts/registry-server.ts) para detalles del mock
- Ver [README.md](README.md) para documentación general
- Ver [docs/SISTEMA_GATEWAY.md](docs/SISTEMA_GATEWAY.md) para arquitectura completa
