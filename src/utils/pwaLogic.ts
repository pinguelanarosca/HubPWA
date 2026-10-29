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
    return {
      ...item,
      lastAccessedDate: new Date().toISOString(),
      accessCount: (item.accessCount || 0) + 1,
    };
  }
}

/**
 * Resolves reliable icon URL for a PWA
 */
export function getFaviconUrl(url: string, customIcon?: string): string {
  if (customIcon && customIcon.trim().length > 0) {
    return customIcon.trim();
  }
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`;
  } catch {
    return '';
  }
}

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
  const total = items.length;
  if (total === 0) {
    return {
      total: 0,
      accessedTodayCount: 0,
      pendingTodayCount: 0,
      completionPercentage: 0,
    };
  }

  let accessedCount = 0;
  for (const item of items) {
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
  const {
    search = '',
    category = 'all',
    statusFilter = 'all',
    sortBy = 'pinned',
    todayStr = getTodayString(),
  } = options;

  const normalizedSearch = search.trim().toLowerCase();

  return items
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

      // Search query (matches name, url, category, notes)
      if (normalizedSearch) {
        const inName = item.name.toLowerCase().includes(normalizedSearch);
        const inUrl = item.url.toLowerCase().includes(normalizedSearch);
        const inCategory = item.category.toLowerCase().includes(normalizedSearch);
        const inNotes = item.notes.toLowerCase().includes(normalizedSearch);
        if (!inName && !inUrl && !inCategory && !inNotes) {
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
        icon: typeof r.icon === 'string' && r.icon.trim() ? r.icon.trim() : undefined,
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
