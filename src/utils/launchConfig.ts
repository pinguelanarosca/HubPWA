export const PWA_WINDOW_WIDTH = 539;
export const PWA_WINDOW_HEIGHT = 993;

export function getPopupWindowFeatures(
  width: number = PWA_WINDOW_WIDTH,
  height: number = PWA_WINDOW_HEIGHT
): string {
  return `popup=yes,width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
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

  // Fallback scan if [Desktop Entry] header wasn't present
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
  height: number = PWA_WINDOW_HEIGHT
): string {
  const sanitized = execLine
    .replace(/\s*%[uUfFdDnNickvm]/g, '')
    .replace(/\s*--window-size=(?:"[^"]*"|'[^']*'|\S+)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return '';
  if (!isChromeExecCommand(sanitized)) return sanitized;

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

  const pushUnique = (cmd: string) => {
    const normalized = cmd.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  // 1. Prefer Chrome Exec parsed from the .desktop file with explicit --window-size
  if (desktopExecLine) {
    const sizedDesktopExec = applyWindowSizeToChromeExec(desktopExecLine, width, height);
    if (sizedDesktopExec) {
      pushUnique(`${sizedDesktopExec} 2>/dev/null`);
    }
  }

  // 2. Direct saved execLine with explicit --window-size
  if (execLine) {
    const sizedExec = applyWindowSizeToChromeExec(execLine, width, height);
    if (sizedExec) {
      pushUnique(`${sizedExec} 2>/dev/null`);
    }
  }

  // 3. App-ID with Profile and explicit --window-size
  if (appId && hasChrome) {
    pushUnique(`google-chrome ${profileArg} --app-id="${appId}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
    pushUnique(`google-chrome-stable ${profileArg} --app-id="${appId}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
    pushUnique(`chromium ${profileArg} --app-id="${appId}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
  }

  // 4. URL App Mode with Profile and explicit --window-size
  if (url && hasChrome) {
    pushUnique(`google-chrome ${profileArg} --app="${url}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
    pushUnique(`google-chrome-stable ${profileArg} --app="${url}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
    pushUnique(`chromium-browser ${profileArg} --app="${url}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
    pushUnique(`chromium ${profileArg} --app="${url}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
    pushUnique(`chrome ${profileArg} --app="${url}" ${sizeArg} 2>/dev/null`.replace(/\s+/g, ' '));
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
