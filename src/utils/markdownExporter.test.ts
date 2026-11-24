import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PWAItem } from '../types/pwa';
import { isAccessedToday } from './pwaLogic';
import {
  applyMarkdownAccessUpdates,
  buildPWAsMarkdownContent,
  formatExportChromeProfile,
  parseAccessFlagValue,
  parsePWAMarkdownAccessEntries,
} from './markdownExporter';

test('buildPWAsMarkdownContent filters selected items and includes Chrome profile and current Acesso status', () => {
  const dummyPWAs: PWAItem[] = [
    {
      id: '1',
      name: 'GitHub',
      url: 'https://github.com',
      category: 'Dev',
      group: 'Dev',
      notes: 'Code review',
      profileDirectory: 'Profile 5',
      lastAccessedDate: '2026-11-22T08:00:00Z',
      accessCount: 5,
      createdAt: '2026-10-01',
    },
    {
      id: '2',
      name: 'Figma',
      url: 'https://figma.com',
      category: 'Design',
      group: 'Design',
      notes: 'UX mockups',
      profileDirectory: 'Default',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-01',
    },
    {
      id: '3',
      name: 'Linear',
      url: 'https://linear.app',
      category: 'Dev',
      group: 'Dev',
      notes: '',
      execLine: '/opt/google/chrome/google-chrome --profile-directory="Profile 2" --app-id=abc',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-01',
    },
    {
      id: '4',
      name: 'SemPerfil',
      url: 'https://semperfil.example.com',
      category: 'Geral',
      group: 'Geral',
      notes: '',
      lastAccessedDate: '2026-11-20T09:00:00Z',
      accessCount: 1,
      createdAt: '2026-10-01',
    },
  ];

  const selected = new Set(['1', '3', '4']);
  const md = buildPWAsMarkdownContent(dummyPWAs, selected, {
    now: new Date(2026, 10, 22, 15, 30, 0),
    todayStr: '2026-11-22',
    chromeProfiles: [
      { directory: 'Profile 5', displayName: 'Conta Trabalho' },
      { directory: 'Profile 2', displayName: 'Profile 2' },
    ],
  });

  assert.ok(md.includes('### [GitHub](https://github.com)'));
  assert.ok(md.includes('- **Perfil do Chrome:** Perfil 5 (Profile 5) — Conta Trabalho'));
  assert.ok(md.includes('- **Acesso:** Sim'));
  assert.ok(md.includes('### [Linear](https://linear.app)'));
  assert.ok(md.includes('- **Perfil do Chrome:** Perfil 2 (Profile 2)'));
  assert.ok(md.includes('- **Acesso:** Não'));
  assert.ok(md.includes('### [SemPerfil](https://semperfil.example.com)'));
  assert.ok(md.includes('- **Perfil do Chrome:** Padrão do Chrome (não especificado)'));
  assert.equal(md.includes('https://figma.com'), false, 'Unselected PWA must not appear');
});

test('formatExportChromeProfile handles Default profile cleanly', () => {
  const defaultItem: PWAItem = {
    id: 'd1',
    name: 'Discord',
    url: 'https://discord.com/app',
    category: 'Geral',
    notes: '',
    profileDirectory: 'Default',
    lastAccessedDate: null,
    accessCount: 0,
    createdAt: '2026-10-01',
  };

  assert.equal(formatExportChromeProfile(defaultItem), 'Default (Padrão)');
  assert.equal(
    formatExportChromeProfile(defaultItem, [{ directory: 'Default', displayName: 'Pessoal' }]),
    'Default — Pessoal (Padrão)'
  );
});

test('parseAccessFlagValue parses Sim/Não variants reliably', () => {
  assert.equal(parseAccessFlagValue('Sim'), true);
  assert.equal(parseAccessFlagValue('  sim '), true);
  assert.equal(parseAccessFlagValue('verde'), true);
  assert.equal(parseAccessFlagValue('Não'), false);
  assert.equal(parseAccessFlagValue('nao'), false);
  assert.equal(parseAccessFlagValue('Pendente'), false);
  assert.equal(parseAccessFlagValue('talvez'), null);
});

