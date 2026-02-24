# 📝 Scripts de Registro de Backends

Tres formas de registrar backends en el gateway, ordenadas de más simple a más completa.

---

## 🚀 **Opción 1: Script Simplificado** (Recomendado para desarrollo rápido)

### Uso Básico

```bash
# Configurar variables de entorno (una vez)
$env:STORAGE_URL="https://kv-storage.deno.dev"
$env:API_KEY="tu-api-key"
$env:ENCRYPTION_KEY="clave-32-caracteres"

# Registrar backend (prefix automático: /{name})
deno task register:simple usuarios https://api-usuarios.com token-123

# Con prefix personalizado
deno task register:simple pagos https://api-pagos.com token-456 /payments
```

### Con IP Pública (Auto-detección)

```bash
# Registra usando tu IP pública actual
deno task register:simple desarrollo --public-ip token-dev /dev 3000

# Detecta tu IP y registra: http://TU_IP:3000
```

**Ventajas:**
- ✅ Solo 3-5 argumentos
- ✅ Prefix automático si no se especifica
- ✅ Detección automática de IP pública
- ✅ Perfecto para desarrollo local

---

## 📦 **Opción 2: Registro Masivo (JSON)** (Recomendado para producción)

### 1. Crear archivo de configuración

```json
// backends-config.json
{
  "storageUrl": "https://kv-storage.deno.dev",
  "apiKey": "tu-api-key-secreta",
  "encryptionKey": "clave-de-32-caracteres-minimo",
  "backends": [
    {
      "name": "usuarios",
      "url": "https://api-usuarios.com",
      "token": "token-usuarios-123"
    },
    {
      "name": "productos",
      "url": "https://api-productos.com",
      "token": "token-productos-456",
      "prefix": "/products"
    },
    {
      "name": "desarrollo-local",
      "usePublicIP": true,
      "port": 3000,
      "token": "dev-token",
      "prefix": "/dev"
    }
  ]
}
```

### 2. Registrar todos a la vez

```bash
deno task register:bulk backends-config.json
```

**Ventajas:**
- ✅ Múltiples backends en un solo comando
- ✅ Configuración versionable (Git)
- ✅ Soporte para IP pública por backend
- ✅ Ideal para setup inicial o CI/CD

---

## ⚙️ **Opción 3: Script Completo** (Control total)

### Uso con todas las opciones

```bash
deno task register \
  --name=produccion \
  --backend-url=https://api-prod.com \
  --backend-token=token-prod \
  --prefix=/api/prod \
  --registry-url=https://kv-storage.deno.dev \
  --api-key=tu-api-key \
  --encryption-key=32-chars-key
```

### Con IP pública

```bash
deno task register \
  --name=desarrollo \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=token-dev \
  --prefix=/dev
```

### Modo Daemon (re-registro automático cada 5 min)

```bash
deno task register \
  --name=desarrollo \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=token-dev \
  --prefix=/dev \
  --daemon
```

**Ventajas:**
- ✅ Control total de todos los parámetros
- ✅ Modo daemon para IPs dinámicas
- ✅ Metadata del sistema incluida
- ✅ Para casos especiales

---

## 🔍 Comparación Rápida

| Característica | Simple | Bulk JSON | Completo |
|----------------|--------|-----------|----------|
| **Argumentos** | 3-5 | 1 archivo | 6-10 flags |
| **Múltiples backends** | ❌ | ✅ | ❌ |
| **IP pública** | ✅ | ✅ | ✅ |
| **Modo daemon** | ❌ | ❌ | ✅ |
| **Versionable** | ❌ | ✅ | ❌ |
| **Velocidad** | ⚡⚡⚡ | ⚡⚡ | ⚡ |

---

## 📖 Ejemplos Completos

### Desarrollo Local

```bash
# Variables de entorno
$env:STORAGE_URL="http://localhost:8001"
$env:API_KEY="dev-key"
$env:ENCRYPTION_KEY="desarrollo-key-32-caracteres"

# Terminal 1: Registry local
deno task registry

# Terminal 2: Registrar backend local con IP pública
deno task register:simple dev --public-ip secret-token /dev 3000

# Terminal 3: Gateway
deno task dev

# Probar
curl http://localhost:8000/dev/endpoint
```

### Producción

```bash
# 1. Crear backends-config.json con todas las APIs
# 2. Registrar todas a la vez
deno task register:bulk backends-config.json

# 3. Deploy gateway a Deno Deploy
git push origin main
```

### Microservicios

```json
{
  "storageUrl": "https://kv-storage.deno.dev",
  "apiKey": "prod-key",
  "encryptionKey": "prod-encryption-key-32-chars",
  "backends": [
    { "name": "auth", "url": "https://auth.app.com", "token": "tok1" },
    { "name": "users", "url": "https://users.app.com", "token": "tok2" },
    { "name": "products", "url": "https://products.app.com", "token": "tok3" },
    { "name": "orders", "url": "https://orders.app.com", "token": "tok4" },
    { "name": "payments", "url": "https://payments.app.com", "token": "tok5" }
  ]
}
```

```bash
deno task register:bulk microservices-config.json
```

---

## 🆘 Troubleshooting

### "No se pudo detectar IP pública"
- Verifica conexión a internet
- El servicio usa https://api.ipify.org
- Fallback: usa URL directa en lugar de `--public-ip`

### "STORAGE_URL y API_KEY son requeridos"
- Configura las variables de entorno
- O pásalas en el archivo JSON (bulk)
- O usa flags completos (script completo)

### Backend no aparece en gateway
```bash
# Ver backends registrados
deno task check

# Recargar gateway sin reiniciar
curl -X POST http://localhost:8000/gateway/reload
```

---

**💡 Tip:** Usa el script simplificado para desarrollo y el bulk JSON para producción.
