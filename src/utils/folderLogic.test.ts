import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFolder,
  renameFolder,
  moveFolder,
  deleteFolderSafe,
  assignPWAsToFolder,
  getFolderPath,
  flattenFoldersHierarchy,
  getFolderStats,
  filterItemsByFolder,
} from './folderLogic';
import { PWAFolder, PWAItem } from '../types/pwa';

function makeItem(id: string, name: string, folderId: string | null = null, lastAccessedDate: string | null = null): PWAItem {
  return {
    id,
    name,
    url: `https://${name.toLowerCase()}.com`,
    category: 'Geral',
    notes: '',
    folderId,
    lastAccessedDate,
    accessCount: 0,
    createdAt: '2026-11-15',
  };
}

test('createFolder creates unique folders per parent and prevents duplicate names in same parent', () => {
  let folders: PWAFolder[] = [];
  const res1 = createFolder(folders, { name: 'Trabalho', color: 'sky' });
  folders = res1.folders;
  assert.equal(folders.length, 1);
  assert.equal(res1.folder.name, 'Trabalho');
  assert.equal(res1.folder.parentId, null);

  // Duplicate in same root parent returns existing folder
  const resDup = createFolder(folders, { name: 'trabalho', color: 'rose' });
  assert.equal(resDup.folders.length, 1);
  assert.equal(resDup.folder.id, res1.folder.id);

  // Same name in different parent is allowed (subfolder)
  const resSub = createFolder(folders, { name: 'Trabalho', color: 'emerald', parentId: res1.folder.id });
  assert.equal(resSub.folders.length, 2);
  assert.equal(resSub.folder.parentId, res1.folder.id);
});

test('renameFolder and moveFolder prevent circular nesting', () => {
  const f1: PWAFolder = { id: 'f1', name: 'Root', color: 'sky', parentId: null, createdAt: '2026-11-15' };
  const f2: PWAFolder = { id: 'f2', name: 'Child', color: 'emerald', parentId: 'f1', createdAt: '2026-11-15' };
  const f3: PWAFolder = { id: 'f3', name: 'Grandchild', color: 'amber', parentId: 'f2', createdAt: '2026-11-15' };

  const renamed = renameFolder([f1, f2, f3], 'f2', 'Subpasta Renamed', 'purple');
  assert.equal(renamed.find((f) => f.id === 'f2')?.name, 'Subpasta Renamed');
  assert.equal(renamed.find((f) => f.id === 'f2')?.color, 'purple');

  // Cannot move f1 into its descendant f3
  const invalidMove = moveFolder([f1, f2, f3], 'f1', 'f3');
  assert.equal(invalidMove.find((f) => f.id === 'f1')?.parentId, null);

  // Valid move: f3 directly under f1
  const validMove = moveFolder([f1, f2, f3], 'f3', 'f1');
  assert.equal(validMove.find((f) => f.id === 'f3')?.parentId, 'f1');
});

test('deleteFolderSafe promotes child folders and PWAs to parent folder without deleting items', () => {
  const f1: PWAFolder = { id: 'f1', name: 'Jogos', parentId: null, createdAt: '2026-11-15' };
  const f2: PWAFolder = { id: 'f2', name: 'Slots', parentId: 'f1', createdAt: '2026-11-15' };
  const items: PWAItem[] = [
    makeItem('1', '03win.com', 'f2'),
    makeItem('2', '11kk.com', 'f1'),
    makeItem('3', 'GitHub', null),
  ];

  // Deleting f2 moves item 1 into f1
  const afterDelSub = deleteFolderSafe([f1, f2], items, 'f2');
  assert.equal(afterDelSub.folders.length, 1);
  assert.equal(afterDelSub.items.find((i) => i.id === '1')?.folderId, 'f1');
  assert.equal(afterDelSub.items.length, 3);

  // Deleting f1 moves all its items to root (null)
  const afterDelRoot = deleteFolderSafe(afterDelSub.folders, afterDelSub.items, 'f1');
  assert.equal(afterDelRoot.folders.length, 0);
  assert.equal(afterDelRoot.items.find((i) => i.id === '1')?.folderId, null);
  assert.equal(afterDelRoot.items.find((i) => i.id === '2')?.folderId, null);
});

