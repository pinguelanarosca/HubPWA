import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAppUrl,
  areConfirmedDuplicates,
  arePossibleDuplicates,
  deduplicateDesktopApps,
} from './desktopDeduplicator.js';
import { ParsedDesktopApp } from '../types/pwa.js';
import { matchesPWASearch } from './pwaLogic.js';
import { convertParsedToPWAs } from './desktopParser.js';

describe('desktopDeduplicator', () => {
  it('normalizes URLs removing tracking parameters and trailing slashes', () => {
    const u1 = normalizeAppUrl('https://app.example.com/login?utm_source=desktop#app');
    const u2 = normalizeAppUrl('https://app.example.com/login/');
    assert.equal(u1, 'app.example.com/login');
    assert.equal(u2, 'app.example.com/login');
    assert.equal(u1, u2);
  });

  it('identifies confirmed duplicates with identical appId and profile', () => {
    const appA: ParsedDesktopApp = {
      name: 'Mercado Livre',
      url: 'https://www.mercadolivre.com.br',
      desktopFileName: 'chrome-fmgghnmmfpokafmgjhbbhlldkjmhlcma-Default.desktop',
      desktopPath: '/home/user/.local/share/applications/chrome-fmgghnmmfpokafmgjhbbhlldkjmhlcma-Default.desktop',
      appId: 'fmgghnmmfpokafmgjhbbhlldkjmhlcma',
      profileDirectory: 'Default',
    };

    const appB: ParsedDesktopApp = {
      name: '95D',
      url: 'https://www.mercadolivre.com.br',
      desktopFileName: '95D.desktop',
      desktopPath: '/home/user/Área de trabalho/001/95D.desktop',
      appId: 'fmgghnmmfpokafmgjhbbhlldkjmhlcma',
      profileDirectory: 'Default',
    };

    assert.equal(areConfirmedDuplicates(appA, appB), true);
  });

  it('NEVER consolidates installations in different Chrome profiles', () => {
    const profile1: ParsedDesktopApp = {
      name: 'Bitwarden (Pessoal)',
      url: 'https://vault.bitwarden.com',
      desktopFileName: 'chrome-app1-Profile_1.desktop',
      desktopPath: '/home/user/.local/share/applications/chrome-app1-Profile_1.desktop',
      appId: 'nngceckbapebfimnlniiiahkandclblb',
      profileDirectory: 'Profile 1',
    };

    const profile2: ParsedDesktopApp = {
      name: 'Bitwarden (Trabalho)',
      url: 'https://vault.bitwarden.com',
      desktopFileName: 'chrome-app1-Profile_2.desktop',
      desktopPath: '/home/user/.local/share/applications/chrome-app1-Profile_2.desktop',
      appId: 'nngceckbapebfimnlniiiahkandclblb',
      profileDirectory: 'Profile 2',
    };

    assert.equal(areConfirmedDuplicates(profile1, profile2), false);
  });

  it('consolidates duplicates, keeping primary and saving aliases & merged files', () => {
    const rawApps: ParsedDesktopApp[] = [
      {
        name: 'Mercado Livre',
        url: 'https://www.mercadolivre.com.br',
        desktopFileName: 'chrome-fmgghnmmfpokafmgjhbbhlldkjmhlcma-Default.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-fmgghnmmfpokafmgjhbbhlldkjmhlcma-Default.desktop',
        appId: 'fmgghnmmfpokafmgjhbbhlldkjmhlcma',
        profileDirectory: 'Default',
        icon: '/api/local-icon?path=/home/user/.local/share/icons/ml.png',
      },
      {
        name: '95D',
        url: 'https://www.mercadolivre.com.br',
        desktopFileName: '95D.desktop',
        desktopPath: '/home/user/Área de trabalho/001/95D.desktop',
        appId: 'fmgghnmmfpokafmgjhbbhlldkjmhlcma',
        profileDirectory: 'Default',
      },
      {
        name: '93D',
        url: 'https://web.whatsapp.com',
        desktopFileName: '93D.desktop',
        desktopPath: '/home/user/Área de trabalho/001/93D.desktop',
        appId: 'hnpfjngllnobngcgfapefoaidbinmjnm',
        profileDirectory: 'Default',
      },
      {
        name: 'WhatsApp Web',
        url: 'https://web.whatsapp.com',
        desktopFileName: 'chrome-hnpfjngllnobngcgfapefoaidbinmjnm-Default.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-hnpfjngllnobngcgfapefoaidbinmjnm-Default.desktop',
        appId: 'hnpfjngllnobngcgfapefoaidbinmjnm',
        profileDirectory: 'Default',
      },
    ];

    const { items, stats } = deduplicateDesktopApps(rawApps);

    assert.equal(stats.totalRawFound, 4);
    assert.equal(stats.confirmedDuplicatesMerged, 2);
    assert.equal(items.length, 2);

    const ml = items.find((i) => i.appId === 'fmgghnmmfpokafmgjhbbhlldkjmhlcma');
    assert.ok(ml);
    assert.ok(ml.mergedNames?.includes('95D'));
    assert.ok(ml.mergedDesktopFiles?.includes('95D.desktop'));
    assert.ok(ml.aliases?.includes('95D'));

    // Convert to PWAItem and verify search findability
    const pwas = convertParsedToPWAs(items);
    const mlPWA = pwas.find((p) => p.appId === 'fmgghnmmfpokafmgjhbbhlldkjmhlcma')!;

    // Search by "95D" must match ML!
    assert.equal(matchesPWASearch(mlPWA, '95D'), true);
    assert.equal(matchesPWASearch(mlPWA, '95d'), true);
    assert.equal(matchesPWASearch(mlPWA, 'Mercado'), true);
  });

  it('marks ambiguous possible duplicates without deleting them', () => {
    const rawApps: ParsedDesktopApp[] = [
      {
        name: 'Portal Financeiro A',
        url: 'https://finance.example.com',
        desktopFileName: 'app-a.desktop',
        appId: 'id-alpha',
        profileDirectory: 'Default',
        iconHash: 'hash-12345',
      },
      {
        name: 'Portal Financeiro B',
        url: 'https://finance.example.com',
        desktopFileName: 'app-b.desktop',
        appId: 'id-beta',
        profileDirectory: 'Default',
        iconHash: 'hash-12345',
      },
    ];

    const { items, stats } = deduplicateDesktopApps(rawApps);
    assert.equal(items.length, 2, 'Ambiguous duplicates must not be auto-deleted');
    assert.equal(stats.possibleDuplicatesCount, 2);
    assert.equal(items[0].isPossibleDuplicate, true);
    assert.equal(items[1].isPossibleDuplicate, true);
  });
});
