import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { parseGitHubCommitResponse, isUpdateAvailable } from './src/utils/githubUpdater.js';

import os from 'os';
import crypto from 'crypto';
import { spawn, exec, execSync } from 'child_process';
import { parseDesktopFile, ParsedDesktopApp, convertParsedToPWAs } from './src/utils/desktopParser.js';
import { deduplicateDesktopApps, DeduplicationResult, normalizeAppUrl } from './src/utils/desktopDeduplicator.js';
import { getCleanDomain, getTodayString, isAndroidOrRedroidApp } from './src/utils/pwaLogic.js';
import { getAutostartStatus, enableAutostartOnUbuntu, disableAutostartOnUbuntu } from './scripts/setup-autostart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'hubpwa_state.json');

interface ServerPWAState {
  id: string;
  name?: string;
  category?: string;
  notes?: string;
  url?: string;
  rawFileName?: string;
  appId?: string;
  profileDirectory?: string;
  rating?: number;
  pinned?: boolean;
  icon?: string;
  group?: string;
  lastAccessedDate?: string | null;
  accessCount?: number;
  updatedAt?: string;
}

interface ServerDb {
  version: number;
  pwas: Record<string, ServerPWAState>;
  deletedIds: string[];
}

let inMemoryDb: ServerDb | null = null;

function loadServerDb(): ServerDb {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (data && typeof data === 'object') {
        const rawPwas = data.pwas || {};
        const cleanPwas: Record<string, ServerPWAState> = {};
        for (const [k, p] of Object.entries(rawPwas)) {
          if (!isAndroidOrRedroidApp(p as any)) {
            cleanPwas[k] = p as ServerPWAState;
          }
        }
        return {
          version: data.version || 1,
          pwas: cleanPwas,
          deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
        };
      }
    }
  } catch (err) {
    console.warn('Aviso ao carregar hubpwa_state.json:', err);
  }
  return { version: 1, pwas: {}, deletedIds: [] };
}

function getDb(): ServerDb {
  if (!inMemoryDb) {
    inMemoryDb = loadServerDb();
  }
  return inMemoryDb;
}

function saveServerDb(db: ServerDb) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${STATE_FILE}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, STATE_FILE);
  } catch (err) {
    console.error('Erro ao salvar hubpwa_state.json:', err);
  }
}

