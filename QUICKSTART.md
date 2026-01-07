# ⚡ Puesta en Marcha Rápida

## 🚀 En 3 Pasos

### 1. Configurar Variables de Entorno

```bash
# Copiar template
cp .env.example .env

# Editar .env con tus valores
CONFIG_API_URL=http://localhost:8000
API_KEY=test-token-123
```

### 2. Registrar un Backend

```bash
deno run -A register-backend.ts \
  --name=mi-backend \
  --url=http://localhost:3000 \
  --token=mi-token-secreto \
  --prefix=/api \
  --config=http://localhost:8000 \
  --api-key=test-token-123
```

### 3. Iniciar Gateway

```bash
deno task gateway:start
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

## ☁️ Deploy en Deno Deploy

```bash
# Instalar deployctl
deno install -A --global jsr:@deno/deployctl

# Deploy
deployctl deploy \
  --project=backend-gateway \
  --env=CONFIG_API_URL=https://tu-api.deno.dev \
  --env=API_KEY=tu-key \
  gateway-server.ts
```

---

## 📚 Más Info

- [README.md](README.md) - Documentación completa
- [.env.example](.env.example) - Variables disponibles
