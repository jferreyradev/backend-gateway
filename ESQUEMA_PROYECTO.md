# 📊 Esquema Resumen del Proyecto - Backend Gateway

## 🎯 Visión General

**Backend Gateway** es un sistema de enrutamiento y proxy minimalista construido con **Deno** que permite gestionar múltiples backends de forma centralizada con autenticación segura, balanceo de carga y caché inteligente.

### Características Principales
- 🔐 **Autenticación Bearer** con tokens temporales
- 🔄 **Balanceo de carga** round-robin automático
- ⚡ **Caché inteligente** de backends (30s TTL)
- 🌐 **Enrutamiento dinámico** por prefijos
- 🔒 **Encriptación** de tokens de backends
- 📊 **Monitoreo** y status en tiempo real
- ☁️ **Deploy listo** para Deno Deploy

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE / USUARIO                         │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ (1) Login / Request + Token
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND GATEWAY                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │             Gateway Server (gateway-server.ts)           │   │
│  │                                                           │   │
│  │  ┌──────────────────┐  ┌──────────────────┐            │   │
│  │  │  Autenticación   │  │  Enrutamiento    │            │   │
│  │  │  - Tokens Bearer │  │  - Por prefijos  │            │   │
│  │  │  - Validación    │  │  - Round-robin   │            │   │
│  │  └──────────────────┘  └──────────────────┘            │   │
│  │                                                           │   │
│  │  ┌──────────────────┐  ┌──────────────────┐            │   │
│  │  │  Caché           │  │  Proxy HTTP      │            │   │
│  │  │  - 30s TTL       │  │  - Headers       │            │   │
│  │  │  - Backends      │  │  - Body forward  │            │   │
│  │  └──────────────────┘  └──────────────────┘            │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ (2) Fetch backends list
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      KV STORAGE (Deno KV)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Collection: backends/                                   │   │
│  │  - name, url, token (encrypted), prefix                  │   │
│  │                                                           │   │
│  │  Collection: users/                                      │   │
│  │  - username, passwordHash                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ (3) Proxy request
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKENDS                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Backend 1   │  │  Backend 2   │  │  Backend N   │         │
│  │  /api/v1     │  │  /users      │  │  /products   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Estructura de Carpetas y Archivos

```
backend-gateway/
│
├── 📁 src/                          # Código fuente principal
│   ├── gateway-server.ts            # ⭐ Servidor gateway con lógica principal
│   │                                #    - Autenticación Bearer
│   │                                #    - Enrutamiento y proxy
│   │                                #    - Balanceo de carga
│   │                                #    - Caché de backends
│   │
│   └── registry-server.ts           # Servidor de registro local (desarrollo)
│                                    #    - Mock del KV storage
│                                    #    - Para testing local
│
├── 📁 scripts/                      # Scripts de utilidad y testing
│   ├── register-backend.ts          # CLI para registrar backends
│   ├── register-user.ts             # CLI para registrar usuarios
│   ├── check-backends.ts            # Verificar backends registrados
│   ├── test-general.ts              # ⭐ Test suite completo (13 tests)
│   ├── test-simple.ts               # Test rápido (3 tests básicos)
│   ├── test-auth.ts                 # Test de autenticación
│   └── test-kv.ts                   # Test de conexión al KV storage
│
├── 📁 docs/                         # Documentación detallada
│   ├── AUTHENTICATION.md            # Guía de autenticación
│   ├── DEPLOY_DENO.md               # Instrucciones de deploy
│   ├── QUICKSTART.md                # Guía de inicio rápido
│   ├── TESTING.md                   # Guía de testing
│   ├── PROJECT_STRUCTURE.md         # Estructura del proyecto
│   └── USER_MANAGEMENT.md           # Gestión de usuarios
│
├── 📄 main.ts                       # Entry point para Deno Deploy
├── 📄 deno.json                     # Configuración de Deno + tasks
├── 📄 .env.example                  # Template de variables de entorno
├── 📄 .gitignore                    # Archivos ignorados
├── 📄 backends.json                 # Datos de ejemplo para desarrollo
└── 📄 README.md                     # Documentación principal
```

