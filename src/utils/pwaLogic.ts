import { PWAItem, PWAStats, SortOption, StatusFilter } from '../types/pwa';

/**
 * Returns the current date in YYYY-MM-DD local format
 */
export function getTodayString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether the PWA was accessed today (returns true for GREEN, false for RED)
 */
export function isAccessedToday(
  lastAccessedDate: string | null | undefined,
  todayStr: string = getTodayString()
): boolean {
  if (!lastAccessedDate) return false;
  // Compare date prefix (YYYY-MM-DD)
  const datePrefix = lastAccessedDate.slice(0, 10);
  return datePrefix === todayStr;
}

/**
 * Marks a PWA item as accessed today
 */
export function markAsAccessed(item: PWAItem, now: Date = new Date()): PWAItem {
  return {
    ...item,
    lastAccessedDate: now.toISOString(),
    accessCount: (item.accessCount || 0) + 1,
  };
}

/**
 * Toggles a PWA's daily access state (accessed <-> pending)
 */
export function toggleAccessedToday(item: PWAItem, todayStr: string = getTodayString()): PWAItem {
  const currentlyAccessed = isAccessedToday(item.lastAccessedDate, todayStr);
  if (currentlyAccessed) {
    return {
      ...item,
      lastAccessedDate: null,
      accessCount: Math.max(0, (item.accessCount || 1) - 1),
    };
  } else {
    const timeSuffix = new Date().toISOString().slice(10);
    return {
      ...item,
      lastAccessedDate: `${todayStr}${timeSuffix}`,
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
    statusFilter?: StatusFilter;
    sortBy?: SortOption;
    todayStr?: string;
  }
): PWAItem[] {
  const safeItems = Array.isArray(items) ? items.filter((it) => it && typeof it === 'object' && typeof it.name === 'string') : [];
  const {
    search = '',
    category = 'all',
    statusFilter = 'all',
    sortBy = 'pinned',
    todayStr = getTodayString(),
  } = options;

  return safeItems
    .filter((item) => {
      // Category filter
      if (category !== 'all' && item.category.toLowerCase() !== category.toLowerCase()) {
        return false;
      }

      // Daily status filter
      if (statusFilter !== 'all') {
        const accessed = isAccessedToday(item.lastAccessedDate, todayStr);
        if (statusFilter === 'accessed' && !accessed) return false;
        if (statusFilter === 'pending' && accessed) return false;
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
      // Pinned items always have higher priority if sortBy is 'pinned' or default
      if (sortBy === 'pinned') {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      }

      // Keep pinned on top for other sorts too, or purely sort by criteria
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
        case 'category':
          return (
            a.category.localeCompare(b.category, 'pt-BR', { sensitivity: 'base' }) ||
            a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
          );
        case 'accessCount':
          return (b.accessCount || 0) - (a.accessCount || 0);
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
        category: String(r.category || 'Geral').trim(),
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