test('assignPWAsToFolder, getFolderPath, flattenFoldersHierarchy, getFolderStats, and filterItemsByFolder', () => {
  const fRoot: PWAFolder = { id: 'f_root', name: 'Plataformas', color: 'sky', parentId: null, createdAt: '2026-11-15' };
  const fSub: PWAFolder = { id: 'f_sub', name: 'Favoritas', color: 'emerald', parentId: 'f_root', createdAt: '2026-11-15' };
  const folders = [fRoot, fSub];

  let items = [
    makeItem('p1', '03win.com', null, '2026-11-15T10:00:00Z'),
    makeItem('p2', '11kk.com', null, null),
    makeItem('p3', '37A.COM', 'f_root', null),
  ];

  items = assignPWAsToFolder(items, ['p1', 'p2'], 'f_sub');
  assert.equal(items[0].folderId, 'f_sub');
  assert.equal(items[1].folderId, 'f_sub');

  const path = getFolderPath(folders, 'f_sub');
  assert.deepEqual(path.map((f) => f.name), ['Plataformas', 'Favoritas']);

  const flat = flattenFoldersHierarchy(folders);
  assert.equal(flat[0].label, 'Plataformas');
  assert.equal(flat[0].depth, 0);
  assert.equal(flat[1].label, 'Plataformas / Favoritas');
  assert.equal(flat[1].depth, 1);

  const rootStats = getFolderStats(folders, items, 'f_root', '2026-11-15');
  assert.equal(rootStats.directCount, 1);
  assert.equal(rootStats.totalCount, 3);
  assert.equal(rootStats.subfolderCount, 1);
  assert.equal(rootStats.accessedTodayCount, 1);
  assert.equal(rootStats.pendingTodayCount, 2);

  const onlyDirect = filterItemsByFolder(items, folders, 'f_root', false);
  assert.equal(onlyDirect.length, 1);
  assert.equal(onlyDirect[0].id, 'p3');

  const withSub = filterItemsByFolder(items, folders, 'f_root', true);
  assert.equal(withSub.length, 3);

  const unfiledBefore = filterItemsByFolder(items, folders, 'unfiled');
  assert.equal(unfiledBefore.length, 0);

  items = assignPWAsToFolder(items, ['p2'], null);
  const unfiledAfter = filterItemsByFolder(items, folders, 'unfiled');
  assert.equal(unfiledAfter.length, 1);
  assert.equal(unfiledAfter[0].id, 'p2');
});

import { filterAndSortPWAs } from './pwaLogic';
import { getFolderDescendantIds } from './folderLogic';

test('filterAndSortPWAs respects folderFilter, folderFilterIds, and validFolderIds', () => {
  const fRoot: PWAFolder = { id: 'f_root', name: 'Plataformas', parentId: null, createdAt: '2026-11-15' };
  const fSub: PWAFolder = { id: 'f_sub', name: 'Favoritas', parentId: 'f_root', createdAt: '2026-11-15' };
  const folders = [fRoot, fSub];
  const validFolderIds = new Set(folders.map((f) => f.id));

  const items: PWAItem[] = [
    makeItem('p1', '03win.com', 'f_sub'),
    makeItem('p2', '11kk.com', null),
    makeItem('p3', '37A.COM', 'f_root'),
    makeItem('p4', 'Orphan', 'deleted_folder_id'),
  ];

  // Unfiled includes null AND orphaned folderId when validFolderIds is passed
  const unfiled = filterAndSortPWAs(items, { folderFilter: 'unfiled', validFolderIds });
  assert.deepEqual(unfiled.map((i) => i.id), ['p2', 'p4']);

  // Root folder filter with descendants includes direct + subfolder items
  const desc = new Set([fRoot.id, ...getFolderDescendantIds(folders, fRoot.id)]);
  const rootFiltered = filterAndSortPWAs(items, { folderFilter: fRoot.id, folderFilterIds: desc, validFolderIds });
  assert.deepEqual(rootFiltered.map((i) => i.id), ['p1', 'p3']);
});
