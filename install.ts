#!/usr/bin/env -S deno run -A
/**
 * Backend Register Universal Installer
 * 
 * Instala automáticamente el daemon de registro en cualquier SO
 * Compatible con: Windows, Linux, macOS
 * 
 * Uso:
 *   deno run -A install.ts
 */

import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { dirname, join } from "https://deno.land/std@0.208.0/path/mod.ts";

interface Config {
  name: string;
  backendUrl?: string;
  backendPort?: string;
  backendToken: string;
  prefix: string;
  backendsRegistryUrl: string;
  apiKey: string;
  encryptionKey?: string;
  usePublicIP?: boolean;
}

async function askQuestion(question: string, defaultValue?: string): Promise<string> {
  const response = prompt(
    defaultValue ? `${question} [${defaultValue}]` : question
  );
  return response || defaultValue || "";
}

async function gatherConfig(): Promise<Config> {
  console.log("\n🔧 Configuración del Backend Register\n");

  const name = await askQuestion("Nombre del backend:", "mi-backend");
  const backendToken = await askQuestion("Token de autenticación del backend:");
  const prefix = await askQuestion("Prefijo de ruta:", "/api");
  const backendsRegistryUrl = await askQuestion(
    "URL del servidor de registro:",
    "http://localhost:8000"
  );
  const apiKey = await askQuestion("API Key del registro:");

  let backendUrl = "";
  let backendPort = "";
  let usePublicIP = false;

  const urlChoice = await askQuestion(
    "¿Usar URL fija (f) o IP pública (p)?",
    "f"
  );

  if (urlChoice.toLowerCase() === "p") {
    backendPort = await askQuestion("Puerto local del backend:", "3000");
    usePublicIP = true;
  } else {
    backendUrl = await askQuestion("URL del backend:", "http://localhost:3000");
  }

  const encryptionKey = await askQuestion(
    "Clave de encriptación (opcional):",
    "go-oracle-api-secure-key-2026"
  );

  return {
    name,
    backendUrl,
    backendPort,
    backendToken,
    prefix,
    backendsRegistryUrl,
    apiKey,
    encryptionKey,
    usePublicIP,
  };
}

async function saveConfig(config: Config, configPath: string): Promise<void> {
  const envContent = `BACKEND_NAME=${config.name}
${config.usePublicIP ? `BACKEND_PORT=${config.backendPort}` : `BACKEND_URL=${config.backendUrl}`}
BACKEND_TOKEN=${config.backendToken}
BACKEND_PREFIX=${config.prefix}
BACKENDS_REGISTRY_URL=${config.backendsRegistryUrl}
API_KEY=${config.apiKey}
ENCRYPTION_KEY=${config.encryptionKey}
`;

  await Deno.writeTextFile(configPath, envContent);
  console.log(`✅ Configuración guardada en: ${configPath}`);
}

function buildCommand(config: Config, scriptPath: string): string {
  let cmd = `deno run -A ${scriptPath}`;
  cmd += ` --name=${config.name}`;
  cmd += ` --backend-token=${config.backendToken}`;
  cmd += ` --prefix=${config.prefix}`;
  cmd += ` --registry-url=${config.backendsRegistryUrl}`;
  cmd += ` --api-key=${config.apiKey}`;

  if (config.usePublicIP) {
    cmd += ` --use-public-ip`;
    cmd += ` --backend-port=${config.backendPort}`;
  } else {
    cmd += ` --backend-url=${config.backendUrl}`;
  }

  if (config.encryptionKey) {
    cmd += ` --encryption-key=${config.encryptionKey}`;
  }

  cmd += ` --daemon`;

  return cmd;
}

