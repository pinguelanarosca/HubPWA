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
    'https://icons.duckduckgo.com/ip3/03win.com.ico'
  );

  // Name as domain when url is empty or malformed
  assert.equal(
    resolveFaviconAtInsertion('', undefined, '03win.com'),
    'https://icons.duckduckgo.com/ip3/03win.com.ico'
  );
  assert.equal(
    resolveFaviconAtInsertion('https://app.com', undefined, '13E.COM'),
    'https://icons.duckduckgo.com/ip3/13e.com.ico'
  );

  // Fixes corrupted domain ending in com.com
  assert.equal(getCleanDomain('https://03wincom.com'), '03win.com');
  assert.equal(
    resolveFaviconAtInsertion('https://03wincom.com'),
    'https://icons.duckduckgo.com/ip3/03win.com.ico'
  );
});


