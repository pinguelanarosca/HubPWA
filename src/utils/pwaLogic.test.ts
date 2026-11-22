import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTodayString,
  isAccessedToday,
  markAsAccessed,
  toggleAccessedToday,
  calculateStats,
  filterAndSortPWAs,
  importPWAsFromJson,
  exportPWAsToJson,
  formatAccessDateTime,
  formatAccessCompact,
  isAndroidOrRedroidApp,
  resolveFaviconAtInsertion,
  getCleanDomain,
  extractChromeProfileDirectory,
  formatChromeProfileDisplay,
  togglePWAFlag,
  updatePWAMoneyDate,
  getPWAFlagState,
  isPWAFlagActive,
  countPWAFlags,
  countPWAFlagBreakdown,
  sanitizeDayMonthTyping,
  normalizeDayMonthOnBlur,
  getMsUntilNextMidnight,
  getScopedSelectableItems,
  migratePWAFlags,
  batchSetRating,
  batchSetStatus,
  batchSetDailyFlag,
  batchClearFlags,
  normalizeChromeProfileInput,
  stripProfileSuffixFromName,
  clonePWAForProfile,
  buildAvailableChromeProfiles,
  isDeprecatedGenericIconUrl,
  isPreservableIconUrl,
  isChromeShortcutLocalCandidate,
  shouldUpgradeChromeShortcutIcon,
  appendCacheBuster,
  extractHtmlIconCandidates,
  isSameOrMatchingPWA,
  ensureUniquePWAIds,
  computeCardSelection,
  getVisuallyOrderedPWAIds,
} from './pwaLogic';
import { PWAItem } from '../types/pwa';

test('getTodayString returns YYYY-MM-DD for given date', () => {
  const d = new Date(2026, 9, 29); // Month is 0-indexed: 9 = October
  assert.equal(getTodayString(d), '2026-10-29');
});

test('isAccessedToday returns true only if lastAccessed matches today date prefix', () => {
  const today = '2026-10-29';
  assert.equal(isAccessedToday('2026-10-29T10:15:00.000Z', today), true);
  assert.equal(isAccessedToday('2026-10-29', today), true);
  assert.equal(isAccessedToday('2026-10-28T23:59:59.000Z', today), false);
  assert.equal(isAccessedToday(null, today), false);
  assert.equal(isAccessedToday(undefined, today), false);
});

test('markAsAccessed updates timestamp and increments access count', () => {
  const item: PWAItem = {
    id: '1',
    name: 'GitHub',
    url: 'https://github.com',
    category: 'Dev',
    notes: 'Repo tracking',
    lastAccessedDate: null,
    accessCount: 0,
    createdAt: '2026-10-01',
  };

  const fakeNow = new Date('2026-10-29T14:30:00.000Z');
  const updated = markAsAccessed(item, fakeNow, '2026-10-29');

  assert.equal(isAccessedToday(updated.lastAccessedDate, '2026-10-29'), true);
  assert.equal(isAccessedToday(updated.lastAccessedDate, '2026-10-30'), false);
  assert.equal(updated.accessCount, 1);
});

test('toggleAccessedToday switches between accessed and pending states', () => {
  const today = '2026-10-29';
  const item: PWAItem = {
    id: '2',
    name: 'Notion',
    url: 'https://notion.so',
    category: 'Produtividade',
    notes: 'Workspace diário',
    lastAccessedDate: null,
    accessCount: 3,
    createdAt: '2026-10-01',
  };

  // Turn to accessed
  const accessed = toggleAccessedToday(item, today);
  assert.equal(isAccessedToday(accessed.lastAccessedDate, today), true);
  assert.equal(accessed.accessCount, 4);

  // Turn back to pending
  const reverted = toggleAccessedToday(accessed, today);
  assert.equal(isAccessedToday(reverted.lastAccessedDate, today), false);
  assert.equal(reverted.lastAccessedDate, null);
  assert.equal(reverted.accessCount, 3);
});

test('calculateStats computes accurate total, accessed, pending and completion rates', () => {
  const today = '2026-10-29';
  const items: PWAItem[] = [
    {
      id: '1',
      name: 'Gmail',
      url: 'https://mail.google.com',
      category: 'Google',
      notes: '',
      lastAccessedDate: '2026-10-29T08:00:00Z',
      accessCount: 1,
      createdAt: '2026-10-01',
    },
    {
      id: '2',
      name: 'Slack',
      url: 'https://slack.com',
      category: 'Comunicação',
      notes: '',
      lastAccessedDate: '2026-10-28T18:00:00Z',
      accessCount: 5,
      createdAt: '2026-10-01',
    },
    {
      id: '3',
      name: 'Linear',
      url: 'https://linear.app',
      category: 'Dev',
      notes: '',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-01',
    },
  ];

  const stats = calculateStats(items, today);
  assert.equal(stats.total, 3);
  assert.equal(stats.accessedTodayCount, 1);
  assert.equal(stats.pendingTodayCount, 2);
  assert.equal(stats.completionPercentage, 33);
});