---

## 🔧 Componentes Principales

### 1. Gateway Server (`src/gateway-server.ts`)

**Responsabilidades:**
- ✅ Gestión de autenticación con tokens Bearer
- ✅ Validación de credenciales contra KV Storage
- ✅ Enrutamiento de peticiones a backends
- ✅ Balanceo de carga round-robin
- ✅ Caché de configuración de backends
- ✅ Proxy HTTP hacia backends
- ✅ Desencriptación de tokens de backends
- ✅ Endpoints de monitoreo y health check

**Endpoints Públicos:**
```
GET  /gateway/health              # Health check (sin auth)
POST /gateway/login               # Autenticación (sin auth)
```

**Endpoints Protegidos (requieren Bearer token):**
```
GET  /gateway/status              # Estado de todos los backends
GET  /gateway/routing             # Tabla de enrutamiento
POST /gateway/logout              # Cerrar sesión
/*                                # Proxy a backends según prefix
```

**Flujo de Autenticación:**
```
1. Cliente → POST /gateway/login {username, password}
2. Gateway → Valida contra KV Storage (collection: users/)
3. Gateway → Genera token Bearer aleatorio
4. Gateway → Almacena token con TTL (default: 1 hora)
5. Gateway → Responde {token, expiresIn, tokenType}
6. Cliente → Usa token en header: Authorization: Bearer <token>
```

**Flujo de Enrutamiento:**
```
1. Cliente → GET /api/v2/users (con Bearer token)
2. Gateway → Valida token
3. Gateway → Busca backend con prefix más específico
   - Ejemplo: /api/v2 > /api
4. Gateway → Aplica balanceo round-robin si hay múltiples backends
5. Gateway → Desencripta token del backend
6. Gateway → Hace proxy de la petición al backend
7. Gateway → Devuelve respuesta al cliente
```

### 2. KV Storage (Deno KV)

**Collections:**

**`backends/` - Configuración de backends**
```json
{
  "key": "backend-name",
  "data": {
    "name": "Backend API",
    "url": "https://api.example.com",
    "token": "encrypted_token_here",
    "prefix": "/api/v1"
  },
  "metadata": {
    "registeredAt": "2025-01-08T00:00:00Z",
    "lastUpdate": "2025-01-08T00:00:00Z",
    "system": {
      "hostname": "server1",
      "os": "linux",
      "arch": "x86_64",
      "denoVersion": "2.6.1"
    }
  }
}
```

**`users/` - Usuarios autorizados**
```json
{
  "key": "username",
  "data": {
    "passwordHash": "sha256_hash_here"
  }
}
```

### 3. Scripts de Registro

**`register-backend.ts`** - Registra backends en el KV Storage
```bash
deno run -A scripts/register-backend.ts \
  --name="API Backend" \
  --backend-url="http://localhost:3000" \
  --backend-token="secret123" \
  --prefix="/api" \
  --registry-url="https://kv-storage-api.deno.dev" \
  --api-key="your-api-key"
```

**`register-user.ts`** - Registra usuarios para autenticación
```bash
deno run -A scripts/register-user.ts \
  --username="admin" \
  --password="secure-password" \
  --registry-url="https://kv-storage-api.deno.dev" \
  --api-key="your-api-key"
```

### 4. Test Suite

**Test Completo** (`test-general.ts`) - 13 pruebas:
```
✅ Endpoints públicos
  - Health check
  - Login con credenciales

✅ Seguridad
  - Rechazo sin token
  - Rechazo con token inválido

✅ Endpoints protegidos
  - Status de backends
  - Routing table
  - Proxy a backends
  - Logout

✅ Validación
  - Headers correctos
  - Body JSON válido
```

---

## 🔄 Flujo de Datos Completo

