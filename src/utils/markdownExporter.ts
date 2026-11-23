import { PWAItem } from '../types/pwa';
import {
  ChromeProfileOption,
  batchSetStatus,
  formatAccessLogDash,
  formatChromeProfileDisplay,
  getNormalizedPWAChromeProfileKey,
  getTodayString,
  isAccessedToday,
  normalizeChromeProfileInput,
} from './pwaLogic';

export interface MarkdownExportOptions {
  now?: Date;
  todayStr?: string;
  chromeProfiles?: ChromeProfileOption[];
}

export interface ParsedMarkdownAccessEntry {
  name: string;
  url: string;
  profileKey?: string;
  accessed: boolean;
}

export interface MarkdownStatusApplyResult {
  items: PWAItem[];
  updatedItems: PWAItem[];
  parsedCount: number;
  matchedCount: number;
  markedAccessedCount: number;
  markedPendingCount: number;
  unchangedCount: number;
  unmatchedCount: number;
}

/**
 * Formats the Chrome profile label for a PWA when exporting URLs to Markdown.
 */
export function formatExportChromeProfile(
  item: PWAItem,
  chromeProfiles: ChromeProfileOption[] = []
): string {
  const display = formatChromeProfileDisplay(item);
  if (!display) {
    return 'Padrão do Chrome (não especificado)';
  }

  const matchedOption = chromeProfiles.find(
    (prof) => prof.directory.trim().toLowerCase() === display.raw.toLowerCase()
  );
  const friendlyName = matchedOption?.displayName?.trim();
  const hasDistinctFriendlyName =
    Boolean(friendlyName) &&
    friendlyName!.toLowerCase() !== display.raw.toLowerCase() &&
    friendlyName!.toLowerCase() !== display.badgeText.toLowerCase();

  if (display.isDefault) {
    return hasDistinctFriendlyName
      ? `Default — ${friendlyName} (Padrão)`
      : 'Default (Padrão)';
  }

  const base =
    display.badgeText !== display.raw
      ? `${display.badgeText} (${display.raw})`
      : display.raw;

  return hasDistinctFriendlyName ? `${base} — ${friendlyName}` : base;
}

/**
 * Builds the Markdown (.md) report string for selected PWAs, including each PWA's Chrome profile
 * and current daily access status (`- **Acesso:** Sim` or `- **Acesso:** Não`).
 */
