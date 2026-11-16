import { FlagFilterKey, PWAFlags, PWAItem, PWAStats, SortOption, StatusFilter } from '../types/pwa';

/**
 * Returns the date in YYYY-MM-DD format in the user's local timezone
 */
export function getLocalDateString(dateInput: Date | string = new Date()): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Returns the current date in YYYY-MM-DD local format
 */
export function getTodayString(d: Date = new Date()): string {
  return getLocalDateString(d);
}

/**
 * Checks whether the PWA was accessed today in the user's local timezone
 * (returns true for GREEN / Acessado hoje, false for RED / Pendente hoje)
 */
export function isAccessedToday(
  lastAccessedDate: string | null | undefined,
  todayStr: string = getTodayString()
): boolean {
  if (!lastAccessedDate) return false;

  const cleanLast = String(lastAccessedDate).trim();
  if (!cleanLast || cleanLast === 'null' || cleanLast === 'undefined') return false;

  const targetToday = todayStr || getTodayString();

  // 1. Direct match with today's local date prefix (e.g. "2026-11-09T..." startsWith "2026-11-09")
  if (cleanLast.startsWith(targetToday)) {
    return true;
  }

  // 2. Parse ISO timestamp and convert to user's local timezone date
  const accessLocalDate = getLocalDateString(cleanLast);
  if (accessLocalDate && accessLocalDate === targetToday) {
    return true;
  }

  // 3. Fallback raw slice check
  const rawPrefix = cleanLast.slice(0, 10);
  if (rawPrefix === targetToday) {
    return true;
  }

  return false;
}

/**
 * Robustly matches whether two PWA items represent the same underlying app.
 * Compares id, appId, rawFileName, desktopPath, normalized URL, and name.
 */
export function isSameOrMatchingPWA(
  a: { id?: string; clonedFromId?: string; appId?: string; url?: string; rawFileName?: string; desktopPath?: string; name?: string },
  b: { id?: string; clonedFromId?: string; appId?: string; url?: string; rawFileName?: string; desktopPath?: string; name?: string }
): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (
    a.clonedFromId ||
    b.clonedFromId ||
    a.id?.startsWith('pwa_clone_') ||
    b.id?.startsWith('pwa_clone_')
  ) {
    return false;
  }
  if (a.appId && b.appId && a.appId.toLowerCase() === b.appId.toLowerCase()) return true;
  if (a.rawFileName && b.rawFileName && a.rawFileName.toLowerCase() === b.rawFileName.toLowerCase()) return true;
  if (a.desktopPath && b.desktopPath && a.desktopPath === b.desktopPath) return true;

  if (a.url && b.url) {
    const cleanA = a.url.trim().toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '');
    const cleanB = b.url.trim().toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (cleanA && cleanB && cleanA === cleanB) return true;
  }

  if (a.name && b.name) {
    const normNameA = a.name.trim().toLowerCase();
    const normNameB = b.name.trim().toLowerCase();
    if (normNameA && normNameB && normNameA === normNameB) return true;
  }

  return false;
}

/**
 * Detects whether an app or desktop shortcut belongs to Android or Redroid
 */
export function isAndroidOrRedroidApp(app: {
  name?: string;
  rawFileName?: string;
  execLine?: string;
  url?: string;
  notes?: string;
  category?: string;
  desktopPath?: string;
  appId?: string;
  aliases?: string[];
}): boolean {
  if (!app) return false;

  const aliasesStr = Array.isArray(app.aliases) ? app.aliases.join(' ') : '';
  const text = [
    app.name || '',
    app.rawFileName || '',
    app.execLine || '',
    app.url || '',
    app.notes || '',
    app.category || '',
    app.desktopPath || '',
    app.appId || '',
    aliasesStr,
  ]
    .join(' ')
    .toLowerCase();

  return (
    text.includes('redroid') ||
    text.includes('android') ||
    text.includes('waydroid') ||
    text.includes('anbox') ||
    text.includes('scrcpy')
  );
}

/**
 * Formats access timestamp into human-readable date and time for access logs
 */