### Ejemplo: Petición a un Backend

```
┌──────────┐                                                    
│ Cliente  │                                                    
└────┬─────┘                                                    
     │                                                          
     │ 1. POST /gateway/login                                  
     │    {username: "admin", password: "pass"}                
     ▼                                                          
┌─────────────┐                                                
│   Gateway   │                                                
│   Server    │                                                
└─────┬───────┘                                                
      │                                                         
      │ 2. Validate credentials                               
      ▼                                                         
┌─────────────┐                                                
│ KV Storage  │                                                
│   users/    │                                                
└─────┬───────┘                                                
      │                                                         
      │ 3. Return passwordHash                                
      ▼                                                         
┌─────────────┐                                                
│   Gateway   │                                                
│   Server    │ 4. Generate token                             
└─────┬───────┘    Store in memory                            
      │                                                         
      │ 5. Return {token, expiresIn}                          
      ▼                                                         
┌──────────┐                                                    
│ Cliente  │ 6. Store token                                   
└────┬─────┘                                                    
     │                                                          
     │ 7. GET /api/users                                       
     │    Header: Authorization: Bearer <token>               
     ▼                                                          
┌─────────────┐                                                
│   Gateway   │ 8. Validate token                             
│   Server    │                                                
└─────┬───────┘                                                
      │                                                         
      │ 9. Check cache (30s TTL)                              
      │    If expired, fetch backends                         
      ▼                                                         
┌─────────────┐                                                
│ KV Storage  │ 10. Return backends list                      
│  backends/  │                                                
└─────┬───────┘                                                
      │                                                         
      ▼                                                         
┌─────────────┐                                                
│   Gateway   │ 11. Match prefix: /api                        
│   Server    │ 12. Round-robin selection                     
└─────┬───────┘ 13. Decrypt backend token                     
      │                                                         
      │ 14. Proxy request                                      
      │     Header: Authorization: Bearer <backend-token>      
      ▼                                                         
┌─────────────┐                                                
│  Backend    │ 15. Process request                           
│   API       │ 16. Return response                           
└─────┬───────┘                                                
      │                                                         
      ▼                                                         
┌─────────────┐                                                
│   Gateway   │ 17. Forward response                          
│   Server    │                                                
└─────┬───────┘                                                
      │                                                         
      ▼                                                         
┌──────────┐                                                    
│ Cliente  │ 18. Receive response                             
└──────────┘                                                    
```

---

## ⚙️ Variables de Entorno

### Gateway Server
```bash
# Requeridas
BACKENDS_REGISTRY_URL=https://kv-storage-api.deno.dev  # URL del KV Storage
API_KEY=your-api-key                                    # API Key para acceder al KV

# Opcional - Seguridad
ENCRYPTION_KEY=go-oracle-api-secure-key-2025           # Clave de encriptación
GATEWAY_USERNAME=admin                                  # Usuario del gateway
GATEWAY_PASSWORD=secure-password                        # Password del gateway

# Opcional - Performance
CACHE_TTL_MS=30000                                      # Cache TTL (default: 30s)
TOKEN_TTL_MS=3600000                                    # Token TTL (default: 1h)
```

---

## 🚀 Comandos de Deno (deno.json)

```json
{
  "tasks": {
    "dev": "deno serve --allow-net --allow-env src/gateway-server.ts",
    "start": "deno serve --allow-net --allow-env src/gateway-server.ts",
    "registry": "deno run -A src/registry-server.ts",
    "register": "deno run -A scripts/register-backend.ts",
    "register:user": "deno run -A scripts/register-user.ts",
    "test": "deno run -A scripts/test-general.ts",
    "test:simple": "deno run -A scripts/test-simple.ts",
    "test:auth": "deno run -A scripts/test-auth.ts",
    "test:kv": "deno run -A scripts/test-kv.ts",
    "check": "deno run -A scripts/check-backends.ts"
  }
}
```

