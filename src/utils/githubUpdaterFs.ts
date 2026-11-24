import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_UPDATE_EXCLUDES = new Set<string>([
  'node_modules',
  '.git',
  '.env',
  '.env.local',
  '.env.production',
  'data',
  '.playwright-cli',
]);

/**
 * Finds the extracted top-level repository directory inside an extracted GitHub tarball folder.
 */
export function findExtractedRepoDirectory(extractRoot: string): string | null {
  if (!extractRoot || !fs.existsSync(extractRoot)) return null;
  const entries = fs.readdirSync(extractRoot, { withFileTypes: true });
  const dirEntry = entries.find((entry) => entry.isDirectory());
  if (!dirEntry) return null;
  return path.resolve(extractRoot, dirEntry.name);
}

/**
 * Recursively copies updated files from `srcDir` into `destDir` using Node's native FS APIs
 * (no external `rsync` binary required), skipping protected directories and environment files.
 */
export function copyUpdateDirectory(
  srcDir: string,
  destDir: string,
  options: { excludeNames?: Set<string> } = {}
): { copiedFiles: number; skippedEntries: string[] } {
  const excludeNames = options.excludeNames ?? DEFAULT_UPDATE_EXCLUDES;
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Diretório de origem não encontrado: ${srcDir}`);
  }
  fs.mkdirSync(destDir, { recursive: true });

  let copiedFiles = 0;
  const skippedEntries: string[] = [];

  const walk = (currentSrc: string, currentDest: string) => {
    const entries = fs.readdirSync(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (excludeNames.has(entry.name) || entry.name.startsWith('.env.')) {
        skippedEntries.push(path.relative(srcDir, path.join(currentSrc, entry.name)));
        continue;
      }

      const srcPath = path.join(currentSrc, entry.name);
      const destPath = path.join(currentDest, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        walk(srcPath, destPath);
      } else if (entry.isSymbolicLink()) {
        // Avoid copying potentially unsafe symlinks out of extracted archives
        skippedEntries.push(path.relative(srcDir, srcPath));
      } else if (entry.isFile()) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        try {
          const stat = fs.statSync(srcPath);
          fs.chmodSync(destPath, stat.mode);
        } catch {
          // ignore permission sync errors on filesystems without POSIX modes
        }
        copiedFiles += 1;
      }
    }
  };

  walk(srcDir, destDir);
  return { copiedFiles, skippedEntries };
}
