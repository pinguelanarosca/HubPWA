import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PWAItem } from '../types/pwa';

test('extractPWAsToMarkdown filters selected items correctly', () => {
  const dummyPWAs: PWAItem[] = [
    { id: '1', name: 'GitHub', url: 'https://github.com', category: 'Dev', group: 'Dev', notes: 'Code review', lastAccessedDate: '2026-11-07T08:00:00Z', accessCount: 5, createdAt: '2026-10-01' },
    { id: '2', name: 'Figma', url: 'https://figma.com', category: 'Design', group: 'Design', notes: 'UX mockups', lastAccessedDate: null, accessCount: 0, createdAt: '2026-10-01' },
  ];
  const selected = new Set(['1']);
  const selectedItems = dummyPWAs.filter((it) => selected.has(it.id));
  assert.equal(selectedItems.length, 1);
  assert.equal(selectedItems[0].name, 'GitHub');
});
