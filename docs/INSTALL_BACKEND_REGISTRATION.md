# Instalación de Backend Registration en Hosts Remotos

Guía para instalar y configurar el auto-registro de backends en diferentes hosts para que se ejecuten automáticamente al arrancar o al cambiar la IP pública.

## 📋 Requisitos Previos

- **Deno** instalado en el host
- Acceso SSH al host remoto (Linux/macOS) o RDP (Windows)
- Puerto del backend ejecutándose en el host
- API Key del servidor de registro

---

## 🔧 Instalación de Deno

### Linux/macOS
```bash
curl -fsSL https://deno.land/install.sh | sh
```

### Windows (PowerShell)
```powershell
irm https://deno.land/install.ps1 | iex
```

### Verificar instalación
```bash
deno --version
```

---

## 📦 Instalación del Script

### 1. Copiar el script al host

```bash
# Crear directorio
mkdir -p /opt/backend-registration
cd /opt/backend-registration

# Copiar el script (ajusta la ruta según tu caso)
scp user@source:/path/to/register-backend.ts ./
```

O descargarlo desde un repositorio:
```bash
curl -o register-backend.ts https://raw.githubusercontent.com/your-repo/register-backend.ts
```

### 2. Crear archivo de configuración

```bash
nano /opt/backend-registration/.env
```

Contenido del `.env`:
```bash
# Identificación del backend
BACKEND_NAME=produccion-api
BACKEND_PREFIX=/api/prod

# Puerto local del backend
PORT=3000

# Token de autenticación del backend
BACKEND_TOKEN=tu-token-secreto-aqui

# Servidor de registro
BACKENDS_REGISTRY_URL=http://gateway.example.com:8001
API_KEY=tu-api-key-del-registro

# Opcional: Clave de encriptación personalizada
ENCRYPTION_KEY=tu-clave-de-encriptacion-2026
```

---

## 🚀 Configuración como Servicio

### Linux (systemd)

#### 1. Crear archivo de servicio

```bash
sudo nano /etc/systemd/system/backend-registration.service
```

```ini
[Unit]
Description=Backend Auto-Registration Service
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/backend-registration
EnvironmentFile=/opt/backend-registration/.env
ExecStart=/root/.deno/bin/deno run \
  --allow-net \
  --allow-env \
  /opt/backend-registration/register-backend.ts \
  --use-public-ip \
  --daemon

# Reiniciar en caso de fallo
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=backend-registration

[Install]
WantedBy=multi-user.target
```

#### 2. Habilitar y arrancar el servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar inicio automático
sudo systemctl enable backend-registration

# Iniciar el servicio
sudo systemctl start backend-registration

# Ver estado
sudo systemctl status backend-registration

# Ver logs
sudo journalctl -u backend-registration -f
```

---

### Windows (Servicio de Windows)

#### Opción 1: Usando NSSM (Non-Sucking Service Manager)

```powershell
# Descargar NSSM
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "nssm.zip"
Expand-Archive -Path "nssm.zip" -DestinationPath "C:\nssm"

# Instalar el servicio
C:\nssm\nssm-2.24\win64\nssm.exe install BackendRegistration `
  "C:\Users\$env:USERNAME\.deno\bin\deno.exe" `
  "run --allow-net --allow-env C:\backend-registration\register-backend.ts --use-public-ip --daemon"

# Configurar variables de entorno
C:\nssm\nssm-2.24\win64\nssm.exe set BackendRegistration AppEnvironmentExtra `
  BACKEND_NAME=produccion-api `
  BACKEND_PREFIX=/api/prod `
  PORT=3000 `
  BACKEND_TOKEN=tu-token `
  BACKENDS_REGISTRY_URL=http://gateway:8001 `
  API_KEY=tu-api-key

# Configurar directorio de trabajo
C:\nssm\nssm-2.24\win64\nssm.exe set BackendRegistration AppDirectory C:\backend-registration

# Iniciar el servicio
C:\nssm\nssm-2.24\win64\nssm.exe start BackendRegistration

# Ver estado
C:\nssm\nssm-2.24\win64\nssm.exe status BackendRegistration
```

#### Opción 2: Usando Task Scheduler

```powershell
# Crear tarea programada que se ejecuta al inicio
$action = New-ScheduledTaskAction -Execute "deno.exe" -Argument "run --allow-net --allow-env C:\backend-registration\register-backend.ts --use-public-ip --daemon" -WorkingDirectory "C:\backend-registration"

$trigger = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "BackendRegistration" -Action $action -Trigger $trigger -Principal $principal -Settings $settings

# Iniciar la tarea
Start-ScheduledTask -TaskName "BackendRegistration"

