import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { parseGitHubCommitResponse, isUpdateAvailable } from './src/utils/githubUpdater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GITHUB_REPO = 'pinguelanarosca/HubPWA';
const DEFAULT_BRANCH = 'main';

app.use(express.json());

// Helper to read local version.json
function getLocalVersion() {
  const versionPath = path.resolve(__dirname, 'version.json');
  try {
    if (fs.existsSync(versionPath)) {
      return JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    }
  } catch (err) {
    console.error('Erro ao ler version.json:', err);
  }
  return {
    repo: GITHUB_REPO,
    branch: DEFAULT_BRANCH,
    commitSha: '92ba6d88bd06e2d6350d78c55ab4698c6568a595',
    commitShort: '92ba6d8',
    commitDate: '2026-10-29T12:58:32Z',
    commitMessage: 'feat: initialize Chrome PWA Hub project',
    version: '1.1.0',
  };
}

// 1. GET /api/updater/status - Check local vs remote GitHub repository
app.get('/api/updater/status', async (_req, res) => {
  try {
    const localVersion = getLocalVersion();

    // Fetch latest commit from GitHub API
    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits/${DEFAULT_BRANCH}`,
      {
        headers: {
          'User-Agent': 'Chrome-PWA-Hub-Updater',
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      return res.status(ghRes.status).json({
        error: `GitHub API respondeu com status ${ghRes.status}`,
        details: errText,
        localVersion,
      });
    }

    const ghData = await ghRes.json();
    const remoteCommit = parseGitHubCommitResponse(ghData);
    const hasUpdate = isUpdateAvailable(localVersion.commitSha, remoteCommit.sha);

    return res.json({
      hasUpdate,
      localVersion,
      remoteCommit,
      repo: GITHUB_REPO,
      branch: DEFAULT_BRANCH,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erro ao verificar atualização no GitHub:', err);
    return res.status(500).json({
      error: 'Não foi possível verificar atualizações no GitHub.',
      details: (err as Error).message,
      localVersion: getLocalVersion(),
    });
  }
});

// 2. POST /api/updater/apply - Download and apply files from GitHub
app.post('/api/updater/apply', async (_req, res) => {
  try {
    const localVersion = getLocalVersion();

    // Fetch latest commit to know target SHA
    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits/${DEFAULT_BRANCH}`,
      {
        headers: {
          'User-Agent': 'Chrome-PWA-Hub-Updater',
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!ghRes.ok) {
      throw new Error(`Falha ao obter commit mais recente do GitHub (${ghRes.status})`);
    }

    const ghData = await ghRes.json();
    const remoteCommit = parseGitHubCommitResponse(ghData);

    // Download tarball or zipball of the repository
    const tarballRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/tarball/${DEFAULT_BRANCH}`,
      {
        headers: {
          'User-Agent': 'Chrome-PWA-Hub-Updater',
        },
      }
    );

    if (!tarballRes.ok) {
      throw new Error(`Falha ao baixar pacote de atualização do GitHub (${tarballRes.status})`);
    }

    // Save temporary archive and extract
    const buffer = Buffer.from(await tarballRes.arrayBuffer());
    const tmpArchive = path.resolve('/tmp', `hubpwa-update-${Date.now()}.tar.gz`);
    const tmpExtractDir = path.resolve('/tmp', `hubpwa-extracted-${Date.now()}`);

    fs.writeFileSync(tmpArchive, buffer);
    fs.mkdirSync(tmpExtractDir, { recursive: true });

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Extract tarball
    await execAsync(`tar -xzf "${tmpArchive}" -C "${tmpExtractDir}"`);

    // The tarball extracts to a single top-level directory like pinguelanarosca-HubPWA-92ba6d8/
    const extractedEntries = fs.readdirSync(tmpExtractDir);
    const innerDir = path.resolve(tmpExtractDir, extractedEntries[0] || '');

    if (fs.existsSync(innerDir)) {
      // Copy files to applet directory, preserving node_modules and .git
      await execAsync(
        `rsync -av --exclude 'node_modules' --exclude '.git' --exclude '.env' "${innerDir}/" "${__dirname}/"`
      );
    }

    // Clean up temporary files
    try {
      fs.unlinkSync(tmpArchive);
      await execAsync(`rm -rf "${tmpExtractDir}"`);
    } catch {
      // ignore temp cleanup error
    }

    // Update local version.json
    const updatedVersion = {
      ...localVersion,
      commitSha: remoteCommit.sha,
      commitShort: remoteCommit.shortSha,
      commitDate: remoteCommit.date,
      commitMessage: remoteCommit.message,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.resolve(__dirname, 'version.json'),
      JSON.stringify(updatedVersion, null, 2),
      'utf-8'
    );

    return res.json({
      success: true,
      message: 'Aplicativo atualizado com sucesso diretamente do GitHub!',
      updatedCommit: remoteCommit,
    });
  } catch (err) {
    console.error('Erro ao aplicar atualização do GitHub:', err);
    return res.status(500).json({
      error: 'Falha durante o download e instalação da atualização.',
      details: (err as Error).message,
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