export function formatAccessDateTime(
  dateInput: string | null | undefined
): { dateStr: string; timeStr: string; fullStr: string; hasRecord: boolean } {
  if (!dateInput || !dateInput.trim()) {
    return { dateStr: '', timeStr: '', fullStr: 'Sem registro', hasRecord: false };
  }

  try {
    const raw = dateInput.trim();
    let y = '';
    let m = '';
    let d = '';
    let hh = '';
    let mm = '';
    let ss = '';

    if (raw.includes('T')) {
      const [dPart, tPart] = raw.split('T');
      if (dPart) {
        const dPieces = dPart.split('-');
        if (dPieces.length === 3) {
          [y, m, d] = dPieces;
        }
      }
      if (tPart) {
        const cleanT = tPart.replace(/Z|[-+].*$/, '');
        const tPieces = cleanT.split(':');
        if (tPieces.length >= 2) {
          hh = tPieces[0].padStart(2, '0');
          mm = tPieces[1].padStart(2, '0');
          ss = (tPieces[2] || '').split('.')[0].padStart(2, '0');
        }
      }
    } else if (raw.includes('-')) {
      const dPieces = raw.split('-');
      if (dPieces.length === 3) {
        [y, m, d] = dPieces;
      }
    }

    if (!d || !m) {
      const parsedDate = new Date(raw);
      if (!isNaN(parsedDate.getTime())) {
        y = String(parsedDate.getFullYear());
        m = String(parsedDate.getMonth() + 1).padStart(2, '0');
        d = String(parsedDate.getDate()).padStart(2, '0');
        hh = String(parsedDate.getHours()).padStart(2, '0');
        mm = String(parsedDate.getMinutes()).padStart(2, '0');
        ss = String(parsedDate.getSeconds()).padStart(2, '0');
      }
    }

    if (!d || !m) {
      return { dateStr: raw, timeStr: '', fullStr: raw, hasRecord: true };
    }

    const dateStr = `${d}/${m}/${y || ''}`.replace(/\/$/, '');
    const timeStr = hh && mm ? (ss ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`) : '';
    const fullStr = timeStr ? `${dateStr} às ${timeStr}` : dateStr;

    return {
      dateStr,
      timeStr,
      fullStr,
      hasRecord: true,
    };
  } catch {
    return { dateStr: '', timeStr: '', fullStr: 'Sem registro', hasRecord: false };
  }
}

/**
 * Formats access timestamp strictly as "DD/MM HH:mm" without seconds.
 * Example: "06/11 14:32"
 */
export function formatAccessCompact(dateInput: string | null | undefined): string {
  if (!dateInput || !dateInput.trim()) {
    return '';
  }
  try {
    const raw = dateInput.trim();
    let m = '';
    let d = '';
    let hh = '00';
    let mm = '00';

    if (raw.includes('T')) {
      const [dPart, tPart] = raw.split('T');
      if (dPart) {
        const dPieces = dPart.split('-');
        if (dPieces.length === 3) {
          [, m, d] = dPieces;
        }
      }
      if (tPart) {
        const cleanT = tPart.replace(/Z|[-+].*$/, '');
        const tPieces = cleanT.split(':');
        if (tPieces.length >= 2) {
          hh = tPieces[0].padStart(2, '0');
          mm = tPieces[1].padStart(2, '0');
        }
      }
    } else if (raw.includes('-')) {
      const dPieces = raw.split('-');
      if (dPieces.length === 3) {
        [, m, d] = dPieces;
      }
    }

    if (!d || !m) {
      const parsedDate = new Date(raw);
      if (!isNaN(parsedDate.getTime())) {
        m = String(parsedDate.getMonth() + 1).padStart(2, '0');
        d = String(parsedDate.getDate()).padStart(2, '0');
        hh = String(parsedDate.getHours()).padStart(2, '0');
        mm = String(parsedDate.getMinutes()).padStart(2, '0');
      }
    }

    if (!d || !m) {
      return '';
    }

    return `${d}/${m} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

/**
 * Formats access timestamp with dash: "06/11 - 21:22" or "- Sem registro -" when missing
 */
export function formatAccessLogDash(dateInput: string | null | undefined): string {
  const compact = formatAccessCompact(dateInput);
  if (!compact) return '- Sem registro -';
  return compact.replace(' ', ' - ');
}

/**
 * Marks a PWA item as accessed today
 */
export function markAsAccessed(
  item: PWAItem,
  now: Date = new Date(),
  todayStr: string = getTodayString(now)
): PWAItem {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const localIso = `${todayStr}T${hours}:${minutes}:${seconds}.000Z`;

  const existingLogs = Array.isArray(item.accessLogs) ? item.accessLogs : [];
  const updatedLogs = [localIso, ...existingLogs.filter((l) => l !== localIso)].slice(0, 10);

  return {
    ...item,
    lastAccessedDate: localIso,
    accessLogs: updatedLogs,
    accessCount: (item.accessCount || 0) + 1,
  };
}

/**
 * Toggles a PWA's daily access state (accessed <-> pending)
 */
export function toggleAccessedToday(
  item: PWAItem,
  todayStr: string = getTodayString()
): PWAItem {
  const currentlyAccessed = isAccessedToday(item.lastAccessedDate, todayStr);
  if (currentlyAccessed) {
    return {
      ...item,
      lastAccessedDate: null,
      accessCount: Math.max(0, (item.accessCount || 1) - 1),
    };
  } else {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const localIso = `${todayStr}T${hours}:${minutes}:${seconds}.000Z`;

    const existingLogs = Array.isArray(item.accessLogs) ? item.accessLogs : [];
    const updatedLogs = [localIso, ...existingLogs.filter((l) => l !== localIso)].slice(0, 10);

    return {
      ...item,
      lastAccessedDate: localIso,
      accessLogs: updatedLogs,
      accessCount: (item.accessCount || 0) + 1,
    };
  }
}

/**
 * Resolves the favicon URL once at insertion time.
 * This stores the static icon URL permanently in the PWA object to prevent system overload.
 */
export function resolveFaviconAtInsertion(url: string, customIcon?: string, name?: string): string {
  if (customIcon && customIcon.trim().length > 0 && !customIcon.includes('/api/icon')) {
    return customIcon.trim();
  }

  let domain = '';
  if (url) {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = parsed.hostname.replace(/^www\./, '');
      if (domain.endsWith('com.com')) {
        domain = domain.slice(0, -7) + '.com';
      }
    } catch {
      // ignore
    }
  }

  // If no domain or placeholder domain, check if name contains a domain (e.g. 03win.com, 13E.COM)
  if ((!domain || domain === 'app.com' || domain === 'seu-app.com') && name) {
    const domainMatch = name.trim().match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/i);
    if (domainMatch) {
      domain = domainMatch[1].toLowerCase().replace(/^www\./, '');
    }
  }

  if (!domain) return '';

  // Use local smart proxy that validates image size and filters out 1478B gray placeholders
  const nameQuery = name ? `&name=${encodeURIComponent(name)}` : '';
  return `/api/icon?domain=${encodeURIComponent(domain)}${nameQuery}`;
}

/**
 * Backwards-compatible alias for resolveFaviconAtInsertion
 */
export const getFaviconUrl = resolveFaviconAtInsertion;

/**
 * Extracts a clean domain label from a URL
 */
export function getCleanDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    let domain = parsed.hostname.replace(/^www\./, '');
    if (domain.endsWith('com.com')) {
      domain = domain.slice(0, -7) + '.com';
    }
    return domain;
  } catch {
    return url;
  }
}

