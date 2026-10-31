import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAppUrl,
  areSamePlatform,
  deduplicateDesktopApps,
  isItemProfile5,
} from './desktopDeduplicator.js';
import { ParsedDesktopApp } from '../types/pwa.js';
import { matchesPWASearch } from './pwaLogic.js';
import { convertParsedToPWAs } from './desktopParser.js';

describe('desktopDeduplicator - Platform Consolidation & Profile 5 Priority', () => {
  it('normalizes URLs removing tracking parameters and trailing slashes', () => {
    const u1 = normalizeAppUrl('https://app.example.com/login?utm_source=desktop#app');
    const u2 = normalizeAppUrl('https://app.example.com/login/');
    assert.equal(u1, 'app.example.com/login');
    assert.equal(u2, 'app.example.com/login');
    assert.equal(u1, u2);
  });

  it('detects Profile 5 across profileDirectory, execLine, desktopPath, and filename', () => {
    assert.equal(isItemProfile5({ profileDirectory: 'Profile 5' }), true);
    assert.equal(isItemProfile5({ profileDirectory: 'Profile_5' }), true);
    assert.equal(isItemProfile5({ execLine: 'google-chrome --profile-directory="Profile 5" --app-id=xyz' }), true);
    assert.equal(isItemProfile5({ desktopPath: '/home/user/.local/share/applications/chrome-xyz-Profile_5.desktop' }), true);
    assert.equal(isItemProfile5({ profileDirectory: 'Profile 1' }), false);
    assert.equal(isItemProfile5({ profileDirectory: 'Default' }), false);
  });

  it('guarantees ABSOLUTE PRIORITY to Profile 5 when platform exists in multiple profiles', () => {
    const rawApps: ParsedDesktopApp[] = [
      {
        name: 'Mercado Livre',
        url: 'https://www.mercadolivre.com.br',
        desktopFileName: 'chrome-ml123-Profile_1.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-ml123-Profile_1.desktop',
        execLine: 'google-chrome --profile-directory="Profile 1" --app-id="ml123"',
        appId: 'ml123',
        profileDirectory: 'Profile 1',
        notes: 'Nota do Perfil 1',
      },
      {
        name: '95D',
        url: 'https://www.mercadolivre.com.br',
        desktopFileName: '95D.desktop',
        desktopPath: '/home/user/Área de trabalho/001/95D.desktop',
        appId: 'ml123',
        profileDirectory: 'Default',
      },
      {
        name: 'Mercado Livre Brasil',
        url: 'https://www.mercadolivre.com.br',
        desktopFileName: 'chrome-ml123-Profile_5.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-ml123-Profile_5.desktop',
        execLine: 'google-chrome --profile-directory="Profile 5" --app-id="ml123"',
        appId: 'ml123',
        profileDirectory: 'Profile 5',
        notes: 'Nota importante do Perfil 5',
      },
      {
        name: 'Mercado Livre (Perfil 2)',
        url: 'https://www.mercadolivre.com.br',
        desktopFileName: 'chrome-ml123-Profile_2.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-ml123-Profile_2.desktop',
        execLine: 'google-chrome --profile-directory="Profile 2" --app-id="ml123"',
        appId: 'ml123',
        profileDirectory: 'Profile 2',
      },
    ];

    const { items, stats } = deduplicateDesktopApps(rawApps);

    // Exactly 1 card for Mercado Livre
    assert.equal(items.length, 1, 'Platform must yield exactly one card');
    assert.equal(stats.totalRawFound, 4);
    assert.equal(stats.confirmedDuplicatesMerged, 3);
    assert.equal(stats.activeCount, 1);

    const ml = items[0];
    // Must be locked to Profile 5
    assert.equal(ml.profileDirectory, 'Profile 5', 'Profile 5 must have absolute priority');
    assert.equal(ml.desktopPath, '/home/user/.local/share/applications/chrome-ml123-Profile_5.desktop');
    assert.equal(ml.execLine, 'google-chrome --profile-directory="Profile 5" --app-id="ml123"');

    // Display name must be descriptive
    assert.equal(ml.name, 'Mercado Livre Brasil');

    // Code name 95D and desktop file must be preserved in aliases & merged files
    assert.ok(ml.aliases?.includes('95D'), '95D must be kept in aliases');
    assert.ok(ml.mergedDesktopFiles?.includes('95D.desktop'), '95D.desktop must be in merged files');
    assert.ok(ml.mergedDesktopFiles?.includes('chrome-ml123-Profile_1.desktop'));

    // Notes must be consolidated
    assert.ok(ml.notes?.includes('Nota do Perfil 1'));
    assert.ok(ml.notes?.includes('Nota importante do Perfil 5'));

    // Searching 95D matches the consolidated Profile 5 card
    const pwaList = convertParsedToPWAs(items);
    assert.equal(matchesPWASearch(pwaList[0], '95D'), true);
    assert.equal(matchesPWASearch(pwaList[0], '95d'), true);
    assert.equal(matchesPWASearch(pwaList[0], 'Mercado'), true);
  });

  it('keeps single installation from another profile if Profile 5 does not exist', () => {
    const rawApps: ParsedDesktopApp[] = [
      {
        name: 'Bitwarden',
        url: 'https://vault.bitwarden.com',
        desktopFileName: 'chrome-bw-Profile_1.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-bw-Profile_1.desktop',
        execLine: 'google-chrome --profile-directory="Profile 1" --app-id="bw123"',
        appId: 'bw123',
        profileDirectory: 'Profile 1',
      },
      {
        name: 'Bitwarden Vault',
        url: 'https://vault.bitwarden.com',
        desktopFileName: 'chrome-bw-Profile_2.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-bw-Profile_2.desktop',
        execLine: 'google-chrome --profile-directory="Profile 2" --app-id="bw123"',
        appId: 'bw123',
        profileDirectory: 'Profile 2',
      },
    ];

    const { items, stats } = deduplicateDesktopApps(rawApps);

    // Exactly 1 card for Bitwarden
    assert.equal(items.length, 1);
    assert.equal(stats.confirmedDuplicatesMerged, 1);
    assert.equal(items[0].appId, 'bw123');
    assert.ok(['Profile 1', 'Profile 2'].includes(items[0].profileDirectory || ''));
  });

  it('handles multiple distinct platforms correctly: 1 card per platform', () => {
    const rawApps: ParsedDesktopApp[] = [
      // Platform 1: WhatsApp (in Profile 2 and Profile 5)
      {
        name: '93D',
        url: 'https://web.whatsapp.com',
        desktopFileName: '93D.desktop',
        desktopPath: '/home/user/Área de trabalho/001/93D.desktop',
        appId: 'wa-id',
        profileDirectory: 'Default',
      },
      {
        name: 'WhatsApp Web',
        url: 'https://web.whatsapp.com',
        desktopFileName: 'chrome-wa-Profile_5.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-wa-Profile_5.desktop',
        appId: 'wa-id',
        profileDirectory: 'Profile 5',
      },
      {
        name: 'WhatsApp Web',
        url: 'https://web.whatsapp.com',
        desktopFileName: 'chrome-wa-Profile_2.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-wa-Profile_2.desktop',
        appId: 'wa-id',
        profileDirectory: 'Profile 2',
      },
      // Platform 2: GitHub (in Profile 1 only)
      {
        name: 'GitHub',
        url: 'https://github.com',
        desktopFileName: 'chrome-gh-Profile_1.desktop',
        desktopPath: '/home/user/.local/share/applications/chrome-gh-Profile_1.desktop',
        appId: 'gh-id',
        profileDirectory: 'Profile 1',
      },
    ];

    const { items, stats } = deduplicateDesktopApps(rawApps);

    // Exactly 2 cards: WhatsApp and GitHub
    assert.equal(items.length, 2);
    assert.equal(stats.totalRawFound, 4);
    assert.equal(stats.confirmedDuplicatesMerged, 2);
    assert.equal(stats.activeCount, 2);

    const wa = items.find((i) => i.appId === 'wa-id')!;
    assert.ok(wa);
    assert.equal(wa.profileDirectory, 'Profile 5');
    assert.equal(wa.name, 'WhatsApp Web');
    assert.ok(wa.aliases?.includes('93D'));

    const gh = items.find((i) => i.appId === 'gh-id')!;
    assert.ok(gh);
    assert.equal(gh.profileDirectory, 'Profile 1');
  });
});