test('applyMarkdownAccessUpdates updates only status (pending<->accessed) cleanly without adding new PWAs', () => {
  const todayStr = '2026-11-23';
  const now = new Date(2026, 10, 23, 10, 0, 0);

  const items: PWAItem[] = [
    {
      id: 'bet-p1',
      name: 'Bet (Perfil 1)',
      url: 'https://bet.example.com',
      category: 'Geral',
      notes: '',
      profileDirectory: 'Profile 1',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-01',
    },
    {
      id: 'bet-p5',
      name: 'Bet (Perfil 5)',
      url: 'https://bet.example.com',
      category: 'Geral',
      notes: '',
      profileDirectory: 'Profile 5',
      lastAccessedDate: '2026-11-23T08:00:00.000Z',
      accessCount: 3,
      createdAt: '2026-10-01',
    },
    {
      id: 'keep-p1',
      name: 'Keep',
      url: 'https://keep.google.com',
      category: 'Geral',
      notes: '',
      profileDirectory: 'Default',
      lastAccessedDate: null,
      accessCount: 2,
      createdAt: '2026-10-01',
    },
  ];

  // Export Bet P1 (Não -> changed by user to Sim), Bet P5 (Sim -> changed by user to Não), Keep (remains Não), plus an unknown PWA
  const exported = buildPWAsMarkdownContent(items, new Set(['bet-p1', 'bet-p5', 'keep-p1']), {
    now,
    todayStr,
  });
  const editedMarkdown =
    exported
      .replace(
        /### \[Bet \(Perfil 1\)\][\s\S]*?- \*\*Acesso:\*\* Não/,
        (block) => block.replace('- **Acesso:** Não', '- **Acesso:** Sim')
      )
      .replace(
        /### \[Bet \(Perfil 5\)\][\s\S]*?- \*\*Acesso:\*\* Sim/,
        (block) => block.replace('- **Acesso:** Sim', '- **Acesso:** Não')
      ) +
    `\n### [Nova PWA Inexistente](https://unknown.example.com)\n- **URL:** \`https://unknown.example.com\`\n- **Acesso:** Sim\n`;

  const parsedEntries = parsePWAMarkdownAccessEntries(editedMarkdown);
  assert.equal(parsedEntries.length, 4);

  const result = applyMarkdownAccessUpdates(items, editedMarkdown, { now, todayStr });

  assert.equal(result.items.length, 3, 'Must never add new PWAs from uploaded markdown');
  assert.equal(result.markedAccessedCount, 1);
  assert.equal(result.markedPendingCount, 1);
  assert.equal(result.unchangedCount, 1);
  assert.equal(result.unmatchedCount, 1);

  const updatedBetP1 = result.items.find((i) => i.id === 'bet-p1')!;
  const updatedBetP5 = result.items.find((i) => i.id === 'bet-p5')!;
  const unchangedKeep = result.items.find((i) => i.id === 'keep-p1')!;

  assert.equal(isAccessedToday(updatedBetP1.lastAccessedDate, todayStr), true);
  assert.equal(updatedBetP1.accessCount, 1);
  assert.equal(isAccessedToday(updatedBetP5.lastAccessedDate, todayStr), false);
  assert.equal(isAccessedToday(unchangedKeep.lastAccessedDate, todayStr), false);
  assert.equal(unchangedKeep.accessCount, 2, 'Unchanged item must not increment accessCount');
});

test('applyMarkdownAccessUpdates parses ## [Name](url) blocks and edits Chrome profileDirectory + status without adding PWAs', () => {
  const todayStr = '2026-11-24';
  const now = new Date(2026, 10, 24, 9, 30, 0);

  const items: PWAItem[] = [
    {
      id: '35m',
      name: '35M.COM',
      url: 'https://35m.com',
      category: 'Geral',
      notes: '',
      profileDirectory: 'Profile 1',
      execLine: '/opt/google/chrome/google-chrome --profile-directory="Profile 1" --app-id=abc35m',
      rawFileName: 'chrome-abc35m-Profile_1.desktop',
      desktopPath: '/home/user/.local/share/applications/chrome-abc35m-Profile_1.desktop',
      appId: 'abc35m',
      lastAccessedDate: '2026-11-24T08:00:00.000Z',
      accessCount: 4,
      createdAt: '2026-10-01',
    },
    {
      id: 'bet-p1',
      name: 'Bet (Perfil 1)',
      url: 'https://bet.example.com',
      category: 'Geral',
      notes: '',
      profileDirectory: 'Profile 1',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-01',
    },
    {
      id: 'bet-p5',
      name: 'Bet (Perfil 5)',
      url: 'https://bet.example.com',
      category: 'Geral',
      notes: '',
      profileDirectory: 'Profile 5',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-01',
    },
  ];

  const mdInput = `## [35M.COM](https://35m.com)
- **URL:** \`https://35m.com\`
- **Perfil do Chrome:** Perfil 5 (Profile 5)
- **Acesso:** Não
- **Classificação:** Sem classificação
- **Último Acesso:** 22/11 - 01:33

## [Bet (Perfil 1)](https://bet.example.com)
- **URL:** \`https://bet.example.com\`
- **Perfil do Chrome:** Perfil 2 (Profile 2)
- **Acesso:** Sim
`;

  const result = applyMarkdownAccessUpdates(items, mdInput, { now, todayStr });
  assert.equal(result.items.length, 3);
  assert.equal(result.parsedCount, 2);
  assert.equal(result.matchedCount, 2);
  assert.equal(result.markedAccessedCount, 1);
  assert.equal(result.markedPendingCount, 1);
  assert.equal(result.updatedProfileCount, 2);

  const updated35m = result.items.find((i) => i.id === '35m')!;
  assert.equal(updated35m.profileDirectory, 'Profile 5');
  assert.equal(isAccessedToday(updated35m.lastAccessedDate, todayStr), false);
  assert.ok(updated35m.execLine?.includes('--profile-directory="Profile 5"'));
  assert.equal(updated35m.desktopPath, undefined);
  assert.equal(updated35m.rawFileName, undefined);
  assert.equal(updated35m.appId, undefined);

  const updatedBet1 = result.items.find((i) => i.id === 'bet-p1')!;
  const untouchedBet5 = result.items.find((i) => i.id === 'bet-p5')!;
  assert.equal(updatedBet1.profileDirectory, 'Profile 2');
  assert.equal(isAccessedToday(updatedBet1.lastAccessedDate, todayStr), true);
  assert.equal(untouchedBet5.profileDirectory, 'Profile 5');
  assert.equal(isAccessedToday(untouchedBet5.lastAccessedDate, todayStr), false);
});

