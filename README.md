# 🌐 Backend Gateway

Sistema completo de registro y enrutamiento de backends con encriptación de tokens y gateway inteligente.

**✨ Compatible con Deno Deploy**

## 📦 Componentes

### 1. **Register Backend** - Cliente de Registro
Registra y mantiene backends en el KV Storage con encriptación de tokens.

### 2. **Gateway Server** - Servidor Gateway
Administra y enruta peticiones a los backends registrados con balanceo de carga y health checks.
Compatible con Deno Deploy mediante actualización lazy/on-demand.

---

## 🚀 Uso Rápido

### 🎯 Iniciar Gateway Server

#### Ejecución Local
```bash
# Configurar variables de entorno
export BACKENDS_REGISTRY_URL=http://localhost:8000
export API_KEY=test-token-123

# Ejecutar
deno run -A gateway-server.ts
```

O usando archivo .env y deno task:
```bash
cp .env.example .env
# Editar .env con tus valores
deno task proxy:start
```

#### Despliegue en Deno Deploy

1. **Crear proyecto en Deno Deploy**
2. **Configurar variables de entorno**:
   - `BACKENDS_REGISTRY_URL`: URL del servidor de registro de backends
   - `API_KEY`: API Key para acceder al KV Storage
   - `ENCRYPTION_KEY`: Clave para desencriptar tokens (opcional)
   - `CACHE_TTL_MS`: TTL del caché en ms (opcional, default: 30000)

3. **Desplegar**:
```bash
deployctl deploy --project=tu-proyecto gateway-server.ts
```

El gateway actualizará automáticamente la lista de backends cada 30 segundos (o el valor de `CACHE_TTL_MS`).

### 📝 Registrar Backend

#### Registro Básico
```bash
deno run -A register-backend.ts \
  --name=backend-prod \
  --backend-url=http://10.6.46.114:3013 \
  --backend-token=secret123 \
  --prefix=/api/prod \
  --registry-url=http://localhost:8000 \
  --api-key=test-token-123
```

### Con IP Pública Automática
```bash
deno run -A register-backend.ts \
  --name=backend-dev \
  --backend-port=3000 \
  --use-public-ip \
  --backend-token=dev-secret \
  --prefix=/dev \
  --registry-url=http://localhost:8000 \
  --api-key=test-token-123
```

### Modo Daemon (Auto-registro cada 5 min)
```bash
deno run -A register-backend.ts \
  --name=backend-auto \
  --backend-url=http://localhost:3000 \
  --backend-token=token123 \
  --prefix=/auto \
  --registry-url=http://localhost:8000 \
  --api-key=test-token-123 \
  --daemon
```
---

## 🌐 Proxy Server

### Características

- ✅ **Auto-descubrimiento**: Consulta automáticamente backends desde KV Storage
- 🔐 **Desencriptación automática**: Desencripta tokens de backends
- 🎯 **Routing inteligente**: Enruta basado en prefijos con matching específico
- ⚖️ **Balanceo de carga**: Round-robin entre backends saludables
- 💚 **Health checks**: Verifica salud de backends cada 15 segundos
- 🔄 **Auto-refresh**: Actualiza lista de backends cada 30 segundos

### Parámetros del Proxy

| Parámetro | Descripción | Requerido | Ejemplo |
|-----------|-------------|-----------|---------|
| `--port` | Puerto del proxy | ❌ (8080) | `--port=8080` |
| `--config` | URL del KV Storage API | ✅ | `--config=http://localhost:8000` |
| `--api-key` | Token del KV Storage API | ✅ | `--api-key=test-token-123` |
| `--key` | Clave de desencriptación | ❌ | `--key=mi-clave-secreta` |

### Endpoints del Proxy

#### Health Check
```bash
curl http://localhost:8080/proxy/health
```
Respuesta:
```json
{
  "status": "ok",
  "backends": 3,
  "healthy": 2
}
```

#### Status Completo
```bash
curl http://localhost:8080/proxy/status
```
Respuesta:
```json
[
  {
    "name": "backend-prod",
    "url": "http://10.6.46.114:3013",
    "prefix": "/api/prod",
    "healthy": true,
    "lastCheck": "2026-01-07T12:35:00.000Z",
    "consecutiveFailures": 0
  },
  {
    "name": "backend-dev",
    "url": "http://localhost:3000",
    "prefix": "/dev",
    "healthy": false,
    "lastCheck": "2026-01-07T12:35:05.000Z",
    "consecutiveFailures": 3
  }
]
```

### Routing

El proxy enruta las peticiones basándose en los prefijos configurados:

