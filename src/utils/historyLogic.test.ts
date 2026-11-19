import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chromeWebkitTimeToDate,
  chromeWebkitTimeToLocalIso,
  collapseRapidChromeVisits,
  formatDateToLocalLogIso,
  groupAccessHistoryByDay,
  matchesVisitUrlForPWA,
  mergeAccessHistoryRecords,
  resolveHistoryProfileDirectory,
} from './historyLogic';
import { AccessHistoryEntry } from '../types/pwa';

test('chromeWebkitTimeToDate and chromeWebkitTimeToLocalIso convert Chrome microseconds accurately', () => {
  // Exact Unix epoch 2026-11-19T14:30:05.000Z in Chrome WebKit microseconds:
  // (Date.UTC(2026, 10, 19, 14, 30, 5) + 11644473600000) * 1000
  const targetUtc = new Date(2026, 10, 19, 14, 30, 5);
  const webkitMicros = (targetUtc.getTime() + 11644473600000) * 1000;

  const converted = chromeWebkitTimeToDate(webkitMicros);
  assert.ok(converted);
  assert.equal(converted.getTime(), targetUtc.getTime());

  const iso = chromeWebkitTimeToLocalIso(webkitMicros);
  assert.equal(iso, formatDateToLocalLogIso(targetUtc));
  assert.equal(iso, '2026-11-19T14:30:05.000Z');
  assert.equal(chromeWebkitTimeToDate(0), null);
});

test('matchesVisitUrlForPWA isolates exact domains and subdomains without false positives', () => {
  assert.equal(matchesVisitUrlForPWA('https://www.aa222.bet/games/slots', 'https://aa222.bet'), true);
  assert.equal(matchesVisitUrlForPWA('https://m.aa222.bet/login', 'https://aa222.bet'), true);
  assert.equal(matchesVisitUrlForPWA('https://linear.app/team/ENG', 'https://linear.app'), true);
  assert.equal(matchesVisitUrlForPWA('https://otheraa222.bet/', 'https://aa222.bet'), false);
  assert.equal(matchesVisitUrlForPWA('https://google.com/', 'https://aa222.bet'), false);
});

test('collapseRapidChromeVisits collapses redirects within window while keeping separate sessions', () => {
  const visits: AccessHistoryEntry[] = [
    { timestamp: '2026-11-19T14:00:02.000Z', source: 'chrome', visitedUrl: 'https://aa222.bet/' },
    { timestamp: '2026-11-19T14:00:15.000Z', source: 'chrome', visitedUrl: 'https://aa222.bet/home' },
    { timestamp: '2026-11-19T11:20:00.000Z', source: 'chrome', visitedUrl: 'https://aa222.bet/home' },
    { timestamp: '2026-11-18T21:10:05.000Z', source: 'chrome', visitedUrl: 'https://aa222.bet/home' },
  ];

  const collapsed = collapseRapidChromeVisits(visits, 60);
  assert.equal(collapsed.length, 3);
  assert.equal(collapsed[0].timestamp, '2026-11-19T14:00:15.000Z');
  assert.equal(collapsed[1].timestamp, '2026-11-19T11:20:00.000Z');
  assert.equal(collapsed[2].timestamp, '2026-11-18T21:10:05.000Z');
});

test('mergeAccessHistoryRecords merges Hub logs + Chrome profile visits sorted newest-first without losing older dates', () => {
  const existing = {
    profileDirectory: 'Profile 5',
    lastAccessedDate: '2026-11-18T19:00:00.000Z',
    accessLogs: ['2026-11-18T19:00:00.000Z'],
    accessHistory: [],
  };

  const chromeVisits: AccessHistoryEntry[] = [
    {
      timestamp: '2026-11-19T09:15:30.000Z',
      source: 'chrome',
      profileDirectory: 'Profile 5',
      visitedUrl: 'https://aa222.bet/home',
      title: 'AA222 Home',
    },
    {
      timestamp: '2026-11-18T19:00:10.000Z',
      source: 'chrome',
      profileDirectory: 'Profile 5',
      visitedUrl: 'https://aa222.bet/',
      title: 'AA222 Login',
    },
  ];

  const merged = mergeAccessHistoryRecords(existing, chromeVisits);
  assert.equal(merged.lastAccessedDate, '2026-11-19T09:15:30.000Z');
  assert.equal(merged.accessHistory.length, 2);
  assert.equal(merged.accessHistory[0].title, 'AA222 Home');
  assert.equal(merged.accessHistory[1].visitedUrl, 'https://aa222.bet/');
  assert.deepEqual(merged.accessLogs, ['2026-11-19T09:15:30.000Z', '2026-11-18T19:00:10.000Z']);
});

test('groupAccessHistoryByDay groups entries into Hoje, Ontem, and older calendar days with exact HH:mm:ss', () => {
  const entries: AccessHistoryEntry[] = [
    { timestamp: '2026-11-19T14:05:10.000Z', source: 'chrome', profileDirectory: 'Profile 5' },
    { timestamp: '2026-11-19T08:12:00.000Z', source: 'hub', profileDirectory: 'Profile 5' },
    { timestamp: '2026-11-18T22:45:33.000Z', source: 'chrome', profileDirectory: 'Profile 5' },
    { timestamp: '2026-11-15T10:00:00.000Z', source: 'chrome', profileDirectory: 'Profile 5' },
  ];

  const grouped = groupAccessHistoryByDay(entries, '2026-11-19');
  assert.equal(grouped.length, 3);
  assert.equal(grouped[0].label, 'Hoje — 19/11/2026');
  assert.equal(grouped[0].entries.length, 2);
  assert.equal(grouped[0].entries[0].timeStr, '14:05:10');
  assert.equal(grouped[0].entries[1].timeStr, '08:12:00');

  assert.equal(grouped[1].label, 'Ontem — 18/11/2026');
  assert.equal(grouped[1].entries[0].timeStr, '22:45:33');

  assert.equal(grouped[2].dateKey, '2026-11-15');
  assert.match(grouped[2].label, /15\/11\/2026/);
});

test('resolveHistoryProfileDirectory derives target Chrome profile accurately', () => {
  assert.equal(resolveHistoryProfileDirectory({ profileDirectory: 'Profile_5' }), 'Profile 5');
  assert.equal(
    resolveHistoryProfileDirectory({ execLine: 'google-chrome --profile-directory="Profile 3" --app=https://a.com' }),
    'Profile 3'
  );
  assert.equal(resolveHistoryProfileDirectory({ rawFileName: 'chrome-abc-Profile_2.desktop' }), 'Profile 2');
  assert.equal(resolveHistoryProfileDirectory({}), 'Default');
});
