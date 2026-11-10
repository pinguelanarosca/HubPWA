import { PWAItem, PWAStats, SortOption, StatusFilter } from '../types/pwa';

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
  a: { id?: string; appId?: string; url?: string; rawFileName?: string; desktopPath?: string; name?: string },
  b: { id?: string; appId?: string; url?: string; rawFileName?: string; desktopPath?: string; name?: string }
): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
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
export function resolveFaviconAtInsertion(url: string, customIcon?: string): string {
  if (customIcon && customIcon.trim().length > 0) {
    return customIcon.trim();
  }
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const domain = parsed.hostname.replace(/^www\./, '');
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return '';
  }
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
    return parsed.hostname.replace(/^www\./, '');
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
    statusFilter?: StatusFilter;
    starFilter?: string;
    sortBy?: SortOption;
    todayStr?: string;
  }
): PWAItem[] {
  const safeItems = Array.isArray(items) ? items.filter((it) => it && typeof it === 'object' && typeof it.name === 'string') : [];
  const {
    search = '',
    category,
    group,
    statusFilter = 'all',
    starFilter = 'all',
    sortBy = 'pinned',
    todayStr = getTodayString(),
  } = options;

  const targetGroup = group || category || 'all';

  return safeItems
    .filter((item) => {
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
        notes: String(r.notes || r.anotacoes || r.description || '').trim(),
        icon: typeof r.icon === 'string' && r.icon.trim()
          ? r.icon.trim()
          : resolveFaviconAtInsertion(url),
        lastAccessedDate: typeof r.lastAccessedDate === 'string' ? r.lastAccessedDate : null,
        accessCount: typeof r.accessCount === 'number' ? r.accessCount : 0,
        pinned: Boolean(r.pinned),
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