export function buildPWAsMarkdownContent(
  items: PWAItem[],
  selectedIds: Set<string>,
  options: MarkdownExportOptions = {}
): string {
  const selectedItems = items.filter((it) => selectedIds.has(it.id));
  if (selectedItems.length === 0) return '';

  const now = options.now || new Date();
  const todayStr = options.todayStr || getTodayString(now);
  const chromeProfiles = options.chromeProfiles || [];
  const dateFormatted = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let mdContent = `# Relatório de PWAs Extraídas - Chrome PWA Hub\n\n`;
  mdContent += `> **Data de Extração:** ${dateFormatted} às ${timeFormatted}  \n`;
  mdContent += `> **Total de PWAs Selecionadas:** ${selectedItems.length}\n\n`;
  mdContent += `---\n\n`;

  // Group items by group name for a clean document structure
  const groupsMap = new Map<string, PWAItem[]>();
  selectedItems.forEach((item) => {
    const grp = item.group || item.category || 'Geral';
    if (!groupsMap.has(grp)) {
      groupsMap.set(grp, []);
    }
    groupsMap.get(grp)!.push(item);
  });

  const sortedGroups = Array.from(groupsMap.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  for (const grpName of sortedGroups) {
    const grpItems = groupsMap.get(grpName) || [];
    mdContent += `## Grupo: ${grpName} (${grpItems.length})\n\n`;

    for (const item of grpItems) {
      const accessLogStr = formatAccessLogDash(item.lastAccessedDate);
      const accessFlagStr = isAccessedToday(item.lastAccessedDate, todayStr) ? 'Sim' : 'Não';
      const ratingStr =
        typeof item.rating === 'number' && item.rating > 0
          ? '⭐'.repeat(item.rating)
          : 'Sem classificação';
      const profileStr = formatExportChromeProfile(item, chromeProfiles);

      mdContent += `### [${item.name}](${item.url})\n`;
      mdContent += `- **URL:** \`${item.url}\`\n`;
      mdContent += `- **Perfil do Chrome:** ${profileStr}\n`;
      mdContent += `- **Acesso:** ${accessFlagStr}\n`;
      mdContent += `- **Classificação:** ${ratingStr}\n`;
      mdContent += `- **Último Acesso:** ${accessLogStr}\n`;
      if (item.notes && item.notes.trim()) {
        mdContent += `- **Anotações:** ${item.notes.trim()}\n`;
      }
      mdContent += `\n`;
    }
  }

  mdContent += `---\n*Gerado automaticamente pelo Chrome PWA Hub*\n`;
  return mdContent;
}

/**
 * Parses an exported `Acesso` value ("Sim" / "Não", case/accent-insensitive) into boolean | null.
 */
export function parseAccessFlagValue(rawValue: string): boolean | null {
  if (!rawValue || typeof rawValue !== 'string') return null;
  const cleaned = rawValue
    .replace(/[*_`]/g, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!cleaned) return null;

  if (
    cleaned === 'sim' ||
    cleaned === 's' ||
    cleaned === 'yes' ||
    cleaned === 'y' ||
    cleaned === 'true' ||
    cleaned === '1' ||
    cleaned === 'ok' ||
    cleaned === 'verde' ||
    cleaned === 'acessado' ||
    cleaned === 'acessada' ||
    /^sim[\s(/,-]/.test(cleaned)
  ) {
    return true;
  }

  if (
    cleaned === 'nao' ||
    cleaned === 'n' ||
    cleaned === 'no' ||
    cleaned === 'false' ||
    cleaned === '0' ||
    cleaned === 'vermelho' ||
    cleaned === 'vermelha' ||
    cleaned === 'pendente' ||
    /^nao[\s(/,-]/.test(cleaned)
  ) {
    return false;
  }

  return null;
}

function extractProfileKeyFromMarkdownLine(rawLine: string): string | undefined {
  const cleaned = (rawLine || '').replace(/[*_`]/g, '').trim();
  if (!cleaned) return undefined;
  if (/n[aã]o\s+especificado|sem\s+perfil/i.test(cleaned)) {
    return '';
  }
  const parenDirMatch = cleaned.match(/\((Profile[_\s-]*\d+|Default)\)/i);
  if (parenDirMatch) {
    return normalizeChromeProfileInput(parenDirMatch[1]).toLowerCase();
  }
  const basePart = cleaned
    .split(/\s+[—–-]\s+/)[0]
    .replace(/\((?:Padr[aã]o|Default)\)/gi, '')
    .trim();
  if (!basePart) return undefined;
  const normalized = normalizeChromeProfileInput(basePart);
  return normalized ? normalized.toLowerCase() : undefined;
}

function cleanMarkdownUrlToken(raw: string): string {
  const trimmed = (raw || '').trim();
  const linkMatch = trimmed.match(/^\[[^\]]*\]\(([^)]+)\)$/);
  if (linkMatch) return linkMatch[1].trim();
  return trimmed.replace(/^[`<]+|[`>]+$/g, '').trim();
}

