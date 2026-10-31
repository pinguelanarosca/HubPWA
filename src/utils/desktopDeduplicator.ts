import { ParsedDesktopApp } from './desktopParser';
import { getCleanDomain, normalizeSearchText, toCompactAlphaNumeric } from './pwaLogic';

export interface DeduplicationStats {
  totalRawFound: number;
  confirmedDuplicatesMerged: number;
  activeCount: number;
  possibleDuplicatesCount: number;
}

export interface DeduplicationResult {
  items: ParsedDesktopApp[];
  stats: DeduplicationStats;
}

/**
 * Normalizes URL by stripping protocol, trailing slash, index file and common tracking query params
 */
export function normalizeAppUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source'];
    trackingParams.forEach((param) => urlObj.searchParams.delete(param));
    
    let pathname = urlObj.pathname.replace(/\/index\.(html|htm|php)$/i, '');
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    
    const search = urlObj.search ? urlObj.search : '';
    return `${urlObj.hostname.replace(/^www\./, '').toLowerCase()}${pathname}${search}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Checks whether two names appear to be from the same platform
 * (e.g. "Mercado Livre" and "95D - Mercado Livre", or one is a short code like "95D")
 */
function isCodeLikeName(name: string): boolean {
  const clean = name.trim();
  // Patterns like "95D", "93D", "95H", "App 1", short alphanumerics <= 6 chars
  return /^[0-9]{1,4}[a-zA-Z]{0,3}$/.test(clean) || clean.length <= 4;
}

/**
 * Chooses the best primary name between two duplicate candidates
 */
function pickBetterName(nameA: string, nameB: string): { primary: string; secondary: string } {
  const isCodeA = isCodeLikeName(nameA);
  const isCodeB = isCodeLikeName(nameB);

  if (isCodeA && !isCodeB) {
    return { primary: nameB, secondary: nameA };
  }
  if (!isCodeA && isCodeB) {
    return { primary: nameA, secondary: nameB };
  }
  // Prefer longer, more descriptive name
  if (nameB.length > nameA.length) {
    return { primary: nameB, secondary: nameA };
  }
  return { primary: nameA, secondary: nameB };
}

/**
 * Checks if two parsed apps are confirmed duplicates (equivalent to the SAME installation in the SAME profile)
 */
export function areConfirmedDuplicates(a: ParsedDesktopApp, b: ParsedDesktopApp): boolean {
  // Profiles MUST be identical to even consider merging
  const profA = (a.profileDirectory || 'Default').toLowerCase().trim();
  const profB = (b.profileDirectory || 'Default').toLowerCase().trim();
  if (profA !== profB) {
    return false;
  }

  // If BOTH have an explicit Chrome appId and they differ, they are separate installations
  if (a.appId && b.appId && a.appId.toLowerCase() !== b.appId.toLowerCase()) {
    return false;
  }

  // Rule 1: Exact same Chrome app-id in the same profile
  if (a.appId && b.appId && a.appId.toLowerCase() === b.appId.toLowerCase()) {
    return true;
  }

  // Rule 2: Exact same .desktop file name across different directories (e.g. applications vs Desktop)
  const nameA = a.rawFileName || (a as any).desktopFileName;
  const nameB = b.rawFileName || (b as any).desktopFileName;
  if (nameA && nameB && nameA.toLowerCase() === nameB.toLowerCase()) {
    return true;
  }

  // Rule 3: Identical normalized target URL in the same profile
  const normUrlA = normalizeAppUrl(a.url);
  const normUrlB = normalizeAppUrl(b.url);
  if (normUrlA && normUrlB && normUrlA === normUrlB) {
    return true;
  }

  // Rule 4: Same domain, same profile, and identical icon hash
  const domainA = getCleanDomain(a.url || '');
  const domainB = getCleanDomain(b.url || '');
  if (
    domainA &&
    domainB &&
    domainA === domainB &&
    a.iconHash &&
    b.iconHash &&
    a.iconHash === b.iconHash
  ) {
    // If one name is a code like 95D and the other is the site name, or names match
    const nameNormA = normalizeSearchText(a.name);
    const nameNormB = normalizeSearchText(b.name);
    if (nameNormA === nameNormB || isCodeLikeName(a.name) || isCodeLikeName(b.name)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if two parsed apps are ambiguous candidates that should be flagged for review (not deleted)
 */
export function arePossibleDuplicates(a: ParsedDesktopApp, b: ParsedDesktopApp): boolean {
  const profA = (a.profileDirectory || 'Default').toLowerCase().trim();
  const profB = (b.profileDirectory || 'Default').toLowerCase().trim();
  if (profA !== profB) {
    return false;
  }

  const domainA = getCleanDomain(a.url || '');
  const domainB = getCleanDomain(b.url || '');

  // Case A: Identical icon hash in the same profile, but different app-ids or URLs
  if (a.iconHash && b.iconHash && a.iconHash === b.iconHash) {
    return true;
  }

  // Case B: Same clean domain in the same profile, but differing URLs
  if (domainA && domainB && domainA === domainB && domainA !== 'localhost') {
    return true;
  }

  return false;
}

/**
 * Intelligently deduplicates scanned desktop apps:
 * - Automatically merges confirmed duplicates (same installation, same profile)
 * - Retains all aliases, merged names, desktop file names for search
 * - Preserves installations in different profiles
 * - Flags ambiguous cases for user review without deletion
 */
export function deduplicateDesktopApps(rawApps: ParsedDesktopApp[]): DeduplicationResult {
  const totalRawFound = rawApps.length;
  const consolidated: ParsedDesktopApp[] = [];
  let confirmedDuplicatesMerged = 0;

  for (const candidate of rawApps) {
    // Check if candidate matches any already consolidated app as a confirmed duplicate
    let merged = false;
    for (let i = 0; i < consolidated.length; i++) {
      const existing = consolidated[i];
      if (areConfirmedDuplicates(existing, candidate)) {
        // Merge candidate into existing
        confirmedDuplicatesMerged++;
        merged = true;

        const { primary, secondary } = pickBetterName(existing.name, candidate.name);
        existing.name = primary;

        // Merge aliases
        const aliasesSet = new Set<string>([
          ...(existing.aliases || []),
          ...(candidate.aliases || []),
        ]);
        if (secondary && secondary !== primary) {
          aliasesSet.add(secondary);
        }
        if (isCodeLikeName(candidate.name)) {
          aliasesSet.add(candidate.name);
        }
        const fileA = existing.rawFileName || (existing as any).desktopFileName || '';
        const fileB = candidate.rawFileName || (candidate as any).desktopFileName || '';

        if (fileB) {
          const baseName = fileB.replace(/\.desktop$/i, '');
          if (isCodeLikeName(baseName)) {
            aliasesSet.add(baseName);
          }
        }

        // Merge names
        const mergedNamesSet = new Set<string>([
          ...(existing.mergedNames || []),
          existing.name,
          candidate.name,
        ]);

        // Merge desktop files
        const mergedFilesSet = new Set<string>([
          ...(existing.mergedDesktopFiles || []),
          ...(fileA ? [fileA] : []),
          ...(fileB ? [fileB] : []),
        ]);

        // Merge alternate paths
        const alternatePathsSet = new Set<string>([
          ...(existing.alternateDesktopPaths || []),
          ...(existing.desktopPath ? [existing.desktopPath] : []),
          ...(candidate.desktopPath ? [candidate.desktopPath] : []),
        ]);

        // Prefer path in ~/.local/share/applications if available
        let bestPath = existing.desktopPath;
        if (candidate.desktopPath?.includes('.local/share/applications')) {
          bestPath = candidate.desktopPath;
        }

        // Prefer best icon and appId
        const bestAppId = existing.appId || candidate.appId;
        const bestIcon = existing.icon || candidate.icon;
        const bestIconHash = existing.iconHash || candidate.iconHash;
        const bestExec = existing.execLine || candidate.execLine;

        // Merge notes if distinct
        let mergedNotes = existing.notes || '';
        if (candidate.notes && candidate.notes !== existing.notes) {
          mergedNotes = mergedNotes ? `${mergedNotes} | ${candidate.notes}` : candidate.notes;
        }

        consolidated[i] = {
          ...existing,
          name: primary,
          appId: bestAppId,
          icon: bestIcon,
          iconHash: bestIconHash,
          execLine: bestExec,
          desktopPath: bestPath,
          notes: mergedNotes,
          aliases: Array.from(aliasesSet).filter(Boolean),
          mergedNames: Array.from(mergedNamesSet).filter(Boolean),
          mergedDesktopFiles: Array.from(mergedFilesSet).filter(Boolean),
          alternateDesktopPaths: Array.from(alternatePathsSet).filter(Boolean),
        };

        break;
      }
    }

    if (!merged) {
      // Normalize stable ID with profile prefix to guarantee profile segregation
      const profileKey = (candidate.profileDirectory || 'Default').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const seedKey = (candidate.appId || candidate.rawFileName?.replace(/\.desktop$/i, '') || candidate.url)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      const stableId = `pwa_${profileKey}_${seedKey}`;

      const initialAliases = new Set<string>(candidate.aliases || []);
      if (candidate.rawFileName) {
        const baseName = candidate.rawFileName.replace(/\.desktop$/i, '');
        if (isCodeLikeName(baseName)) {
          initialAliases.add(baseName);
        }
      }
      if (isCodeLikeName(candidate.name)) {
        initialAliases.add(candidate.name);
      }

      consolidated.push({
        ...candidate,
        id: stableId,
        aliases: Array.from(initialAliases),
        mergedNames: [candidate.name],
        mergedDesktopFiles: candidate.rawFileName ? [candidate.rawFileName] : [],
        alternateDesktopPaths: candidate.desktopPath ? [candidate.desktopPath] : [],
      });
    }
  }

  // Second pass: Identify ambiguous possible duplicates (same profile, same domain/icon but different apps)
  let possibleDuplicatesCount = 0;
  for (let i = 0; i < consolidated.length; i++) {
    for (let j = i + 1; j < consolidated.length; j++) {
      const a = consolidated[i];
      const b = consolidated[j];

      if (arePossibleDuplicates(a, b)) {
        a.isPossibleDuplicate = true;
        b.isPossibleDuplicate = true;
        a.possibleDuplicateReason = `Possível equivalência com "${b.name}" (${b.profileDirectory || 'Default'})`;
        b.possibleDuplicateReason = `Possível equivalência com "${a.name}" (${a.profileDirectory || 'Default'})`;
        a.duplicateCandidateId = b.id;
        b.duplicateCandidateId = a.id;
      }
    }
  }

  for (const item of consolidated) {
    if (item.isPossibleDuplicate) {
      possibleDuplicatesCount++;
    }
  }

  return {
    items: consolidated,
    stats: {
      totalRawFound,
      confirmedDuplicatesMerged,
      activeCount: consolidated.length,
      possibleDuplicatesCount,
    },
  };
}
