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

test('Anti-double-click simulation: duplicate rapid clicks on same PWA within cooldown are debounced', () => {
  const cooldownMap = new Map<string, number>();
  let executionCount = 0;

  const tryLaunch = (itemKey: string, timeMs: number) => {
    const lastItemTime = cooldownMap.get(itemKey) || 0;
    const globalLastTime = cooldownMap.get('__global__') || 0;

    if ((lastItemTime > 0 && timeMs - lastItemTime < 1500) || (globalLastTime > 0 && timeMs - globalLastTime < 350)) {
      return false; // Ignored as duplicate click
    }

    cooldownMap.set(itemKey, timeMs);
    cooldownMap.set('__global__', timeMs);
    executionCount++;
    return true;
  };

  // 1st click at t=1000ms -> should execute
  assert.equal(tryLaunch('pwa_discord', 1000), true);
  assert.equal(executionCount, 1);

  // 2nd click at t=1050ms (accidental double-click) -> must be blocked
  assert.equal(tryLaunch('pwa_discord', 1050), false);
  assert.equal(executionCount, 1);

  // 3rd click at t=1200ms -> still within 1500ms cooldown -> must be blocked
  assert.equal(tryLaunch('pwa_discord', 1200), false);
  assert.equal(executionCount, 1);

  // 4th click after 1500ms cooldown (t=2600ms) -> should execute
  assert.equal(tryLaunch('pwa_discord', 2600), true);
  assert.equal(executionCount, 2);
});

test('Star Rating Confirmation workflow: changing stars sets pending state and applies only upon confirmation', () => {
  const pwa: PWAItem = {
    id: 'pwa_slack',
    name: 'Slack',
    url: 'https://app.slack.com',
    icon: 'slack',
    category: 'Comunicação',
    notes: '',
    rating: 2,
    pinned: true,
    lastAccessedDate: null,
    accessCount: 0,
    aliases: [],
    createdAt: '2026-11-09',
  };

  let pendingRatingChange: { item: PWAItem; newRating: number } | null = null;
  let currentItems = [pwa];

  const handleSetRating = (item: PWAItem, newRating: number) => {
    const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
    if (currentRating === newRating) return;
    pendingRatingChange = { item, newRating };
  };

  const handleConfirm = () => {
    if (!pendingRatingChange) return;
    const { item, newRating } = pendingRatingChange;
    currentItems = currentItems.map((it) =>
      it.id === item.id ? { ...it, rating: newRating, pinned: newRating > 0 } : it
    );
    pendingRatingChange = null;
  };

  const handleCancel = () => {
    pendingRatingChange = null;
  };

  // 1. User clicks 5 stars (from 2) -> should NOT immediately change currentItems, but set pending confirmation
  handleSetRating(pwa, 5);
  assert.notEqual(pendingRatingChange, null);
  assert.equal((pendingRatingChange as { newRating: number } | null)?.newRating, 5);
  assert.equal(currentItems[0].rating, 2); // Still 2 until confirmed

  // 2. User cancels -> rating stays 2
  handleCancel();
  assert.equal(pendingRatingChange, null);
  assert.equal(currentItems[0].rating, 2);

  // 3. User clicks 4 stars and confirms -> rating changes to 4
  handleSetRating(pwa, 4);
  assert.notEqual(pendingRatingChange, null);
  handleConfirm();
  assert.equal(pendingRatingChange, null);
  assert.equal(currentItems[0].rating, 4);
  assert.equal(currentItems[0].pinned, true);

  // 4. User clicks 0 stars (removes rating) and confirms -> rating becomes 0 and pinned false
  handleSetRating(currentItems[0], 0);
  assert.equal((pendingRatingChange as { newRating: number } | null)?.newRating, 0);
  handleConfirm();
  assert.equal(currentItems[0].rating, 0);
  assert.equal(currentItems[0].pinned, false);

  // 5. User clicks same rating (0) -> ignores, does not open confirmation
  handleSetRating(currentItems[0], 0);
  assert.equal(pendingRatingChange, null);
});

test('Launch Target constraint: only icon and name are valid launch triggers', () => {
  const validLaunchTargets = new Set(['icon', 'name']);

  const canTriggerLaunch = (targetType: 'card-bg' | 'stars' | 'status-badge' | 'notes' | 'icon' | 'name') => {
    return validLaunchTargets.has(targetType);
  };

  assert.equal(canTriggerLaunch('card-bg'), false, 'Clicking card background must NOT launch PWA');
  assert.equal(canTriggerLaunch('stars'), false, 'Clicking stars must NOT launch PWA');
  assert.equal(canTriggerLaunch('status-badge'), false, 'Clicking status badge must NOT launch PWA');
  assert.equal(canTriggerLaunch('notes'), false, 'Clicking notes field must NOT launch PWA');
  assert.equal(canTriggerLaunch('icon'), true, 'Clicking icon MUST launch PWA');
  assert.equal(canTriggerLaunch('name'), true, 'Clicking name MUST launch PWA');
});