test('filterAndSortPWAs filters by query, category, status and maintains pinned order', () => {
  const today = '2026-10-29';
  const items: PWAItem[] = [
    {
      id: '1',
      name: 'Linear',
      url: 'https://linear.app',
      category: 'Dev',
      notes: 'Roadmap Q4',
      lastAccessedDate: '2026-10-29T09:00:00Z',
      accessCount: 10,
      pinned: false,
      createdAt: '2026-10-01',
    },
    {
      id: '2',
      name: 'GitHub',
      url: 'https://github.com',
      category: 'Dev',
      notes: 'Pull requests',
      lastAccessedDate: null,
      accessCount: 20,
      pinned: true,
      createdAt: '2026-10-01',
    },
    {
      id: '3',
      name: 'Spotify',
      url: 'https://open.spotify.com',
      category: 'Mídia',
      notes: 'Playlist foco',
      lastAccessedDate: null,
      accessCount: 2,
      pinned: false,
      createdAt: '2026-10-01',
    },
  ];

  // Search by note content
  const searchResult = filterAndSortPWAs(items, { search: 'Roadmap', todayStr: today });
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].name, 'Linear');

  // Filter pending status (vermelhos)
  const pendingOnly = filterAndSortPWAs(items, { statusFilter: 'pending', todayStr: today });
  assert.equal(pendingOnly.length, 2);
  // Pinned GitHub should come first
  assert.equal(pendingOnly[0].name, 'GitHub');

  // Filter accessed status (verdes)
  const accessedOnly = filterAndSortPWAs(items, { statusFilter: 'accessed', todayStr: today });
  assert.equal(accessedOnly.length, 1);
  assert.equal(accessedOnly[0].name, 'Linear');
});

test('import and export JSON handles arrays and sanitizes items', () => {
  const sample = [
    {
      id: 'pwa-1',
      name: 'Notion',
      url: 'notion.so',
      category: 'Produtividade',
      notes: 'Anotações gerais',
      accessCount: 4,
      lastAccessedDate: '2026-10-29T12:00:00Z',
    },
  ];

  const json = JSON.stringify(sample);
  const imported = importPWAsFromJson(json);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].name, 'Notion');
  assert.equal(imported[0].url, 'https://notion.so');

  const reExported = exportPWAsToJson(imported);
  assert.match(reExported, /"name": "Notion"/);
});

test('filterAndSortPWAs sorts by 1 to 5 star ratings descending', () => {
  const items: PWAItem[] = [
    {
      id: '1',
      name: 'Unrated App',
      url: 'https://app0.com',
      category: 'Geral',
      notes: '',
      lastAccessedDate: null,
      accessCount: 0,
      rating: 0,
      createdAt: '2026-10-01',
    },
    {
      id: '2',
      name: '5 Star App',
      url: 'https://app5.com',
      category: 'Geral',
      notes: '',
      lastAccessedDate: null,
      accessCount: 0,
      rating: 5,
      createdAt: '2026-10-01',
    },
    {
      id: '3',
      name: '3 Star App',
      url: 'https://app3.com',
      category: 'Geral',
      notes: '',
      lastAccessedDate: null,
      accessCount: 0,
      rating: 3,
      createdAt: '2026-10-01',
    },
  ];

  const sorted = filterAndSortPWAs(items, { sortBy: 'pinned' });
  assert.equal(sorted[0].name, '5 Star App');
  assert.equal(sorted[1].name, '3 Star App');
  assert.equal(sorted[2].name, 'Unrated App');
});

test('formatAccessDateTime accurately parses and formats date and time', () => {
  // 1. Full ISO with time
  const res1 = formatAccessDateTime('2026-11-06T14:32:05.000Z');
  assert.equal(res1.hasRecord, true);
  assert.equal(res1.dateStr, '06/11/2026');
  assert.equal(res1.timeStr, '14:32:05');
  assert.equal(res1.fullStr, '06/11/2026 às 14:32:05');

  // 2. Date only
  const res2 = formatAccessDateTime('2026-11-06');
  assert.equal(res2.hasRecord, true);
  assert.equal(res2.dateStr, '06/11/2026');
  assert.equal(res2.timeStr, '');
  assert.equal(res2.fullStr, '06/11/2026');

  // 3. Null / empty
  const res3 = formatAccessDateTime(null);
  assert.equal(res3.hasRecord, false);
  assert.equal(res3.fullStr, 'Sem registro');

  const res4 = formatAccessDateTime('');
  assert.equal(res4.hasRecord, false);
  assert.equal(res4.fullStr, 'Sem registro');
});

