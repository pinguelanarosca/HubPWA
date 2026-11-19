import { DailyFlagKey, DailyFlagState, FlagFilterKey, PWAFlags, PWAItem, PWAStats, SortOption, StatusFilter } from '../types/pwa';

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
  const updatedLogs = [localIso, ...existingLogs.filter((l) => l !== localIso)].slice(0, 60);

  const existingHistory = Array.isArray(item.accessHistory) ? item.accessHistory : [];
  const updatedHistory = [
    {
      timestamp: localIso,
      source: 'hub' as const,
      profileDirectory: item.profileDirectory,
      visitedUrl: item.url,
    },
    ...existingHistory.filter((h) => h && h.timestamp !== localIso),
  ].slice(0, 80);

  return {
    ...item,
    lastAccessedDate: localIso,
    accessLogs: updatedLogs,
    accessHistory: updatedHistory,
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
    const updatedLogs = [localIso, ...existingLogs.filter((l) => l !== localIso)].slice(0, 60);

    const existingHistory = Array.isArray(item.accessHistory) ? item.accessHistory : [];
    const updatedHistory = [
      {
        timestamp: localIso,
        source: 'hub' as const,
        profileDirectory: item.profileDirectory,
        visitedUrl: item.url,
      },
      ...existingHistory.filter((h) => h && h.timestamp !== localIso),
    ].slice(0, 80);

    return {
      ...item,
      lastAccessedDate: localIso,
      accessLogs: updatedLogs,
      accessHistory: updatedHistory,
      accessCount: (item.accessCount || 0) + 1,
    };
  }
}

/**
 * Detects legacy generic-prone third-party favicon URLs that frequently serve monochrome letter placeholders
 */
export function isDeprecatedGenericIconUrl(iconUrl?: string | null): boolean {
  if (!iconUrl || !iconUrl.trim()) return false;
  const lower = iconUrl.trim().toLowerCase();
  return (
    lower.includes('google.com/s2/favicons') ||
    lower.includes('gstatic.com/faviconv2') ||
    lower.includes('icons.duckduckgo.com')
  );
}

/**
 * Returns true if an icon URL represents an explicit custom image/URL or a web-resolved /api/icon?domain=...
 * reference that should be preserved across local .desktop rescans (never overwritten by chrome-* paths).
 */
export function isPreservableIconUrl(iconUrl?: string | null): boolean {
  if (!iconUrl || !iconUrl.trim()) return false;
  const clean = iconUrl.trim();
  if (isDeprecatedGenericIconUrl(clean)) return false;
  if (clean.startsWith('data:')) return true;
  if (clean.startsWith('http://') || clean.startsWith('https://')) return true;
  if (clean.includes('/api/icon')) {
    return (
      clean.includes('domain=') &&
      !clean.includes('name=chrome-') &&
      !clean.includes('path=')
    );
  }
  return false;
}

/**
 * Detects whether a local icon candidate name/path refers to Chrome's auto-generated shortcut icon
 */
export function isChromeShortcutLocalCandidate(cand?: string | null): boolean {
  if (!cand) return false;
  const lower = cand.trim().toLowerCase();
  return (
    /(?:^|[\\/=?&])chrome-/i.test(lower) ||
    /(?:^|[\\/_-])profile[_\s-]?\d+/i.test(lower) ||
    /[-_]default(?:\.\w+)?$/i.test(lower) ||
    lower.includes('web applications') ||
    lower.includes('google-chrome')
  );
}

/**
 * Returns true if a stored icon URL points to a Chrome shortcut local reference (/api/icon?name=chrome-... or path=...)
 * while a real web domain exists to resolve an authentic web logo instead.
 */
export function shouldUpgradeChromeShortcutIcon(iconUrl?: string | null, appUrl?: string | null): boolean {
  if (!iconUrl || !iconUrl.trim()) return false;
  const clean = iconUrl.trim();
  if (!clean.includes('/api/icon')) return false;
  const isLegacyChromeRef =
    clean.includes('name=chrome-') ||
    clean.includes('path=') ||
    (!clean.includes('domain=') && isChromeShortcutLocalCandidate(clean));
  if (!isLegacyChromeRef) return false;

  if (!appUrl || !appUrl.trim()) return false;
  const domain = getCleanDomain(appUrl).trim().toLowerCase();
  return Boolean(
    domain &&
      domain.includes('.') &&
      domain !== 'app.com' &&
      domain !== 'seu-app.com' &&
      !domain.includes('localhost')
  );
}