async function installWindows(
  config: Config,
  scriptPath: string
): Promise<void> {
  console.log("\n📋 Instalación en Windows (Task Scheduler)\n");

  const command = buildCommand(config, scriptPath);
  const taskName = "Backend Register Daemon";

  // Crear script temporario para configurar Task Scheduler
  const psScript = `
$taskName = "${taskName}"
$action = New-ScheduledTaskAction \`
    -Execute "deno" \`
    -Argument "run -A ${scriptPath.replaceAll("\\", "\\\\")} --name=${config.name} --backend-token=${config.backendToken} --prefix=${config.prefix} --registry-url=${config.backendsRegistryUrl} --api-key=${config.apiKey} ${config.usePublicIP ? `--use-public-ip --backend-port=${config.backendPort}` : `--backend-url=${config.backendUrl}`} ${config.encryptionKey ? `--encryption-key=${config.encryptionKey}` : ""} --daemon" \`
    -WorkingDirectory "${dirname(scriptPath).replaceAll("\\", "\\\\")}"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal \`
    -UserID "NT AUTHORITY\\\\SYSTEM" \`
    -LogonType ServiceAccount \`
    -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask \`
    -TaskName $taskName \`
    -Action $action \`
    -Trigger $trigger \`
    -Principal $principal \`
    -Settings $settings \`
    -Force

Write-Host "✅ Backend Register Daemon instalado en Task Scheduler" -ForegroundColor Green
`;

  // Ejecutar PowerShell
  try {
    const proc = new Deno.Command("powershell.exe", {
      args: ["-NoProfile", "-Command", psScript],
    });

    const result = await proc.output();

    if (result.success) {
      console.log("✅ Tarea de Windows (Task Scheduler) configurada exitosamente");
      console.log("   Se ejecutará automáticamente al iniciar el equipo");
    } else {
      console.error(
        "❌ Error configurando Task Scheduler. Ejecuta manualmente:"
      );
      console.error(`   ${command}`);
    }
  } catch (error) {
    console.error("⚠️  No se pudo configurar Task Scheduler automáticamente");
    console.error("   Por favor, sigue los pasos manuales en INSTALL_REGISTER_DAEMON.md");
  }
}

async function installLinux(
  config: Config,
  scriptPath: string
): Promise<void> {
  console.log("\n📋 Instalación en Linux\n");

  const command = buildCommand(config, scriptPath);

  // Intentar usar systemd primero
  const systemdPath = "/etc/systemd/system/backend-register.service";
  const hasSystemd = existsSync("/etc/systemd");

  if (hasSystemd) {
    console.log("📝 Configurando como servicio SystemD...");

    const serviceContent = `[Unit]
Description=Backend Register Daemon
After=network.target

[Service]
Type=simple
User=$${USER}
WorkingDirectory=${dirname(scriptPath)}
ExecStart=${command}
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
`;

    try {
      // Escribir archivo de servicio
      const tempFile = await Deno.makeTempFile();
      await Deno.writeTextFile(tempFile, serviceContent);

      // Usar sudo para copiar a la ubicación del sistema
      const proc = new Deno.Command("sudo", {
        args: ["cp", tempFile, systemdPath],
      });

      const result = await proc.output();

      if (result.success) {
        // Habilitar y iniciar el servicio
        await new Deno.Command("sudo", {
          args: ["systemctl", "daemon-reload"],
        }).output();

        await new Deno.Command("sudo", {
          args: ["systemctl", "enable", "backend-register"],
        }).output();

        await new Deno.Command("sudo", {
          args: ["systemctl", "start", "backend-register"],
        }).output();

        console.log("✅ Servicio SystemD configurado exitosamente");
        console.log("   Ver estado: sudo systemctl status backend-register");
        console.log("   Ver logs: sudo journalctl -u backend-register -f");
      } else {
        throw new Error("No se pudo copiar el archivo de servicio");
      }

      await Deno.remove(tempFile);
    } catch {
      console.log("⚠️  No se pudo configurar SystemD automáticamente");
      console.log("   Necesitas permisos de sudo. Prueba:");
      console.log(`   sudo nano ${systemdPath}`);
    }
  } else {
    // Usar cron como fallback
    console.log("📝 Configurando con cron...");
    const cronEntry = `@reboot cd ${dirname(scriptPath)} && ${command}`;

    try {
      const proc = new Deno.Command("crontab", {
        args: ["-l"],
      });

      const result = await proc.output();
      const decoder = new TextDecoder();
      let currentCron = result.success ? decoder.decode(result.stdout) : "";

      // Evitar duplicados
      if (!currentCron.includes("Backend Register Daemon")) {
        currentCron += `\n# Backend Register Daemon\n${cronEntry}\n`;

        const tempFile = await Deno.makeTempFile();
        await Deno.writeTextFile(tempFile, currentCron);

        const cronProc = new Deno.Command("crontab", {
          args: [tempFile],
        });

        const cronResult = await cronProc.output();

        if (cronResult.success) {
          console.log("✅ Cron configurado exitosamente");
          console.log("   Ver crontab: crontab -l");
        }

        await Deno.remove(tempFile);
      }
    } catch {
      console.log("⚠️  No se pudo configurar cron automáticamente");
      console.log("   Configura manualmente con: crontab -e");
    }
  }
}

