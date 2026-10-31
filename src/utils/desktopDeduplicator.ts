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
 * Checks whether a name appears to be a short code (e.g. "95D", "93D", "95H", "A1")
 */
export function isCodeLikeName(name: string): boolean {
  if (!name) return false;
  const clean = name.trim();
  // Patterns like "95D", "93D", "95H", short alphanumeric codes <= 5 chars
  return /^[0-9]{1,4}[a-zA-Z]{0,3}$/.test(clean) || clean.length <= 4;
}

/**
 * Checks whether an item belongs to Chrome's Profile 5
 */
export function isItemProfile5(item: {
  profileDirectory?: string;
  execLine?: string;
  desktopPath?: string;
  rawFileName?: string;
}): boolean {
  if (item.profileDirectory) {
    const clean = item.profileDirectory.toLowerCase().replace(/[\s_-]/g, '');
    if (clean === 'profile5') return true;
  }
  if (item.execLine && /--profile-directory=["']?Profile[ _]?5["']?/i.test(item.execLine)) {
    return true;
  }
  if (item.desktopPath && /Profile[ _]?5/i.test(item.desktopPath)) {
    return true;
  }
  if (item.rawFileName && /Profile[ _]?5/i.test(item.rawFileName)) {
    return true;
  }
  return false;
}

/**
 * Helper to get filename from rawFileName or desktopFileName
 */
function getDesktopFileName(item: ParsedDesktopApp): string {
  return item.rawFileName || (item as any).desktopFileName || '';
}

/**
 * Checks if two entries belong to the exact same platform
 * Evaluates appId, normalized URL, domain, desktop filename, code-like cross-reference, and names.
 */
export function areSamePlatform(a: ParsedDesktopApp, b: ParsedDesktopApp): boolean {
  // 1. Same Chrome appId (Chrome calculates the 32-character ID from the PWA manifest start_url)
  if (a.appId && b.appId && a.appId.toLowerCase() === b.appId.toLowerCase()) {
    return true;
  }

  // 2. Exact same normalized URL
  const normUrlA = normalizeAppUrl(a.url);
  const normUrlB = normalizeAppUrl(b.url);
  if (normUrlA && normUrlB && normUrlA === normUrlB) {
    return true;
  }

  // 3. Same clean domain (e.g. mercadolivre.com.br, web.whatsapp.com, vault.bitwarden.com)
  const domA = getCleanDomain(a.url || '');
  const domB = getCleanDomain(b.url || '');
  if (domA && domB && domA !== 'localhost' && domA.length > 3) {
    if (domA === domB) {
      // For shared corporate domains like google.com, require matching service subdomain or subpath
      if (domA === 'google.com') {
        const subA = (a.url.match(/https?:\/\/([^/]+)/) || [])[1] || '';
        const subB = (b.url.match(/https?:\/\/([^/]+)/) || [])[1] || '';
        if (subA && subB && subA === subB) {
          return true;
        }
      } else {
        return true;
      }
    }
  }

  // 4. Identical desktop file name (e.g. 95D.desktop in ~/.local/share/applications vs Desktop/001)
  const fileA = getDesktopFileName(a);
  const fileB = getDesktopFileName(b);
  if (fileA && fileB && fileA.toLowerCase() === fileB.toLowerCase()) {
    return true;
  }

  // 5. Code-like cross-reference: one item is named "95D" and the other references "95D" in files or aliases
  const checkCodeMatch = (codeApp: ParsedDesktopApp, targetApp: ParsedDesktopApp) => {
    const code = codeApp.name?.trim();
    if (!isCodeLikeName(code)) return false;
    const cleanCode = toCompactAlphaNumeric(code);
    if (!cleanCode) return false;

    const targetFiles = [
      getDesktopFileName(targetApp),
      ...(targetApp.mergedDesktopFiles || []),
      ...(targetApp.aliases || []),
      ...(targetApp.mergedNames || []),
    ].map(toCompactAlphaNumeric);

    return targetFiles.includes(cleanCode);
  };

  if (checkCodeMatch(a, b) || checkCodeMatch(b, a)) {
    return true;
  }

  // 6. Descriptive names match exactly (when neither is a short code like 95D)
  const nameA = normalizeSearchText(a.name);
  const nameB = normalizeSearchText(b.name);
  if (nameA && nameB && nameA === nameB && !isCodeLikeName(a.name) && !isCodeLikeName(b.name)) {
    return true;
  }

  // 7. Matching icon hash on the same root domain
  if (
    a.iconHash &&
    b.iconHash &&
    a.iconHash === b.iconHash &&
    domA &&
    domB &&
    (domA === domB || domA.endsWith(`.${domB}`) || domB.endsWith(`.${domA}`))
  ) {
    return true;
  }

  return false;
}

/**
 * Calculates priority score for an installation of a platform.
 * PROFILE 5 HAS ABSOLUTE PRIORITY over all other profiles (+100,000 points).
 */
export function getInstallationScore(item: ParsedDesktopApp): number {
  let score = 0;

  // ABSOLUTE PRIORITY: Profile 5
  if (isItemProfile5(item)) {
    score += 100000;
  }

  // Has existing desktop launcher path
  if (item.desktopPath) {
    score += 1000;
    // Prefer the canonical ~/.local/share/applications directory
    if (item.desktopPath.includes('.local/share/applications')) {
      score += 500;
    }
  }

  // Has explicit Chrome appId
  if (item.appId) {
    score += 200;
  }

  // Has explicit Exec command line
  if (item.execLine) {
    score += 100;
  }

  // Has resolved local icon
  if (item.icon && !item.icon.includes('google.com/s2/favicons')) {
    score += 50;
  }

  // Prefer human-readable descriptive name over short codes
  if (!isCodeLikeName(item.name)) {
    score += 20;
  }

  return score;
}

/**
 * Strips unwanted profile suffixes like "(Perfil 2)" or "(Profile 1)" from names
 */
export function cleanProfileSuffix(name: string): string {
  if (!name) return '';
  return name.replace(/\s*\((?:perfil|profile)\s*\d+\)/i, '').trim();
}

/**
 * Chooses the best human-readable descriptive name among candidates
 */
function pickBestDisplayName(primary: ParsedDesktopApp, allNames: string[]): string {
  const cleanedPrimary = cleanProfileSuffix(primary.name);
  if (cleanedPrimary && !isCodeLikeName(cleanedPrimary)) {
    return cleanedPrimary;
  }

  // If primary is a code like 95D, find descriptive name from other candidates
  const descriptive = allNames
    .map(cleanProfileSuffix)
    .filter((n) => n && !isCodeLikeName(n));

  if (descriptive.length > 0) {
    return descriptive[0];
  }

  return cleanedPrimary || primary.name || 'PWA';
}

/**
 * Consolidated deduplication engine:
 * - Exactly ONE card per platform across ALL profiles
 * - Absolute priority for Chrome Profile 5
 * - If not in Profile 5, maintains one valid installation from another profile
 * - Retains desktop launcher, appId and profile of the chosen installation for native launch
 * - Consolidates all notes, aliases, desktop filenames, and history
 * - Does not modify or delete Ubuntu .desktop files
 */
export function deduplicateDesktopApps(rawApps: ParsedDesktopApp[]): DeduplicationResult {
  const totalRawFound = rawApps.length;

  if (rawApps.length === 0) {
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

  // Group raw apps into platform clusters
  const clusters: ParsedDesktopApp[][] = [];

  for (const app of rawApps) {
    const matchingClusterIndices: number[] = [];

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      // Check if app matches any member of this cluster
      const matchesCluster = cluster.some((member) => areSamePlatform(member, app));
      if (matchesCluster) {
        matchingClusterIndices.push(i);
      }
    }

    if (matchingClusterIndices.length === 0) {
      // New cluster
      clusters.push([app]);
    } else {
      // Add to first matching cluster
      const primaryIndex = matchingClusterIndices[0];
      clusters[primaryIndex].push(app);

      // If matches multiple clusters (transitive link), merge them
      for (let k = matchingClusterIndices.length - 1; k > 0; k--) {
        const mergeFromIndex = matchingClusterIndices[k];
        clusters[primaryIndex].push(...clusters[mergeFromIndex]);
        clusters.splice(mergeFromIndex, 1);
      }
    }
  }

  let confirmedDuplicatesMerged = 0;
  const consolidated: ParsedDesktopApp[] = [];

  for (const cluster of clusters) {
    if (cluster.length > 1) {
      confirmedDuplicatesMerged += cluster.length - 1;
    }

    // Sort cluster items by installation priority (Profile 5 wins with +100,000 score)
    cluster.sort((a, b) => getInstallationScore(b) - getInstallationScore(a));
    const primary = cluster[0];

    // Pick best display name
    const allNames = cluster.map((c) => c.name);
    const bestName = pickBestDisplayName(primary, allNames);

    // Merge all aliases & code names (e.g. 95D, 93D)
    const aliasesSet = new Set<string>();
    for (const item of cluster) {
      (item.aliases || []).forEach((a) => aliasesSet.add(a));
      if (item.name && item.name !== bestName) {
        aliasesSet.add(item.name);
      }
      if (isCodeLikeName(item.name)) {
        aliasesSet.add(item.name);
      }
      const fileName = getDesktopFileName(item);
      if (fileName) {
        const baseName = fileName.replace(/\.desktop$/i, '');
        if (isCodeLikeName(baseName)) {
          aliasesSet.add(baseName);
        }
      }
    }

    // Merge names
    const mergedNamesSet = new Set<string>();
    for (const item of cluster) {
      if (item.name) mergedNamesSet.add(item.name);
      (item.mergedNames || []).forEach((n) => mergedNamesSet.add(n));
    }

    // Merge desktop files
    const mergedFilesSet = new Set<string>();
    for (const item of cluster) {
      const fileName = getDesktopFileName(item);
      if (fileName) mergedFilesSet.add(fileName);
      (item.mergedDesktopFiles || []).forEach((f) => mergedFilesSet.add(f));
    }

    // Merge alternate desktop paths
    const alternatePathsSet = new Set<string>();
    for (const item of cluster) {
      if (item.desktopPath) alternatePathsSet.add(item.desktopPath);
      (item.alternateDesktopPaths || []).forEach((p) => alternatePathsSet.add(p));
    }

    // Merge notes
    const uniqueNotes: string[] = [];
    for (const item of cluster) {
      if (item.notes && item.notes.trim()) {
        const trimmed = item.notes.trim();
        if (!uniqueNotes.includes(trimmed)) {
          uniqueNotes.push(trimmed);
        }
      }
    }
    const combinedNotes = uniqueNotes.join(' | ');

    // Best icon (prefer local icon)
    let bestIcon = primary.icon;
    for (const item of cluster) {
      if (item.icon && !item.icon.includes('google.com/s2/favicons')) {
        bestIcon = item.icon;
        break;
      }
    }

    // Explicitly enforce profile if Profile 5 detected
    const finalProfile = isItemProfile5(primary)
      ? 'Profile 5'
      : primary.profileDirectory || 'Default';

    // Form stable ID for platform
    const platformSeed = (primary.appId || getCleanDomain(primary.url) || bestName)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    const stableId = `pwa_platform_${platformSeed}`;

    consolidated.push({
      ...primary,
      id: stableId,
      name: bestName,
      profileDirectory: finalProfile,
      icon: bestIcon,
      notes: combinedNotes,
      aliases: Array.from(aliasesSet).filter(Boolean),
      mergedNames: Array.from(mergedNamesSet).filter(Boolean),
      mergedDesktopFiles: Array.from(mergedFilesSet).filter(Boolean),
      alternateDesktopPaths: Array.from(alternatePathsSet).filter(Boolean),
      isPossibleDuplicate: false,
    });
  }

  // Sort alphabetically by name
  consolidated.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return {
    items: consolidated,
    stats: {
      totalRawFound,
      confirmedDuplicatesMerged,
      activeCount: consolidated.length,
      possibleDuplicatesCount: 0,
    },
  };
}

// Backwards compatibility alias
export const areConfirmedDuplicates = areSamePlatform;
export const arePossibleDuplicates = () => false;
