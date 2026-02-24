# 🖥️ Configurar PC con Registro Automático de IP Pública

Guía para registrar automáticamente tu API local con IP pública en el gateway.

---

## 📋 Requisitos

- ✅ API corriendo localmente (ej: puerto 3000)
- ✅ Deno instalado
- ✅ Acceso al KV Storage (URL y API Key)
- ✅ IP pública (automáticamente detectada)

---

## ⚡ Configuración Rápida

### **Opción 1: Script Simplificado (Recomendado)**

```bash
# 1. Configurar variables de entorno (una sola vez)
$env:STORAGE_URL="https://tu-kv-storage.deno.dev"
$env:API_KEY="tu-api-key-secreta"
$env:ENCRYPTION_KEY="clave-de-32-caracteres-minimo"

# 2. Iniciar tu API local
# (tu aplicación en puerto 3000, 8080, etc.)

# 3. Registrar con daemon (verifica cada 30 min, registra solo si IP cambia)
deno run -A scripts/register-backend.ts \
  --name=pc-oficina \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=token-secreto-api \
  --prefix=/api/oficina \
  --daemon
```

### **Opción 2: Con todas las opciones inline**

```bash
deno run -A scripts/register-backend.ts \
  --name=pc-casa \
  --use-public-ip \
  --backend-port=8080 \
  --backend-token=mi-token-secreto \
  --prefix=/api/casa \
  --registry-url=https://kv-storage.deno.dev \
  --api-key=tu-api-key \
  --encryption-key=32-caracteres-key \
  --daemon
```

---

## 🔄 ¿Qué hace el modo daemon?

- ✅ Detecta tu IP pública actual
- ✅ Registra: `http://TU_IP:PUERTO`
- ✅ Verifica IP cada **30 minutos**
- ✅ Registra solo si la IP cambió (ahorro de recursos)
- ✅ Mantiene el backend actualizado automáticamente

---

## 🏢 Ejemplo: Múltiples PCs

### **PC 1 - Oficina (puerto 3000)**

```bash
# Variables de entorno
$env:STORAGE_URL="https://kv-storage.deno.dev"
$env:API_KEY="shared-api-key"
$env:ENCRYPTION_KEY="shared-encryption-key"

# Registrar
deno run -A scripts/register-backend.ts \
  --name=oficina-principal \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=token-oficina-123 \
  --prefix=/oficina \
  --daemon
```

### **PC 2 - Casa (puerto 8080)**

```bash
# Mismas variables de entorno
$env:STORAGE_URL="https://kv-storage.deno.dev"
$env:API_KEY="shared-api-key"
$env:ENCRYPTION_KEY="shared-encryption-key"

# Registrar
deno run -A scripts/register-backend.ts \
  --name=casa-desarrollo \
  --use-public-ip \
  --backend-port=8080 \
  --backend-token=token-casa-456 \
  --prefix=/casa \
  --daemon
```

### **PC 3 - Remoto (puerto 5000)**

```bash
# Mismas variables de entorno
$env:STORAGE_URL="https://kv-storage.deno.dev"
$env:API_KEY="shared-api-key"
$env:ENCRYPTION_KEY="shared-encryption-key"

# Registrar
deno run -A scripts/register-backend.ts \
  --name=servidor-remoto \
  --use-public-ip \
  --backend-port=5000 \
  --backend-token=token-remoto-789 \
  --prefix=/remoto \
  --daemon
```

---

## ☁️ Gateway en Deno Deploy

### 1. Deploy del Gateway

```bash
# Push a GitHub
git add .
git commit -m "Deploy gateway"
git push origin main

# O con deployctl
deployctl deploy \
  --project=mi-gateway \
  --env=STORAGE_URL=https://kv-storage.deno.dev \
  --env=API_KEY=shared-api-key \
  --env=ENCRYPTION_KEY=shared-encryption-key \
  main.ts
```

### 2. Acceder desde el Gateway

```bash
# El gateway ahora puede acceder a todas las PCs:

# PC Oficina
curl https://mi-gateway.deno.dev/oficina/endpoint

# PC Casa
curl https://mi-gateway.deno.dev/casa/endpoint

# PC Remoto
curl https://mi-gateway.deno.dev/remoto/endpoint
```

---

## 🔍 Verificar Registro

