import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const homeDir = os.homedir();

export interface AutostartStatus {
  enabled: boolean;
  autostartFileExists: boolean;
  systemdServiceExists: boolean;
  projectPath: string;
  autostartFilePath: string;
  systemdFilePath: string;
}

export function getAutostartStatus(): AutostartStatus {
  const autostartFilePath = path.join(homeDir, '.config', 'autostart', 'chrome-pwa-hub-autostart.desktop');
  const systemdFilePath = path.join(homeDir, '.config', 'systemd', 'user', 'chrome-pwa-hub.service');

  const autostartFileExists = fs.existsSync(autostartFilePath);
  const systemdServiceExists = fs.existsSync(systemdFilePath);

  return {
    enabled: autostartFileExists || systemdServiceExists,
    autostartFileExists,
    systemdServiceExists,
    projectPath: projectRoot,
    autostartFilePath,
    systemdFilePath,
  };
}

export function enableAutostartOnUbuntu(): { success: boolean; message: string } {
  try {
    const autostartDir = path.join(homeDir, '.config', 'autostart');
    const systemdDir = path.join(homeDir, '.config', 'systemd', 'user');

    if (!fs.existsSync(autostartDir)) {
      fs.mkdirSync(autostartDir, { recursive: true });
    }
    if (!fs.existsSync(systemdDir)) {
      fs.mkdirSync(systemdDir, { recursive: true });
    }

    // Determine paths for node and npm
    let nodePath = '/usr/bin/node';
    let npmPath = '/usr/bin/npm';
    try {
      nodePath = execSync('which node 2>/dev/null || which tsx 2>/dev/null', { encoding: 'utf-8' }).trim() || nodePath;
      npmPath = execSync('which npm 2>/dev/null', { encoding: 'utf-8' }).trim() || npmPath;
    } catch {
      // ignore
    }

    // 1. Create ~/.config/autostart/chrome-pwa-hub-autostart.desktop
    const autostartFilePath = path.join(autostartDir, 'chrome-pwa-hub-autostart.desktop');
    const autostartContent = `[Desktop Entry]
Type=Application
Name=Chrome PWA Hub (Autostart)
Comment=Inicia automaticamente o servidor do Chrome PWA Hub ao ligar o Ubuntu
Exec=bash -c "cd '${projectRoot}' && export PORT=3000 && (${nodePath} server.ts || ${npmPath} run dev) > ~/.local/share/chrome-pwa-hub-server.log 2>&1"
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
Terminal=false
`;
    fs.writeFileSync(autostartFilePath, autostartContent, 'utf-8');

    // 2. Create ~/.config/systemd/user/chrome-pwa-hub.service
    const systemdFilePath = path.join(systemdDir, 'chrome-pwa-hub.service');
    const systemdContent = `[Unit]
Description=Chrome PWA Hub Auto-Start Server
After=network.target

[Service]
Type=simple
WorkingDirectory=${projectRoot}
ExecStart=${npmPath} run dev
Restart=always
RestartSec=5
Environment=PORT=3000

[Install]
WantedBy=default.target
`;
    fs.writeFileSync(systemdFilePath, systemdContent, 'utf-8');

    // 3. Try enabling systemd user service if available
    try {
      execSync('systemctl --user daemon-reload 2>/dev/null');
      execSync('systemctl --user enable chrome-pwa-hub.service 2>/dev/null');
      execSync('systemctl --user start chrome-pwa-hub.service 2>/dev/null');
    } catch {
      // systemctl --user might not be active in container, autostart.desktop will still work on desktop login
    }

    // 4. Create local application launcher in ~/.local/share/applications
    try {
      const appsDir = path.join(homeDir, '.local', 'share', 'applications');
      if (fs.existsSync(appsDir)) {
        const appDesktopPath = path.join(appsDir, 'chrome-pwa-hub-launcher.desktop');
        const appDesktopContent = `[Desktop Entry]
Type=Application
Name=Chrome PWA Hub
Comment=Gerenciador Desktop de PWAs do Google Chrome
Exec=bash -c "cd '${projectRoot}' && (${nodePath} server.ts || ${npmPath} run dev) & sleep 2 && google-chrome --app=http://localhost:3000"
Icon=google-chrome
Terminal=false
Categories=Utility;Development;
`;
        fs.writeFileSync(appDesktopPath, appDesktopContent, 'utf-8');
      }
    } catch {
      // ignore
    }

    return {
      success: true,
      message: 'Inicialização automática no Ubuntu configurada com sucesso! O Chrome PWA Hub iniciará automaticamente ao ligar seu PC.',
    };
  } catch (err) {
    console.error('Erro ao configurar autostart no Ubuntu:', err);
    return {
      success: false,
      message: `Erro ao configurar inicialização automática: ${(err as Error).message}`,
    };
  }
}

export function disableAutostartOnUbuntu(): { success: boolean; message: string } {
  try {
    const autostartFilePath = path.join(homeDir, '.config', 'autostart', 'chrome-pwa-hub-autostart.desktop');
    const systemdFilePath = path.join(homeDir, '.config', 'systemd', 'user', 'chrome-pwa-hub.service');

    if (fs.existsSync(autostartFilePath)) {
      fs.unlinkSync(autostartFilePath);
    }
    if (fs.existsSync(systemdFilePath)) {
      fs.unlinkSync(systemdFilePath);
    }

    try {
      execSync('systemctl --user disable chrome-pwa-hub.service 2>/dev/null');
    } catch {
      // ignore
    }

    return {
      success: true,
      message: 'Inicialização automática desativada.',
    };
  } catch (err) {
    return {
      success: false,
      message: `Erro ao desativar autostart: ${(err as Error).message}`,
    };
  }
}

// CLI direct runner
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = enableAutostartOnUbuntu();
  console.log(result.message);
}