```bash
# Petición al proxy
curl http://localhost:8080/api/prod/users

# Se enruta a -> http://10.6.46.114:3013/users
# (elimina el prefijo /api/prod)
```

### Ejemplo Completo

1. **Iniciar KV Storage API** (puerto 8000)
2. **Registrar backends**:
```bash
# Backend de producción
deno run -A register-backend.ts \
  --name=prod \
  --url=http://10.6.46.114:3013 \
  --token=prod-secret \
  --prefix=/api/prod \
  --config=http://localhost:8000 \
  --api-key=test-token-123

# Backend de desarrollo
deno run -A register-backend.ts \
  --name=dev \
  --url=http://localhost:3000 \
  --token=dev-secret \
  --prefix=/api/dev \
  --config=http://localhost:8000 \
  --api-key=test-token-123
```

3. **Iniciar Gateway**:
```bash
export CONFIG_API_URL=http://localhost:8000
export API_KEY=test-token-123
deno run -A gateway-server.ts
```

4. **Hacer peticiones a través del gateway**:
```bash
# A producción
curl http://localhost:8080/api/prod/users

# A desarrollo
curl http://localhost:8080/api/dev/users

# Ver status del gateway
curl http://localhost:8080/gateway/status

# Ver tabla de enrutamiento
curl http://localhost:8080/gateway/routing

# Health check
curl http://localhost:8080/gateway/health
```

### Headers Añadidos por el Gateway

El gateway añade headers informativos:

```
X-Proxied-By: gateway-server
X-Backend-Name: backend-prod
X-Forwarded-For: client-ip
X-Forwarded-Host: localhost:8080
X-Forwarded-Proto: http
```

---

## ☁️ Despliegue en Deno Deploy

### Características Optimizadas para Deno Deploy

- **Actualización lazy/on-demand**: Solo carga backends cuando es necesario
- **Caché con TTL**: Reduce llamadas al KV Storage
- **Sin timers bloqueantes**: Compatible con el entorno de Deno Deploy
- **Health checks on-demand**: Se ejecutan solo cuando se necesitan

### Pasos para Desplegar