test('isAndroidOrRedroidApp detects and disregards Android, Redroid, Waydroid, and Anbox apps', () => {
  // Should detect Android / Redroid apps
  assert.equal(isAndroidOrRedroidApp({ name: 'Redroid Client' }), true);
  assert.equal(isAndroidOrRedroidApp({ name: 'Android Emulator' }), true);
  assert.equal(isAndroidOrRedroidApp({ name: 'WhatsApp', rawFileName: 'redroid_whatsapp.desktop' }), true);
  assert.equal(isAndroidOrRedroidApp({ name: 'WhatsApp', execLine: 'scrcpy -s 127.0.0.1:5555' }), true);
  assert.equal(isAndroidOrRedroidApp({ name: 'App', url: 'http://localhost:8000/redroid' }), true);
  assert.equal(isAndroidOrRedroidApp({ name: 'Waydroid Launcher' }), true);
  assert.equal(isAndroidOrRedroidApp({ name: 'Anbox Session' }), true);

  // Normal Chrome PWAs must NOT be flagged
  assert.equal(isAndroidOrRedroidApp({ name: 'Gmail', url: 'https://mail.google.com' }), false);
  assert.equal(isAndroidOrRedroidApp({ name: 'GitHub', url: 'https://github.com' }), false);
  assert.equal(isAndroidOrRedroidApp({ name: 'Slack', url: 'https://slack.com' }), false);
  assert.equal(isAndroidOrRedroidApp({ name: 'WhatsApp Web', url: 'https://web.whatsapp.com' }), false);
  assert.equal(isAndroidOrRedroidApp({ name: 'ChatGPT', url: 'https://chatgpt.com' }), false);
});

test('formatAccessCompact formats strictly as DD/MM HH:mm without seconds', () => {
  assert.equal(formatAccessCompact('2026-11-06T14:32:05.000Z'), '06/11 14:32');
  assert.equal(formatAccessCompact('2026-03-09T09:05:42.123Z'), '09/03 09:05');
  assert.equal(formatAccessCompact('2026-11-06'), '06/11 00:00');
  assert.equal(formatAccessCompact(null), '');
  assert.equal(formatAccessCompact(''), '');
});

test('resolveFaviconAtInsertion extracts domain from url or name and returns high-res favicon', () => {
  // Direct domain
  assert.equal(
    resolveFaviconAtInsertion('https://03win.com'),
    '/api/icon?domain=03win.com'
  );

  // Name as domain when url is empty or malformed
  assert.equal(
    resolveFaviconAtInsertion('', undefined, '03win.com'),
    '/api/icon?domain=03win.com&name=03win.com'
  );
  assert.equal(
    resolveFaviconAtInsertion('https://app.com', undefined, '13E.COM'),
    '/api/icon?domain=13e.com&name=13E.COM'
  );

  // Fixes corrupted domain ending in com.com
  assert.equal(getCleanDomain('https://03wincom.com'), '03win.com');
  assert.equal(
    resolveFaviconAtInsertion('https://03wincom.com'),
    '/api/icon?domain=03win.com'
  );
});

test('extractChromeProfileDirectory and formatChromeProfileDisplay normalize Chrome profiles cleanly', () => {
  const p5 = formatChromeProfileDisplay({ profileDirectory: 'Profile 5' });
  assert.ok(p5);
  assert.equal(p5.profileNumber, '5');
  assert.equal(p5.badgeText, 'Perfil 5');
  assert.equal(p5.shortLabel, 'P5');
  assert.equal(p5.isDefault, false);

  const p12 = formatChromeProfileDisplay({ profileDirectory: 'Profile_12' });
  assert.ok(p12);
  assert.equal(p12.profileNumber, '12');
  assert.equal(p12.badgeText, 'Perfil 12');

  const bareNum = formatChromeProfileDisplay({ profileDirectory: '3' });
  assert.ok(bareNum);
  assert.equal(bareNum.profileNumber, '3');
  assert.equal(bareNum.badgeText, 'Perfil 3');

  const def = formatChromeProfileDisplay({ profileDirectory: 'Default' });
  assert.ok(def);
  assert.equal(def.profileNumber, '0');
  assert.equal(def.badgeText, 'Default');
  assert.equal(def.isDefault, true);

  // Fallback extraction from execLine or filename
  assert.equal(
    extractChromeProfileDirectory({ execLine: 'google-chrome --profile-directory="Profile 7" --app-id=abc' }),
    'Profile 7'
  );
  const fromFn = formatChromeProfileDisplay({ rawFileName: 'chrome-abc123-Profile_2.desktop' });
  assert.ok(fromFn);
  assert.equal(fromFn.badgeText, 'Perfil 2');

  // Empty/missing profile returns null
  assert.equal(formatChromeProfileDisplay({}), null);
  assert.equal(formatChromeProfileDisplay({ profileDirectory: '   ' }), null);
});

