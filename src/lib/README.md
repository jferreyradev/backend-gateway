# 📚 Módulos del Gateway (v2.0)

Arquitectura modular del Backend Gateway con separación clara de responsabilidades.

## 📦 Módulos

### [types.ts](types.ts)
**Interfaces y tipos TypeScript**
- `Backend` - Definición de backend
- `AuthToken` - Token de autenticación
- `LoginRequest/Response` - Contratos de login
- `User` - Usuario del sistema
- `KVStorageBackendResponse` - Respuesta del KV storage
- `KVStorageUserResponse` - Respuesta de usuarios

### [config.ts](config.ts)
**Configuración centralizada**
- `GatewayConfig` - Interface de configuración
- `loadConfig()` - Carga variables de entorno
- `validateConfig()` - Valida configuración requerida

**Variables de entorno:**
- `PORT` - Puerto del servidor (default: 8080)
- `STORAGE_URL` - URL de la API de almacenamiento (cualquier API compatible)
- `API_KEY` - API Key para autenticación con la API de almacenamiento
- `TOKEN_TTL_MS` - TTL de tokens (default: 3600000)
- `ENCRYPTION_KEY` - Clave de encriptación (32+ chars)
- `ALLOWED_ORIGINS` - CORS origins (comma-separated)

### [crypto.ts](crypto.ts)
**Criptografía y seguridad**
- `CryptoManager` - Clase principal
  - `decryptToken()` - Desencripta tokens AES-GCM con PBKDF2
  - `hashPassword()` - Hash SHA-256 de contraseñas
  - `generateSecureToken()` - Genera tokens aleatorios
  - `generateRequestId()` - UUID para tracking

**Algoritmos:**
- AES-GCM 256-bit para encriptación
- PBKDF2 con 100,000 iteraciones
- SHA-256 para passwords

### [auth.ts](auth.ts)
**Autenticación y tokens**
- `AuthManager` - Gestión de autenticación
  - `validateToken()` - Valida tokens Bearer
  - `login()` - Autentica usuario
  - `logout()` - Cierra sesión
  - `getActiveTokensCount()` - Cuenta tokens activos

**Características:**
- Tokens en memoria (Map)
- Limpieza automática de tokens expirados
- Validación contra KV storage

### [backends.ts](backends.ts)
**Gestión de backends y proxy**
- `BackendManager` - Gestión de backends
  - `initialize()` - Carga inicial
  - `loadBackends()` - Recarga desde KV storage
  - `findBackend()` - Busca por ruta (longest match)
  - `proxyRequest()` - Proxy HTTP completo
  - `removePrefix()` - Elimina prefijo de ruta
  - `getBackendsList()` - Lista simple
  - `getBackendsDetailedList()` - Lista detallada

**Características:**
- Caché en memoria
- Longest prefix matching
- Desencriptación automática de tokens
- Logging detallado con request IDs

### [middleware.ts](middleware.ts)
**Middleware y utilidades HTTP**
- `MiddlewareManager` - Gestión de HTTP
  - `getCorsHeaders()` - Headers CORS configurables
  - `getSecurityHeaders()` - Headers de seguridad
  - `applyHeaders()` - Aplica headers a Response
  - `jsonResponse()` - Crea respuesta JSON
  - `errorResponse()` - Crea respuesta de error
  - `handleOptions()` - Maneja CORS preflight

**Headers aplicados:**
- CORS: `Access-Control-Allow-*`
- Seguridad: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`
- Tracking: `X-Request-ID`, `X-Response-Time`
- Info: `X-Proxied-By`, `X-Backend`

## 🔄 Flujo de Datos

```
Request → SimpleGateway.handleRequest()
    ↓
    ├─→ MiddlewareManager (CORS, headers)
    ├─→ AuthManager (login, tokens)
    ├─→ BackendManager (proxy)
    │   └─→ CryptoManager (decrypt tokens)
    └─→ MiddlewareManager (response)
```

## 🧪 Testing

Cada módulo es independiente y fácil de testear:

```typescript
// Ejemplo: Test de AuthManager
import { AuthManager } from './auth.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const auth = new AuthManager(config);

// Testear login
const result = await auth.login('user', 'pass');
console.assert(result !== null, 'Login debería funcionar');
```

## 📐 Arquitectura

### Principios aplicados:
- ✅ **Single Responsibility** - Cada módulo tiene una responsabilidad
- ✅ **Dependency Injection** - Config se pasa al constructor
- ✅ **Separation of Concerns** - Lógica separada por dominio
- ✅ **DRY** - No hay código duplicado
- ✅ **Clean Code** - Nombres descriptivos, funciones pequeñas

### Beneficios:
- 🧪 **Testeable** - Unit tests por módulo
- 🔧 **Mantenible** - Fácil de modificar
- 📚 **Legible** - Código auto-documentado
- 🔄 **Reutilizable** - Módulos independientes
- 🚀 **Escalable** - Fácil agregar features

## 🔗 Dependencias

```
simple-gateway.ts
    ├── config.ts
    ├── auth.ts
    │   ├── crypto.ts
    │   ├── types.ts
    │   └── config.ts
    ├── backends.ts
    │   ├── crypto.ts
    │   ├── types.ts
    │   └── config.ts
    ├── middleware.ts
    │   ├── types.ts
    │   └── config.ts
    └── types.ts
```

## 📏 Métricas

| Archivo | Líneas | Responsabilidad |
|---------|--------|-----------------|
| `types.ts` | ~60 | Definiciones de tipos |
| `config.ts` | ~75 | Configuración |
| `crypto.ts` | ~90 | Criptografía |
| `auth.ts` | ~130 | Autenticación |
| `backends.ts` | ~200 | Backends & Proxy |
| `middleware.ts` | ~140 | HTTP middleware |
| **Total lib/** | **~695** | Módulos |
| `simple-gateway.ts` | ~270 | Orquestador |
| **Total** | **~965** | vs 749 monolítico |

**Nota:** Aunque hay más líneas totales, cada archivo es mucho más pequeño y manejable (~200 líneas máx vs 749).

## 🚀 Agregar Nuevas Features

### Ejemplo: Agregar rate limiting

1. Crear `src/lib/rate-limit.ts`:
```typescript
export class RateLimiter {
    private requests = new Map<string, number[]>();
    
    isAllowed(ip: string, limit = 100): boolean {
        // Implementación
    }
}
```

2. Integrar en `simple-gateway.ts`:
```typescript
import { RateLimiter } from './lib/rate-limit.ts';

class SimpleGateway {
    private rateLimiter = new RateLimiter();
    
    async handleRequest(req: Request) {
        if (!this.rateLimiter.isAllowed(clientIP)) {
            return new Response('Too many requests', { status: 429 });
        }
        // ...
    }
}
```

¡Simple y limpio! 🎉