```bash
# Ver todos los backends registrados
deno task check

# Salida esperada:
# 1. oficina-principal
#    URL: http://181.45.23.12:3000
#    Prefix: /oficina
#
# 2. casa-desarrollo
#    URL: http://190.12.34.56:8080
#    Prefix: /casa
#
# 3. servidor-remoto
#    URL: http://200.98.76.54:5000
#    Prefix: /remoto
```

---

## 🔐 Seguridad

### ⚠️ Consideraciones Importantes:

1. **Firewall/Router**: Debes configurar port forwarding en tu router para el puerto de tu API
2. **IP Dinámica**: El modo daemon verifica cada 30 min, registra solo si la IP cambió
3. **Tokens Seguros**: Usa tokens diferentes por PC
4. **HTTPS**: El gateway en Deno Deploy usa HTTPS automáticamente

### Configurar Port Forwarding:

```
Router → Port Forwarding:
  - Puerto Externo: 3000
  - Puerto Interno: 3000
  - IP Interna: 192.168.1.X (tu PC)
  - Protocolo: TCP
```

---

## 🖥️ Ejecutar como Servicio (Windows)

### Con Tarea Programada (se reinicia automáticamente):

```powershell
# 1. Crear script de inicio
@"
cd D:\proyectos\backend-infrastructure\backend-gateway
`$env:STORAGE_URL="https://kv-storage.deno.dev"
`$env:API_KEY="shared-api-key"
`$env:ENCRYPTION_KEY="shared-key"
deno run -A scripts/register-backend.ts --name=mi-pc --use-public-ip --backend-port=3000 --backend-token=token --prefix=/mipc --daemon
"@ | Out-File -FilePath "C:\registro-gateway.ps1"

# 2. Crear tarea programada
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File C:\registro-gateway.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Gateway Registration" -Description "Registra API en gateway automáticamente"
```

---

## 🧪 Testing Local → Gateway Deploy

### 1. Inicia tu API local:

```bash
# Ejemplo con tu API
cd mi-api
npm start  # o deno run, etc.
# API corriendo en http://localhost:3000
```

### 2. Registra con daemon:

```bash
deno run -A scripts/register-backend.ts \
  --name=test-local \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=test-token \
  --prefix=/test \
  --daemon
```

Verás en consola:
```
🔍 Detectando IP pública...
✅ IP pública detectada: 181.45.23.12
📤 Registrando backend test-local...
✅ Registrado exitosamente
🔄 Modo daemon activado
   Verificación cada 30 minutos
   Solo registra si la IP cambia
```

### 3. Prueba desde el gateway:

```bash
# Desde cualquier lugar del mundo
curl https://mi-gateway.deno.dev/test/endpoint
# → Se conecta a http://181.45.23.12:3000/endpoint
```

---

## 📊 Arquitectura Completa

```
┌─────────────────┐
│   PC Oficina    │ IP: 181.45.23.12:3000
│  (daemon activo)│────┐
└─────────────────┘    │
                       │
┌─────────────────┐    │      ┌──────────────┐
│    PC Casa      │ IP: 190.12.34.56:8080    │  KV Storage  │
│  (daemon activo)│────┼──────▶│   (Shared)   │
└─────────────────┘    │      └──────────────┘
                       │              ▲
┌─────────────────┐    │              │
│   PC Remoto     │ IP: 200.98.76.54:5000    │
│  (daemon activo)│────┘              │
└─────────────────┘                   │
                                      │
                            ┌─────────┴─────────┐
                            │  Gateway (Deno)   │
                            │  deploy.deno.dev  │
                            └───────────────────┘
                                      ▲
                                      │
                            ┌─────────┴─────────┐
                            │     Clientes      │
                            │   (Navegadores)   │
                            └───────────────────┘
```

---

## 🐛 Troubleshooting

### No se detecta IP pública
✅ Verifica conexión a internet  
✅ El script usa https://api.ipify.org  
✅ Revisa firewall local

### Gateway no puede conectar
✅ Verifica port forwarding en router  
✅ Verifica firewall de Windows  
✅ Prueba desde externa: `curl http://TU_IP:PUERTO`

### IP cambia y no actualiza
✅ Verifica que el daemon esté corriendo  
✅ Verifica IP cada 30 minutos automáticamente  
✅ Registra solo si la IP cambió (eficiente)
✅ Revisa logs del script

---

**✅ Listo para producción con IPs dinámicas!** 🚀
