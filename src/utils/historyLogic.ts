import { AccessHistoryEntry, PWAItem } from '../types/pwa';
import { formatAccessDateTime, getCleanDomain, getTodayString, normalizeChromeProfileInput } from './pwaLogic';

const CHROME_EPOCH_OFFSET_MS = 11644473600000;

/**
 * Formats a Date into local wall-clock ISO string matching HubPWA's access log format (`YYYY-MM-DDTHH:mm:ss.000Z`).
 */
export function formatDateToLocalLogIso(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}.000Z`;
}

/**
 * Converts Chrome/WebKit History microsecond timestamp (since 1601-01-01 UTC) to JS Date or null.
 */
export function chromeWebkitTimeToDate(webkitMicros: number): Date | null {
  if (typeof webkitMicros !== 'number' || !Number.isFinite(webkitMicros) || webkitMicros <= 0) {
    return null;
  }
  const unixMs = Math.floor(webkitMicros / 1000 - CHROME_EPOCH_OFFSET_MS);
  if (!Number.isFinite(unixMs) || unixMs <= 0) return null;
  const d = new Date(unixMs);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parses Chrome/WebKit timestamp into HubPWA local ISO string (`YYYY-MM-DDTHH:mm:ss.000Z`).
 */
export function chromeWebkitTimeToLocalIso(webkitMicros: number): string {
  const d = chromeWebkitTimeToDate(webkitMicros);
  return d ? formatDateToLocalLogIso(d) : '';
}

/**
 * Normalizes a PWA or visited URL hostname for accurate profile history matching.
 */
export function extractHostnameForHistory(rawUrl?: string | null): string {
  if (!rawUrl || !rawUrl.trim()) return '';
  const clean = getCleanDomain(rawUrl.trim()).toLowerCase();
  return clean.split('/')[0].split(':')[0].replace(/^www\./, '');
}

/**
 * Checks whether a Chrome History URL belongs to the target PWA URL (same domain or subdomain).
 */
export function matchesVisitUrlForPWA(visitUrl: string, pwaUrl: string): boolean {
  if (!visitUrl || !pwaUrl) return false;
  const visitHost = extractHostnameForHistory(visitUrl);
  const targetHost = extractHostnameForHistory(pwaUrl);
  if (!visitHost || !targetHost) return false;
  if (targetHost === 'app.com' || targetHost === 'seu-app.com') return false;
  if (visitHost === targetHost) return true;
  return visitHost.endsWith(`.${targetHost}`) || targetHost.endsWith(`.${visitHost}`);
}

/**
 * Parses a HubPWA local ISO timestamp (`YYYY-MM-DDTHH:mm:ss.000Z`) into epoch ms for sorting/dedup comparisons.
 */
export function parseLogIsoSortMs(ts: string): number {
  if (!ts || !ts.trim()) return 0;
  const clean = ts.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    ).getTime();
  }
  const parsed = new Date(clean).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Collapses rapid redirect bursts (e.g. within 60 seconds) from Chrome History into distinct access sessions.
 * Expects or sorts newest-first.
 */
export function collapseRapidChromeVisits(
  entries: AccessHistoryEntry[],
  windowSeconds = 60,
  maxItems = 60
): AccessHistoryEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const sorted = [...entries]
    .filter((e) => e && e.timestamp)
    .sort((a, b) => parseLogIsoSortMs(b.timestamp) - parseLogIsoSortMs(a.timestamp));

  const kept: AccessHistoryEntry[] = [];
  const windowMs = Math.max(0, windowSeconds) * 1000;

  for (const entry of sorted) {
    const entryMs = parseLogIsoSortMs(entry.timestamp);
    if (!entryMs) continue;

    const duplicateClose = kept.some((k) => Math.abs(parseLogIsoSortMs(k.timestamp) - entryMs) < windowMs);
    if (!duplicateClose) {
      kept.push(entry);
      if (kept.length >= maxItems) break;
    }
  }

  return kept;
}

/**
 * Resolves the effective Chrome profile directory name for a PWA item (defaults to 'Default' when unspecified).
 */
export function resolveHistoryProfileDirectory(item: {
  profileDirectory?: string;
  execLine?: string;
  rawFileName?: string;
  desktopPath?: string;
}): string {
  if (item.profileDirectory && item.profileDirectory.trim()) {
    return normalizeChromeProfileInput(item.profileDirectory);
  }
  if (item.execLine) {
    const m = item.execLine.match(/--profile-directory=(?:["']([^"']+)["']|([^\s"']+))/i);
    const val = (m?.[1] || m?.[2] || '').trim();
    if (val) return normalizeChromeProfileInput(val);
  }
  const candidates = [item.rawFileName, item.desktopPath].filter(Boolean) as string[];
  for (const cand of candidates) {
    const m = cand.match(/Profile[_\s]?(\d+)|(Default)/i);
    if (m?.[2]) return 'Default';
    if (m?.[1]) return `Profile ${m[1]}`;
  }
  return 'Default';
}

/**
 * Merges Chrome profile SQLite visits and Hub-recorded access logs into a clean, deduplicated timeline (newest-first).
 */
export function mergeAccessHistoryRecords(
  existingItem: Pick<PWAItem, 'lastAccessedDate' | 'accessLogs' | 'accessHistory' | 'profileDirectory'>,
  chromeVisits: AccessHistoryEntry[],
  maxItems = 80
): {
  accessHistory: AccessHistoryEntry[];
  accessLogs: string[];
  lastAccessedDate: string | null;
} {
  const combined: AccessHistoryEntry[] = [];

  if (Array.isArray(chromeVisits)) {
    for (const v of chromeVisits) {
      if (v && v.timestamp) {
        combined.push({
          ...v,
          source: v.source || 'chrome',
          profileDirectory: v.profileDirectory || existingItem.profileDirectory,
        });
      }
    }
  }

  if (Array.isArray(existingItem.accessHistory)) {
    for (const h of existingItem.accessHistory) {
      if (h && h.timestamp) {
        combined.push(h);
      }
    }
  }

  const fallbackTimestamps: string[] = [];
  if (Array.isArray(existingItem.accessLogs)) {
    fallbackTimestamps.push(...existingItem.accessLogs);
  }
  if (existingItem.lastAccessedDate) {
    fallbackTimestamps.push(existingItem.lastAccessedDate);
  }

  for (const ts of fallbackTimestamps) {
    if (ts && ts.trim()) {
      combined.push({
        timestamp: ts.trim(),
        source: 'hub',
        profileDirectory: existingItem.profileDirectory,
      });
    }
  }

  // Sort newest first, preferring Chrome entry metadata when timestamps fall within 60s of each other
  const sorted = combined
    .filter((e) => parseLogIsoSortMs(e.timestamp) > 0)
    .sort((a, b) => {
      const diff = parseLogIsoSortMs(b.timestamp) - parseLogIsoSortMs(a.timestamp);
      if (Math.abs(diff) <= 5000 && a.source !== b.source) {
        return a.source === 'chrome' ? -1 : 1;
      }
      return diff;
    });

  const deduped: AccessHistoryEntry[] = [];
  for (const entry of sorted) {
    const entryMs = parseLogIsoSortMs(entry.timestamp);
    const nearbyIdx = deduped.findIndex((existing) => Math.abs(parseLogIsoSortMs(existing.timestamp) - entryMs) < 60000);
    if (nearbyIdx === -1) {
      deduped.push(entry);
      if (deduped.length >= maxItems) break;
    } else if (deduped[nearbyIdx].source === 'hub' && entry.source === 'chrome') {
      // Enrich nearby Hub click with richer Chrome URL/title if available
      deduped[nearbyIdx] = {
        ...deduped[nearbyIdx],
        visitedUrl: entry.visitedUrl || deduped[nearbyIdx].visitedUrl,
        title: entry.title || deduped[nearbyIdx].title,
        profileDirectory: entry.profileDirectory || deduped[nearbyIdx].profileDirectory,
      };
    }
  }

  const accessLogs = deduped.map((e) => e.timestamp);
  const lastAccessedDate = accessLogs[0] || existingItem.lastAccessedDate || null;

  return {
    accessHistory: deduped,
    accessLogs,
    lastAccessedDate,
  };
}

export interface AccessHistoryDayGroup {
  dateKey: string; // YYYY-MM-DD
  label: string; // e.g. "Hoje — 19/11/2026"
  entries: Array<
    AccessHistoryEntry & {
      dateStr: string;
      timeStr: string;
    }
  >;
}

/**
 * Groups access history entries by calendar day (`YYYY-MM-DD`), newest day first, formatting Dia e Hora in pt-BR.
 */
export function groupAccessHistoryByDay(
  entries: AccessHistoryEntry[],
  todayStr: string = getTodayString()
): AccessHistoryDayGroup[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const todayParts = todayStr.split('-').map(Number);
  let yesterdayStr = '';
  if (todayParts.length === 3 && !todayParts.some(isNaN)) {
    const d = new Date(todayParts[0], todayParts[1] - 1, todayParts[2] - 1);
    yesterdayStr = getTodayString(d);
  }

  const groupsMap = new Map<string, AccessHistoryDayGroup>();

  const sorted = [...entries].sort((a, b) => parseLogIsoSortMs(b.timestamp) - parseLogIsoSortMs(a.timestamp));

  for (const entry of sorted) {
    const parsed = formatAccessDateTime(entry.timestamp);
    const m = entry.timestamp.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dateKey = m ? `${m[1]}-${m[2]}-${m[3]}` : parsed.dateStr || 'desconhecida';

    if (!groupsMap.has(dateKey)) {
      let dayLabel = parsed.dateStr || dateKey;
      if (dateKey === todayStr) {
        dayLabel = `Hoje — ${parsed.dateStr}`;
      } else if (yesterdayStr && dateKey === yesterdayStr) {
        dayLabel = `Ontem — ${parsed.dateStr}`;
      } else if (m) {
        try {
          const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
          const wd = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(dt).replace('.', '');
          const wdCap = wd.charAt(0).toUpperCase() + wd.slice(1);
          dayLabel = `${wdCap} — ${parsed.dateStr}`;
        } catch {
          dayLabel = parsed.dateStr;
        }
      }

      groupsMap.set(dateKey, {
        dateKey,
        label: dayLabel,
        entries: [],
      });
    }

    groupsMap.get(dateKey)!.entries.push({
      ...entry,
      dateStr: parsed.dateStr,
      timeStr: parsed.timeStr || '00:00:00',
    });
  }

  return Array.from(groupsMap.values());
}

/**
 * Parses an "HH:mm" (or "HH:mm:ss") string into minutes since midnight (0..1439).
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
}

/**
 * Extracts local wall-clock calendar date (YYYY-MM-DD) and minutes since midnight from an access timestamp.
 * Only timestamps that include an explicit time part ("THH:mm") match hour-based filters.
 */
export function extractLocalDateAndMinutes(ts?: string | null): { dateStr: string; minutes: number } | null {
  if (!ts || typeof ts !== 'string') return null;
  const clean = ts.trim();
  const m = clean.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return {
    dateStr: m[1],
    minutes: hh * 60 + mm,
  };
}

/**
 * Checks whether a single access timestamp falls within a day & HH:mm..HH:mm window (supports wrap-around past midnight).
 */
export function isTimestampInTimeWindow(
  ts: string | null | undefined,
  startTime: string,
  endTime: string,
  dayScope: 'today' | 'any' = 'today',
  todayStr: string = getTodayString()
): boolean {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin === null || endMin === null) return false;

  const parsed = extractLocalDateAndMinutes(ts);
  if (!parsed) return false;

  if (dayScope === 'today' && parsed.dateStr !== todayStr) {
    return false;
  }

  if (startMin <= endMin) {
    return parsed.minutes >= startMin && parsed.minutes <= endMin;
  }

  // Wrap-around window (e.g. 22:00 to 02:00)
  return parsed.minutes >= startMin || parsed.minutes <= endMin;
}

/**
 * Checks whether a PWA item has at least one recorded access (lastAccessedDate, accessLogs, or accessHistory)
 * inside the configured time window.
 */
export function matchesAccessTimeWindow(
  item: Pick<PWAItem, 'lastAccessedDate' | 'accessLogs' | 'accessHistory'>,
  windowFilter?: {
    enabled?: boolean;
    startTime?: string;
    endTime?: string;
    dayScope?: 'today' | 'any';
  } | null,
  todayStr: string = getTodayString()
): boolean {
  if (!windowFilter || !windowFilter.enabled) return true;
  const startTime = windowFilter.startTime || '00:00';
  const endTime = windowFilter.endTime || '23:59';
  const dayScope = windowFilter.dayScope === 'any' ? 'any' : 'today';

  const candidates = new Set<string>();
  if (item.lastAccessedDate) candidates.add(item.lastAccessedDate);
  if (Array.isArray(item.accessLogs)) {
    for (const l of item.accessLogs) {
      if (l) candidates.add(l);
    }
  }
  if (Array.isArray(item.accessHistory)) {
    for (const h of item.accessHistory) {
      if (h?.timestamp) candidates.add(h.timestamp);
    }
  }

  for (const ts of candidates) {
    if (isTimestampInTimeWindow(ts, startTime, endTime, dayScope, todayStr)) {
      return true;
    }
  }

  return false;
}

/**
 * Builds an HH:mm start/end pair for the last N hours relative to `now`.
 */
export function buildRelativeTimeWindow(
  hoursBack: number,
  now: Date = new Date()
): { startTime: string; endTime: string } {
  const endMin = now.getHours() * 60 + now.getMinutes();
  const clampedBack = Math.max(1, Math.round(hoursBack * 60));
  const startMin = Math.max(0, endMin - clampedBack);

  const fmt = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  return {
    startTime: fmt(startMin),
    endTime: fmt(endMin),
  };
}