/**
 * Computes dashboard statistics for daily progress
 */
export function calculateStats(items: PWAItem[], todayStr: string = getTodayString()): PWAStats {
  const safeItems = Array.isArray(items) ? items.filter((it) => it && typeof it === 'object' && typeof it.name === 'string') : [];
  const total = safeItems.length;
  if (total === 0) {
    return {
      total: 0,
      accessedTodayCount: 0,
      pendingTodayCount: 0,
      completionPercentage: 0,
    };
  }

  let accessedCount = 0;
  for (const item of safeItems) {
    if (isAccessedToday(item.lastAccessedDate, todayStr)) {
      accessedCount++;
    }
  }

  const pendingCount = total - accessedCount;
  const percentage = Math.round((accessedCount / total) * 100);

  return {
    total,
    accessedTodayCount: accessedCount,
    pendingTodayCount: pendingCount,
    completionPercentage: percentage,
  };
}

/**
 * Normalizes text for resilient searching (lowercased, diacritics stripped, trimmed)
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Returns compact alphanumeric representation of text (e.g. "95-D" -> "95d")
 */
export function toCompactAlphaNumeric(text: string | null | undefined): string {
  if (!text) return '';
  return normalizeSearchText(text).replace(/[^a-z0-9]/g, '');
}

/**
 * Intelligent search matcher for PWA items
 */