/**
 * Appends or replaces a cache-busting `&v=<token>` query param on non-data-URI icon URLs.
 */
export function appendCacheBuster(iconUrl: string, token: string | number): string {
  if (!iconUrl || !iconUrl.trim()) return '';
  const clean = iconUrl.trim();
  if (clean.startsWith('data:')) return clean;

  const stripped = clean
    .replace(/([?&])v=[^&]*&?/g, '$1')
    .replace(/([?&])refresh=[^&]*&?/g, '$1')
    .replace(/[?&]$/, '');

  const separator = stripped.includes('?') ? '&' : '?';
  return `${stripped}${separator}v=${encodeURIComponent(String(token))}`;
}

/**
 * Extracts ordered icon candidate URLs (apple-touch-icon, link icon, og:image) from HTML regardless of attribute order.
 */
export function extractHtmlIconCandidates(html: string, domain: string): string[] {
  if (!html || !domain) return [];
  const rawHrefs: string[] = [];

  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  const appleLinks: string[] = [];
  const standardLinks: string[] = [];

  for (const tag of linkTags) {
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']+)["']/i);
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!relMatch || !hrefMatch) continue;
    const rel = relMatch[1].toLowerCase();
    const href = hrefMatch[1].trim();
    if (!href || href.startsWith('data:text')) continue;
    if (rel.includes('apple-touch-icon')) {
      appleLinks.push(href);
    } else if (/\bicon\b/i.test(rel)) {
      standardLinks.push(href);
    }
  }

  rawHrefs.push(...appleLinks, ...standardLinks);

  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const propMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (!propMatch || !contentMatch) continue;
    const prop = propMatch[1].toLowerCase();
    if (prop === 'og:image' || prop === 'twitter:image') {
      rawHrefs.push(contentMatch[1].trim());
    }
  }

  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const rawHref of rawHrefs) {
    let absUrl = '';
    if (rawHref.startsWith('http://') || rawHref.startsWith('https://') || rawHref.startsWith('data:image')) {
      absUrl = rawHref;
    } else if (rawHref.startsWith('//')) {
      absUrl = `https:${rawHref}`;
    } else if (rawHref.startsWith('/')) {
      absUrl = `https://${domain}${rawHref}`;
    } else {
      absUrl = `https://${domain}/${rawHref.replace(/^\.\//, '')}`;
    }
    if (absUrl && !seen.has(absUrl)) {
      seen.add(absUrl);
      resolved.push(absUrl);
    }
  }
  return resolved;
}

/**
 * Resolves the favicon URL once at insertion time.
 * This stores the static icon URL permanently in the PWA object to prevent system overload.
 */