**Uso:**
```bash
# Desarrollo
deno task dev              # Iniciar gateway en puerto 8000
deno task registry         # Iniciar servidor de registro local
deno task register         # Registrar un nuevo backend
deno task register:user    # Registrar un nuevo usuario

# Testing
deno task test             # Test completo (13 tests)
deno task test:simple      # Test rápido (3 tests)
deno task test:auth        # Test de autenticación
deno task test:kv          # Test de KV Storage
deno task check            # Verificar backends registrados

# Producción
deno task start            # Iniciar en modo producción
```

---

## 🔐 Sistema de Seguridad

### Niveles de Seguridad

**1. Autenticación de Usuario (Cliente → Gateway)**
- Credenciales almacenadas en KV Storage (`users/` collection)
- Passwords hasheados con SHA-256
- Tokens Bearer generados aleatoriamente (32 bytes)
- TTL configurable (default: 1 hora)
- Tokens almacenados en memoria del gateway

**2. Autenticación de Backend (Gateway → Backends)**
- Tokens encriptados en KV Storage
- Desencriptación transparente por el gateway
- Forwarding automático en header `Authorization`

**3. Endpoints Protegidos**
- Todos los endpoints requieren Bearer token excepto:
  - `GET /gateway/health`
  - `POST /gateway/login`

### Formato de Token
```
Header: Authorization: Bearer <token_aleatorio_32_bytes>
Ejemplo: Authorization: Bearer Q2xhc3NpYyBjcnlwdG8gcmFuZG9t
```

---

## 📊 Características Técnicas

### Caché Inteligente
- **TTL por defecto:** 30 segundos
- **Estrategia:** Cache-aside pattern
- **Invalidación:** Automática por timeout
- **Scope:** Configuración de backends

### Balanceo de Carga
- **Algoritmo:** Round-robin
- **Granularidad:** Por prefix
- **Estado:** Contador en memoria
- **Fallback:** Si un backend falla, intenta el siguiente

### Enrutamiento
- **Estrategia:** Longest prefix match
- **Prioridad:** Prefijos más específicos primero
- **Ejemplo:**
  ```
  /api/v2/users  → Backend con prefix /api/v2 (si existe)
                 → Backend con prefix /api (fallback)
  ```

### Proxy HTTP
- **Método:** Fetch API nativo de Deno
- **Headers:** Forward completo
- **Body:** Stream directo
- **Timeout:** Sin timeout explícito (usa defaults del sistema)

---

## 🌐 Deploy en Deno Deploy