export function matchesPWASearch(item: PWAItem, rawQuery: string): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;
  const qNorm = normalizeSearchText(rawQuery);
  const qCompact = toCompactAlphaNumeric(rawQuery);
  if (!qNorm) return true;

  const queryTokens = qNorm.split(/\s+/).filter(Boolean);
  const domain = getCleanDomain(item.url || '');

  const corpusParts: string[] = [
    item.name || '',
    item.url || '',
    domain,
    item.rawFileName || '',
    item.appId || '',
    item.profileDirectory || '',
    item.category || '',
    item.notes || '',
    ...(Array.isArray(item.aliases) ? item.aliases : []),
    ...(Array.isArray(item.mergedNames) ? item.mergedNames : []),
    ...(Array.isArray(item.mergedDesktopFiles) ? item.mergedDesktopFiles : []),
  ];

  const fullCorpusNorm = corpusParts.map(normalizeSearchText).join(' ');
  const fullCorpusCompact = corpusParts.map(toCompactAlphaNumeric).join(' ');

  // 1. All search tokens match in normalized text
  const allTokensMatch = queryTokens.every((token) => fullCorpusNorm.includes(token));
  if (allTokensMatch) return true;

  // 2. Compact alphanumeric match (e.g. "95D" matching "95-D" or "95d.desktop")
  if (qCompact.length >= 2 && fullCorpusCompact.includes(qCompact)) {
    return true;
  }

  return false;
}

/**
 * Filters and sorts PWA list
 */