function findStoredState(
  item: { id?: string; appId?: string; url?: string; rawFileName?: string; name?: string },
  db: ServerDb
): ServerPWAState | null {
  if (!db || !db.pwas) return null;

  // 1. Direct ID match
  if (item.id && db.pwas[item.id]) {
    return db.pwas[item.id];
  }

  // 2. Exact appId match
  if (item.appId) {
    const targetAppId = item.appId.toLowerCase();
    for (const savedId in db.pwas) {
      const saved = db.pwas[savedId];
      if (saved.appId && saved.appId.toLowerCase() === targetAppId) {
        return saved;
      }
    }
  }

  // 3. Exact rawFileName match
  if (item.rawFileName) {
    for (const savedId in db.pwas) {
      const saved = db.pwas[savedId];
      if (saved.rawFileName && saved.rawFileName === item.rawFileName) {
        return saved;
      }
    }
  }

  // 4. Match by normalized URL (exact URL including path, never bare domain)
  const normUrl = item.url ? normalizeAppUrl(item.url) : '';
  if (normUrl) {
    for (const savedId in db.pwas) {
      const saved = db.pwas[savedId];
      if (saved.url && normalizeAppUrl(saved.url) === normUrl) {
        return saved;
      }
    }
  }

  return null;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GITHUB_REPO = 'pinguelanarosca/HubPWA';
const DEFAULT_BRANCH = 'main';

app.use(express.json());

// Memoize command existence checks to avoid running execSync on every launch
const commandCache = new Map<string, boolean>();
function hasCommand(cmd: string): boolean {
  if (commandCache.has(cmd)) {
    return commandCache.get(cmd)!;
  }
  try {
    execSync(`command -v ${cmd} 2>/dev/null`, { stdio: 'ignore' });
    commandCache.set(cmd, true);
    return true;
  } catch {
    commandCache.set(cmd, false);
    return false;
  }
}

// In-memory cache for web-fetched icon buffers
const iconBufferCache = new Map<string, { buffer: Buffer; contentType: string }>();

// Helper to find local icon file on Ubuntu/Linux
function findLocalIcon(iconNameOrPath: string): string | null {
  if (!iconNameOrPath) return null;

  // 1. Direct absolute path check
  if (path.isAbsolute(iconNameOrPath) && fs.existsSync(iconNameOrPath)) {
    return iconNameOrPath;
  }

  const homeDir = process.env.HOME || os.homedir();
  const rawKey = iconNameOrPath.trim();
  const searchKeyClean = rawKey
    .toLowerCase()
    .replace(/^chrome-/, '')
    .replace(/-profile_\d+|-default/gi, '')
    .replace(/\.(png|ico|svg|xpm|desktop)$/i, '');

  const appIdMatch = rawKey.match(/[a-f0-9]{32}|[a-p]{32}/i);
  const appId = appIdMatch ? appIdMatch[0].toLowerCase() : null;

  const targetDirs = [
    path.join(homeDir, '.local/share/icons'),
    path.join(homeDir, '.local/share/applications'),
    path.join(homeDir, 'Área de trabalho'),
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, '.config/google-chrome'),
    path.join(homeDir, '.config/chromium'),
    '/usr/share/icons',
    '/usr/share/pixmaps',
  ];

  function searchDir(dir: string, depth = 0): string | null {
    if (depth > 4 || !fs.existsSync(dir)) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = searchDir(fullPath, depth + 1);
          if (found) return found;
        } else if (entry.isFile()) {
          const lowerName = entry.name.toLowerCase();
          if (
            lowerName.endsWith('.png') ||
            lowerName.endsWith('.svg') ||
            lowerName.endsWith('.ico') ||
            lowerName.endsWith('.xpm')
          ) {
            if (appId && lowerName.includes(appId)) return fullPath;
            if (searchKeyClean.length >= 3 && lowerName.includes(searchKeyClean)) return fullPath;
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  for (const dir of targetDirs) {
    const res = searchDir(dir);
    if (res) return res;
  }

  return null;
}

// Serve site favicon (SVG & ICO)
app.get(['/favicon.ico', '/favicon.svg'], (_req, res) => {
  const faviconSvg = path.join(__dirname, 'public', 'favicon.svg');
  if (fs.existsSync(faviconSvg)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.sendFile(faviconSvg);
  }
  return res.status(204).end();
});

// Route to serve local Linux icon image files or proxy original web favicons directly
app.get('/api/icon', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const iconParam = String(req.query.path || req.query.name || '');
  const urlParam = String(req.query.url || '');
  const domainParam = String(req.query.domain || '');
  const nameParam = String(req.query.name || '');

  // 1. Check local Ubuntu system icon files across iconParam, nameParam, domainParam
  const localCandidates = [iconParam, nameParam, domainParam, urlParam].filter(Boolean);
  for (const cand of localCandidates) {
    const resolved = findLocalIcon(cand);
    if (resolved && fs.existsSync(resolved)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(resolved);
    }
  }

  // 2. Extract domain
  let domain = domainParam.trim().toLowerCase();
  if (!domain && urlParam) {
    try {
      const parsed = new URL(urlParam.startsWith('http') ? urlParam : `https://${urlParam}`);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }
  }
  if (!domain && (iconParam || nameParam)) {
    const match = (iconParam || nameParam).match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/i);
    if (match) {
      domain = match[1].toLowerCase().replace(/^www\./, '');
    }
  }

  if (domain && domain.endsWith('com.com')) {
    domain = domain.slice(0, -7) + '.com';
  }

  // 3. Serve cached original favicon buffer if available
  if (domain && domain !== 'app.com' && domain !== 'seu-app.com') {
    if (iconBufferCache.has(domain)) {
      const cached = iconBufferCache.get(domain)!;
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.send(cached.buffer);
    }

    // Attempt 1: Fetch DuckDuckGo high-res original favicon
    try {
      const ddgUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
      const response = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
        signal: AbortSignal.timeout(4000),
      });
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (buf.length > 2000) {
          const ct = response.headers.get('content-type') || 'image/png';
          iconBufferCache.set(domain, { buffer: buf, contentType: ct });
          res.setHeader('Content-Type', ct);
          res.setHeader('Cache-Control', 'public, max-age=604800');
          return res.send(buf);
        }
      }
    } catch {
      // ignore
    }

    // Attempt 2: HTML Scrape for exact original <link rel="icon"> or <link rel="apple-touch-icon"> from platform homepage
    try {
      const pageRes = await fetch(`https://${domain}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(3500),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut |apple-touch-)?icon["'][^>]+href=["']([^"']+)["']/i);
        if (iconMatch && iconMatch[1]) {
          const rawHref = iconMatch[1].trim();
          const absIconUrl = rawHref.startsWith('http')
            ? rawHref
            : rawHref.startsWith('/')
            ? `https://${domain}${rawHref}`
            : `https://${domain}/${rawHref}`;

          const imgRes = await fetch(absIconUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(3500),
          });
          if (imgRes.ok) {
            const arrayBuf = await imgRes.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            if (buf.length > 300) {
              const ct = imgRes.headers.get('content-type') || 'image/png';
              iconBufferCache.set(domain, { buffer: buf, contentType: ct });
              res.setHeader('Content-Type', ct);
              res.setHeader('Cache-Control', 'public, max-age=604800');
              return res.send(buf);
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Attempt 3: Fetch Google GStatic original favicon
    try {
      const gstaticUrl = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;
      const response = await fetch(gstaticUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
        signal: AbortSignal.timeout(3500),
      });
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (buf.length > 1000) {
          const ct = response.headers.get('content-type') || 'image/png';
          iconBufferCache.set(domain, { buffer: buf, contentType: ct });
          res.setHeader('Content-Type', ct);
          res.setHeader('Cache-Control', 'public, max-age=604800');
          return res.send(buf);
        }
      }
    } catch {
      // ignore
    }
  }

  return res.status(404).send('Icon not found');
});

