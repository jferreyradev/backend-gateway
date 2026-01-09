# ⚡ Puesta en Marcha Rápida

## 🚀 Registrar un Backend

```bash
deno run -A register-backend.ts \
  --name=mi-backend \
  --backend-url=http://localhost:3000 \
  --backend-token=token-secreto \
  --prefix=/api \
  --registry-url=http://localhost:8000 \
  --api-key=test-token-123 \
  --daemon
```

El backend se registrará automáticamente cada 5 minutos.

---

## 🚀 Ejecutar el Gateway

```bash
BACKENDS_REGISTRY_URL=http://localhost:8000 \
API_KEY=test-token-123 \
deno run -A gateway-server.ts
```

Gateway corriendo en `http://localhost:8080` ✅

---

## 🌐 Probar

```bash
# Health check
curl http://localhost:8080/gateway/health

# Ver backends registrados
curl http://localhost:8080/gateway/status

# Hacer petición a través del gateway
curl http://localhost:8080/api/tu-endpoint
```

---

## 📝 Opciones de register-backend.ts

**Requeridos:**
- `--name` - Nombre del backend
- `--backend-token` - Token de autenticación
- `--prefix` - Prefijo de ruta
- `--registry-url` - URL del servidor de registro
- `--api-key` - API Key del registro

**Una de estas (URL fija o IP pública):**
- `--backend-url` - URL del backend
- `--backend-port` + `--use-public-ip` - Detectar IP automáticamente

**Opcionales:**
- `--encryption-key` - Clave de encriptación
- `--daemon` - Modo automático (sin daemon, se ejecuta una sola vez)

---

## 📚 Más Info

- [README.md](README.md) - Documentación completa
- [.env.example](.env.example) - Variables disponibles