export function filterAndSortPWAs(
  items: PWAItem[],
  options: {
    search?: string;
    category?: string;
    group?: string;
    folderFilter?: string;
    folderFilterIds?: Set<string>;
    validFolderIds?: Set<string>;
    statusFilter?: StatusFilter;
    starFilter?: string;
    flagFilters?: FlagFilterKey[];
    sortBy?: SortOption;
    todayStr?: string;
  }
): PWAItem[] {
  const safeItems = Array.isArray(items) ? items.filter((it) => it && typeof it === 'object' && typeof it.name === 'string') : [];
  const {
    search = '',
    category,
    group,
    folderFilter = 'all',
    folderFilterIds,
    validFolderIds,
    statusFilter = 'all',
    starFilter = 'all',
    flagFilters = [],
    sortBy = 'pinned',
    todayStr = getTodayString(),
  } = options;

  const targetGroup = group || category || 'all';

  return safeItems
    .filter((item) => {
      // Folder filter
      if (folderFilter && folderFilter !== 'all') {
        if (folderFilter === 'unfiled') {
          if (item.folderId && (!validFolderIds || validFolderIds.has(item.folderId))) {
            return false;
          }
        } else if (folderFilterIds) {
          if (!item.folderId || !folderFilterIds.has(item.folderId)) {
            return false;
          }
        } else if (item.folderId !== folderFilter) {
          return false;
        }
      }

      // Group/Category filter
      if (targetGroup !== 'all') {
        const itemGroup = item.group || item.category || 'Geral';
        if (itemGroup.toLowerCase() !== targetGroup.toLowerCase()) {
          return false;
        }
      }

      // Daily status filter
      if (statusFilter !== 'all') {
        const accessed = isAccessedToday(item.lastAccessedDate, todayStr);
        if (statusFilter === 'accessed' && !accessed) return false;
        if (statusFilter === 'pending' && accessed) return false;
      }

      // Star rating filter
      if (starFilter && starFilter !== 'all') {
        const rating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
        if (starFilter === '5' && rating !== 5) return false;
        if (starFilter === '4' && rating < 4) return false;
        if (starFilter === '3' && rating < 3) return false;
        if (starFilter === 'unrated' && rating > 0) return false;
      }

      // Custom icon flag filters (money, transfer arrows, gold bar)
      if (Array.isArray(flagFilters) && flagFilters.length > 0) {
        const flags = item.flags || {};
        const matchesAllSelectedFlags = flagFilters.every((flagKey) => Boolean(flags[flagKey]));
        if (!matchesAllSelectedFlags) {
          return false;
        }
      }

      // Intelligent multi-field search
      if (search && search.trim()) {
        if (!matchesPWASearch(item, search)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const ratingA = typeof a.rating === 'number' ? a.rating : (a.pinned ? 5 : 0);
      const ratingB = typeof b.rating === 'number' ? b.rating : (b.pinned ? 5 : 0);

      const accessedA = isAccessedToday(a.lastAccessedDate, todayStr);
      const accessedB = isAccessedToday(b.lastAccessedDate, todayStr);

      if (sortBy === 'pendingFirst') {
        if (accessedA !== accessedB) {
          return accessedA ? 1 : -1;
        }
        if (ratingA !== ratingB) {
          return ratingB - ratingA;
        }
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      }

      if (sortBy === 'pinned') {
        if (ratingA !== ratingB) {
          return ratingB - ratingA;
        }
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      }

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
        case 'category': {
          const groupA = a.group || a.category || 'Geral';
          const groupB = b.group || b.category || 'Geral';
          return (
            groupA.localeCompare(groupB, 'pt-BR', { sensitivity: 'base' }) ||
            a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
          );
        }
        case 'accessCount':
          return (b.accessCount || 0) - (a.accessCount || 0);
        case 'leastAccessed':
          return (a.accessCount || 0) - (b.accessCount || 0);
        case 'lastAccessed': {
          const timeA = a.lastAccessedDate ? new Date(a.lastAccessedDate).getTime() : 0;
          const timeB = b.lastAccessedDate ? new Date(b.lastAccessedDate).getTime() : 0;
          return timeB - timeA;
        }
        default:
          return 0;
      }
    });
}

/**
 * Validates and imports PWA items from JSON format
 */
export function importPWAsFromJson(rawJson: string): PWAItem[] {
  const parsed = JSON.parse(rawJson);
  const candidateList = Array.isArray(parsed) ? parsed : parsed.pwas || parsed.items;

  if (!Array.isArray(candidateList)) {
    throw new Error('Formato inválido: o JSON deve conter uma lista de PWAs.');
  }

  return candidateList
    .map((raw: unknown, idx: number): PWAItem | null => {
      if (typeof raw !== 'object' || raw === null) return null;
      const r = raw as Record<string, unknown>;
      const name = String(r.name || r.title || 'Sem título').trim();
      const url = String(r.url || r.link || '').trim();
      if (!url) return null;

      return {
        id: String(r.id || `pwa_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`),
        name,
        url: url.startsWith('http') ? url : `https://${url}`,
        category: String(r.group || r.category || 'Geral').trim(),
        group: String(r.group || r.category || 'Geral').trim(),
        folderId: typeof r.folderId === 'string' && r.folderId.trim() ? r.folderId.trim() : null,
        notes: String(r.notes || r.anotacoes || r.description || '').trim(),
        icon: typeof r.icon === 'string' && r.icon.trim()
          ? r.icon.trim()
          : resolveFaviconAtInsertion(url),
        lastAccessedDate: typeof r.lastAccessedDate === 'string' ? r.lastAccessedDate : null,
        accessCount: typeof r.accessCount === 'number' ? r.accessCount : 0,
        pinned: Boolean(r.pinned),
        flags:
          typeof r.flags === 'object' && r.flags !== null
            ? {
                money: Boolean((r.flags as PWAFlags).money),
                transfer: Boolean((r.flags as PWAFlags).transfer),
                gold: Boolean((r.flags as PWAFlags).gold),
              }
            : undefined,
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
      };
    })
    .filter((item): item is PWAItem => item !== null);
}

/**
 * Exports PWA items to a clean JSON string
 */
export function exportPWAsToJson(items: PWAItem[]): string {
  return JSON.stringify(items, null, 2);
}

export interface ChromeProfileDisplay {
  raw: string;
  profileNumber: string;
  shortLabel: string;
  badgeText: string;
  tooltip: string;
  isDefault: boolean;
}

/**
 * Extracts Chrome profile directory from explicit field, Chrome Exec command line, or filename/path.
 */
export function extractChromeProfileDirectory(item: {
  profileDirectory?: string;
  execLine?: string;
  rawFileName?: string;
  desktopPath?: string;
}): string | undefined {
  if (!item) return undefined;

  if (item.profileDirectory && item.profileDirectory.trim()) {
    return item.profileDirectory.trim();
  }

  if (item.execLine) {
    const execMatch = item.execLine.match(/--profile-directory=(?:["']([^"']+)["']|([^\s"']+))/i);
    const extracted = (execMatch?.[1] || execMatch?.[2] || '').trim();
    if (extracted) return extracted;
  }

  const fileCandidates = [item.rawFileName, item.desktopPath].filter(Boolean) as string[];
  for (const candidate of fileCandidates) {
    const fnMatch = candidate.match(/Profile[_\s]?(\d+)|(Default)/i);
    if (fnMatch) {
      if (fnMatch[2]) return 'Default';
      if (fnMatch[1]) return `Profile ${fnMatch[1]}`;
    }
  }

  return undefined;
}

/**
 * Formats Chrome profile identifier for compact display beside PWA star ratings.
 * Examples:
 * - "Profile 5" -> badgeText: "Perfil 5", shortLabel: "P5", profileNumber: "5"
 * - "Default"   -> badgeText: "Default", shortLabel: "Default", profileNumber: "0"
 */
export function formatChromeProfileDisplay(item: {
  profileDirectory?: string;
  execLine?: string;
  rawFileName?: string;
  desktopPath?: string;
}): ChromeProfileDisplay | null {
  const raw = extractChromeProfileDirectory(item);
  if (!raw) return null;

  const clean = raw.trim();
  if (!clean) return null;

  if (/^default$/i.test(clean) || /^padr[aã]o$/i.test(clean)) {
    return {
      raw: clean,
      profileNumber: '0',
      shortLabel: 'Default',
      badgeText: 'Default',
      tooltip: `Perfil do Chrome: ${clean} (Padrão)`,
      isDefault: true,
    };
  }

  const numMatch = clean.match(/^(?:profile|perfil)?[_\s-]*(\d+)$/i);
  if (numMatch) {
    const num = numMatch[1];
    return {
      raw: clean,
      profileNumber: num,
      shortLabel: `P${num}`,
      badgeText: `Perfil ${num}`,
      tooltip: `Perfil do Chrome: ${clean}`,
      isDefault: false,
    };
  }

  return {
    raw: clean,
    profileNumber: clean,
    shortLabel: clean,
    badgeText: clean,
    tooltip: `Perfil do Chrome: ${clean}`,
    isDefault: false,
  };
}

/**
 * Toggles a specific boolean flag (money, transfer, gold) on a PWA item immutably.
 */
export function togglePWAFlag(item: PWAItem, flag: FlagFilterKey): PWAItem {
  const currentFlags = item.flags || {};
  const nextFlags: PWAFlags = {
    ...currentFlags,
    [flag]: !Boolean(currentFlags[flag]),
  };
  return {
    ...item,
    flags: nextFlags,
  };
}

/**
 * Counts how many PWAs have each flag enabled.
 */
export function countPWAFlags(items: PWAItem[]): Record<FlagFilterKey, number> {
  const counts: Record<FlagFilterKey, number> = {
    money: 0,
    transfer: 0,
    gold: 0,
  };
  for (const it of items) {
    if (!it || !it.flags) continue;
    if (it.flags.money) counts.money++;
    if (it.flags.transfer) counts.transfer++;
    if (it.flags.gold) counts.gold++;
  }
  return counts;
}

export interface ChromeProfileOption {
  directory: string;
  displayName?: string;
}

/**
 * Normalizes a user-supplied Chrome profile input into Chrome's `--profile-directory` format.
 * Examples:
 * - "5" -> "Profile 5"
 * - "perfil 3" -> "Profile 3"
 * - "default" -> "Default"
 * - "Profile 2" -> "Profile 2"
 */
export function normalizeChromeProfileInput(rawInput: string): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';
  if (/^(default|padr[aã]o)$/i.test(trimmed)) return 'Default';
  const numOnly = trimmed.match(/^(?:(?:profile|perfil)[_\s-]*)?(\d+)$/i);
  if (numOnly) {
    return `Profile ${numOnly[1]}`;
  }
  return trimmed;
}

/**
 * Strips any trailing profile suffix like " (Perfil 2)" or " (Default)" from a PWA name
 * so repeated clones don't stack suffixes.
 */
export function stripProfileSuffixFromName(name: string): string {
  return (name || '').replace(/\s*\((?:Perfil\s+\d+|Default|Profile\s+\d+)\)\s*$/i, '').trim();
}

/**
 * Creates an independent clone of a PWA item bound to a target Chrome profile directory.
 * Clears `.desktop`-hardcoded paths (`rawFileName`, `desktopPath`, `execLine`, `appId`)
 * so launches open directly with `--profile-directory="<target>" --app="<url>"`.
 */
export function clonePWAForProfile(
  source: PWAItem,
  options: {
    profileDirectory: string;
    name?: string;
    copyNotesAndFlags?: boolean;
    keepFolderAndGroup?: boolean;
    now?: Date;
  }
): PWAItem {
  const normalizedProfile = normalizeChromeProfileInput(options.profileDirectory);
  if (!normalizedProfile) {
    throw new Error('Perfil do navegador inválido para clonagem.');
  }

  const now = options.now || new Date();
  const display = formatChromeProfileDisplay({ profileDirectory: normalizedProfile });
  const baseName = stripProfileSuffixFromName(source.name) || source.name;
  const targetName =
    options.name && options.name.trim()
      ? options.name.trim()
      : `${baseName} (${display?.badgeText || normalizedProfile})`;

  const copyNotesAndFlags = options.copyNotesAndFlags !== false;
  const keepFolderAndGroup = options.keepFolderAndGroup !== false;
  const groupName = keepFolderAndGroup ? (source.group || source.category || 'Geral') : 'Geral';

  return {
    id: `pwa_clone_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`,
    clonedFromId: source.id,
    name: targetName,
    url: source.url,
    icon: source.icon || resolveFaviconAtInsertion(source.url, undefined, baseName),
    category: groupName,
    group: groupName,
    folderId: keepFolderAndGroup ? (source.folderId ?? null) : null,
    notes: copyNotesAndFlags ? (source.notes || '') : '',
    flags: copyNotesAndFlags && source.flags ? { ...source.flags } : undefined,
    rating: typeof source.rating === 'number' ? source.rating : (source.pinned ? 5 : 0),
    pinned: Boolean(source.pinned || (source.rating && source.rating > 0)),
    profileDirectory: normalizedProfile,
    aliases: Array.isArray(source.aliases) ? [...source.aliases] : undefined,
    lastAccessedDate: null,
    accessLogs: [],
    accessCount: 0,
    createdAt: now.toISOString(),
  };
}

/**
 * Builds a deduplicated, naturally sorted list of Chrome profile choices from:
 * - Local OS discovered Chrome profiles
 * - Profiles already detected in the user's PWAs
 * - Standard Chrome profile slots (Default, Profile 1..8)
 */
export function buildAvailableChromeProfiles(
  items: PWAItem[],
  discovered: ChromeProfileOption[] = []
): ChromeProfileOption[] {
  const map = new Map<string, ChromeProfileOption>();

  const upsert = (directory: string, displayName?: string) => {
    const normalized = normalizeChromeProfileInput(directory);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { directory: normalized, displayName: displayName?.trim() || undefined });
    } else if (displayName?.trim() && !existing.displayName) {
      map.set(key, { directory: existing.directory, displayName: displayName.trim() });
    }
  };

  for (const prof of discovered) {
    if (prof?.directory) upsert(prof.directory, prof.displayName);
  }

  for (const item of items) {
    const dir = extractChromeProfileDirectory(item);
    if (dir) upsert(dir);
  }

  const defaults = ['Default', 'Profile 1', 'Profile 2', 'Profile 3', 'Profile 4', 'Profile 5', 'Profile 6', 'Profile 7', 'Profile 8'];
  for (const def of defaults) {
    upsert(def);
  }

  return Array.from(map.values()).sort((a, b) => {
    const aDef = a.directory.toLowerCase() === 'default';
    const bDef = b.directory.toLowerCase() === 'default';
    if (aDef !== bDef) return aDef ? -1 : 1;

    const aNum = a.directory.match(/^profile\s+(\d+)$/i);
    const bNum = b.directory.match(/^profile\s+(\d+)$/i);
    if (aNum && bNum) return Number(aNum[1]) - Number(bNum[1]);
    if (aNum) return -1;
    if (bNum) return 1;

    return a.directory.localeCompare(b.directory, 'pt-BR', { sensitivity: 'base' });
  });
}
