#!/usr/bin/env bash
# Script de Atualização Direta do Chrome PWA Hub via Terminal (sem precisar abrir a interface antes)

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITHUB_REPO="pinguelanarosca/HubPWA"
DEFAULT_BRANCH="main"

echo "🔄 [Chrome PWA Hub] Verificando e baixando atualizações do repositório $GITHUB_REPO..."
echo "📂 Pasta do projeto: $PROJECT_DIR"

cd "$PROJECT_DIR"

# 1. Se o diretório for um repositório Git com remote configurado, faz git pull
if [ -d ".git" ] && command -v git &>/dev/null; then
    echo "📦 Baixando atualizações via Git..."
    git fetch origin "$DEFAULT_BRANCH" || true
    git pull origin "$DEFAULT_BRANCH" || echo "⚠️ Revesando atualização via download de pacote tarball..."
fi

# 2. Se git não atualizar ou não for um repositório git completo, baixa o tarball oficial do GitHub
TMP_ARCHIVE="/tmp/hubpwa-update-$$.tar.gz"
TMP_EXTRACT="/tmp/hubpwa-extract-$$"

echo "🌐 Consultando a API do GitHub para obter a versão mais recente..."
COMMIT_SHA=$(curl -s "https://api.github.com/repos/$GITHUB_REPO/commits/$DEFAULT_BRANCH" | grep '"sha":' | head -n 1 | cut -d '"' -f 4 || echo "")

if [ -n "$COMMIT_SHA" ]; then
    SHORT_SHA="${COMMIT_SHA:0:7}"
    echo "✨ Último commit no GitHub: $SHORT_SHA"
    
    echo "📥 Baixando pacote do GitHub..."
    curl -sL "https://api.github.com/repos/$GITHUB_REPO/tarball/$DEFAULT_BRANCH" -o "$TMP_ARCHIVE"
    
    mkdir -p "$TMP_EXTRACT"
    tar -xzf "$TMP_ARCHIVE" -C "$TMP_EXTRACT"
    
    EXTRACTED_DIR=$(find "$TMP_EXTRACT" -maxdepth 1 -type d | grep -v "^$TMP_EXTRACT$" | head -n 1)
    if [ -n "$EXTRACTED_DIR" ] && [ -d "$EXTRACTED_DIR" ]; then
        echo "📂 Atualizando arquivos do aplicativo (preservando dados em data/)..."
        rsync -av --exclude 'node_modules' --exclude '.git' --exclude '.env' --exclude 'data' "$EXTRACTED_DIR/" "$PROJECT_DIR/"
    fi
    
    # Atualiza version.json
    cat <<EOF > "$PROJECT_DIR/version.json"
{
  "repo": "$GITHUB_REPO",
  "branch": "$DEFAULT_BRANCH",
  "commitSha": "$COMMIT_SHA",
  "commitShort": "$SHORT_SHA",
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "version": "1.1.0"
}
EOF
    rm -rf "$TMP_ARCHIVE" "$TMP_EXTRACT"
fi

# 3. Garante que dependências estejam instaladas
echo "⚡ Verificando dependências do Node.js..."
npm install --legacy-peer-deps --quiet

# 4. Se o serviço systemd do usuário estiver rodando, reinicia
if command -v systemctl &>/dev/null && systemctl --user is-active --quiet chrome-pwa-hub.service 2>/dev/null; then
    echo "🔄 Reiniciando serviço background systemd..."
    systemctl --user restart chrome-pwa-hub.service
    echo "✅ Chrome PWA Hub atualizado e reiniciado em http://localhost:3000!"
else
    echo "✅ Atualização concluída com sucesso!"
    echo "🚀 Para iniciar o Chrome PWA Hub agora, execute:"
    echo "   npm run dev"
    echo "   ou acesse http://localhost:3000 se o Autostart estiver ativo."
fi