1. **Crear cuenta en [Deno Deploy](https://deno.com/deploy)**

2. **Crear nuevo proyecto**:
   - Conecta tu repositorio GitHub o GitLab
   - O usa `deployctl` para despliegue directo

3. **Configurar variables de entorno** en el dashboard:
   ```
   CONFIG_API_URL=https://tu-kv-storage-api.deno.dev
   API_KEY=tu-api-key-segura
   ENCRYPTION_KEY=tu-clave-encriptacion
   CACHE_TTL_MS=30000
   ```

4. **Desplegar con deployctl**:
   ```bash
   # Instalar deployctl
   deno install -A --global jsr:@deno/deployctl
   
   # Desplegar
   deployctl deploy \
     --project=backend-gateway \
     --env=CONFIG_API_URL=https://tu-api.deno.dev \
     --env=API_KEY=tu-key \
     gateway-server.ts
   ```

5. **Verificar despliegue**:
   ```bash
   curl https://backend-gateway.deno.dev/gateway/health
   ```

### Monitoreo en Producción

```bash
# Health check
curl https://tu-proyecto.deno.dev/gateway/health

# Estado de backends
curl https://tu-proyecto.deno.dev/gateway/status

# Tabla de enrutamiento
curl https://tu-proyecto.deno.dev/gateway/routing
```

---

## 📝 Registro de Backends

```

## 📋 Parámetros

| Parámetro | Descripción | Requerido | Ejemplo |
|-----------|-------------|-----------|---------|
| `--name` | Identificador único del backend | ✅ | `--name=backend-prod` |
| `--url` | URL del backend | ✅* | `--url=http://10.6.46.114:3013` |
| `--port` | Puerto (con `--use-public-ip`) | ✅* | `--port=3000` |
| `--token` | Token de autenticación del backend | ✅ | `--token=secret123` |
| `--prefix` | Prefijo de rutas | ✅ | `--prefix=/api/v1` |
| `--config` | URL del KV Storage API | ✅ | `--config=http://localhost:8000` |
| `--api-key` | Token del KV Storage API | ✅ | `--api-key=test-token-123` |
| `--use-public-ip` | Usar IP pública como URL | ❌ | Flag sin valor |
| `--daemon` | Modo registro continuo | ❌ | Flag sin valor |
| `--key` | Clave de encriptación custom | ❌ | `--key=mi-clave-secreta` |

\* Requerido `--url` O `--port + --use-public-ip`

## 🔐 Variables de Entorno (Alternativas)

```bash
# Windows PowerShell
$env:BACKEND_NAME="backend-prod"
$env:BACKEND_URL="http://localhost:3000"
$env:BACKEND_TOKEN="secret123"
$env:BACKEND_PREFIX="/api"
$env:CONFIG_API_URL="http://localhost:8000"
$env:API_KEY="test-token-123"
$env:ENCRYPTION_KEY="custom-key-2026"

deno run -A register-backend.ts
```

## 🔑 Tokens

### `--token` (Token del Backend)
- Token de autenticación del backend que estás registrando
- Se guarda **encriptado** con AES-GCM
- Cada backend tiene su propio token

### `--api-key` (Token del KV Storage)
- Token para escribir en el KV Storage API
- Debe coincidir con el `API_KEY` del servidor KV
- NO se guarda, solo se usa durante el registro

## 📊 Estructura de Datos Guardada

```json
{
  "key": "backend-prod",
  "data": {
    "name": "backend-prod",
    "url": "http://10.6.46.114:3013",
    "token": "encrypted_base64_token...",
    "prefix": "/api/prod"
  },
  "metadata": {
    "registeredAt": "2026-01-07T12:30:00.000Z",
    "lastUpdate": "2026-01-07T12:30:00.000Z",
    "system": {
      "hostname": "mi-servidor",
      "os": "windows",
      "arch": "x86_64",
      "denoVersion": "2.6.3",
      "publicIP": "200.123.45.67"
    }
  }
}
```

## 🌐 IP Pública

### Modo 1: URL Manual
```bash
--url=http://10.6.46.114:3013
```
- Usa la URL especificada
- IP pública se guarda en `metadata.system.publicIP` (solo referencia)

### Modo 2: IP Pública Automática
```bash
--port=3000 --use-public-ip
```
- Obtiene IP de `api.ipify.org`
- URL final: `http://[IP_PUBLICA]:3000`
- IP también se guarda en metadata

## 🔄 Modo Daemon

Registro automático cada 5 minutos:

```bash
deno run -A register-backend.ts \
  --name=backend-auto \
  --url=http://localhost:3000 \
  --token=token123 \
  --prefix=/auto \
  --config=http://localhost:8000 \
  --api-key=test-token-123 \
  --daemon
```

**Uso típico:** Mantener actualizado el registro en entornos con IPs dinámicas.

## 🛠️ Ejemplos de Uso

### Desarrollo Local
```bash
deno run -A register-backend.ts \
  --name=dev-local \
  --url=http://localhost:3000 \
  --token=dev123 \
  --prefix=/dev \
  --config=http://localhost:8000 \
  --api-key=test-token-123
```

### Producción con IP Estática
```bash
deno run -A register-backend.ts \
  --name=prod-api \
  --url=http://192.168.1.100:8080 \
  --token=prod-secret-2026 \
  --prefix=/api/v2 \
  --config=https://kv-storage.deno.dev \
  --api-key=production-key-secure
```

### Servidor con IP Dinámica
```bash
deno run -A register-backend.ts \
  --name=dynamic-backend \
  --port=3000 \
  --use-public-ip \
  --token=dynamic-token \
  --prefix=/dynamic \
  --config=https://kv-storage.deno.dev \
  --api-key=production-key \
  --daemon
```

## 🔒 Encriptación

El token del backend se encripta con:
- **Algoritmo:** AES-GCM 256-bit
- **Derivación:** PBKDF2 con 100,000 iteraciones
- **Clave por defecto:** `go-oracle-api-secure-key-2026`
- **Clave custom:** `--key=tu-clave-secreta`

## ✅ Verificar Registro

```bash
# Ver todos los backends registrados
curl http://localhost:8000/collections/backends

# Ver backend específico
curl http://localhost:8000/collections/backends/backend-prod

# Con jq (formatear JSON)
curl http://localhost:8000/collections/backends/backend-prod | jq
```

## 🚨 Solución de Problemas

### Error: "Faltan parámetros"
Verifica que todos los parámetros requeridos estén presentes.

### Error: "401 Unauthorized"
El `--api-key` no coincide con el `API_KEY` del servidor KV.

### Error: "No se pudo obtener IP pública"
- Verifica conexión a internet
- El script usará `127.0.0.1` como fallback

### Error: "409 Conflict"
El backend ya existe. Usa PUT para actualizar o cambia el `--name`.

## 🔗 Relacionado

- [KV Storage API](../backends-proliq/) - Servidor de persistencia
- [API Reference](../backends-proliq/README.md) - Documentación completa del KV API

---

**Proyecto:** Backend Gateway  
**Versión:** 1.0.0  
**Deno:** 2.6.3+  
**Licencia:** MIT