test('moneyDate persists across midnight while COM, RB, and BON selections reset automatically on day rollover', () => {
  const today = '2026-11-16';
  const tomorrow = '2026-11-17';

  // Day/month typing & blur normalization
  assert.equal(sanitizeDayMonthTyping('1611'), '16/11');
  assert.equal(sanitizeDayMonthTyping('16/'), '16/');
  assert.equal(normalizeDayMonthOnBlur('5/9'), '05/09');
  assert.equal(normalizeDayMonthOnBlur('35/15'), '31/12');

  // Legacy rdDate/irbDate migration to rbDate/bonDate
  assert.deepEqual(
    migratePWAFlags({ moneyDate: '5/9', comDate: today, rdDate: today, irbDate: null }),
    { moneyDate: '05/09', comDate: today, rbDate: today, bonDate: null }
  );

  const baseA: PWAItem = {
    id: 'a',
    name: 'App A',
    url: 'https://a.com',
    category: 'Geral',
    notes: '',
    lastAccessedDate: null,
    accessCount: 0,
    createdAt: '2026-11-01',
  };
  const baseB: PWAItem = {
    id: 'b',
    name: 'App B',
    url: 'https://b.com',
    category: 'Geral',
    notes: '',
    lastAccessedDate: null,
    accessCount: 0,
    flags: { moneyDate: '04/11', comDate: today, rbDate: null, bonDate: null },
    createdAt: '2026-11-01',
  };
  const baseC: PWAItem = {
    id: 'c',
    name: 'App C',
    url: 'https://c.com',
    category: 'Geral',
    notes: '',
    lastAccessedDate: null,
    accessCount: 0,
    flags: { comDate: today, rbDate: today, bonDate: today },
    createdAt: '2026-11-01',
  };

  // Update persistent DD/MM date and set COM -> 'check', RB -> 'x', BON -> 'check' on App A for today
  const aDated = updatePWAMoneyDate(baseA, '16/11');
  const aWithCom = togglePWAFlag(aDated, 'com', today, 'check');
  const aWithRbX = togglePWAFlag(aWithCom, 'rb', today, 'x');
  const aWithComRbBon = togglePWAFlag(aWithRbX, 'bon', today, 'check');

  assert.equal(aWithComRbBon.flags?.moneyDate, '16/11');
  assert.equal(aWithComRbBon.flags?.comDate, today);
  assert.equal(aWithComRbBon.flags?.comState, 'check');
  assert.equal(aWithComRbBon.flags?.rbDate, today);
  assert.equal(aWithComRbBon.flags?.rbState, 'x');
  assert.equal(aWithComRbBon.flags?.bonDate, today);
  assert.equal(aWithComRbBon.flags?.bonState, 'check');

  assert.equal(getPWAFlagState(aWithComRbBon, 'com', today), 'check');
  assert.equal(getPWAFlagState(aWithComRbBon, 'rb', today), 'x');
  assert.equal(getPWAFlagState(aWithComRbBon, 'bon', today), 'check');
  assert.equal(getPWAFlagState(baseB, 'com', today), 'check'); // legacy record without comState defaults to 'check'
  assert.equal(getPWAFlagState(baseB, 'rb', today), null);

  assert.equal(isPWAFlagActive(aWithComRbBon, 'com', today), true);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'com:check', today), true);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'com:x', today), false);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'rb', today), true);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'rb:x', today), true);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'rb:check', today), false);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'moneyDate', today), true);

  // Clicking the active X on RB clears it back to optional null; clicking X on COM switches 'check' -> 'x'
  const aClearedRb = togglePWAFlag(aWithComRbBon, 'rb', today, 'x');
  assert.equal(aClearedRb.flags?.rbDate, null);
  assert.equal(aClearedRb.flags?.rbState, null);
  assert.equal(getPWAFlagState(aClearedRb, 'rb', today), null);

  const aComSwitchedToX = togglePWAFlag(aWithComRbBon, 'com', today, 'x');
  assert.equal(getPWAFlagState(aComSwitchedToX, 'com', today), 'x');

  const items = [aWithComRbBon, baseB, baseC];
  assert.deepEqual(countPWAFlags(items, today), {
    moneyDate: 2,
    com: 3,
    rb: 2,
    bon: 2,
  });
  assert.deepEqual(countPWAFlagBreakdown(items, today), {
    moneyDate: 2,
    com: { total: 3, check: 3, x: 0 },
    rb: { total: 2, check: 1, x: 1 },
    bon: { total: 2, check: 2, x: 0 },
  });

  // Filtering on today (general + specific check/x)
  assert.deepEqual(
    filterAndSortPWAs(items, { flagFilters: ['moneyDate'], todayStr: today }).map((i) => i.id).sort(),
    ['a', 'b']
  );
  assert.deepEqual(
    filterAndSortPWAs(items, { flagFilters: ['com', 'rb'], todayStr: today }).map((i) => i.id).sort(),
    ['a', 'c']
  );
  assert.deepEqual(
    filterAndSortPWAs(items, { flagFilters: ['rb:x'], todayStr: today }).map((i) => i.id),
    ['a']
  );
  assert.deepEqual(
    filterAndSortPWAs(items, { flagFilters: ['rb:check'], todayStr: today }).map((i) => i.id),
    ['c']
  );

  // Midnight rollover to tomorrow: COM, RB, BON check/x selections vanish automatically, moneyDate stays!
  assert.equal(getPWAFlagState(aWithComRbBon, 'com', tomorrow), null);
  assert.equal(getPWAFlagState(aWithComRbBon, 'rb', tomorrow), null);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'com', tomorrow), false);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'rb:x', tomorrow), false);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'bon', tomorrow), false);
  assert.equal(isPWAFlagActive(aWithComRbBon, 'moneyDate', tomorrow), true);
  assert.equal(aWithComRbBon.flags?.moneyDate, '16/11');
  assert.deepEqual(countPWAFlags(items, tomorrow), {
    moneyDate: 2,
    com: 0,
    rb: 0,
    bon: 0,
  });
  assert.equal(filterAndSortPWAs(items, { flagFilters: ['com'], todayStr: tomorrow }).length, 0);
  assert.equal(filterAndSortPWAs(items, { flagFilters: ['moneyDate'], todayStr: tomorrow }).length, 2);
});