test('applyMarkdownAccessUpdates returns Default and duplicate copies to Profile 5 from exported report without Acesso line while preserving distinct clones', () => {
  const todayStr = '2026-11-24';
  const now = new Date(2026, 10, 24, 9, 45, 0);

  const items: PWAItem[] = [
    {
      id: 'pwa_platform_13e_com',
      name: '13E.COM',
      url: 'https://13e.com',
      category: 'Comunicação',
      notes: '',
      profileDirectory: 'Default',
      execLine: '/opt/google/chrome/google-chrome --profile-directory="Default" --app-id=app13e',
      rawFileName: 'chrome-app13e-Default.desktop',
      desktopPath: '/home/user/.local/share/applications/chrome-app13e-Default.desktop',
      appId: 'app13e',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-01',
    },
    {
      id: 'pwa_platform_13e_com__dup_2',
      name: '13E.COM (Default)',
      url: 'https://13e.com/',
      category: 'Comunicação',
      notes: '',
      profileDirectory: 'Default',
      rawFileName: 'chrome-app13e-copy-Default.desktop',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-02',
    },
    {
      id: 'pwa_5ggg_stale',
      name: '5ggg.com',
      url: 'https://5ggg.com/',
      category: 'Comunicação',
      notes: '',
      // Already labeled Profile 5, but still carrying stale Default desktop fields
      profileDirectory: 'Profile 5',
      execLine: '/opt/google/chrome/google-chrome --profile-directory="Default" --app-id=app5ggg',
      rawFileName: 'chrome-app5ggg-Default.desktop',
      desktopPath: '/home/user/.local/share/applications/chrome-app5ggg-Default.desktop',
      appId: 'app5ggg',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-01',
    },
    {
      id: 'pwa_clone_5ggg_p2',
      name: '5ggg.com (Perfil 2)',
      url: 'https://5ggg.com/',
      category: 'Comunicação',
      notes: '',
      clonedFromId: 'pwa_5ggg_stale',
      profileDirectory: 'Profile 2',
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-03',
    },
  ];

  const mdInput = `# Relatório de PWAs Extraídas - Chrome PWA Hub

> **Data de Extração:** 23/11/2026 às 08:59
> **Total de PWAs Selecionadas:** 2

---

## Grupo: Comunicação (2)

### [13E.COM](https://13e.com)
- **URL:** \`https://13e.com\`
- **Perfil do Chrome:** Perfil 5 (Profile 5) — Marlene
- **Classificação:** Sem classificação
- **Último Acesso:** 22/11 - 09:07

### [5ggg.com](https://5ggg.com/)
- **URL:** \`https://5ggg.com/\`
- **Perfil do Chrome:** Perfil 5 (Profile 5) — Marlene
- **Classificação:** Sem classificação
- **Último Acesso:** 22/11 - 05:35
`;

  const result = applyMarkdownAccessUpdates(items, mdInput, { now, todayStr });

  assert.equal(result.items.length, 4, 'Never adds or removes cards');
  assert.equal(result.parsedCount, 2);
  assert.equal(result.matchedCount, 2);
  assert.equal(result.updatedProfileCount, 3, 'Moves both 13E.COM copies and cleans 5ggg stale Default fields');

  const p13Main = result.items.find((i) => i.id === 'pwa_platform_13e_com')!;
  const p13Dup = result.items.find((i) => i.id === 'pwa_platform_13e_com__dup_2')!;
  const p5gggMain = result.items.find((i) => i.id === 'pwa_5ggg_stale')!;
  const p5gggCloneP2 = result.items.find((i) => i.id === 'pwa_clone_5ggg_p2')!;

  assert.equal(p13Main.profileDirectory, 'Profile 5');
  assert.equal(p13Main.desktopPath, undefined);
  assert.equal(p13Main.rawFileName, undefined);
  assert.equal(p13Main.appId, undefined);
  assert.ok(p13Main.execLine?.includes('--profile-directory="Profile 5"'));

  assert.equal(p13Dup.profileDirectory, 'Profile 5');
  assert.equal(p13Dup.rawFileName, undefined);

  assert.equal(p5gggMain.profileDirectory, 'Profile 5');
  assert.equal(p5gggMain.desktopPath, undefined);
  assert.equal(p5gggMain.rawFileName, undefined);
  assert.equal(p5gggMain.appId, undefined);
  assert.ok(p5gggMain.execLine?.includes('--profile-directory="Profile 5"'));

  assert.equal(p5gggCloneP2.profileDirectory, 'Profile 2', 'Must never overwrite an explicit Perfil 2 clone');
});


