# ⚡ Puesta en Marcha Rápida

## 🚀 En 1 Paso

```bash
deno run -A install.ts
```

Responde las preguntas, reinicia tu equipo y **listo**.

El daemon se ejecutará automáticamente al iniciar.

---

## 📝 Si Prefieres Configurar Manualmente

### 1. Registrar Backend

```bash
deno run -A register-backend.ts \
  --name=mi-backend \
  --backend-url=http://localhost:3000 \
  --backend-token=mi-token-secreto \
  --prefix=/api \
  --registry-url=http://localhost:8000 \
  --api-key=test-token-123 \
  --daemon
```

### 2. Iniciar Gateway

```bash
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

## 📚 Más Info

- [README.md](README.md) - Documentación completa
- [.env.example](.env.example) - Variables disponibles