// Helper to compute perceptual/content hash for local icon file
function getIconHash(iconNameOrPath: string): string | null {
  if (!iconNameOrPath) return null;
  const iconPath = findLocalIcon(iconNameOrPath);
  if (!iconPath || !fs.existsSync(iconPath)) return null;

  try {
    const buffer = fs.readFileSync(iconPath);
    // 1. Content hash (sha256 prefix)
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    // 2. Perceptual block distribution: sample 16 points across buffer to detect visually similar icons
    let sampleSum = 0;
    const step = Math.max(1, Math.floor(buffer.length / 16));
    for (let i = 0; i < buffer.length; i += step) {
      sampleSum = (sampleSum * 31 + buffer[i]) >>> 0;
    }
    return `${contentHash}_${sampleSum.toString(16)}`;
  } catch {
    return null;
  }
}

// Helper to scan local .desktop files from Ubuntu with smart deduplication
function scanLocalPWAsWithStats(): DeduplicationResult {
  if (process.platform !== 'linux') {
    return {
      items: [],
      stats: {
        totalRawFound: 0,
        confirmedDuplicatesMerged: 0,
        activeCount: 0,
        possibleDuplicatesCount: 0,
      },
    };
  }

  const homeDir = process.env.HOME || os.homedir();
  const targetFolders = [
    path.join(homeDir, '.local/share/applications'),
    path.join(homeDir, 'Área de trabalho/001'),
    path.join(homeDir, 'Desktop/001'),
    path.join(homeDir, 'Área de trabalho'),
    path.join(homeDir, 'Desktop'),
  ];

  const foundFiles: { filePath: string; fileName: string }[] = [];

  for (const folder of targetFolders) {
    if (!fs.existsSync(folder)) continue;
    try {
      const files = fs.readdirSync(folder);
      for (const file of files) {
        if (file.endsWith('.desktop')) {
          foundFiles.push({
            filePath: path.join(folder, file),
            fileName: file,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  const rawApps: ParsedDesktopApp[] = [];

  for (const item of foundFiles) {
    if (
      item.fileName.toLowerCase().includes('redroid') ||
      item.fileName.toLowerCase().includes('android')
    ) {
      continue;
    }

    try {
      const content = fs.readFileSync(item.filePath, 'utf-8');
      if (
        !content.includes('chrome') &&
        !content.includes('--app') &&
        !content.includes('URL=') &&
        !content.includes('Exec=')
      ) {
        continue;
      }

      const parsed = parseDesktopFile(content, item.fileName);
      if (!parsed || isAndroidOrRedroidApp(parsed)) continue;

      parsed.desktopPath = item.filePath;

      // Extract raw Icon property from desktop file to compute icon hash
      const iconMatch = content.match(/^Icon=(.+)$/m);
      const rawIconName = iconMatch ? iconMatch[1].trim() : parsed.icon || '';
      parsed.iconHash = getIconHash(rawIconName) || undefined;

      rawApps.push(parsed);
    } catch {
      // ignore
    }
  }

  const result = deduplicateDesktopApps(rawApps);
  console.log(
    `[HubPWA] Scan concluído: ${result.stats.totalRawFound} encontrados, ${result.stats.confirmedDuplicatesMerged} duplicatas confirmadas consolidadas, ${result.stats.activeCount} ativos finais, ${result.stats.possibleDuplicatesCount} possíveis duplicatas sinalizadas.`
  );

  return result;
}

// Endpoint to automatically discover local PWAs on Ubuntu with deduplication metrics and state persistence
app.get('/api/pwas/scan', (_req, res) => {
  try {
    const { items: consolidatedApps, stats } = scanLocalPWAsWithStats();
    const pwaItems = convertParsedToPWAs(consolidatedApps);

    // Merge with persisted disk database so notes, ratings, accessed status, and custom edits survive restarts
    const db = getDb();
    const activeItems = pwaItems
      .filter((pwa) => !db.deletedIds.includes(pwa.id) && !isAndroidOrRedroidApp(pwa))
      .map((pwa) => {
        const stored = findStoredState(pwa, db);
        if (stored) {
          const workingIcon =
            stored.icon && !stored.icon.includes('/api/icon')
              ? stored.icon
              : pwa.icon;
          return {
            ...pwa,
            name: stored.name || pwa.name,
            category: stored.category || pwa.category,
            group: stored.group || stored.category || pwa.category,
            icon: workingIcon || pwa.icon,
            notes: stored.notes !== undefined ? stored.notes : pwa.notes,
            rating: typeof stored.rating === 'number' ? stored.rating : (stored.pinned ? 5 : 0),
            pinned: Boolean(stored.pinned || (stored.rating && stored.rating > 0)),
            lastAccessedDate: stored.lastAccessedDate || pwa.lastAccessedDate,
            accessCount: typeof stored.accessCount === 'number' ? stored.accessCount : pwa.accessCount,
          };
        }
        return pwa;
      });

    return res.json({
      success: true,
      items: activeItems,
      count: activeItems.length,
      stats: {
        ...stats,
        activeCount: activeItems.length,
      },
    });
  } catch (err) {
    console.error('Erro ao escanear PWAs locais:', err);
    return res.status(500).json({
      success: false,
      items: [],
      count: 0,
      stats: {
        totalRawFound: 0,
        confirmedDuplicatesMerged: 0,
        activeCount: 0,
        possibleDuplicatesCount: 0,
      },
      error: (err as Error).message,
    });
  }
});

// GET /api/pwas/state - Retrieve server-persisted user state
app.get('/api/pwas/state', (_req, res) => {
  try {
    const db = getDb();
    return res.json({ success: true, db });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/pwas/state - Save / update user state to disk
app.post('/api/pwas/state', (req, res) => {
  try {
    const { items, deletedIds } = req.body || {};
    const db = getDb();

    if (Array.isArray(deletedIds)) {
      deletedIds.forEach((id: string) => {
        if (!db.deletedIds.includes(id)) {
          db.deletedIds.push(id);
        }
      });
    }

    if (Array.isArray(items)) {
      for (const item of items) {
        if (!item || !item.id || isAndroidOrRedroidApp(item)) continue;
        db.pwas[item.id] = {
          id: item.id,
          name: item.name,
          category: item.category,
          url: item.url,
          rawFileName: item.rawFileName,
          appId: item.appId,
          notes: item.notes || '',
          rating: typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0),
          pinned: Boolean(item.pinned || (item.rating && item.rating > 0)),
          lastAccessedDate: item.lastAccessedDate || null,
          accessCount: typeof item.accessCount === 'number' ? item.accessCount : 0,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    saveServerDb(db);
    return res.json({ success: true, count: Object.keys(db.pwas).length });
  } catch (err) {
    console.error('Erro ao salvar estado:', err);
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/pwas/delete - Permanently mark PWA as deleted so it does not reappear on re-scan
app.post('/api/pwas/delete', (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID obrigatório' });
    const db = getDb();
    if (!db.deletedIds.includes(id)) {
      db.deletedIds.push(id);
    }
    delete db.pwas[id];
    saveServerDb(db);
    return res.json({ success: true, deletedId: id });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

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

// 0. POST /api/launch-pwa - Launches PWA in native Chrome Standalone App Window on Ubuntu/Linux preserving profile
app.post('/api/launch-pwa', (req, res) => {
  const { id, url, rawFileName, appId, profileDirectory, execLine, desktopPath, todayStr } = req.body || {};
  if (!url && !rawFileName && !execLine && !desktopPath) {
    return res.status(400).json({ error: 'URL ou atalho é obrigatório para lançar a PWA.' });
  }

  // Automatically record access in server in-memory & disk database
  let localTimeStr = '';
  try {
    const db = getDb();
    const effectiveToday = todayStr || getTodayString();
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    localTimeStr = `${effectiveToday}T${hours}:${minutes}:${seconds}.000Z`;

    const matched = findStoredState({ id, appId, url, rawFileName }, db);
    const key = id || (matched ? matched.id : `pwa_${(appId || (rawFileName ? rawFileName.replace(/\.desktop$/i, '') : Date.now().toString())).toLowerCase().replace(/[^a-z0-9]/g, '_')}`);

    db.pwas[key] = {
      ...(matched || {}),
      id: key,
      url: url || (matched ? matched.url : ''),
      appId: appId || (matched ? matched.appId : undefined),
      rawFileName: rawFileName || (matched ? matched.rawFileName : undefined),
      lastAccessedDate: localTimeStr,
      accessCount: ((matched && matched.accessCount) || 0) + 1,
      updatedAt: now.toISOString(),
    };
    saveServerDb(db);
  } catch (err) {
    console.warn('Aviso ao registrar acesso no servidor:', err);
  }

  // Only execute native desktop launch if running on Linux/Ubuntu with a browser installed
  if (process.platform === 'linux') {
    const hasGtkLaunch = hasCommand('gtk-launch');
    const hasGio = hasCommand('gio');
    const hasChrome =
      hasCommand('google-chrome') ||
      hasCommand('google-chrome-stable') ||
      hasCommand('chromium') ||
      hasCommand('chromium-browser') ||
      hasCommand('chrome');

    if (!hasGtkLaunch && !hasGio && !hasChrome) {
      // In headless/container preview with no browser installed, return fallback gracefully
      return res.json({ success: true, launchedNative: false, fallbackUrl: url, lastAccessedDate: localTimeStr });
    }

    const profileArg = profileDirectory ? `--profile-directory="${profileDirectory}"` : '';
    const commandCandidates: string[] = [];

    // 1. Direct GIO launch of full .desktop file (exact match on Ubuntu desktop)
    if (desktopPath && fs.existsSync(desktopPath)) {
      if (hasGio) commandCandidates.push(`gio launch "${desktopPath}" 2>/dev/null`);
      if (hasGtkLaunch) commandCandidates.push(`gtk-launch "${path.basename(desktopPath, '.desktop')}" 2>/dev/null`);
    }

    // 2. If we have the exact .desktop file in ~/.local/share/applications/
    if (rawFileName) {
      const desktopName = rawFileName.replace(/\.desktop$/i, '');
      if (hasGtkLaunch) commandCandidates.push(`gtk-launch "${desktopName}" 2>/dev/null`);
      if (hasGio) commandCandidates.push(`gio launch "$HOME/.local/share/applications/${rawFileName}" 2>/dev/null`);
    }

    // 3. Direct execLine if saved
    if (execLine) {
      const sanitizedExec = execLine.replace(/%[uUfF]/g, '').trim();
      if (sanitizedExec) {
        commandCandidates.push(`${sanitizedExec} 2>/dev/null`);
      }
    }

    // 4. App-ID with Profile
    if (appId && hasChrome) {
      commandCandidates.push(`google-chrome ${profileArg} --app-id="${appId}" 2>/dev/null`);
      commandCandidates.push(`google-chrome-stable ${profileArg} --app-id="${appId}" 2>/dev/null`);
      commandCandidates.push(`chromium ${profileArg} --app-id="${appId}" 2>/dev/null`);
    }

    // 5. URL App Mode with Profile
    if (url && hasChrome) {
      commandCandidates.push(`google-chrome ${profileArg} --app="${url}" 2>/dev/null`);
      commandCandidates.push(`google-chrome-stable ${profileArg} --app="${url}" 2>/dev/null`);
      commandCandidates.push(`chromium-browser ${profileArg} --app="${url}" 2>/dev/null`);
      commandCandidates.push(`chromium ${profileArg} --app="${url}" 2>/dev/null`);
      commandCandidates.push(`chrome ${profileArg} --app="${url}" 2>/dev/null`);
    }

    if (commandCandidates.length === 0) {
      return res.json({ success: true, launchedNative: false, fallbackUrl: url, lastAccessedDate: localTimeStr });
    }

    const fullCommand = commandCandidates.join(' || ');

    // Execute silently without logging warnings to console
    exec(fullCommand, () => {
      // Chrome IPC process delegation handled silently
    });

    return res.json({
      success: true,
      launchedNative: true,
      lastAccessedDate: localTimeStr,
      message: `PWA lançada no perfil '${profileDirectory || 'padrão'}' em modo standalone!`,
    });
  }

  return res.json({ success: true, launchedNative: false, fallbackUrl: url, lastAccessedDate: localTimeStr });
});

// Ubuntu Autostart Management Endpoints
app.get('/api/autostart/status', (_req, res) => {
  res.json(getAutostartStatus());
});

app.post('/api/autostart/enable', (_req, res) => {
  const result = enableAutostartOnUbuntu();
  res.json(result);
});

app.post('/api/autostart/disable', (_req, res) => {
  const result = disableAutostartOnUbuntu();
  res.json(result);
});

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
      // 1. Copy files to applet directory, preserving node_modules and .git
      await execAsync(
        `rsync -av --exclude 'node_modules' --exclude '.git' --exclude '.env' "${innerDir}/" "${__dirname}/"`
      );

      // 2. Run npm install to ensure any new dependencies are installed
      try {
        await execAsync('npm install --legacy-peer-deps', { cwd: __dirname });
      } catch (npmErr) {
        console.warn('Aviso durante npm install:', npmErr);
      }
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

    res.json({
      success: true,
      message: 'Aplicativo atualizado com sucesso diretamente do GitHub!',
      updatedCommit: remoteCommit,
    });

    // Seamlessly spawn detached background server process on the same PORT and exit old process
    setTimeout(() => {
      const currentPort = String(process.env.PORT || '3000');
      
      try {
        const child = spawn('npm', ['run', 'dev'], {
          cwd: __dirname,
          env: { ...process.env, PORT: currentPort },
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } catch (spawnErr) {
        console.error('Erro ao relançar processo do servidor:', spawnErr);
      }

      setTimeout(() => {
        process.exit(0);
      }, 500);
    }, 800);

    return;
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
