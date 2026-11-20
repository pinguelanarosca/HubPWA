import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { parseGitHubCommitResponse, isUpdateAvailable } from './src/utils/githubUpdater.js';

import os from 'os';
import crypto from 'crypto';
import { promisify } from 'util';
import { spawn, exec, execFile, execSync } from 'child_process';
import { parseDesktopFile, ParsedDesktopApp, convertParsedToPWAs } from './src/utils/desktopParser.js';
import { deduplicateDesktopApps, DeduplicationResult, normalizeAppUrl } from './src/utils/desktopDeduplicator.js';
import {
  extractHtmlIconCandidates,
  getCleanDomain,
  getTodayString,
  isAndroidOrRedroidApp,
  isChromeShortcutLocalCandidate,
  isPreservableIconUrl,
} from './src/utils/pwaLogic.js';
import type { AccessHistoryEntry } from './src/types/pwa.js';
import {
  chromeWebkitTimeToLocalIso,
  collapseRapidChromeVisits,
  matchesVisitUrlForPWA,
  mergeAccessHistoryRecords,
  resolveHistoryProfileDirectory,
} from './src/utils/historyLogic.js';
import { getAutostartStatus, enableAutostartOnUbuntu, disableAutostartOnUbuntu } from './scripts/setup-autostart.js';
import {
  PWA_WINDOW_WIDTH,
  PWA_WINDOW_HEIGHT,
  decodeBase64Url,
  decodeLaunchBridgePayload,
  extractExecFromDesktopContent,
  buildLinuxLaunchCandidates,
} from './src/utils/launchConfig.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'hubpwa_state.json');

interface ServerPWAFolder {
  id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  createdAt: string;
}

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
  folderId?: string | null;
  aliases?: string[];
  flags?: {
    moneyDate?: string;
    comDate?: string | null;
    comState?: 'check' | 'x' | null;
    rbDate?: string | null;
    rbState?: 'check' | 'x' | null;
    bonDate?: string | null;
    bonState?: 'check' | 'x' | null;
  };
  clonedFromId?: string;
  lastAccessedDate?: string | null;
  accessLogs?: string[];
  accessHistory?: AccessHistoryEntry[];
  accessCount?: number;
  updatedAt?: string;
}

