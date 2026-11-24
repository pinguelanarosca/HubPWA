import { PWAItem } from '../types/pwa';
import {
  ChromeProfileOption,
  batchSetStatus,
  extractExplicitProfileSuffixKey,
  formatAccessLogDash,
  formatChromeProfileDisplay,
  getNormalizedPWAChromeProfileKey,
  getTodayString,
  isAccessedToday,
  normalizeAppUrlForMatch,
  normalizeChromeProfileInput,
  sanitizeLauncherMetadataForProfile,
  stripProfileSuffixFromName,
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
  profileDirectory?: string;
  hasProfileField: boolean;
  accessed: boolean | null;
}

export interface MarkdownStatusApplyResult {
  items: PWAItem[];
  updatedItems: PWAItem[];
  parsedCount: number;
  matchedCount: number;
  markedAccessedCount: number;
  markedPendingCount: number;
  updatedProfileCount: number;
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

/**
 * Extracts canonical Chrome profile directory & key from a Markdown profile field.
 * Examples:
 * - "Perfil 5 (Profile 5)" -> { key: "profile 5", directory: "Profile 5" }
 * - "Perfil 5 (Profile 5) — Trabalho" -> { key: "profile 5", directory: "Profile 5" }
 * - "Default (Padrão)" -> { key: "default", directory: "Default" }
 * - "Padrão do Chrome (não especificado)" / "Sem perfil" -> { key: "", directory: undefined }
 */
export function parseMarkdownProfileValue(
  rawLine: string
): { key: string; directory?: string } | undefined {
  const cleaned = (rawLine || '').replace(/[*_`]/g, '').trim();
  if (!cleaned) return undefined;
  if (/^(?:padrao|padr[aã]o)\s+do\s+chrome\s*\(n[aã]o\s+especificado\)|^sem\s+perfil$|^nenhum$|^n[aã]o\s+especificado$/i.test(cleaned)) {
    return { key: '', directory: undefined };
  }
  const parenDirMatch = cleaned.match(/\((Profile[_\s-]*\d+|Default)\)/i);
  if (parenDirMatch) {
    const dir = normalizeChromeProfileInput(parenDirMatch[1]);
    return dir ? { key: dir.toLowerCase(), directory: dir } : undefined;
  }
  const basePart = cleaned
    .split(/\s+[—–-]\s+/)[0]
    .replace(/\((?:Padr[aã]o|Default)\)/gi, '')
    .trim();
  if (!basePart) return undefined;
  const normalized = normalizeChromeProfileInput(basePart);
  return normalized ? { key: normalized.toLowerCase(), directory: normalized } : undefined;
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
 * Parses PWA blocks (`## [Name](url)` or `### [Name](url)`) containing `- **Acesso:**`
 * and/or `- **Perfil do Chrome:**` / `- **Profile:**` from a Markdown document.
 */
export function parsePWAMarkdownAccessEntries(markdownText: string): ParsedMarkdownAccessEntry[] {
  if (!markdownText || typeof markdownText !== 'string') return [];

  const lines = markdownText.split(/\r?\n/);
  const entries: ParsedMarkdownAccessEntry[] = [];

  let current: {
    name: string;
    url: string;
    profileKey?: string;
    profileDirectory?: string;
    hasProfileField: boolean;
    accessed: boolean | null;
  } | null = null;

  const flushCurrent = () => {
    if (
      current &&
      (current.accessed !== null || current.hasProfileField) &&
      (current.url || current.name)
    ) {
      entries.push({
        name: current.name,
        url: current.url,
        profileKey: current.profileKey,
        profileDirectory: current.profileDirectory,
        hasProfileField: current.hasProfileField,
        accessed: current.accessed,
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^---+$/.test(trimmed)) {
      flushCurrent();
      continue;
    }

    const headingMatch = trimmed.match(/^#{2,4}\s+(.+)$/);
    if (headingMatch) {
      flushCurrent();
      const heading = headingMatch[1].trim();
      if (/^Grupo\s*:/i.test(heading)) {
        continue;
      }
      const linkHeading = heading.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      current = {
        name: (linkHeading ? linkHeading[1] : heading).trim(),
        url: linkHeading ? linkHeading[2].trim() : '',
        hasProfileField: false,
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
      /^(?:\*\*|__)?(?:Perfil(?:\s+do\s+Chrome)?|Profile):?(?:\*\*|__)?\s*:?\s*(.+)$/i
    );
    if (profileField) {
      const parsedProfile = parseMarkdownProfileValue(profileField[1]);
      if (parsedProfile) {
        current.profileKey = parsedProfile.key;
        current.profileDirectory = parsedProfile.directory;
        current.hasProfileField = true;
      }
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
 * Updates daily access status (`accessed` <-> `pending`) and/or Chrome profile (`profileDirectory`)
 * of existing PWAs matched against an uploaded `.md` report. Never adds or removes PWAs.
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
  const profileUpdatesById = new Map<string, string | undefined>();
  const claimedIds = new Set<string>();

  let matchedCount = 0;
  let unchangedCount = 0;
  let unmatchedCount = 0;

  const urlEntryCounts = new Map<string, number>();
  for (const entry of entries) {
    const u = normalizeAppUrlForMatch(entry.url);
    if (!u) continue;
    urlEntryCounts.set(u, (urlEntryCounts.get(u) || 0) + 1);
  }

  for (const entry of entries) {
    const targetUrlNorm = normalizeUrlForMatch(entry.url);
    const targetNameNorm = entry.name.trim().toLowerCase();
    const targetBaseNameNorm = stripProfileSuffixFromName(entry.name).trim().toLowerCase();
    const hasProfileConstraint = entry.profileKey !== undefined;
    const entryHasExplicitProfileSuffix = Boolean(
      extractExplicitProfileSuffixKey(entry.name)
    );

    const findMatch = (): PWAItem | undefined => {
      if (targetUrlNorm && targetNameNorm && hasProfileConstraint) {
        const match = safeItems.find(
          (it) =>
            !claimedIds.has(it.id) &&
            normalizeUrlForMatch(it.url) === targetUrlNorm &&
            it.name.trim().toLowerCase() === targetNameNorm &&
            getNormalizedPWAChromeProfileKey(it) === entry.profileKey
        );
        if (match) return match;
      }

      if (targetUrlNorm && targetBaseNameNorm && hasProfileConstraint) {
        const match = safeItems.find(
          (it) =>
            !claimedIds.has(it.id) &&
            normalizeUrlForMatch(it.url) === targetUrlNorm &&
            stripProfileSuffixFromName(it.name).trim().toLowerCase() === targetBaseNameNorm &&
            getNormalizedPWAChromeProfileKey(it) === entry.profileKey
        );
        if (match) return match;
      }

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

      if (targetUrlNorm && targetNameNorm) {
        const match = safeItems.find(
          (it) =>
            !claimedIds.has(it.id) &&
            normalizeUrlForMatch(it.url) === targetUrlNorm &&
            it.name.trim().toLowerCase() === targetNameNorm
        );
        if (match) return match;
      }

      if (targetUrlNorm && targetBaseNameNorm) {
        const match = safeItems.find(
          (it) =>
            !claimedIds.has(it.id) &&
            normalizeUrlForMatch(it.url) === targetUrlNorm &&
            stripProfileSuffixFromName(it.name).trim().toLowerCase() === targetBaseNameNorm
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

    const primaryMatched = findMatch();
    if (!primaryMatched) {
      unmatchedCount += 1;
      continue;
    }

    const targets: PWAItem[] = [primaryMatched];
    claimedIds.add(primaryMatched.id);
    matchedCount += 1;

    // If this URL only appears once in the .md report and has no explicit per-profile suffix
    // (e.g. "### [13E.COM](https://13e.com)" with "Perfil 5"), also migrate any unclaimed
    // duplicate/Default copies sharing the exact same URL so none remain stuck in Default.
    if (
      targetUrlNorm &&
      (urlEntryCounts.get(targetUrlNorm) || 0) === 1 &&
      !entryHasExplicitProfileSuffix
    ) {
      const targetProfKey = entry.profileKey || '';
      for (const candidate of safeItems) {
        if (claimedIds.has(candidate.id)) continue;
        if (normalizeUrlForMatch(candidate.url) !== targetUrlNorm) continue;

        const candExplicitSuffixKey = extractExplicitProfileSuffixKey(candidate.name);
        if (
          candExplicitSuffixKey &&
          candExplicitSuffixKey !== 'default' &&
          candExplicitSuffixKey !== targetProfKey
        ) {
          continue;
        }

        const candCurrentProfKey = getNormalizedPWAChromeProfileKey(candidate);
        if (
          candidate.clonedFromId &&
          candCurrentProfKey &&
          candCurrentProfKey !== 'default' &&
          candCurrentProfKey !== targetProfKey
        ) {
          continue;
        }

        claimedIds.add(candidate.id);
        targets.push(candidate);
      }
    }

    let primaryOrCopyChanged = false;
    for (const target of targets) {
      let targetChanged = false;

      if (entry.accessed !== null) {
        const currentlyAccessed = isAccessedToday(target.lastAccessedDate, todayStr);
        if (entry.accessed && !currentlyAccessed) {
          toAccessedIds.add(target.id);
          targetChanged = true;
        } else if (!entry.accessed && currentlyAccessed) {
          toPendingIds.add(target.id);
          targetChanged = true;
        }
      }

      if (entry.hasProfileField) {
        const { changed } = sanitizeLauncherMetadataForProfile(target, entry.profileDirectory);
        if (changed) {
          profileUpdatesById.set(target.id, entry.profileDirectory);
          targetChanged = true;
        }
      }

      if (targetChanged) {
        primaryOrCopyChanged = true;
      }
    }

    if (!primaryOrCopyChanged) {
      unchangedCount += 1;
    }
  }

  let nextItems = safeItems;
  if (profileUpdatesById.size > 0) {
    nextItems = nextItems.map((it) => {
      if (!profileUpdatesById.has(it.id)) return it;
      const nextProfileDir = profileUpdatesById.get(it.id);
      return sanitizeLauncherMetadataForProfile(it, nextProfileDir).item;
    });
  }
  if (toAccessedIds.size > 0) {
    nextItems = batchSetStatus(nextItems, toAccessedIds, 'accessed', now, todayStr);
  }
  if (toPendingIds.size > 0) {
    nextItems = batchSetStatus(nextItems, toPendingIds, 'pending', now, todayStr);
  }

  const changedIds = new Set<string>([
    ...toAccessedIds,
    ...toPendingIds,
    ...profileUpdatesById.keys(),
  ]);
  const updatedItems = nextItems.filter((it) => changedIds.has(it.id));

  return {
    items: nextItems,
    updatedItems,
    parsedCount: entries.length,
    matchedCount,
    markedAccessedCount: toAccessedIds.size,
    markedPendingCount: toPendingIds.size,
    updatedProfileCount: profileUpdatesById.size,
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