export function resolveFaviconAtInsertion(url: string, customIcon?: string, name?: string): string {
  if (
    customIcon &&
    customIcon.trim().length > 0 &&
    !customIcon.includes('/api/icon') &&
    !isDeprecatedGenericIconUrl(customIcon)
  ) {
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

  // Use local smart proxy that validates image size and filters out generic letter placeholders
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

      // Custom bottom markings filter ($ Date, COM, RD, IRB)
      if (Array.isArray(flagFilters) && flagFilters.length > 0) {
        const matchesAllSelectedFlags = flagFilters.every((flagKey) =>
          isPWAFlagActive(item, flagKey, todayStr)
        );
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
            ? migratePWAFlags(r.flags as Record<string, unknown>)
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
 * Sanitizes live typing inside a DD/MM day/month field without fighting backspace.
 * Auto-inserts "/" after 2 digits when typing a 3rd digit (e.g. "1611" -> "16/11").
 */
export function sanitizeDayMonthTyping(raw: string): string {
  const cleaned = (raw || '').replace(/[^\d/]/g, '');
  if (!cleaned) return '';

  const slashIdx = cleaned.indexOf('/');
  if (slashIdx === -1) {
    const digits = cleaned.slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
    }
    return digits;
  }

  const dayPart = cleaned.slice(0, slashIdx).replace(/\//g, '').slice(0, 2);
  const monthPart = cleaned.slice(slashIdx + 1).replace(/\//g, '').slice(0, 2);
  return `${dayPart}/${monthPart}`;
}

/**
 * Normalizes and clamps a DD/MM string on blur (e.g. "5/9" -> "05/09", "35/15" -> "31/12").
 */
export function normalizeDayMonthOnBlur(raw: string): string {
  const sanitized = sanitizeDayMonthTyping(raw).trim();
  if (!sanitized) return '';

  let dayStr = '';
  let monthStr = '';

  if (sanitized.includes('/')) {
    const [d, m] = sanitized.split('/');
    dayStr = d || '';
    monthStr = m || '';
  } else if (sanitized.length === 4) {
    dayStr = sanitized.slice(0, 2);
    monthStr = sanitized.slice(2, 4);
  } else {
    dayStr = sanitized.slice(0, 2);
  }

  if (dayStr) {
    let dNum = parseInt(dayStr, 10);
    if (!isNaN(dNum)) {
      if (dNum < 1) dNum = 1;
      if (dNum > 31) dNum = 31;
      dayStr = monthStr ? String(dNum).padStart(2, '0') : dayStr.length === 2 ? String(dNum).padStart(2, '0') : dayStr;
    }
  }

  if (monthStr) {
    let mNum = parseInt(monthStr, 10);
    if (!isNaN(mNum)) {
      if (mNum < 1) mNum = 1;
      if (mNum > 12) mNum = 12;
      monthStr = String(mNum).padStart(2, '0');
    }
    return `${(dayStr || '01').padStart(2, '0')}/${monthStr}`;
  }

  return dayStr;
}

const DAILY_FLAG_FIELD_MAP: Record<
  DailyFlagKey,
  {
    dateField: 'comDate' | 'rbDate' | 'bonDate';
    stateField: 'comState' | 'rbState' | 'bonState';
  }
> = {
  com: { dateField: 'comDate', stateField: 'comState' },
  rb: { dateField: 'rbDate', stateField: 'rbState' },
  bon: { dateField: 'bonDate', stateField: 'bonState' },
};

function normalizeDailyFlagState(raw: unknown): DailyFlagState | null | undefined {
  if (raw === 'check' || raw === 'x') return raw;
  if (raw === null) return null;
  return undefined;
}

/**
 * Normalizes and migrates legacy rdDate/irbDate fields to rbDate/bonDate cleanly.
 */
export function migratePWAFlags(rawFlags?: Record<string, unknown> | null): PWAFlags | undefined {
  if (!rawFlags || typeof rawFlags !== 'object') return undefined;
  const f = rawFlags as Record<string, unknown>;
  const result: PWAFlags = {};

  if (typeof f.moneyDate === 'string' && f.moneyDate.trim()) {
    result.moneyDate = normalizeDayMonthOnBlur(f.moneyDate);
  }
  if (f.comDate !== undefined) {
    result.comDate = f.comDate ? String(f.comDate) : null;
  }
  const comState = normalizeDailyFlagState(f.comState);
  if (comState !== undefined) {
    result.comState = comState;
  }

  const rbRaw = f.rbDate !== undefined ? f.rbDate : f.rdDate;
  if (rbRaw !== undefined) {
    result.rbDate = rbRaw ? String(rbRaw) : null;
  }
  const rbState = normalizeDailyFlagState(f.rbState !== undefined ? f.rbState : f.rdState);
  if (rbState !== undefined) {
    result.rbState = rbState;
  }

  const bonRaw = f.bonDate !== undefined ? f.bonDate : f.irbDate;
  if (bonRaw !== undefined) {
    result.bonDate = bonRaw ? String(bonRaw) : null;
  }
  const bonState = normalizeDailyFlagState(f.bonState !== undefined ? f.bonState : f.irbState);
  if (bonState !== undefined) {
    result.bonState = bonState;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Returns the active daily state ('check' | 'x' | null) for COM, RB, or BON on `todayStr`.
 * Automatically resets to null at midnight rollover. Legacy records with `comDate === todayStr`
 * and no explicit `comState` smoothly resolve as 'check'.
 */
export function getPWAFlagState(
  item: Pick<PWAItem, 'flags'> | undefined,
  flag: DailyFlagKey,
  todayStr: string = getTodayString()
): DailyFlagState | null {
  const flags = item?.flags;
  if (!flags) return null;
  const { dateField, stateField } = DAILY_FLAG_FIELD_MAP[flag];
  const storedDate = flags[dateField];
  if (!storedDate || storedDate.trim() !== todayStr) {
    return null;
  }
  const storedState = flags[stateField];
  return storedState === 'x' ? 'x' : 'check';
}

/**
 * Checks whether a PWA flag or DD/MM date marking is active for the given local day (`todayStr`).
 * - `moneyDate`: active whenever a non-empty DD/MM date is filled (never resets at midnight).
 * - `com`, `rb`, `bon`: active when either green check ('check') or red X ('x') is selected today.
 * - `com:check` / `com:x` (etc.): active only when that exact state is selected today.
 */
export function isPWAFlagActive(
  item: Pick<PWAItem, 'flags'> | undefined,
  flag: FlagFilterKey,
  todayStr: string = getTodayString()
): boolean {
  const flags = item?.flags;
  if (!flags) return false;
  if (flag === 'moneyDate') {
    return Boolean(flags.moneyDate && flags.moneyDate.trim().length > 0);
  }
  if (flag.includes(':')) {
    const [baseFlag, targetState] = flag.split(':') as [DailyFlagKey, DailyFlagState];
    return getPWAFlagState(item, baseFlag, todayStr) === targetState;
  }
  return getPWAFlagState(item, flag as DailyFlagKey, todayStr) !== null;
}

/**
 * Toggles or sets a daily-resetting selection (`com`, `rb`, `bon`) for `todayStr`.
 * Clicking the currently active state ('check' or 'x') clears it back to null (optional).
 */
export function togglePWAFlag(
  item: PWAItem,
  flag: DailyFlagKey,
  todayStr: string = getTodayString(),
  targetState?: DailyFlagState | null
): PWAItem {
  const { dateField, stateField } = DAILY_FLAG_FIELD_MAP[flag];
  const currentFlags = item.flags || {};
  const currentState = getPWAFlagState(item, flag, todayStr);

  let nextDate: string | null = null;
  let nextState: DailyFlagState | null = null;

  if (targetState === null) {
    nextDate = null;
    nextState = null;
  } else {
    const desired: DailyFlagState = targetState ?? 'check';
    if (currentState === desired) {
      // Optional toggle-off when clicking the already-selected icon
      nextDate = null;
      nextState = null;
    } else {
      nextDate = todayStr;
      nextState = desired;
    }
  }

  const nextFlags: PWAFlags = {
    ...currentFlags,
    [dateField]: nextDate,
    [stateField]: nextState,
  };
  return {
    ...item,
    flags: nextFlags,
  };
}

/**
 * Updates the persistent DD/MM date field next to the green dollar icon.
 */
export function updatePWAMoneyDate(item: PWAItem, moneyDate: string): PWAItem {
  const currentFlags = item.flags || {};
  return {
    ...item,
    flags: {
      ...currentFlags,
      moneyDate,
    },
  };
}

export interface DailyFlagBreakdown {
  total: number;
  check: number;
  x: number;
}

export interface PWAFlagBreakdown {
  moneyDate: number;
  com: DailyFlagBreakdown;
  rb: DailyFlagBreakdown;
  bon: DailyFlagBreakdown;
}

/**
 * Counts active markings (both total and check/x breakdown) across PWAs for `todayStr`.
 */
export function countPWAFlagBreakdown(
  items: PWAItem[],
  todayStr: string = getTodayString()
): PWAFlagBreakdown {
  const counts: PWAFlagBreakdown = {
    moneyDate: 0,
    com: { total: 0, check: 0, x: 0 },
    rb: { total: 0, check: 0, x: 0 },
    bon: { total: 0, check: 0, x: 0 },
  };
  for (const it of items) {
    if (!it || !it.flags) continue;
    if (isPWAFlagActive(it, 'moneyDate', todayStr)) counts.moneyDate++;
    (['com', 'rb', 'bon'] as DailyFlagKey[]).forEach((key) => {
      const st = getPWAFlagState(it, key, todayStr);
      if (st === 'check') {
        counts[key].total++;
        counts[key].check++;
      } else if (st === 'x') {
        counts[key].total++;
        counts[key].x++;
      }
    });
  }
  return counts;
}

/**
 * Counts active markings across PWAs for the given local day (`todayStr`).
 */
export function countPWAFlags(
  items: PWAItem[],
  todayStr: string = getTodayString()
): Record<'moneyDate' | DailyFlagKey, number> {
  const breakdown = countPWAFlagBreakdown(items, todayStr);
  return {
    moneyDate: breakdown.moneyDate,
    com: breakdown.com.total,
    rb: breakdown.rb.total,
    bon: breakdown.bon.total,
  };
}

/**
 * Computes milliseconds remaining until the next local midnight (+100ms buffer).
 */
export function getMsUntilNextMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    100
  );
  return Math.max(1000, nextMidnight.getTime() - now.getTime());
}

/**
 * Returns the list of PWAs eligible for "Selecionar todas" in the active context:
 * - In 'folders' mode inside a folder: ONLY PWAs directly inside that folder.
 * - In 'folders' mode at root: ONLY unfiled PWAs ("PWAs sem pasta").
 * - In other modes ('cards', 'compact-table', 'dense-grid'): the currently filtered displayedItems.
 */
export function getScopedSelectableItems(
  displayedItems: PWAItem[],
  options: {
    density: string;
    folders: Array<{ id: string }>;
    currentFolderId: string | null;
  }
): PWAItem[] {
  if (options.density !== 'folders') {
    return displayedItems;
  }
  const validFolderIds = new Set(options.folders.map((f) => f.id));
  if (options.currentFolderId && validFolderIds.has(options.currentFolderId)) {
    return displayedItems.filter((it) => it.folderId === options.currentFolderId);
  }
  return displayedItems.filter((it) => !it.folderId || !validFolderIds.has(it.folderId));
}

/**
 * Bulk sets star rating (0..5) on target PWA IDs. Rating 0 clears stars and pinned flag.
 */
export function batchSetRating(
  items: PWAItem[],
  targetIds: Set<string>,
  rating: number
): PWAItem[] {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return items.map((it) => {
    if (!targetIds.has(it.id)) return it;
    return {
      ...it,
      rating: clamped,
      pinned: clamped > 0,
    };
  });
}

/**
 * Bulk sets daily status ('accessed', 'pending', or 'toggle') on target PWA IDs.
 */
export function batchSetStatus(
  items: PWAItem[],
  targetIds: Set<string>,
  mode: 'accessed' | 'pending' | 'toggle',
  now: Date = new Date(),
  todayStr: string = getTodayString(now)
): PWAItem[] {
  return items.map((it) => {
    if (!targetIds.has(it.id)) return it;
    if (mode === 'toggle') {
      return toggleAccessedToday(it, todayStr);
    }
    if (mode === 'accessed') {
      return isAccessedToday(it.lastAccessedDate, todayStr)
        ? it
        : markAsAccessed(it, now, todayStr);
    }
    // mode === 'pending'
    return {
      ...it,
      lastAccessedDate: null,
    };
  });
}

/**
 * Bulk sets or clears a daily flag ('com', 'rb', 'bon') on target PWA IDs.
 * Supports `true` (defaults to 'check'), `'check'`, `'x'`, `false`, or `null`.
 */
export function batchSetDailyFlag(
  items: PWAItem[],
  targetIds: Set<string>,
  flag: DailyFlagKey,
  activeOrState: boolean | DailyFlagState | null,
  todayStr: string = getTodayString()
): PWAItem[] {
  const { dateField, stateField } = DAILY_FLAG_FIELD_MAP[flag];
  const resolvedState: DailyFlagState | null =
    activeOrState === true
      ? 'check'
      : activeOrState === false || activeOrState === null
      ? null
      : activeOrState;

  return items.map((it) => {
    if (!targetIds.has(it.id)) return it;
    return {
      ...it,
      flags: {
        ...(it.flags || {}),
        [dateField]: resolvedState ? todayStr : null,
        [stateField]: resolvedState,
      },
    };
  });
}

/**
 * Bulk clears daily selections (COM, RB, BON) and/or permanent moneyDate on target PWA IDs.
 */
export function batchClearFlags(
  items: PWAItem[],
  targetIds: Set<string>,
  options: { clearDaily?: boolean; clearMoneyDate?: boolean } = { clearDaily: true, clearMoneyDate: false }
): PWAItem[] {
  return items.map((it) => {
    if (!targetIds.has(it.id)) return it;
    const prev = it.flags || {};
    return {
      ...it,
      flags: {
        ...prev,
        ...(options.clearDaily
          ? { comDate: null, comState: null, rbDate: null, rbState: null, bonDate: null, bonState: null }
          : {}),
        ...(options.clearMoneyDate ? { moneyDate: '' } : {}),
      },
    };
  });
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