test('getMsUntilNextMidnight calculates positive duration to local midnight', () => {
  const beforeMidnight = new Date(2026, 10, 16, 23, 59, 30, 0);
  const ms = getMsUntilNextMidnight(beforeMidnight);
  assert.equal(ms, 30100);
});

test('getScopedSelectableItems selects only cards in current folder or only unfiled cards at root', () => {
  const mkItem = (id: string, folderId: string | null): PWAItem => ({
    id,
    name: `App ${id}`,
    url: `https://${id}.com`,
    category: 'Geral',
    folderId,
    notes: '',
    lastAccessedDate: null,
    accessCount: 0,
    createdAt: '2026-11-01',
  });

  const folders = [{ id: 'f_games' }, { id: 'f_work' }];
  const allDisplayed = [
    mkItem('u1', null),
    mkItem('u2', 'deleted_folder'),
    mkItem('g1', 'f_games'),
    mkItem('g2', 'f_games'),
    mkItem('w1', 'f_work'),
  ];

  // Inside folder f_games in 'folders' view -> ONLY g1, g2
  const inGamesFolder = getScopedSelectableItems(allDisplayed, {
    density: 'folders',
    folders,
    currentFolderId: 'f_games',
  });
  assert.deepEqual(inGamesFolder.map((i) => i.id), ['g1', 'g2']);

  // At root in 'folders' view (PWAs sem pasta) -> ONLY u1, u2 (not g1, g2, w1 inside folders)
  const atRoot = getScopedSelectableItems(allDisplayed, {
    density: 'folders',
    folders,
    currentFolderId: null,
  });
  assert.deepEqual(atRoot.map((i) => i.id), ['u1', 'u2']);

  // In 'cards' or 'mini-cards' view -> returns all displayedItems (already filtered by selectedFolder)
  const inCards = getScopedSelectableItems(allDisplayed, {
    density: 'cards',
    folders,
    currentFolderId: 'f_games',
  });
  assert.equal(inCards.length, 5);

  const inMiniCards = getScopedSelectableItems(allDisplayed, {
    density: 'mini-cards',
    folders,
    currentFolderId: 'f_games',
  });
  assert.equal(inMiniCards.length, 5);
});

test('clonePWAForProfile creates independent PWA bound to target Chrome profile without colliding with source', () => {
  const source: PWAItem = {
    id: 'pwa_linear_1',
    name: 'Linear (Perfil 1)',
    url: 'https://linear.app',
    icon: '/api/icon?domain=linear.app',
    category: 'Dev & Código',
    group: 'Dev & Código',
    folderId: 'folder_work',
    notes: 'Board principal',
    flags: { moneyDate: '16/11', comDate: '2026-11-16', rbDate: null, bonDate: '2026-11-16' },
    rating: 4,
    pinned: true,
    profileDirectory: 'Profile 1',
    rawFileName: 'chrome-abc-Profile_1.desktop',
    desktopPath: '/home/user/.local/share/applications/chrome-abc-Profile_1.desktop',
    execLine: 'google-chrome --profile-directory="Profile 1" --app-id=abc',
    appId: 'abc',
    lastAccessedDate: '2026-11-15T10:00:00.000Z',
    accessCount: 12,
    createdAt: '2026-11-01T00:00:00.000Z',
  };

  assert.equal(normalizeChromeProfileInput('5'), 'Profile 5');
  assert.equal(normalizeChromeProfileInput('perfil 3'), 'Profile 3');
  assert.equal(normalizeChromeProfileInput('default'), 'Default');
  assert.equal(stripProfileSuffixFromName('Linear (Perfil 1)'), 'Linear');

  const clone = clonePWAForProfile(source, {
    profileDirectory: '5',
    now: new Date('2026-11-16T08:00:00.000Z'),
  });

  assert.ok(clone.id.startsWith('pwa_clone_'));
  assert.notEqual(clone.id, source.id);
  assert.equal(clone.clonedFromId, source.id);
  assert.equal(clone.profileDirectory, 'Profile 5');
  assert.equal(clone.name, 'Linear (Perfil 5)');
  assert.equal(clone.url, source.url);
  assert.equal(clone.folderId, 'folder_work');
  assert.equal(clone.notes, 'Board principal');
  assert.deepEqual(clone.flags, {
    moneyDate: '16/11',
    comDate: '2026-11-16',
    rbDate: null,
    bonDate: '2026-11-16',
  });
  assert.equal(clone.lastAccessedDate, null);
  assert.equal(clone.accessCount, 0);
  // Source .desktop bindings must be stripped so launch uses target profile
  assert.equal(clone.rawFileName, undefined);
  assert.equal(clone.desktopPath, undefined);
  assert.equal(clone.execLine, undefined);
  assert.equal(clone.appId, undefined);

  // Clone and source must NOT collide in isSameOrMatchingPWA even though URL matches
  assert.equal(isSameOrMatchingPWA(source, clone), false);
  assert.equal(isSameOrMatchingPWA(clone, clone), true);

  // Build available profiles merges discovered names + item profiles + defaults sorted cleanly
  const available = buildAvailableChromeProfiles([source, clone], [
    { directory: 'Profile 2', displayName: 'Trabalho' },
  ]);
  assert.equal(available[0].directory, 'Default');
  const p2 = available.find((p) => p.directory === 'Profile 2');
  assert.equal(p2?.displayName, 'Trabalho');
});

