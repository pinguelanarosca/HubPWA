#!/usr/bin/env bash
# Script para configurar a inicialização automática do Chrome PWA Hub no Ubuntu

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTOSTART_DIR="$HOME/.config/autostart"
SYSTEMD_DIR="$HOME/.config/systemd/user"
APPS_DIR="$HOME/.local/share/applications"

echo "🚀 Configurando inicialização automática do Chrome PWA Hub no Ubuntu..."
echo "📂 Pasta do aplicativo: $PROJECT_DIR"

mkdir -p "$AUTOSTART_DIR"
mkdir -p "$SYSTEMD_DIR"
mkdir -p "$APPS_DIR"

# 1. Criar atalho de Autostart do GNOME/Ubuntu (~/.config/autostart/)
cat <<EOF > "$AUTOSTART_DIR/chrome-pwa-hub-autostart.desktop"
[Desktop Entry]
Type=Application
Name=Chrome PWA Hub (Autostart)
Comment=Inicia automaticamente o servidor do Chrome PWA Hub ao ligar o Ubuntu
Exec=bash -c "cd '$PROJECT_DIR' && export PORT=3000 && (npx tsx server.ts || node server.ts || npm run dev) > '$HOME/.local/share/chrome-pwa-hub-server.log' 2>&1"
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
Terminal=false
EOF

chmod +x "$AUTOSTART_DIR/chrome-pwa-hub-autostart.desktop"

# 2. Criar Serviço do Systemd User (~/.config/systemd/user/)
cat <<EOF > "$SYSTEMD_DIR/chrome-pwa-hub.service"
[Unit]
Description=Chrome PWA Hub Auto-Start Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/env npm run dev
Restart=always
RestartSec=5
Environment=PORT=3000

[Install]
WantedBy=default.target
EOF

# Tentar ativar no systemctl do usuário se disponível
if command -v systemctl &>/dev/null; then
    systemctl --user daemon-reload || true
    systemctl --user enable chrome-pwa-hub.service || true
    systemctl --user start chrome-pwa-hub.service || true
    echo "✅ Serviço systemd de usuário configurado e ativado!"
fi

# 3. Criar atalho no Menu de Aplicativos do Ubuntu
cat <<EOF > "$APPS_DIR/chrome-pwa-hub.desktop"
[Desktop Entry]
Type=Application
Name=Chrome PWA Hub
Comment=Gerenciador Desktop de PWAs do Google Chrome
Exec=bash -c "cd '$PROJECT_DIR' && (npx tsx server.ts || npm run dev) & sleep 2 text && google-chrome --app=http://localhost:3000"
Icon=google-chrome
Terminal=false
Categories=Utility;Development;
EOF

chmod +x "$APPS_DIR/chrome-pwa-hub.desktop"

echo "🎉 Pronto! O Chrome PWA Hub foi configurado para iniciar automaticamente toda vez que você reiniciar ou ligar o Ubuntu."
echo "🌐 URL: http://localhost:3000"