interface ServerDb {
  version: number;
  pwas: Record<string, ServerPWAState>;
  folders: ServerPWAFolder[];
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
          folders: Array.isArray(data.folders) ? data.folders : [],
          deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
        };
      }
    }
  } catch (err) {
    console.warn('Aviso ao carregar hubpwa_state.json:', err);
  }
  return { version: 1, pwas: {}, folders: [], deletedIds: [] };
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
  item: { id?: string; clonedFromId?: string; appId?: string; url?: string; rawFileName?: string; name?: string },
  db: ServerDb
): ServerPWAState | null {
  if (!db || !db.pwas) return null;

  // 1. Direct ID match
  if (item.id && db.pwas[item.id]) {
    return db.pwas[item.id];
  }

  // Cloned profile PWAs share URL with the original PWA, so never fall back to url/appId
  if (item.clonedFromId || item.id?.startsWith('pwa_clone_')) {
    return null;
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

// Memoize executable lookups via fs.accessSync (0 shell forks, <0.05ms)
const commandCache = new Map<string, boolean>();
function hasCommand(cmd: string): boolean {
  if (commandCache.has(cmd)) {
    return commandCache.get(cmd)!;
  }
  const searchDirs = [
    ...(process.env.PATH || '').split(path.delimiter).filter(Boolean),
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/opt/google/chrome',
    '/snap/bin',
  ];
  let found = false;
  for (const dir of searchDirs) {
    try {
      const candidate = path.join(dir, cmd);
      fs.accessSync(candidate, fs.constants.X_OK);
      found = true;
      break;
    } catch {
      // continue searching PATH
    }
  }
  commandCache.set(cmd, found);
  return found;
}

// In-memory cache for web-fetched icon buffers
const iconBufferCache = new Map<string, { buffer: Buffer; contentType: string }>();

// Cache for local Ubuntu system icon path lookups
const localIconCache = new Map<string, string | null>();

// Helper to validate whether a buffer contains a true image (PNG, JPG, GIF, WEBP, ICO, SVG)
function isValidImageBuffer(buf: Buffer, contentType?: string): boolean {
  if (!buf || buf.length < 100) return false;

  const ct = (contentType || '').toLowerCase();
  if (ct.includes('html') || ct.includes('text') || ct.includes('json') || ct.includes('javascript')) {
    return false;
  }

  // Filter out 1478B or 1232B DuckDuckGo gray circle placeholder PNGs
  if (buf.length === 1478 || buf.length === 1232) {
    const hex = buf.toString('hex');
    if (hex.includes('4475636b') || hex.includes('6475636b')) return false;
  }

  // Header magic bytes check
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isGif = buf.subarray(0, 3).toString('ascii') === 'GIF';
  const isIco = buf[0] === 0x00 && buf[1] === 0x00 && (buf[2] === 0x01 || buf[2] === 0x02) && buf[3] === 0x00;
  const isWebp = buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  const isSvg = buf.subarray(0, 200).toString('utf-8').toLowerCase().includes('<svg');

  return isPng || isJpg || isGif || isIco || isWebp || isSvg;
}

// Helper to find local icon file on Ubuntu/Linux
function findLocalIcon(iconNameOrPath: string): string | null {
  if (!iconNameOrPath) return null;

  // Direct absolute path check
  if (path.isAbsolute(iconNameOrPath) && fs.existsSync(iconNameOrPath)) {
    return iconNameOrPath;
  }

  const homeDir = process.env.HOME || os.homedir();
  const rawKey = iconNameOrPath.trim();
  const rawKeyLower = rawKey.toLowerCase();

  const searchKeyClean = rawKeyLower
    .replace(/^chrome-/, '')
    .replace(/-profile_\d+|-default/gi, '')
    .replace(/\.(png|ico|svg|xpm|desktop)$/i, '');

  const appIdMatch = rawKey.match(/[a-f0-9]{32}|[a-p]{32}/i);
  const appId = appIdMatch ? appIdMatch[0].toLowerCase() : null;

  // Include explicit Chrome PWA icon directories on Ubuntu
  const targetDirs = [
    path.join(homeDir, '.local/share/icons/hicolor/128x128/apps'),
    path.join(homeDir, '.local/share/icons/hicolor/256x256/apps'),
    path.join(homeDir, '.local/share/icons/hicolor/48x48/apps'),
    path.join(homeDir, '.local/share/icons/hicolor/512x512/apps'),
    path.join(homeDir, '.local/share/icons/hicolor/scalable/apps'),
    path.join(homeDir, '.local/share/icons'),
    path.join(homeDir, '.local/share/applications'),
    path.join(homeDir, '.config/google-chrome'),
    path.join(homeDir, '.config/chromium'),
    path.join(homeDir, 'Área de trabalho'),
    path.join(homeDir, 'Desktop'),
    '/usr/share/icons/hicolor/128x128/apps',
    '/usr/share/icons/hicolor/256x256/apps',
    '/usr/share/icons',
    '/usr/share/pixmaps',
    '/var/lib/snapd/desktop/icons',
  ];

  function searchDir(dir: string, depth = 0): string | null {
    if (depth > 6 || !fs.existsSync(dir)) return null;
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
            if (lowerName.includes(rawKeyLower)) return fullPath;
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

function findLocalIconCached(iconNameOrPath: string): string | null {
  if (!iconNameOrPath) return null;
  if (localIconCache.has(iconNameOrPath)) {
    return localIconCache.get(iconNameOrPath)!;
  }
  const result = findLocalIcon(iconNameOrPath);
  localIconCache.set(iconNameOrPath, result);
  return result;
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

async function fetchAuthenticWebIcon(domain: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  // Attempt 1: Fetch Icon Horse CDN high-resolution original app icon (reject generic fallback stand-in)
  try {
    const ihUrl = `https://icon.horse/icon/${domain}`;
    const response = await fetch(ihUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const isStandIn =
        response.headers.get('x-icon-fallback') === 'true' ||
        response.headers.get('x-icon-stand-in') === 'true';
      if (!isStandIn) {
        const arrayBuf = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const ct = response.headers.get('content-type') || 'image/png';
        if (isValidImageBuffer(buf, ct) && buf.length > 400) {
          return { buffer: buf, contentType: ct };
        }
      }
    }
  } catch {
    // ignore
  }

  // Attempt 2: HTML Scrape for exact original apple-touch-icon, link icon or og:image from homepage
  for (const originUrl of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const pageRes = await fetch(originUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(3500),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const effectiveDomain = (() => {
          try {
            return new URL(pageRes.url || originUrl).hostname || domain;
          } catch {
            return domain;
          }
        })();
        const candidateHrefs = extractHtmlIconCandidates(html, effectiveDomain);
        for (const absIconUrl of candidateHrefs) {
          try {
            const imgRes = await fetch(absIconUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(3000),
            });
            if (imgRes.ok) {
              const arrayBuf = await imgRes.arrayBuffer();
              const buf = Buffer.from(arrayBuf);
              const ct = imgRes.headers.get('content-type') || 'image/png';
              if (isValidImageBuffer(buf, ct) && buf.length > 200) {
                return { buffer: buf, contentType: ct };
              }
            }
          } catch {
            // try next candidate
          }
        }
        break;
      }
    } catch {
      // try next origin
    }
  }

  // Attempt 3: Fetch DuckDuckGo high-res original favicon
  try {
    const ddgUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    const response = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
      signal: AbortSignal.timeout(3500),
    });
    if (response.ok) {
      const arrayBuf = await response.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const ct = response.headers.get('content-type') || 'image/png';
      if (isValidImageBuffer(buf, ct) && buf.length > 1500) {
        return { buffer: buf, contentType: ct };
      }
    }
  } catch {
    // ignore
  }

  // Attempt 4: Fetch Google GStatic favicon (strictly filter out tiny ~726B grey letter monograms)
  try {
    const gstaticUrl = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;
    const response = await fetch(gstaticUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
      signal: AbortSignal.timeout(3500),
    });
    if (response.ok) {
      const arrayBuf = await response.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const ct = response.headers.get('content-type') || 'image/png';
      if (isValidImageBuffer(buf, ct) && buf.length > 1200) {
        return { buffer: buf, contentType: ct };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

// Route to serve local Linux icon image files or proxy original web favicons directly
app.get('/api/icon', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const iconParam = String(req.query.path || req.query.name || '');
  const urlParam = String(req.query.url || '');
  const domainParam = String(req.query.domain || '');
  const nameParam = String(req.query.name || '');
  const forceRefresh = req.query.refresh === '1';
  const preferWeb = forceRefresh || req.query.preferWeb === '1';

  // 1. Extract domain
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

  const hasPublicDomain = Boolean(
    domain &&
      domain !== 'app.com' &&
      domain !== 'seu-app.com' &&
      !domain.includes('localhost') &&
      !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(domain)
  );

  // 2. Check local Ubuntu system icon files across candidates (cached)
  let localMatch: { resolved: string; isChromeShortcut: boolean } | null = null;
  const localCandidates = [iconParam, nameParam, domainParam, urlParam].filter(Boolean);
  for (const cand of localCandidates) {
    const resolved = findLocalIconCached(cand);
    if (resolved && fs.existsSync(resolved)) {
      const isChromeShortcut =
        isChromeShortcutLocalCandidate(cand) ||
        isChromeShortcutLocalCandidate(path.basename(resolved)) ||
        resolved.toLowerCase().includes('web applications');
      localMatch = { resolved, isChromeShortcut };
      break;
    }
  }

  // Serve explicit non-Chrome local icons immediately (unless refresh/preferWeb explicitly requested)
  if (localMatch && !localMatch.isChromeShortcut && !preferWeb) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(localMatch.resolved);
  }

  // 3. For web domains (even when Chrome wrote a local .desktop PNG, which is often a generic letter monogram),
  //    resolve authentic web favicon first and keep Chrome's local file as fallback.
  if (hasPublicDomain) {
    if (forceRefresh) {
      iconBufferCache.delete(domain);
    }

    if (!forceRefresh && iconBufferCache.has(domain)) {
      const cached = iconBufferCache.get(domain)!;
      if (isValidImageBuffer(cached.buffer, cached.contentType)) {
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=604800');
        return res.send(cached.buffer);
      } else {
        iconBufferCache.delete(domain);
      }
    }

    const webIcon = await fetchAuthenticWebIcon(domain);
    if (webIcon) {
      iconBufferCache.set(domain, webIcon);
      res.setHeader('Content-Type', webIcon.contentType);
      res.setHeader('Cache-Control', forceRefresh ? 'no-cache' : 'public, max-age=604800');
      return res.send(webIcon.buffer);
    }
  }

  // Fallback to local icon file (e.g. Cloudflare-protected sites or local network apps)
  if (localMatch) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(localMatch.resolved);
  }

  return res.status(404).send('Icon not found');
});

// Explicit icon resolution endpoint to pre-warm and verify authentic PWA icons upon creation/edition
app.get('/api/icon/resolve', async (req, res) => {
  const urlParam = String(req.query.url || '');
  const nameParam = String(req.query.name || '');
  const forceRefresh = req.query.refresh === '1';
  let domain = String(req.query.domain || '').trim().toLowerCase();

  if (!domain && urlParam) {
    try {
      const parsed = new URL(urlParam.startsWith('http') ? urlParam : `https://${urlParam}`);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch {}
  }
  if (!domain && nameParam) {
    const match = nameParam.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/i);
    if (match) domain = match[1].toLowerCase().replace(/^www\./, '');
  }

  if (domain && domain.endsWith('com.com')) {
    domain = domain.slice(0, -7) + '.com';
  }

  if (!domain) {
    return res.status(400).json({ success: false, error: 'Domain or URL required' });
  }

  if (forceRefresh) {
    iconBufferCache.delete(domain);
  }

  // Pre-warm web icon into cache cleanly
  if (!iconBufferCache.has(domain)) {
    const webIcon = await fetchAuthenticWebIcon(domain);
    if (webIcon) {
      iconBufferCache.set(domain, webIcon);
    }
  }

  const local = findLocalIconCached(nameParam) || findLocalIconCached(domain);
  const iconUrl = `/api/icon?domain=${encodeURIComponent(domain)}&name=${encodeURIComponent(nameParam)}`;

  return res.json({
    success: true,
    domain,
    hasLocalIcon: Boolean(local),
    hasWebIcon: iconBufferCache.has(domain),
    iconUrl,
  });
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
          const workingIcon = isPreservableIconUrl(stored.icon)
            ? stored.icon
            : pwa.icon;
          return {
            ...pwa,
            name: stored.name || pwa.name,
            category: stored.category || pwa.category,
            group: stored.group || stored.category || pwa.category,
            folderId: stored.folderId !== undefined ? stored.folderId : pwa.folderId,
            icon: workingIcon || pwa.icon,
            profileDirectory: stored.profileDirectory || pwa.profileDirectory,
            aliases: Array.isArray(stored.aliases) ? stored.aliases : pwa.aliases,
            ...(stored.flags ? { flags: stored.flags } : {}),
            ...(stored.clonedFromId ? { clonedFromId: stored.clonedFromId } : {}),
            notes: stored.notes !== undefined ? stored.notes : pwa.notes,
            rating: typeof stored.rating === 'number' ? stored.rating : (stored.pinned ? 5 : 0),
            pinned: Boolean(stored.pinned || (stored.rating && stored.rating > 0)),
            lastAccessedDate: stored.lastAccessedDate || pwa.lastAccessedDate,
            accessLogs: Array.isArray(stored.accessLogs) ? stored.accessLogs : pwa.accessLogs,
            accessHistory: Array.isArray(stored.accessHistory) ? stored.accessHistory : pwa.accessHistory,
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
    const { items, folders, deletedIds, replaceAll, allowRestore } = req.body || {};
    const db = getDb();

    if (Array.isArray(deletedIds)) {
      deletedIds.forEach((id: string) => {
        if (id && !db.deletedIds.includes(id)) {
          db.deletedIds.push(id);
        }
        if (id) {
          delete db.pwas[id];
        }
      });
    }

    if (Array.isArray(folders)) {
      db.folders = folders;
    }

    if (Array.isArray(items)) {
      if (replaceAll === true) {
        db.pwas = {};
      }
      for (const item of items) {
        if (!item || !item.id || isAndroidOrRedroidApp(item)) continue;
        if (db.deletedIds.includes(item.id) && !allowRestore) continue;
        db.pwas[item.id] = {
          id: item.id,
          name: item.name,
          category: item.category,
          group: item.group || item.category,
          folderId: item.folderId !== undefined ? item.folderId : (db.pwas[item.id]?.folderId ?? null),
          icon: item.icon,
          url: item.url,
          rawFileName: item.rawFileName,
          appId: item.appId,
          profileDirectory: item.profileDirectory,
          aliases: Array.isArray(item.aliases) ? item.aliases : undefined,
          flags:
            item.flags && typeof item.flags === 'object'
              ? {
                  ...(typeof item.flags.moneyDate === 'string'
                    ? { moneyDate: item.flags.moneyDate.slice(0, 10) }
                    : {}),
                  ...(item.flags.comDate !== undefined
                    ? { comDate: item.flags.comDate ? String(item.flags.comDate) : null }
                    : {}),
                  ...(item.flags.comState !== undefined
                    ? {
                        comState:
                          item.flags.comState === 'check' || item.flags.comState === 'x'
                            ? item.flags.comState
                            : null,
                      }
                    : {}),
                  ...((item.flags.rbDate !== undefined || item.flags.rdDate !== undefined)
                    ? {
                        rbDate: (item.flags.rbDate ?? item.flags.rdDate)
                          ? String(item.flags.rbDate ?? item.flags.rdDate)
                          : null,
                      }
                    : {}),
                  ...(item.flags.rbState !== undefined
                    ? {
                        rbState:
                          item.flags.rbState === 'check' || item.flags.rbState === 'x'
                            ? item.flags.rbState
                            : null,
                      }
                    : {}),
                  ...((item.flags.bonDate !== undefined || item.flags.irbDate !== undefined)
                    ? {
                        bonDate: (item.flags.bonDate ?? item.flags.irbDate)
                          ? String(item.flags.bonDate ?? item.flags.irbDate)
                          : null,
                      }
                    : {}),
                  ...(item.flags.bonState !== undefined
                    ? {
                        bonState:
                          item.flags.bonState === 'check' || item.flags.bonState === 'x'
                            ? item.flags.bonState
                            : null,
                      }
                    : {}),
                }
              : db.pwas[item.id]?.flags,
          clonedFromId: item.clonedFromId || db.pwas[item.id]?.clonedFromId,
          notes: item.notes || '',
          rating: typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0),
          pinned: Boolean(item.pinned || (item.rating && item.rating > 0)),
          lastAccessedDate: item.lastAccessedDate || null,
          accessLogs: Array.isArray(item.accessLogs)
            ? item.accessLogs.slice(0, 80)
            : db.pwas[item.id]?.accessLogs,
          accessHistory: Array.isArray(item.accessHistory)
            ? item.accessHistory.slice(0, 100)
            : db.pwas[item.id]?.accessHistory,
          accessCount: typeof item.accessCount === 'number' ? item.accessCount : 0,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    saveServerDb(db);
    return res.json({ success: true, count: Object.keys(db.pwas).length, folderCount: db.folders.length });
  } catch (err) {
    console.error('Erro ao salvar estado:', err);
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/pwas/delete - Permanently mark single or batch PWAs as deleted so they do not reappear on re-scan
app.post('/api/pwas/delete', (req, res) => {
  try {
    const { id, ids } = req.body || {};
    const targetIds: string[] = [];
    if (Array.isArray(ids)) {
      for (const entry of ids) {
        if (typeof entry === 'string' && entry.trim()) targetIds.push(entry.trim());
      }
    }
    if (typeof id === 'string' && id.trim() && !targetIds.includes(id.trim())) {
      targetIds.push(id.trim());
    }
    if (targetIds.length === 0) {
      return res.status(400).json({ error: 'ID obrigatório' });
    }
    const db = getDb();
    for (const targetId of targetIds) {
      if (!db.deletedIds.includes(targetId)) {
        db.deletedIds.push(targetId);
      }
      delete db.pwas[targetId];
    }
    saveServerDb(db);
    return res.json({ success: true, deletedId: targetIds[0], deletedIds: targetIds });
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

// 0a. GET /api/launch-bridge/:payload - Instant bridge fallback when running pure Wayland without X11
app.get('/api/launch-bridge/:payload', (req, res) => {
  const targetUrl = decodeLaunchBridgePayload(String(req.params.payload || ''));
  if (!targetUrl) {
    return res.status(400).send('URL inválida.');
  }

  const rawW = Number(req.query.w);
  const rawH = Number(req.query.h);
  const width = Number.isFinite(rawW) && rawW >= 240 && rawW <= 3840 ? Math.round(rawW) : PWA_WINDOW_WIDTH;
  const height = Number.isFinite(rawH) && rawH >= 320 && rawH <= 2160 ? Math.round(rawH) : PWA_WINDOW_HEIGHT;
  const decodedTitle = (decodeBase64Url(String(req.query.t || '')) || '').trim();
  const bridgeTitle = decodedTitle || 'Abrindo PWA...';
  const safeHtmlTitle = bridgeTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const serializedTitle = JSON.stringify(bridgeTitle);
  const serializedUrl = JSON.stringify(targetUrl);
  const safeMetaUrl = targetUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=${safeMetaUrl}" />
  <title>${safeHtmlTitle}</title>
  <script>
    (function () {
      try {
        document.title = ${serializedTitle};
        window.resizeTo(${width}, ${height});
      } catch (e) {}
      window.location.replace(${serializedUrl});
    })();
  </script>
</head>
<body style="margin:0;background:#0d0e12;color:#a3a3a3;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;font-size:12px;">
  Abrindo ${safeHtmlTitle} (${width}x${height})...
</body>
</html>`);
});

// 0. POST /api/launch-pwa - Launches PWA immediately on Ubuntu/Linux without blocking Node's event loop
app.post('/api/launch-pwa', (req, res) => {
  const { id, name, url, rawFileName, appId, profileDirectory, execLine, desktopPath, todayStr, recordOnly } =
    req.body || {};
  if (!url && !rawFileName && !execLine && !desktopPath) {
    return res.status(400).json({ error: 'URL ou atalho é obrigatório para lançar a PWA.' });
  }

  let resolvedTitle = typeof name === 'string' ? name.trim() : '';

  // Record access immediately in memory and defer disk flush so Chrome launch has 0ms I/O delay
  let localTimeStr = '';
  try {
    const db = getDb();
    const effectiveToday = todayStr || getTodayString();
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    localTimeStr = `${effectiveToday}T${hours}:${minutes}:${seconds}.000Z`;

    const matched = findStoredState({ id, clonedFromId: req.body?.clonedFromId, appId, url, rawFileName }, db);
    if (!resolvedTitle && matched?.name) {
      resolvedTitle = String(matched.name).trim();
    }
    const key =
      id ||
      (matched
        ? matched.id
        : `pwa_${(appId || (rawFileName ? rawFileName.replace(/\.desktop$/i, '') : Date.now().toString()))
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')}`);

    const prevLogs = Array.isArray(matched?.accessLogs) ? matched.accessLogs : [];
    const nextLogs = [localTimeStr, ...prevLogs.filter((l) => l !== localTimeStr)].slice(0, 60);
    const prevHistory = Array.isArray(matched?.accessHistory) ? matched.accessHistory : [];
    const nextHistory: AccessHistoryEntry[] = [
      {
        timestamp: localTimeStr,
        source: 'hub' as const,
        profileDirectory: profileDirectory || matched?.profileDirectory,
        visitedUrl: url || matched?.url,
      },
      ...prevHistory.filter((h) => h && h.timestamp !== localTimeStr),
    ].slice(0, 80);

    db.pwas[key] = {
      ...(matched || {}),
      id: key,
      name: resolvedTitle || (matched ? matched.name : undefined),
      url: url || (matched ? matched.url : ''),
      appId: appId || (matched ? matched.appId : undefined),
      rawFileName: rawFileName || (matched ? matched.rawFileName : undefined),
      profileDirectory: profileDirectory || (matched ? matched.profileDirectory : undefined),
      lastAccessedDate: localTimeStr,
      accessLogs: nextLogs,
      accessHistory: nextHistory,
      accessCount: ((matched && matched.accessCount) || 0) + 1,
      updatedAt: now.toISOString(),
    };
    setImmediate(() => saveServerDb(db));
  } catch (err) {
    console.warn('Aviso ao registrar acesso no servidor:', err);
  }

  if (recordOnly) {
    return res.json({
      success: true,
      launchedNative: false,
      fallbackUrl: url,
      windowSize: { width: PWA_WINDOW_WIDTH, height: PWA_WINDOW_HEIGHT },
      lastAccessedDate: localTimeStr,
    });
  }

  // Only execute native desktop launch on Linux/Ubuntu when a browser/launcher exists
  if (process.platform === 'linux') {
    const hasGtkLaunch = hasCommand('gtk-launch');
    const hasGio = hasCommand('gio');
    const hasPython3 = hasCommand('python3');
    const installedChromeBins = [
      'google-chrome',
      'google-chrome-stable',
      'chromium-browser',
      'chromium',
      'chrome',
    ].filter(hasCommand);
    const hasChrome = installedChromeBins.length > 0;

    if (!hasGtkLaunch && !hasGio && !hasChrome) {
      return res.json({
        success: true,
        launchedNative: false,
        fallbackUrl: url,
        windowSize: { width: PWA_WINDOW_WIDTH, height: PWA_WINDOW_HEIGHT },
        lastAccessedDate: localTimeStr,
      });
    }

    // Read Exec= from .desktop file when present
    const homeDir = process.env.HOME || os.homedir();
    const resolvedDesktopFile =
      desktopPath && fs.existsSync(desktopPath)
        ? desktopPath
        : rawFileName && fs.existsSync(path.join(homeDir, '.local/share/applications', rawFileName))
        ? path.join(homeDir, '.local/share/applications', rawFileName)
        : undefined;

    let desktopExecLine: string | null = null;
    if (resolvedDesktopFile) {
      try {
        const content = fs.readFileSync(resolvedDesktopFile, 'utf8');
        const extracted = extractExecFromDesktopContent(content);
        if (extracted) {
          // Verify absolute executable path if present so nonexistent paths don't stall fallback
          const firstToken = extracted.match(/^(?:"([^"]+)"|'([^']+)'|(\S+))/);
          const exePath = firstToken ? firstToken[1] || firstToken[2] || firstToken[3] : '';
          if (!exePath.startsWith('/') || fs.existsSync(exePath)) {
            desktopExecLine = extracted;
          }
        }
      } catch {
        desktopExecLine = null;
      }
    }

    const x11ScriptPath = path.resolve(__dirname, 'scripts', 'x11_resize_chrome.py');
    // A Wayland session often exposes DISPLAY for XWayland. That does NOT mean
    // native Chrome Wayland windows are manageable through libX11.
    const isWaylandSession =
      process.env.XDG_SESSION_TYPE?.toLowerCase() === 'wayland' ||
      (Boolean(process.env.WAYLAND_DISPLAY) && process.env.XDG_SESSION_TYPE?.toLowerCase() !== 'x11');
    const canUsePythonX11 = !isWaylandSession && hasPython3 && fs.existsSync(x11ScriptPath);
    const desktopEnv = isWaylandSession ? { ...process.env } : { ...process.env, DISPLAY: process.env.DISPLAY || ':0' };

    // Route URL-app launches through the self-sizing bridge on Wayland, even
    // when the obsolete X11 helper happens to be installed.
    const useBridge = isWaylandSession;
    const localPort = req.socket?.localPort || Number(process.env.PORT) || 3000;
    const bridgeOrigin = useBridge ? `http://127.0.0.1:${localPort}` : undefined;

    let commandCandidates = buildLinuxLaunchCandidates({
      desktopExecLine,
      execLine,
      desktopPath,
      desktopPathExists: Boolean(desktopPath && fs.existsSync(desktopPath)),
      rawFileName,
      appId,
      profileDirectory,
      url,
      bridgeOrigin,
      windowTitle: resolvedTitle || undefined,
      chromeBinaries: installedChromeBins.slice(0, 1),
      hasGtkLaunch,
      hasGio,
      hasChrome,
      width: PWA_WINDOW_WIDTH,
      height: PWA_WINDOW_HEIGHT,
    });

    // When a verified Chrome binary command exists, do NOT append slow gio/gtk-launch D-Bus fallbacks after it
    if (hasChrome) {
      const chromeOnly = commandCandidates.filter(
        (cmd) => !cmd.startsWith('gio launch') && !cmd.startsWith('gtk-launch')
      );
      if (chromeOnly.length > 0) {
        commandCandidates = chromeOnly;
      }
    }

    if (commandCandidates.length === 0) {
      return res.json({
        success: true,
        launchedNative: false,
        fallbackUrl: url,
        windowSize: { width: PWA_WINDOW_WIDTH, height: PWA_WINDOW_HEIGHT },
        lastAccessedDate: localTimeStr,
      });
    }

    const fullCommand = commandCandidates.slice(0, 3).join(' || ');

    if (canUsePythonX11) {
      // Single detached background helper: snapshots X11 windows -> spawns Chrome immediately -> enforces 539x993 + Hub title
      const launcher = spawn(
        'python3',
        [
          x11ScriptPath,
          '--launch-and-watch',
          String(PWA_WINDOW_WIDTH),
          String(PWA_WINDOW_HEIGHT),
          resolvedTitle,
          fullCommand,
        ],
        { env: desktopEnv, stdio: 'ignore', detached: true }
      );
      launcher.on('error', () => {
        const direct = spawn('sh', ['-c', fullCommand], { env: desktopEnv, stdio: 'ignore', detached: true });
        direct.unref();
      });
      launcher.unref();
    } else {
      const direct = spawn('sh', ['-c', fullCommand], { env: desktopEnv, stdio: 'ignore', detached: true });
      direct.unref();
    }

    return res.json({
      success: true,
      launchedNative: true,
      windowSize: { width: PWA_WINDOW_WIDTH, height: PWA_WINDOW_HEIGHT },
      lastAccessedDate: localTimeStr,
      message: `PWA lançada no perfil '${profileDirectory || 'padrão'}' em ${PWA_WINDOW_WIDTH}x${PWA_WINDOW_HEIGHT}!`,
    });
  }

  return res.json({
    success: true,
    launchedNative: false,
    fallbackUrl: url,
    windowSize: { width: PWA_WINDOW_WIDTH, height: PWA_WINDOW_HEIGHT },
    lastAccessedDate: localTimeStr,
  });
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

// GET /api/chrome-profiles - Discover Chrome/Chromium profile directories and display names on Linux/Ubuntu
app.get('/api/chrome-profiles', (_req, res) => {
  try {
    const discovered = new Map<string, { directory: string; displayName?: string }>();
    if (process.platform === 'linux') {
      const homeDir = process.env.HOME || os.homedir();
      const configRoots = [
        path.join(homeDir, '.config/google-chrome'),
        path.join(homeDir, '.config/google-chrome-beta'),
        path.join(homeDir, '.config/chromium'),
      ];

      for (const root of configRoots) {
        if (!fs.existsSync(root)) continue;
        const localStatePath = path.join(root, 'Local State');
        if (fs.existsSync(localStatePath)) {
          try {
            const stateJson = JSON.parse(fs.readFileSync(localStatePath, 'utf-8'));
            const infoCache = stateJson?.profile?.info_cache;
            if (infoCache && typeof infoCache === 'object') {
              for (const [dirName, meta] of Object.entries(infoCache)) {
                const m = meta as { name?: string; gaia_name?: string; user_name?: string } | null;
                const label = m?.name || m?.gaia_name || m?.user_name || '';
                if (dirName && !discovered.has(dirName)) {
                  discovered.set(dirName, {
                    directory: dirName,
                    displayName: label ? String(label).trim() : undefined,
                  });
                }
              }
            }
          } catch {
            // ignore malformed Local State
          }
        }

        try {
          const entries = fs.readdirSync(root, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name === 'Default' || /^Profile\s+\d+$/i.test(entry.name)) {
              if (!discovered.has(entry.name)) {
                discovered.set(entry.name, { directory: entry.name });
              }
            }
          }
        } catch {
          // ignore unreadable dir
        }
      }
    }

    return res.json({
      success: true,
      profiles: Array.from(discovered.values()),
    });
  } catch (err) {
    return res.json({ success: false, profiles: [], error: (err as Error).message });
  }
});

interface RawChromeHistoryRow {
  visitTime: number;
  url: string;
  title: string;
}

function getChromeConfigRoots(): string[] {
  const homeDir = process.env.HOME || os.homedir();
  return [
    path.join(homeDir, '.config/google-chrome'),
    path.join(homeDir, '.config/google-chrome-beta'),
    path.join(homeDir, '.config/chromium'),
  ];
}

function resolveChromeHistoryFile(profileDirectory: string): string | null {
  if (process.platform !== 'linux') return null;
  const target = (profileDirectory || 'Default').trim();
  const targetLower = target.toLowerCase();

  for (const root of getChromeConfigRoots()) {
    if (!fs.existsSync(root)) continue;

    // Direct exact match
    const direct = path.join(root, target, 'History');
    if (fs.existsSync(direct)) return direct;

    // Case-insensitive match across subdirectories (e.g. profile 5 vs Profile 5)
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.toLowerCase() === targetLower) {
          const candidate = path.join(root, entry.name, 'History');
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    } catch {
      // ignore unreadable root
    }
  }

  return null;
}

const CHROME_HISTORY_PY_SCRIPT = `
import sqlite3, json, sys
db_path = sys.argv[1]
conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=2.0)
cur = conn.cursor()
cur.execute("""
  SELECT v.visit_time, u.url, COALESCE(u.title, '')
  FROM visits v
  JOIN urls u ON v.url = u.id
  ORDER BY v.visit_time DESC
  LIMIT 6000
""")
rows = [{"visitTime": r[0], "url": r[1] or "", "title": r[2] or ""} for r in cur.fetchall()]
conn.close()
print(json.dumps(rows))
`.trim();

async function queryChromeProfileHistoryRows(historyPath: string): Promise<RawChromeHistoryRow[]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hubpwa-hist-'));
  const tmpHistoryPath = path.join(tmpDir, 'History');
  try {
    fs.copyFileSync(historyPath, tmpHistoryPath);
    for (const suffix of ['-wal', '-shm']) {
      const auxSrc = `${historyPath}${suffix}`;
      if (fs.existsSync(auxSrc)) {
        try {
          fs.copyFileSync(auxSrc, `${tmpHistoryPath}${suffix}`);
        } catch {
          // ignore optional wal/shm copy errors
        }
      }
    }

    const { stdout } = await execFileAsync(
      'python3',
      ['-c', CHROME_HISTORY_PY_SCRIPT, tmpHistoryPath],
      { timeout: 6000, maxBuffer: 12 * 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Aviso ao ler banco History do Chrome:', (err as Error).message);
    return [];
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup errors
    }
  }
}

function buildChromeVisitsForPWA(
  rows: RawChromeHistoryRow[],
  targetUrl: string,
  profileDirectory: string
): AccessHistoryEntry[] {
  if (!targetUrl || rows.length === 0) return [];
  const matched: AccessHistoryEntry[] = [];

  for (const row of rows) {
    if (!row || !row.url || !matchesVisitUrlForPWA(row.url, targetUrl)) continue;
    const timestamp = chromeWebkitTimeToLocalIso(Number(row.visitTime));
    if (!timestamp) continue;
    matched.push({
      timestamp,
      source: 'chrome',
      profileDirectory,
      visitedUrl: row.url,
      title: row.title || undefined,
    });
  }

  return collapseRapidChromeVisits(matched, 60, 80);
}

// GET /api/pwas/profile-history - Read a single PWA's Chrome profile SQLite History + Hub history
app.get('/api/pwas/profile-history', async (req, res) => {
  try {
    const pwaId = String(req.query.pwaId || '').trim();
    const url = String(req.query.url || '').trim();
    const rawProfile = String(req.query.profileDirectory || '').trim();
    const profileDirectory = resolveHistoryProfileDirectory({ profileDirectory: rawProfile });

    const db = getDb();
    const stored = pwaId ? db.pwas[pwaId] : undefined;
    const effectiveUrl = url || stored?.url || '';
    const historyFile = resolveChromeHistoryFile(profileDirectory);

    let chromeVisits: AccessHistoryEntry[] = [];
    if (historyFile && effectiveUrl) {
      const rows = await queryChromeProfileHistoryRows(historyFile);
      chromeVisits = buildChromeVisitsForPWA(rows, effectiveUrl, profileDirectory);
    }

    const merged = mergeAccessHistoryRecords(
      {
        lastAccessedDate: stored?.lastAccessedDate || null,
        accessLogs: stored?.accessLogs,
        accessHistory: stored?.accessHistory,
        profileDirectory,
      },
      chromeVisits
    );

    if (stored && pwaId && chromeVisits.length > 0) {
      db.pwas[pwaId] = {
        ...stored,
        lastAccessedDate: merged.lastAccessedDate,
        accessLogs: merged.accessLogs,
        accessHistory: merged.accessHistory,
        accessCount: Math.max(stored.accessCount || 0, merged.accessHistory.length),
        updatedAt: new Date().toISOString(),
      };
      saveServerDb(db);
    }

    return res.json({
      success: true,
      profileDirectory,
      historyFound: Boolean(historyFile),
      chromeVisitsCount: chromeVisits.length,
      visits: chromeVisits,
      accessHistory: merged.accessHistory,
      accessLogs: merged.accessLogs,
      lastAccessedDate: merged.lastAccessedDate,
      reason: historyFile
        ? null
        : `Arquivo History do perfil "${profileDirectory}" não encontrado neste ambiente.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/pwas/history/sync - Batch sync Chrome profile History SQLite across all configured PWAs
app.post('/api/pwas/history/sync', async (req, res) => {
  try {
    const reqItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const db = getDb();

    // Cache SQLite queries per resolved Chrome History file during this sync pass
    const rowsByHistoryPath = new Map<string, RawChromeHistoryRow[]>();
    const results: Record<
      string,
      {
        profileDirectory: string;
        historyFound: boolean;
        accessHistory: AccessHistoryEntry[];
        accessLogs: string[];
        lastAccessedDate: string | null;
      }
    > = {};

    let updatedCount = 0;

    for (const item of reqItems) {
      if (!item || !item.id || !item.url) continue;
      const profileDirectory = resolveHistoryProfileDirectory(item);
      const historyFile = resolveChromeHistoryFile(profileDirectory);

      let rows: RawChromeHistoryRow[] = [];
      if (historyFile) {
        if (rowsByHistoryPath.has(historyFile)) {
          rows = rowsByHistoryPath.get(historyFile)!;
        } else {
          rows = await queryChromeProfileHistoryRows(historyFile);
          rowsByHistoryPath.set(historyFile, rows);
        }
      }

      const chromeVisits = historyFile
        ? buildChromeVisitsForPWA(rows, item.url, profileDirectory)
        : [];

      const stored = db.pwas[item.id];
      const merged = mergeAccessHistoryRecords(
        {
          lastAccessedDate: stored?.lastAccessedDate ?? item.lastAccessedDate ?? null,
          accessLogs: stored?.accessLogs ?? item.accessLogs,
          accessHistory: stored?.accessHistory ?? item.accessHistory,
          profileDirectory,
        },
        chromeVisits
      );

      results[item.id] = {
        profileDirectory,
        historyFound: Boolean(historyFile),
        accessHistory: merged.accessHistory,
        accessLogs: merged.accessLogs,
        lastAccessedDate: merged.lastAccessedDate,
      };

      if (chromeVisits.length > 0 && stored) {
        db.pwas[item.id] = {
          ...stored,
          lastAccessedDate: merged.lastAccessedDate,
          accessLogs: merged.accessLogs,
          accessHistory: merged.accessHistory,
          accessCount: Math.max(stored.accessCount || 0, merged.accessHistory.length),
          updatedAt: new Date().toISOString(),
        };
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      saveServerDb(db);
    }

    return res.json({
      success: true,
      syncedAt: new Date().toISOString(),
      profilesScanned: rowsByHistoryPath.size,
      results,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
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