async function installMacOS(
  config: Config,
  scriptPath: string
): Promise<void> {
  console.log("\n📋 Instalación en macOS\n");

  const command = buildCommand(config, scriptPath);
  const label = "com.backend.register.daemon";
  const plistPath = `${Deno.env.get("HOME")}/Library/LaunchAgents/${label}.plist`;

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>${command}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${Deno.env.get("HOME")}/Library/Logs/backend-register.log</string>
    <key>StandardErrorPath</key>
    <string>${Deno.env.get("HOME")}/Library/Logs/backend-register.log</string>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
</dict>
</plist>`;

  try {
    // Crear directorio si no existe
    await Deno.mkdir(dirname(plistPath), { recursive: true });

    // Escribir plist
    await Deno.writeTextFile(plistPath, plistContent);

    // Cargar el agente
    await new Deno.Command("launchctl", {
      args: ["load", plistPath],
    }).output();

    console.log("✅ Agente launchd configurado exitosamente");
    console.log(`   Archivo: ${plistPath}`);
    console.log("   Ver logs: tail -f ~/Library/Logs/backend-register.log");
  } catch (error) {
    console.error("❌ Error configurando launchd:", error.message);
  }
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║  🚀 Backend Register Universal Installer        ║");
  console.log("║  Compatible: Windows, Linux, macOS              ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  try {
    // Obtener configuración
    const config = await gatherConfig();

    // Determinar rutas
    const scriptDir = dirname(new URL(import.meta.url).pathname);
    const scriptPath = join(scriptDir, "register-backend.ts");
    const configPath = join(scriptDir, ".env");

    // Guardar configuración
    console.log("");
    await saveConfig(config, configPath);

    // Instalar según SO
    console.log("");
    const os = Deno.build.os;

    if (os === "windows") {
      await installWindows(config, scriptPath);
    } else if (os === "linux") {
      await installLinux(config, scriptPath);
    } else if (os === "darwin") {
      await installMacOS(config, scriptPath);
    } else {
      console.error(`❌ SO no soportado: ${os}`);
      Deno.exit(1);
    }

    // Resumen final
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║  ✅ Instalación Completada                     ║");
    console.log("╚════════════════════════════════════════════════╝\n");

    console.log("📊 Resumen:");
    console.log(`   Backend: ${config.name}`);
    console.log(`   Registro: ${config.backendsRegistryUrl}`);
    console.log(`   Actualización: cada 5 minutos\n`);

    console.log("🚀 El daemon se ejecutará automáticamente al reiniciar\n");

    console.log("📝 Archivos creados:");
    console.log(`   - ${configPath} (configuración)`);
    if (os === "windows") {
      console.log("   - Task Scheduler: 'Backend Register Daemon'\n");
    } else if (os === "linux") {
      console.log("   - Servicio SystemD: backend-register.service\n");
    } else if (os === "darwin") {
      console.log(`   - Agente launchd: ${plistPath}\n`);
    }

    console.log("⚙️  Próximos pasos:");
    console.log("   1. Reinicia tu equipo");
    console.log("   2. Verifica que el backend está registrado:");
    console.log("      curl http://localhost:8080/gateway/status");
    console.log("");
  } catch (error) {
    console.error("\n❌ Error durante la instalación:", error.message);
    Deno.exit(1);
  }
}

main();
