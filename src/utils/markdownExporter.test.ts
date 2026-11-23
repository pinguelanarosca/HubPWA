import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PWAItem } from '../types/pwa';
import { buildPWAsMarkdownContent, formatExportChromeProfile } from './markdownExporter';

test('buildPWAsMarkdownContent filters selected items and includes Chrome profile information', () => {
  const dummyPWAs: PWAItem[] = [
    {
      id: '1',
      name: 'GitHub',
      url: 'https://github.com',
      category: 'Dev',
      group: 'Dev',
      notes: 'Code review',
      profileDirectory: 'Profile 5',
      lastAccessedDate: '2026-11-07T08:00:00Z',
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
      lastAccessedDate: null,
      accessCount: 0,
      createdAt: '2026-10-01',
    },
  ];

  const selected = new Set(['1', '3', '4']);
  const md = buildPWAsMarkdownContent(dummyPWAs, selected, {
    now: new Date('2026-11-22T15:30:00Z'),
    chromeProfiles: [
      { directory: 'Profile 5', displayName: 'Conta Trabalho' },
      { directory: 'Profile 2', displayName: 'Profile 2' },
    ],
  });

  assert.ok(md.includes('### [GitHub](https://github.com)'));
  assert.ok(md.includes('- **Perfil do Chrome:** Perfil 5 (Profile 5) — Conta Trabalho'));
  assert.ok(md.includes('### [Linear](https://linear.app)'));
  assert.ok(md.includes('- **Perfil do Chrome:** Perfil 2 (Profile 2)'));
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