test('bulk actions add/remove stars, update status, and set/clear daily COM/RB/BON flags cleanly on targeted IDs only', () => {
  const today = '2026-11-16';
  const now = new Date('2026-11-16T12:00:00.000Z');
  const pwas: PWAItem[] = [
    {
      id: 'p1',
      name: 'App 1',
      url: 'https://1.com',
      category: 'Geral',
      notes: '',
      rating: 4,
      pinned: true,
      flags: { moneyDate: '05/11', comDate: today },
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-11-01',
    },
    {
      id: 'p2',
      name: 'App 2',
      url: 'https://2.com',
      category: 'Geral',
      notes: '',
      rating: 0,
      pinned: false,
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-11-01',
    },
    {
      id: 'p3',
      name: 'Outside Scope',
      url: 'https://3.com',
      category: 'Geral',
      notes: '',
      rating: 5,
      pinned: true,
      lastAccessedDate: null,
      accessCount: 2,
      createdAt: '2026-11-01',
    },
  ];

  const targets = new Set(['p1', 'p2']);

  // Bulk set 5 stars
  const starred = batchSetRating(pwas, targets, 5);
  assert.equal(starred[0].rating, 5);
  assert.equal(starred[1].rating, 5);
  assert.equal(starred[1].pinned, true);
  assert.equal(starred[2].rating, 5);

  // Bulk remove all stars (0) only on targets
  const clearedStars = batchSetRating(starred, targets, 0);
  assert.equal(clearedStars[0].rating, 0);
  assert.equal(clearedStars[0].pinned, false);
  assert.equal(clearedStars[1].rating, 0);
  assert.equal(clearedStars[1].pinned, false);
  assert.equal(clearedStars[2].rating, 5); // Outside target untouched

  // Bulk mark accessed then pending
  const accessed = batchSetStatus(clearedStars, targets, 'accessed', now, today);
  assert.equal(isAccessedToday(accessed[0].lastAccessedDate, today), true);
  assert.equal(isAccessedToday(accessed[1].lastAccessedDate, today), true);
  assert.equal(isAccessedToday(accessed[2].lastAccessedDate, today), false);

  const pending = batchSetStatus(accessed, targets, 'pending', now, today);
  assert.equal(pending[0].lastAccessedDate, null);
  assert.equal(pending[1].lastAccessedDate, null);

  // Bulk set daily RB ('x') & BON ('check') flags, then clear daily flags (moneyDate preserved)
  const withRb = batchSetDailyFlag(pending, targets, 'rb', 'x', today);
  const withBon = batchSetDailyFlag(withRb, targets, 'bon', 'check', today);
  assert.equal(withBon[0].flags?.rbDate, today);
  assert.equal(withBon[0].flags?.rbState, 'x');
  assert.equal(withBon[1].flags?.bonDate, today);
  assert.equal(withBon[1].flags?.bonState, 'check');
  assert.equal(withBon[2].flags, undefined);

  const clearedDaily = batchClearFlags(withBon, targets, { clearDaily: true, clearMoneyDate: false });
  assert.equal(clearedDaily[0].flags?.comDate, null);
  assert.equal(clearedDaily[0].flags?.comState, null);
  assert.equal(clearedDaily[0].flags?.rbDate, null);
  assert.equal(clearedDaily[0].flags?.rbState, null);
  assert.equal(clearedDaily[0].flags?.bonDate, null);
  assert.equal(clearedDaily[0].flags?.bonState, null);
  assert.equal(clearedDaily[0].flags?.moneyDate, '05/11'); // permanent preserved!
});