function normalizeUrlForMatch(rawUrl?: string): string {
  if (!rawUrl) return '';
  return rawUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

/**
 * Parses `### ...` PWA blocks containing an `- **Acesso:** Sim|Não` parameter from an exported Markdown document.
 */
export function parsePWAMarkdownAccessEntries(markdownText: string): ParsedMarkdownAccessEntry[] {
  if (!markdownText || typeof markdownText !== 'string') return [];

  const lines = markdownText.split(/\r?\n/);
  const entries: ParsedMarkdownAccessEntry[] = [];

  let current: {
    name: string;
    url: string;
    profileKey?: string;
    accessed: boolean | null;
  } | null = null;

  const flushCurrent = () => {
    if (current && current.accessed !== null && (current.url || current.name)) {
      entries.push({
        name: current.name,
        url: current.url,
        profileKey: current.profileKey,
        accessed: current.accessed,
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^##\s+/.test(trimmed) || /^---+$/.test(trimmed)) {
      flushCurrent();
      continue;
    }

    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match) {
      flushCurrent();
      const heading = h3Match[1].trim();
      const linkHeading = heading.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      current = {
        name: (linkHeading ? linkHeading[1] : heading).trim(),
        url: linkHeading ? linkHeading[2].trim() : '',
        accessed: null,
      };
      continue;
    }

    if (!current) continue;

    const fieldLine = trimmed.replace(/^[-*]\s+/, '').trim();

    const urlField = fieldLine.match(/^(?:\*\*|__)?URL:?(?:\*\*|__)?\s*:?\s*(.+)$/i);
    if (urlField) {
      const cleanedUrl = cleanMarkdownUrlToken(urlField[1]);
      if (cleanedUrl) current.url = cleanedUrl;
      continue;
    }

    const profileField = fieldLine.match(
      /^(?:\*\*|__)?Perfil(?:\s+do\s+Chrome)?:?(?:\*\*|__)?\s*:?\s*(.+)$/i
    );
    if (profileField) {
      current.profileKey = extractProfileKeyFromMarkdownLine(profileField[1]);
      continue;
    }

    const accessField = fieldLine.match(/^(?:\*\*|__)?Acesso:?(?:\*\*|__)?\s*:?\s*(.+)$/i);
    if (accessField) {
      const parsedFlag = parseAccessFlagValue(accessField[1]);
      if (parsedFlag !== null) {
        current.accessed = parsedFlag;
      }
      continue;
    }
  }

  flushCurrent();
  return entries;
}

/**
 * Updates ONLY the daily access status (`accessed` <-> `pending`) of existing PWAs
 * matched against an uploaded `.md` report. Never adds or removes PWAs.
 */
export function applyMarkdownAccessUpdates(
  items: PWAItem[],
  markdownText: string,
  options: { now?: Date; todayStr?: string } = {}
): MarkdownStatusApplyResult {
  const safeItems = Array.isArray(items) ? items : [];
  const entries = parsePWAMarkdownAccessEntries(markdownText);
  const now = options.now || new Date();
  const todayStr = options.todayStr || getTodayString(now);

  const toAccessedIds = new Set<string>();
  const toPendingIds = new Set<string>();
  const claimedIds = new Set<string>();

  let matchedCount = 0;
  let unchangedCount = 0;
  let unmatchedCount = 0;

  for (const entry of entries) {
    const targetUrlNorm = normalizeUrlForMatch(entry.url);
    const targetNameNorm = entry.name.trim().toLowerCase();
    const hasProfileConstraint = entry.profileKey !== undefined;

    const findMatch = (): PWAItem | undefined => {
      if (targetUrlNorm && hasProfileConstraint) {
        const match = safeItems.find(
          (it) =>
            !claimedIds.has(it.id) &&
            normalizeUrlForMatch(it.url) === targetUrlNorm &&
            getNormalizedPWAChromeProfileKey(it) === entry.profileKey
        );
        if (match) return match;
      }

      if (targetNameNorm && hasProfileConstraint) {
        const match = safeItems.find(
          (it) =>
            !claimedIds.has(it.id) &&
            it.name.trim().toLowerCase() === targetNameNorm &&
            getNormalizedPWAChromeProfileKey(it) === entry.profileKey
        );
        if (match) return match;
      }

      if (targetUrlNorm) {
        const match = safeItems.find(
          (it) => !claimedIds.has(it.id) && normalizeUrlForMatch(it.url) === targetUrlNorm
        );
        if (match) return match;
      }

      if (targetNameNorm) {
        const match = safeItems.find(
          (it) => !claimedIds.has(it.id) && it.name.trim().toLowerCase() === targetNameNorm
        );
        if (match) return match;
      }

      return undefined;
    };

    const matched = findMatch();
    if (!matched) {
      unmatchedCount += 1;
      continue;
    }

    claimedIds.add(matched.id);
    matchedCount += 1;

    const currentlyAccessed = isAccessedToday(matched.lastAccessedDate, todayStr);
    if (entry.accessed && !currentlyAccessed) {
      toAccessedIds.add(matched.id);
    } else if (!entry.accessed && currentlyAccessed) {
      toPendingIds.add(matched.id);
    } else {
      unchangedCount += 1;
    }
  }

  let nextItems = safeItems;
  if (toAccessedIds.size > 0) {
    nextItems = batchSetStatus(nextItems, toAccessedIds, 'accessed', now, todayStr);
  }
  if (toPendingIds.size > 0) {
    nextItems = batchSetStatus(nextItems, toPendingIds, 'pending', now, todayStr);
  }

  const changedIds = new Set<string>([...toAccessedIds, ...toPendingIds]);
  const updatedItems = nextItems.filter((it) => changedIds.has(it.id));

  return {
    items: nextItems,
    updatedItems,
    parsedCount: entries.length,
    matchedCount,
    markedAccessedCount: toAccessedIds.size,
    markedPendingCount: toPendingIds.size,
    unchangedCount,
    unmatchedCount,
  };
}

/**
 * Extracts selected PWAs into a formatted Markdown (.md) document and triggers browser file download.
 */
export function extractPWAsToMarkdown(
  items: PWAItem[],
  selectedIds: Set<string>,
  chromeProfiles: ChromeProfileOption[] = []
): void {
  const now = new Date();
  const mdContent = buildPWAsMarkdownContent(items, selectedIds, {
    now,
    chromeProfiles,
  });
  if (!mdContent) return;

  // Trigger browser download of .md file
  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateSuffix = now.toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `pwa-urls-${dateSuffix}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