### Configuración
1. Push código a GitHub
2. Conectar repositorio en [dash.deno.com](https://dash.deno.com)
3. Configurar variables de entorno:
   - `BACKENDS_REGISTRY_URL`
   - `API_KEY`
   - `GATEWAY_USERNAME`
   - `GATEWAY_PASSWORD`
   - (Opcional) `ENCRYPTION_KEY`, `CACHE_TTL_MS`, `TOKEN_TTL_MS`
4. Entry point: `main.ts`
5. Deploy automático en cada push

### Ventajas
- ✅ Edge computing global
- ✅ Auto-scaling
- ✅ Zero configuration
- ✅ HTTPS automático
- ✅ Deno KV integrado

---

## 📈 Métricas y Monitoreo

### Endpoints de Status

**`GET /gateway/health`** (público)
```json
{
  "status": "healthy",
  "timestamp": "2025-01-09T12:00:00Z",
  "uptime": 3600000,
  "version": "1.0.0"
}
```

**`GET /gateway/status`** (protegido)
```json
{
  "backends": [
    {
      "name": "API Backend",
      "url": "https://api.example.com",
      "prefix": "/api",
      "healthy": true
    }
  ],
  "totalBackends": 1,
  "healthyBackends": 1
}
```

**`GET /gateway/routing`** (protegido)
```json
{
  "routes": {
    "/api/v1": ["Backend API V1"],
    "/users": ["User Service"]
  }
}
```

---

## 🧪 Testing

### Estrategia de Testing
- **Test completo:** 13 pruebas que cubren todos los flows
- **Test simple:** 3 pruebas básicas para validación rápida
- **Tests específicos:** Autenticación, KV Storage, etc.

### Cobertura
- ✅ Endpoints públicos
- ✅ Autenticación y tokens
- ✅ Endpoints protegidos
- ✅ Proxy a backends
- ✅ Manejo de errores
- ✅ Validación de respuestas
- ✅ Seguridad (tokens inválidos, sin auth)

### Ejemplo de Ejecución
```bash
# Terminal 1: Iniciar gateway
deno task dev

# Terminal 2: Ejecutar tests
deno task test

# Resultado esperado: ✅ 13/13 tests passed
```

---

## 🔧 Desarrollo y Extensión

### Agregar un Nuevo Backend
```bash
deno task register -- \
  --name="My API" \
  --backend-url="http://localhost:3000" \
  --backend-token="secret123" \
  --prefix="/myapi"
```

### Agregar un Nuevo Usuario
```bash
deno task register:user -- \
  --username="newuser" \
  --password="secure-pass"
```

### Modificar el Gateway
El archivo principal está en `src/gateway-server.ts`:
- Líneas 41-240: Clase `GatewayServer` con toda la lógica
- Líneas 49-71: Sistema de autenticación
- Líneas 113-156: Refresh y caché de backends
- Líneas 158-194: Lógica de enrutamiento
- Líneas 196-240: Handlers de endpoints

---

## 📋 Checklist de Deployment

### Pre-Deploy
- [ ] Configurar variables de entorno
- [ ] Registrar al menos un usuario en KV Storage
- [ ] Registrar al menos un backend en KV Storage
- [ ] Ejecutar `deno task test` para validar
- [ ] Verificar conexión al KV Storage con `deno task test:kv`

### Deploy
- [ ] Push código a GitHub
- [ ] Conectar repo en Deno Deploy
- [ ] Configurar variables de entorno en Deno Deploy
- [ ] Verificar entry point: `main.ts`
- [ ] Deploy automático

### Post-Deploy
- [ ] Verificar `GET /gateway/health`
- [ ] Hacer login: `POST /gateway/login`
- [ ] Verificar backends: `GET /gateway/status`
- [ ] Probar proxy: `GET /{prefix}/{endpoint}`

---

## 🎓 Glosario

- **Gateway:** Servidor que actúa como punto de entrada único para múltiples backends
- **KV Storage:** Sistema de almacenamiento clave-valor de Deno
- **Bearer Token:** Token de autenticación enviado en el header HTTP
- **Round-robin:** Algoritmo de balanceo de carga que distribuye peticiones equitativamente
- **Prefix matching:** Estrategia de enrutamiento basada en el inicio de la ruta
- **TTL (Time To Live):** Tiempo de vida de datos en caché
- **Proxy:** Intermediario que reenvía peticiones HTTP
- **Collection:** Agrupación lógica de datos en KV Storage

---

## 📚 Recursos Adicionales

- [README.md](README.md) - Documentación principal
- [docs/QUICKSTART.md](docs/QUICKSTART.md) - Inicio rápido
- [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) - Sistema de autenticación
- [docs/DEPLOY_DENO.md](docs/DEPLOY_DENO.md) - Instrucciones de deploy
- [docs/TESTING.md](docs/TESTING.md) - Guía completa de testing
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) - Estructura detallada

---

## 🤝 Contribución

Para contribuir al proyecto:
1. Fork del repositorio
2. Crear rama: `git checkout -b feature/nueva-funcionalidad`
3. Hacer cambios y commit
4. Ejecutar tests: `deno task test`
5. Push y crear Pull Request

---

**Versión:** 1.0.0  
**Última actualización:** Enero 2025  
**Tecnología:** Deno 2.6+  
**Licencia:** MIT
