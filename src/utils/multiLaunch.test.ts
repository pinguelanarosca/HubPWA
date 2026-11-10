import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PWAItem } from '../types/pwa.js';
import { markAsAccessed, isAccessedToday, getTodayString } from './pwaLogic.js';

test('Multi-launch simulation: launching 20 PWAs in rapid succession marks 100% as accessed without drops', () => {
  const today = getTodayString();
  const count = 20;

  // Initial list of 20 distinct PWAs
  let state: PWAItem[] = Array.from({ length: count }, (_, i) => ({
    id: `pwa_item_${i + 1}`,
    name: `App ${i + 1}`,
    url: `https://app${i + 1}.example.com`,
    category: 'Geral',
    pinned: false,
    rating: 0,
    notes: '',
    createdAt: new Date().toISOString(),
    lastAccessedDate: null,
    accessCount: 0,
  }));

  // Simulate clicking / launching each item in rapid succession
  for (let i = 0; i < count; i++) {
    const targetId = `pwa_item_${i + 1}`;
    const now = new Date();
    // Functional updater simulating React setItems((prev) => prev.map(...))
    state = state.map((it) => (it.id === targetId ? markAsAccessed(it, now, today) : it));
  }

  // Verify all 20 items are marked accessed
  const accessedCount = state.filter((it) => isAccessedToday(it.lastAccessedDate, today)).length;
  assert.equal(accessedCount, count, `All ${count} PWAs must be marked accessed`);

  for (let i = 0; i < count; i++) {
    const item = state[i];
    assert.equal(item.accessCount, 1, `App ${i + 1} access count should be 1`);
    assert.ok(isAccessedToday(item.lastAccessedDate, today), `App ${i + 1} must be accessed today`);
  }
});

test('Multi-launch on PWAs sharing domain: does not conflate different apps sharing root domain', () => {
  const today = getTodayString();
  const nowIso = new Date().toISOString();

  // Distinct Google Workspace apps
  let apps: PWAItem[] = [
    { id: 'pwa_gmail', name: 'Gmail', url: 'https://mail.google.com/mail', category: 'Comunicação', notes: '', createdAt: nowIso, lastAccessedDate: null, accessCount: 0 },
    { id: 'pwa_calendar', name: 'Calendar', url: 'https://calendar.google.com/calendar', category: 'Produtividade', notes: '', createdAt: nowIso, lastAccessedDate: null, accessCount: 0 },
    { id: 'pwa_drive', name: 'Drive', url: 'https://drive.google.com/drive', category: 'Armazenamento', notes: '', createdAt: nowIso, lastAccessedDate: null, accessCount: 0 },
    { id: 'pwa_keep', name: 'Keep', url: 'https://keep.google.com/keep', category: 'Notas', notes: '', createdAt: nowIso, lastAccessedDate: null, accessCount: 0 },
  ];

  // User launches Gmail and Calendar only
  apps = apps.map((it) => (it.id === 'pwa_gmail' ? markAsAccessed(it, new Date(), today) : it));
  apps = apps.map((it) => (it.id === 'pwa_calendar' ? markAsAccessed(it, new Date(), today) : it));

  assert.equal(isAccessedToday(apps.find((a) => a.id === 'pwa_gmail')?.lastAccessedDate, today), true);
  assert.equal(isAccessedToday(apps.find((a) => a.id === 'pwa_calendar')?.lastAccessedDate, today), true);
  assert.equal(isAccessedToday(apps.find((a) => a.id === 'pwa_drive')?.lastAccessedDate, today), false);
  assert.equal(isAccessedToday(apps.find((a) => a.id === 'pwa_keep')?.lastAccessedDate, today), false);
});

test('isSameOrMatchingPWA: correctly matches apps with divergent IDs across scan, deduplication and localStorage', async () => {
  const { isSameOrMatchingPWA } = await import('./pwaLogic.js');

  const itemA = {
    id: 'pwa_platform_discord',
    appId: 'agimnkijcaahngcdmfeangaknmldooml',
    url: 'https://discord.com/app',
    name: 'Discord',
    rawFileName: 'chrome-agimnkijcaahngcdmfeangaknmldooml-Profile_5.desktop',
  };

  const itemB = {
    id: 'pwa_17300000000_abc',
    appId: 'agimnkijcaahngcdmfeangaknmldooml',
    url: 'https://discord.com/app',
    name: 'Discord',
    rawFileName: 'chrome-agimnkijcaahngcdmfeangaknmldooml-Default.desktop',
  };

  const itemC = {
    id: 'pwa_other_slack',
    appId: 'different_id_slack',
    url: 'https://slack.com',
    name: 'Slack',
  };

  assert.equal(isSameOrMatchingPWA(itemA, itemB), true, 'Apps with same appId or URL must match even if IDs differ');
  assert.equal(isSameOrMatchingPWA(itemA, itemC), false, 'Different apps must never match');
});
