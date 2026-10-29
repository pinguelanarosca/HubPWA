export interface LocalVersionInfo {
  repo: string;
  branch: string;
  commitSha: string;
  commitShort: string;
  commitDate: string;
  commitMessage: string;
  version: string;
}

export interface RemoteCommitInfo {
  sha: string;
  shortSha: string;
  author: string;
  date: string;
  message: string;
  avatarUrl?: string;
  htmlUrl: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  localVersion: LocalVersionInfo;
  remoteCommit: RemoteCommitInfo;
  checkedAt: string;
}

export const GITHUB_REPO = 'pinguelanarosca/HubPWA';
export const DEFAULT_BRANCH = 'main';

/**
 * Checks whether an update is available comparing commit SHAs
 */
export function isUpdateAvailable(localSha: string, remoteSha: string): boolean {
  if (!localSha || !remoteSha) return false;
  return localSha.trim().toLowerCase() !== remoteSha.trim().toLowerCase();
}

/**
 * Parses GitHub API commit JSON into structured RemoteCommitInfo
 */
export function parseGitHubCommitResponse(data: unknown): RemoteCommitInfo {
  if (!data || typeof data !== 'object') {
    throw new Error('Resposta inválida do GitHub');
  }

  const d = data as Record<string, unknown>;
  const sha = String(d.sha || '');
  const commitObj = (d.commit && typeof d.commit === 'object' ? d.commit : {}) as Record<string, unknown>;
  const authorObj = (commitObj.author && typeof commitObj.author === 'object' ? commitObj.author : {}) as Record<string, unknown>;
  const ghAuthorObj = (d.author && typeof d.author === 'object' ? d.author : {}) as Record<string, unknown>;

  return {
    sha,
    shortSha: sha.slice(0, 7),
    author: String(authorObj.name || ghAuthorObj.login || 'pinguelanarosca'),
    date: String(authorObj.date || new Date().toISOString()),
    message: String(commitObj.message || 'Sem mensagem de commit'),
    avatarUrl: typeof ghAuthorObj.avatar_url === 'string' ? ghAuthorObj.avatar_url : undefined,
    htmlUrl: String(d.html_url || `https://github.com/${GITHUB_REPO}/commit/${sha}`),
  };
}

/**
 * Formats ISO date to readable pt-BR date
 */
export function formatCommitDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoDate;
  }
}