test('icon URL helpers preserve web-resolved /api/icon?domain=... across rescans and extract HTML icons regardless of attribute order', () => {
  assert.equal(isDeprecatedGenericIconUrl('https://www.google.com/s2/favicons?domain=aa222.bet&sz=128'), true);
  assert.equal(isDeprecatedGenericIconUrl('https://t1.gstatic.com/faviconV2?url=http://aa222.bet'), true);
  assert.equal(isDeprecatedGenericIconUrl('https://icons.duckduckgo.com/ip3/aa222.bet.ico'), true);
  assert.equal(isDeprecatedGenericIconUrl('/api/icon?domain=aa222.bet'), false);

  assert.equal(isPreservableIconUrl('/api/icon?domain=aa222.bet&name=AA222.BET'), true);
  assert.equal(isPreservableIconUrl('data:image/png;base64,abc'), true);
  assert.equal(isPreservableIconUrl('https://cdn.aa222.bet/logo.png'), true);
  assert.equal(isPreservableIconUrl('/api/icon?name=chrome-abcdef-Profile_5&url=https://aa222.bet'), false);
  assert.equal(isPreservableIconUrl('https://www.google.com/s2/favicons?domain=aa222.bet'), false);

  assert.equal(isChromeShortcutLocalCandidate('chrome-abcdef-Profile_5'), true);
  assert.equal(isChromeShortcutLocalCandidate('/api/icon?name=chrome-abcdef-Profile_5'), true);
  assert.equal(isChromeShortcutLocalCandidate('Profile_5'), true);
  assert.equal(isChromeShortcutLocalCandidate('/home/user/.config/google-chrome/Profile 5/Web Applications/foo.png'), true);
  assert.equal(isChromeShortcutLocalCandidate('aa222.bet'), false);

  assert.equal(
    shouldUpgradeChromeShortcutIcon('/api/icon?name=chrome-abcdef-Profile_5&url=https%3A%2F%2Faa222.bet', 'https://aa222.bet'),
    true
  );
  assert.equal(
    shouldUpgradeChromeShortcutIcon('/api/icon?path=%2Fhome%2Fuser%2FProfile_5%2Ficon.png', 'https://aa222.bet'),
    true
  );
  assert.equal(
    shouldUpgradeChromeShortcutIcon('/api/icon?domain=aa222.bet&name=AA222.BET', 'https://aa222.bet'),
    false
  );
  assert.equal(
    shouldUpgradeChromeShortcutIcon('https://cdn.aa222.bet/logo.png', 'https://aa222.bet'),
    false
  );

  assert.equal(
    appendCacheBuster('/api/icon?domain=aa222.bet&name=AA222.BET&v=111&refresh=1', 222),
    '/api/icon?domain=aa222.bet&name=AA222.BET&v=222'
  );
  assert.equal(
    appendCacheBuster('data:image/png;base64,abc', 222),
    'data:image/png;base64,abc'
  );

  const html = `
    <link href="//cdn.aa222.bet/favicon.png" rel="icon" type="image/png">
    <link href="/apple-icon.png" rel="apple-touch-icon-precomposed">
    <meta content="./og-logo.png" property="og:image">
  `;
  assert.deepEqual(extractHtmlIconCandidates(html, 'aa222.bet'), [
    'https://aa222.bet/apple-icon.png',
    'https://cdn.aa222.bet/favicon.png',
    'https://aa222.bet/og-logo.png',
  ]);
});

