# 🔐 Autenticación del Gateway

El gateway ahora requiere autenticación mediante tokens Bearer temporales.

## 🚀 Inicio Rápido

### 1. Obtener un Token

```bash
curl -X POST http://localhost:8000/gateway/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Respuesta:**
```json
{
  "token": "ABC123XYZ...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### 2. Usar el Token

```bash
# Ver status
curl http://localhost:8000/gateway/status \
  -H "Authorization: Bearer ABC123XYZ..."

# Proxy a backend
curl http://localhost:8000/api/users \
  -H "Authorization: Bearer ABC123XYZ..."
```

### 3. Cerrar Sesión (Logout)

```bash
curl -X POST http://localhost:8000/gateway/logout \
  -H "Authorization: Bearer ABC123XYZ..."
```

**Respuesta:**
```json
{
  "message": "Logout successful"
}
```

⚠️ **Después del logout, el token queda inmediatamente revocado y no se puede volver a usar.**

## 🔑 Configuración

Variables de entorno:

```bash
# Credenciales del gateway
GATEWAY_USERNAME=admin
GATEWAY_PASSWORD=tu-password-seguro

# Duración del token (en milisegundos)
TOKEN_TTL_MS=3600000  # 1 hora por defecto
```

## 📝 Endpoints

### Públicos (sin autenticación)
- `POST /gateway/login` - Obtener token
- `GET /gateway/health` - Health check
- `OPTIONS *` - CORS preflight

### Protegidos (requieren token Bearer)
- `POST /gateway/logout` - Cerrar sesión y revocar token
- `GET /gateway/status` - Estado de backends
- `GET /gateway/routing` - Tabla de rutas
- `GET /` o `/gateway` - Info del gateway
- Todas las rutas de proxy a backends

## 🛡️ Seguridad

- ✅ Tokens aleatorios generados con `crypto.getRandomValues`
- ✅ Tokens con expiración configurable (1 hora por defecto)
- ✅ Limpieza automática de tokens expirados
- ✅ Revocación manual de tokens con logout
- ✅ Validación estricta del formato Bearer
- ✅ Respuestas 401 con WWW-Authenticate header

## 💡 Ejemplo Completo

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:8000/gateway/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.token')

# 2. Usar el token
curl http://localhost:8000/gateway/status \
  -H "Authorization: Bearer $TOKEN"

# 3. Proxy a tu backend
curl http://localhost:8000/api/users \
  -H "Authorization: Bearer $TOKEN"

# 4. Logout cuando termines
curl -X POST http://localhost:8000/gateway/logout \
  -H "Authorization: Bearer $TOKEN"
```

## ⚠️ Importante

- Cambia las credenciales por defecto en producción
- Guarda el token de forma segura
- El token expira después del tiempo configurado en `TOKEN_TTL_MS`
- Los tokens se almacenan en memoria (se pierden al reiniciar el gateway)