# Ver estado
Get-ScheduledTask -TaskName "BackendRegistration"
```

---

### macOS (launchd)

#### 1. Crear archivo plist

```bash
sudo nano /Library/LaunchDaemons/com.backend.registration.plist
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.backend.registration</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/Users/username/.deno/bin/deno</string>
        <string>run</string>
        <string>--allow-net</string>
        <string>--allow-env</string>
        <string>/opt/backend-registration/register-backend.ts</string>
        <string>--use-public-ip</string>
        <string>--daemon</string>
    </array>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>BACKEND_NAME</key>
        <string>produccion-api</string>
        <key>BACKEND_PREFIX</key>
        <string>/api/prod</string>
        <key>PORT</key>
        <string>3000</string>
        <key>BACKEND_TOKEN</key>
        <string>tu-token</string>
        <key>BACKENDS_REGISTRY_URL</key>
        <string>http://gateway:8001</string>
        <key>API_KEY</key>
        <string>tu-api-key</string>
    </dict>
    
    <key>WorkingDirectory</key>
    <string>/opt/backend-registration</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/var/log/backend-registration.log</string>
    
    <key>StandardErrorPath</key>
    <string>/var/log/backend-registration-error.log</string>
</dict>
</plist>
```

#### 2. Cargar y arrancar el servicio

```bash
# Establecer permisos
sudo chown root:wheel /Library/LaunchDaemons/com.backend.registration.plist
sudo chmod 644 /Library/LaunchDaemons/com.backend.registration.plist

# Cargar el servicio
sudo launchctl load /Library/LaunchDaemons/com.backend.registration.plist

# Ver estado
sudo launchctl list | grep backend

# Ver logs
tail -f /var/log/backend-registration.log
```

---

## 🔄 Detección de Cambio de IP

El modo `--daemon` re-registra el backend cada 5 minutos automáticamente. Si la IP pública cambia, el nuevo registro la actualizará.

### Configuración del intervalo

Para cambiar el intervalo de re-registro, edita el script `register-backend.ts`:

```typescript
const DAEMON_INTERVAL = 5 * 60 * 1000; // 5 minutos en milisegundos
```

Opciones comunes:
- `1 * 60 * 1000` = 1 minuto
- `5 * 60 * 1000` = 5 minutos (por defecto)
- `10 * 60 * 1000` = 10 minutos
- `30 * 60 * 1000` = 30 minutos

---

## 🧪 Pruebas Manuales

### Registro único (sin daemon)
```bash
deno run --allow-net --allow-env register-backend.ts \
  --name=test-backend \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=token123 \
  --prefix=/api/test \
  --registry-url=http://gateway:8001 \
  --api-key=test-key
```

### Modo daemon (re-registro automático)
```bash
deno run --allow-net --allow-env register-backend.ts \
  --name=test-backend \
  --use-public-ip \
  --backend-port=3000 \
  --backend-token=token123 \
  --prefix=/api/test \
  --registry-url=http://gateway:8001 \
  --api-key=test-key \
  --daemon
```

### Con URL fija (sin detección de IP)
```bash
deno run --allow-net --allow-env register-backend.ts \
  --name=test-backend \
  --backend-url=http://192.168.1.100:3000 \
  --backend-token=token123 \
  --prefix=/api/test \
  --registry-url=http://gateway:8001 \
  --api-key=test-key \
  --daemon
```

---

## 📊 Monitoreo y Logs

### Linux (systemd)
```bash
# Ver logs en tiempo real
sudo journalctl -u backend-registration -f

# Ver últimas 100 líneas
sudo journalctl -u backend-registration -n 100

# Ver logs de hoy
sudo journalctl -u backend-registration --since today
```

### Windows (NSSM)
```powershell
# Ver logs
Get-Content C:\nssm\logs\BackendRegistration.log -Tail 50 -Wait

# Ver estado del servicio
Get-Service BackendRegistration
```

### macOS (launchd)
```bash
# Ver logs
tail -f /var/log/backend-registration.log

# Ver errores
tail -f /var/log/backend-registration-error.log
```

---

## 🛠️ Troubleshooting

### El servicio no arranca

**Linux:**
```bash
# Ver errores
sudo journalctl -u backend-registration -xe

# Verificar permisos del archivo
ls -l /opt/backend-registration/register-backend.ts

# Verificar que Deno está instalado
which deno
```

**Windows:**
```powershell
# Ver eventos del sistema
Get-EventLog -LogName Application -Source BackendRegistration -Newest 10

# Verificar instalación de Deno
where.exe deno
```

### IP pública no se detecta

El script usa `https://api.ipify.org` para detectar la IP. Verifica:
- Conectividad a Internet
- Firewall no bloquea el acceso a ipify.org
- DNS funciona correctamente