test('ensureUniquePWAIds non-destructively repairs colliding and missing IDs while preserving all user data', () => {
  const collidedItems: PWAItem[] = [
    {
      id: 'pwa_dup_1',
      name: '03win.com (Perfil1)',
      url: 'https://03win.com',
      category: 'Jogos',
      group: 'Jogos',
      folderId: 'folder_agente',
      notes: 'Conta principal',
      rating: 5,
      pinned: true,
      profileDirectory: 'Profile 1',
      lastAccessedDate: '2026-11-20T05:14:00.000Z',
      accessCount: 11,
      flags: { comDate: '2026-11-20', comState: 'check', moneyDate: '20/11' },
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    {
      id: 'pwa_dup_1',
      name: '03win.com (Perfil1)',
      url: 'https://03win.com',
      category: 'Jogos',
      group: 'Jogos',
      folderId: 'folder_agente',
      notes: 'Copia com nota diferente',
      rating: 3,
      pinned: true,
      profileDirectory: 'Profile 1',
      lastAccessedDate: '2026-11-20T05:14:00.000Z',
      accessCount: 9,
      flags: { rbDate: '2026-11-20', rbState: 'x' },
      createdAt: '2026-11-02T00:00:00.000Z',
    },
    {
      id: 'pwa_dup_1',
      name: '03win.com (Perfil1)',
      url: 'https://03win.com',
      category: 'Jogos',
      notes: 'Terceira copia',
      rating: 0,
      lastAccessedDate: null,
      accessCount: 10,
      createdAt: '2026-11-03T00:00:00.000Z',
    },
    {
      id: '',
      name: '5X5X.COM',
      url: 'https://5x5x.com',
      category: 'Geral',
      notes: 'Sem id original',
      lastAccessedDate: '2026-11-20T04:56:00.000Z',
      accessCount: 5,
      createdAt: '2026-11-04T00:00:00.000Z',
    },
  ];

  const repaired = ensureUniquePWAIds(collidedItems);

  // Never removes or merges user's existing items
  assert.equal(repaired.length, 4);

  // Every ID is non-empty and strictly unique
  const ids = repaired.map((it) => it.id);
  assert.equal(new Set(ids).size, 4);
  assert.equal(ids[0], 'pwa_dup_1');
  assert.equal(ids[1], 'pwa_dup_1__dup_2');
  assert.equal(ids[2], 'pwa_dup_1__dup_3');
  assert.ok(ids[3].startsWith('pwa_repaired_5x5x_com_'));

  // All user metadata preserved verbatim
  assert.equal(repaired[0].notes, 'Conta principal');
  assert.equal(repaired[0].flags?.moneyDate, '20/11');
  assert.equal(repaired[1].notes, 'Copia com nota diferente');
  assert.equal(repaired[1].accessCount, 9);
  assert.equal(repaired[1].flags?.rbState, 'x');
  assert.equal(repaired[2].notes, 'Terceira copia');
  assert.equal(repaired[3].notes, 'Sem id original');
  assert.equal(repaired[3].accessCount, 5);

  // Running ensureUniquePWAIds again is idempotent
  assert.deepEqual(ensureUniquePWAIds(repaired), repaired);

  // __dup_ copies do NOT cross-match original items on URL/name in isSameOrMatchingPWA
  assert.equal(isSameOrMatchingPWA(repaired[0], repaired[1]), false);
  assert.equal(isSameOrMatchingPWA(repaired[1], repaired[2]), false);
  assert.equal(isSameOrMatchingPWA(repaired[1], repaired[1]), true);
});

test('clonePWAForProfile avoids ID collisions against existingIds', () => {
  const src: PWAItem = {
    id: 'pwa_src_1',
    name: 'Site Teste',
    url: 'https://siteteste.com',
    category: 'Geral',
    notes: '',
    lastAccessedDate: null,
    accessCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
  const existing = new Set<string>(['pwa_src_1']);
  const clone1 = clonePWAForProfile(src, { profileDirectory: 'Profile 2', existingIds: existing });
  existing.add(clone1.id);
  const clone2 = clonePWAForProfile(src, { profileDirectory: 'Profile 3', existingIds: existing });
  assert.notEqual(clone1.id, clone2.id);
  assert.equal(clone1.clonedFromId, 'pwa_src_1');
  assert.equal(clone2.clonedFromId, 'pwa_src_1');
});

test('computeCardSelection supports plain click, Ctrl+Click multi-select, and Shift+Click range', () => {
  const ordered = ['a', 'b', 'c', 'd', 'e'];

  // 1. Plain click selects only the clicked card and sets anchor
  const r1 = computeCardSelection(new Set(), null, 'b', ordered);
  assert.deepEqual(Array.from(r1.selectedIds), ['b']);
  assert.equal(r1.lastSelectedId, 'b');

  // 2. Clicking another card without modifiers replaces selection with new card
  const r2 = computeCardSelection(r1.selectedIds, r1.lastSelectedId, 'd', ordered);
  assert.deepEqual(Array.from(r2.selectedIds), ['d']);
  assert.equal(r2.lastSelectedId, 'd');

  // 3. Clicking the single already-selected card deselects it
  const r2Off = computeCardSelection(r2.selectedIds, r2.lastSelectedId, 'd', ordered);
  assert.deepEqual(Array.from(r2Off.selectedIds), []);
  assert.equal(r2Off.lastSelectedId, null);

  // 4. Ctrl+Click adds/toggles without clearing other selected cards
  const r3 = computeCardSelection(r1.selectedIds, r1.lastSelectedId, 'd', ordered, { ctrlKey: true });
  assert.deepEqual(Array.from(r3.selectedIds).sort(), ['b', 'd']);
  assert.equal(r3.lastSelectedId, 'd');

  const r4 = computeCardSelection(r3.selectedIds, r3.lastSelectedId, 'b', ordered, { metaKey: true });
  assert.deepEqual(Array.from(r4.selectedIds), ['d']);
  assert.equal(r4.lastSelectedId, 'd');

  // 5. Shift+Click selects contiguous forward range [b..e] while preserving anchor 'b'
  const r5 = computeCardSelection(r1.selectedIds, r1.lastSelectedId, 'e', ordered, { shiftKey: true });
  assert.deepEqual(Array.from(r5.selectedIds), ['b', 'c', 'd', 'e']);
  assert.equal(r5.lastSelectedId, 'b');

  // 6. Reverse Shift+Click from anchor 'e' to 'b' selects [b..e]
  const anchorE = computeCardSelection(new Set(), null, 'e', ordered);
  const r6 = computeCardSelection(anchorE.selectedIds, anchorE.lastSelectedId, 'b', ordered, { shiftKey: true });
  assert.deepEqual(Array.from(r6.selectedIds), ['b', 'c', 'd', 'e']);

  // 7. Shift+Ctrl merges new range with existing non-contiguous selection
  const existing = new Set(['a']);
  const r7 = computeCardSelection(existing, 'c', 'e', ordered, { shiftKey: true, ctrlKey: true });
  assert.deepEqual(Array.from(r7.selectedIds).sort(), ['a', 'c', 'd', 'e']);

  // 8. Checkbox click preserves existing selection; fallback when anchor is missing selects clicked
  const r8 = computeCardSelection(new Set(['a']), 'a', 'c', ordered, { fromCheckbox: true });
  assert.deepEqual(Array.from(r8.selectedIds).sort(), ['a', 'c']);
  const r9 = computeCardSelection(new Set(['missing']), 'missing', 'c', ordered, { shiftKey: true });
  assert.deepEqual(Array.from(r9.selectedIds), ['c']);
  assert.equal(r9.lastSelectedId, 'c');
});

test('getVisuallyOrderedPWAIds follows flat and grouped alphabetical render order', () => {
  const makeItem = (id: string, group: string): PWAItem => ({
    id,
    name: id.toUpperCase(),
    url: `https://${id}.example.com`,
    category: group,
    group,
    notes: '',
    lastAccessedDate: null,
    accessCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z',
  });

  const list = [
    makeItem('1', 'Zeta'),
    makeItem('2', 'Alpha'),
    makeItem('3', 'Zeta'),
    makeItem('4', 'Alpha'),
  ];

  assert.deepEqual(getVisuallyOrderedPWAIds(list, false), ['1', '2', '3', '4']);
  assert.deepEqual(getVisuallyOrderedPWAIds(list, true), ['2', '4', '1', '3']);
});



