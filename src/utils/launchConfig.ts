export const PWA_WINDOW_WIDTH = 539;
export const PWA_WINDOW_HEIGHT = 993;

export function getPopupWindowFeatures(
  width: number = PWA_WINDOW_WIDTH,
  height: number = PWA_WINDOW_HEIGHT
): string {
  return `popup=yes,width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
}

export function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeBase64Url(payload: string): string | null {
  if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload)) return null;
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((payload.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeLaunchBridgePayload(targetUrl: string): string | null {
  if (!/^https?:\/\//i.test((targetUrl || '').trim())) return null;
  return encodeBase64Url(targetUrl.trim());
}

export function decodeLaunchBridgePayload(payload: string): string | null {
  const decoded = decodeBase64Url(payload);
  if (!decoded) return null;
  const trimmed = decoded.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function buildLaunchBridgeUrl(
  targetUrl: string,
  origin: string,
  width: number = PWA_WINDOW_WIDTH,
  height: number = PWA_WINDOW_HEIGHT,
  windowTitle?: string
): string | null {
  const payload = encodeLaunchBridgePayload(targetUrl);
  if (!payload || !origin) return null;
  const cleanOrigin = origin.replace(/\/+$/g, '');
  const titleQuery =
    windowTitle && windowTitle.trim()
      ? `&t=${encodeBase64Url(windowTitle.trim())}`
      : '';
  return `${cleanOrigin}/api/launch-bridge/${payload}?w=${width}&h=${height}${titleQuery}`;
}

export function extractExecFromDesktopContent(content: string): string | null {
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  let inDesktopEntry = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('[')) {
      inDesktopEntry = trimmed === '[Desktop Entry]';
      continue;
    }
    if (inDesktopEntry && /^Exec\s*=/i.test(trimmed)) {
      const value = trimmed.replace(/^Exec\s*=\s*/i, '').trim();
      return value || null;
    }
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^Exec\s*=/i.test(trimmed)) {
      const value = trimmed.replace(/^Exec\s*=\s*/i, '').trim();
      return value || null;
    }
  }

  return null;
}

export function isChromeExecCommand(execLine: string): boolean {
  return /(?:^|\/|\s|"|')(?:google-chrome(?:-stable|-beta|-unstable)?|chromium(?:-browser)?|chrome)(?:\s|"|'|$)/i.test(
    execLine
  );
}

export function applyWindowSizeToChromeExec(
  execLine: string,
  width: number = PWA_WINDOW_WIDTH,
  height: number = PWA_WINDOW_HEIGHT,
  bridgeOrigin?: string,
  windowTitle?: string
): string {
  let sanitized = execLine
    .replace(/\s*%[uUfFdDnNickvm]/g, '')
    .replace(/\s*--window-size=(?:"[^"]*"|'[^']*'|\S+)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return '';
  if (!isChromeExecCommand(sanitized)) return sanitized;

  if (bridgeOrigin) {
    sanitized = sanitized.replace(
      /--app=(?:"([^"]+)"|'([^']+)'|([^\s"']+))/i,
      (full, q1, q2, q3) => {
        const rawUrl = q1 || q2 || q3 || '';
        const bridge = buildLaunchBridgeUrl(rawUrl, bridgeOrigin, width, height, windowTitle);
        return bridge ? `--app="${bridge}"` : full;
      }
    );
  }

  return `${sanitized} --window-size=${width},${height}`;
}

export interface LinuxLaunchCandidateOptions {
  desktopExecLine?: string | null;
  execLine?: string;
  desktopPath?: string;
  desktopPathExists?: boolean;
  rawFileName?: string;
  appId?: string;
  profileDirectory?: string;
  url?: string;
  windowTitle?: string;
  bridgeOrigin?: string;
  chromeBinaries?: string[];
  hasGtkLaunch: boolean;
  hasGio: boolean;
  hasChrome: boolean;
  homeApplicationsDir?: string;
  width?: number;
  height?: number;
}

export function buildLinuxLaunchCandidates(options: LinuxLaunchCandidateOptions): string[] {
  const {
    desktopExecLine,
    execLine,
    desktopPath,
    desktopPathExists = false,
    rawFileName,
    appId,
    profileDirectory,
    url,
    windowTitle,
    bridgeOrigin,
    chromeBinaries,
    hasGtkLaunch,
    hasGio,
    hasChrome,
    homeApplicationsDir = '$HOME/.local/share/applications',
    width = PWA_WINDOW_WIDTH,
    height = PWA_WINDOW_HEIGHT,
  } = options;

  const profileArg = profileDirectory ? `--profile-directory="${profileDirectory}"` : '';
  const sizeArg = `--window-size=${width},${height}`;
  const candidates: string[] = [];
  const seen = new Set<string>();

  const bins =
    Array.isArray(chromeBinaries) && chromeBinaries.length > 0
      ? chromeBinaries
      : ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium', 'chrome'];

  const pushUnique = (cmd: string) => {
    const normalized = cmd.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  // 1. Prefer Chrome Exec parsed from the .desktop file with explicit --window-size
  if (desktopExecLine) {
    const sizedDesktopExec = applyWindowSizeToChromeExec(
      desktopExecLine,
      width,
      height,
      bridgeOrigin,
      windowTitle
    );
    if (sizedDesktopExec) {
      pushUnique(`${sizedDesktopExec} 2>/dev/null`);
    }
  }

  // 2. Direct saved execLine with explicit --window-size
  if (execLine) {
    const sizedExec = applyWindowSizeToChromeExec(execLine, width, height, bridgeOrigin, windowTitle);
    if (sizedExec) {
      pushUnique(`${sizedExec} 2>/dev/null`);
    }
  }

  // 3. App-ID with Profile and explicit --window-size
  if (appId && hasChrome) {
    for (const bin of bins) {
      pushUnique(`${bin} ${profileArg} --app-id="${appId}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
    }
  }

  // 4. URL App Mode with Profile (clones & URL PWAs)
  if (url && hasChrome) {
    const appTarget =
      (bridgeOrigin && buildLaunchBridgeUrl(url, bridgeOrigin, width, height, windowTitle)) || url;
    for (const bin of bins) {
      pushUnique(`${bin} ${profileArg} --app="${appTarget}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
    }
  }

  // 5. Fallback to native .desktop launchers if direct Chrome launch wasn't possible
  if (desktopPath && desktopPathExists) {
    const baseName = desktopPath.replace(/^.*\//, '').replace(/\.desktop$/i, '');
    if (hasGio) pushUnique(`gio launch "${desktopPath}" 2>/dev/null`);
    if (hasGtkLaunch && baseName) pushUnique(`gtk-launch "${baseName}" 2>/dev/null`);
  }

  if (rawFileName) {
    const desktopName = rawFileName.replace(/\.desktop$/i, '');
    if (hasGtkLaunch) pushUnique(`gtk-launch "${desktopName}" 2>/dev/null`);
    if (hasGio) pushUnique(`gio launch "${homeApplicationsDir}/${rawFileName}" 2>/dev/null`);
  }

  return candidates;
}
