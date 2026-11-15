import { PWAFolder, PWAItem } from '../types/pwa';
import { isAccessedToday, getTodayString } from './pwaLogic';

export const FOLDERS_STORAGE_KEY = 'chrome_pwa_hub_folders_v1';

export function loadFolders(): PWAFolder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (f): f is PWAFolder =>
            Boolean(f && typeof f === 'object' && typeof f.id === 'string' && typeof f.name === 'string')
        );
      }
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

export function saveFolders(folders: PWAFolder[]): void {
  try {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch {
    // ignore storage errors
  }
}

export function createFolder(
  folders: PWAFolder[],
  input: { name: string; color?: string; parentId?: string | null }
): { folder: PWAFolder; folders: PWAFolder[] } {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error('Nome da pasta é obrigatório.');
  }

  const normalizedParentId = input.parentId || null;
  const duplicate = folders.find(
    (f) =>
      (f.parentId || null) === normalizedParentId &&
      f.name.trim().toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    return { folder: duplicate, folders };
  }

  const newFolder: PWAFolder = {
    id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    color: input.color || 'emerald',
    parentId: normalizedParentId,
    createdAt: new Date().toISOString(),
  };

  return {
    folder: newFolder,
    folders: [...folders, newFolder],
  };
}

export function renameFolder(
  folders: PWAFolder[],
  folderId: string,
  newName: string,
  newColor?: string
): PWAFolder[] {
  const cleanName = newName.trim();
  if (!cleanName) return folders;

  return folders.map((f) => {
    if (f.id !== folderId) return f;
    return {
      ...f,
      name: cleanName,
      ...(newColor !== undefined ? { color: newColor } : {}),
    };
  });
}

export function getFolderDescendantIds(folders: PWAFolder[], rootFolderId: string): Set<string> {
  const result = new Set<string>();
  const queue = [rootFolderId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const f of folders) {
      if ((f.parentId || null) === currentId && !result.has(f.id) && f.id !== rootFolderId) {
        result.add(f.id);
        queue.push(f.id);
      }
    }
  }

  return result;
}

export function moveFolder(
  folders: PWAFolder[],
  folderId: string,
  newParentId: string | null
): PWAFolder[] {
  const targetParent = newParentId || null;
  if (targetParent === folderId) return folders;

  if (targetParent) {
    const descendants = getFolderDescendantIds(folders, folderId);
    if (descendants.has(targetParent)) {
      return folders; // Prevent circular nesting
    }
  }

  return folders.map((f) => (f.id === folderId ? { ...f, parentId: targetParent } : f));
}

export function deleteFolderSafe(
  folders: PWAFolder[],
  items: PWAItem[],
  folderId: string
): { folders: PWAFolder[]; items: PWAItem[] } {
  const target = folders.find((f) => f.id === folderId);
  if (!target) return { folders, items };

  const fallbackParentId = target.parentId || null;

  const updatedFolders = folders
    .filter((f) => f.id !== folderId)
    .map((f) => (f.parentId === folderId ? { ...f, parentId: fallbackParentId } : f));

  const updatedItems = items.map((it) =>
    it.folderId === folderId ? { ...it, folderId: fallbackParentId } : it
  );

  return { folders: updatedFolders, items: updatedItems };
}

export function assignPWAsToFolder(
  items: PWAItem[],
  pwaIds: string[] | Set<string>,
  targetFolderId: string | null
): PWAItem[] {
  const idSet = pwaIds instanceof Set ? pwaIds : new Set(pwaIds);
  const normalizedTarget = targetFolderId || null;

  return items.map((it) => {
    if (!idSet.has(it.id)) return it;
    return {
      ...it,
      folderId: normalizedTarget,
    };
  });
}

export function getFolderPath(folders: PWAFolder[], folderId: string | null | undefined): PWAFolder[] {
  if (!folderId) return [];
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const path: PWAFolder[] = [];
  const visited = new Set<string>();

  let currentId: string | null | undefined = folderId;
  while (currentId && !visited.has(currentId)) {
    const folder = folderMap.get(currentId);
    if (!folder) break;
    visited.add(currentId);
    path.unshift(folder);
    currentId = folder.parentId || null;
  }

  return path;
}

export interface FlattenedFolderOption {
  folder: PWAFolder;
  depth: number;
  label: string;
}

export function flattenFoldersHierarchy(folders: PWAFolder[]): FlattenedFolderOption[] {
  const byParent = new Map<string | null, PWAFolder[]>();
  const validIds = new Set(folders.map((f) => f.id));

  for (const f of folders) {
    const parentKey = f.parentId && validIds.has(f.parentId) ? f.parentId : null;
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey)!.push(f);
  }

  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }

  const result: FlattenedFolderOption[] = [];
  const visited = new Set<string>();

  const walk = (parentId: string | null, depth: number, prefixParts: string[]) => {
    const children = byParent.get(parentId) || [];
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      const nextParts = [...prefixParts, child.name];
      result.push({
        folder: child,
        depth,
        label: nextParts.join(' / '),
      });
      walk(child.id, depth + 1, nextParts);
    }
  };

  walk(null, 0, []);
  return result;
}

export interface FolderStats {
  folderId: string;
  directCount: number;
  totalCount: number;
  subfolderCount: number;
  accessedTodayCount: number;
  pendingTodayCount: number;
  previewItems: PWAItem[];
}

export function getFolderStats(
  folders: PWAFolder[],
  items: PWAItem[],
  folderId: string,
  todayStr: string = getTodayString()
): FolderStats {
  const descendantIds = getFolderDescendantIds(folders, folderId);
  const allFolderIds = new Set([folderId, ...descendantIds]);

  const directItems = items.filter((it) => it.folderId === folderId);
  const treeItems = items.filter((it) => it.folderId && allFolderIds.has(it.folderId));
  const subfolderCount = folders.filter((f) => (f.parentId || null) === folderId).length;

  let accessedTodayCount = 0;
  for (const it of treeItems) {
    if (isAccessedToday(it.lastAccessedDate, todayStr)) {
      accessedTodayCount++;
    }
  }

  return {
    folderId,
    directCount: directItems.length,
    totalCount: treeItems.length,
    subfolderCount,
    accessedTodayCount,
    pendingTodayCount: treeItems.length - accessedTodayCount,
    previewItems: (directItems.length > 0 ? directItems : treeItems).slice(0, 4),
  };
}

export function filterItemsByFolder(
  items: PWAItem[],
  folders: PWAFolder[],
  selectedFolderId: string,
  includeSubfolders = true
): PWAItem[] {
  if (!selectedFolderId || selectedFolderId === 'all') {
    return items;
  }

  const validFolderIds = new Set(folders.map((f) => f.id));

  if (selectedFolderId === 'unfiled') {
    return items.filter((it) => !it.folderId || !validFolderIds.has(it.folderId));
  }

  if (!includeSubfolders) {
    return items.filter((it) => it.folderId === selectedFolderId);
  }

  const allowedIds = new Set([selectedFolderId, ...getFolderDescendantIds(folders, selectedFolderId)]);
  return items.filter((it) => Boolean(it.folderId && allowedIds.has(it.folderId)));
}