### Backend no aparece en el gateway

Verifica:
- El servidor de registro está ejecutándose
- La API Key es correcta
- El backend-token es correcto
- Revisa los logs para ver errores de autenticación

---

## 🔐 Seguridad

### Mejores prácticas

1. **Protege las credenciales**
   ```bash
   chmod 600 /opt/backend-registration/.env
   ```

2. **Usa tokens fuertes**
   ```bash
   # Generar token aleatorio
   openssl rand -base64 32
   ```

3. **Configura firewall**
   ```bash
   # Permitir solo tráfico necesario
   sudo ufw allow from <gateway-ip> to any port <backend-port>
   ```

4. **Usa HTTPS en producción**
   - Configura SSL/TLS en el gateway
   - Actualiza `BACKENDS_REGISTRY_URL` a `https://`

---

## 📝 Script de Instalación Automatizada

### install-backend-registration.sh (Linux)

```bash
#!/bin/bash
set -e

echo "🚀 Instalando Backend Registration Service"

# Variables
INSTALL_DIR="/opt/backend-registration"
SERVICE_NAME="backend-registration"

# Verificar si es root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Este script debe ejecutarse como root"
    exit 1
fi

# Instalar Deno si no está instalado
if ! command -v deno &> /dev/null; then
    echo "📦 Instalando Deno..."
    curl -fsSL https://deno.land/install.sh | sh
    export PATH="$HOME/.deno/bin:$PATH"
fi

# Crear directorio
echo "📁 Creando directorio..."
mkdir -p $INSTALL_DIR

# Pedir configuración
read -p "Nombre del backend: " BACKEND_NAME
read -p "Puerto del backend: " PORT
read -p "Prefijo (ej: /api/prod): " PREFIX
read -sp "Token del backend: " BACKEND_TOKEN
echo
read -p "URL del registro (ej: http://gateway:8001): " REGISTRY_URL
read -sp "API Key del registro: " API_KEY
echo

# Crear archivo .env
cat > $INSTALL_DIR/.env << EOF
BACKEND_NAME=$BACKEND_NAME
PORT=$PORT
BACKEND_PREFIX=$PREFIX
BACKEND_TOKEN=$BACKEND_TOKEN
BACKENDS_REGISTRY_URL=$REGISTRY_URL
API_KEY=$API_KEY
EOF

chmod 600 $INSTALL_DIR/.env

# Descargar script (ajusta la URL)
echo "⬇️  Descargando script..."
curl -o $INSTALL_DIR/register-backend.ts https://raw.githubusercontent.com/your-repo/register-backend.ts

# Crear servicio systemd
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Backend Auto-Registration Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$(which deno) run --allow-net --allow-env $INSTALL_DIR/register-backend.ts --use-public-ip --daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Habilitar y arrancar servicio
echo "🔧 Configurando servicio..."
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

echo "✅ Instalación completada!"
echo "📊 Ver estado: systemctl status $SERVICE_NAME"
echo "📋 Ver logs: journalctl -u $SERVICE_NAME -f"
```

---

## 🔄 Actualización del Script

### Linux
```bash
# Descargar nueva versión
curl -o /opt/backend-registration/register-backend.ts.new \
  https://raw.githubusercontent.com/your-repo/register-backend.ts

# Backup de la versión anterior
cp /opt/backend-registration/register-backend.ts \
   /opt/backend-registration/register-backend.ts.bak

# Reemplazar
mv /opt/backend-registration/register-backend.ts.new \
   /opt/backend-registration/register-backend.ts

# Reiniciar servicio
sudo systemctl restart backend-registration
```

### Windows
```powershell
# Detener servicio
Stop-Service BackendRegistration

# Actualizar archivo
Copy-Item -Path "C:\path\to\new\register-backend.ts" -Destination "C:\backend-registration\register-backend.ts" -Force

# Iniciar servicio
Start-Service BackendRegistration
```

---

## 📚 Recursos Adicionales

- [Documentación de Deno](https://deno.land/manual)
- [systemd documentation](https://www.freedesktop.org/wiki/Software/systemd/)
- [NSSM - the Non-Sucking Service Manager](https://nssm.cc/)
- [launchd info](https://www.launchd.info/)

---

## 💡 Consejos

1. **Prueba primero en modo manual** antes de configurar el servicio
2. **Usa variables de entorno** en lugar de hardcodear credenciales
3. **Monitorea los logs** regularmente
4. **Configura alertas** si el registro falla repetidamente
5. **Documenta** las configuraciones específicas de cada host
