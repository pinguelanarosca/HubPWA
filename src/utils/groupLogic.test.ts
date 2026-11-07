import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGroupTheme, getGroupColorKey, GROUP_COLOR_THEMES, DEFAULT_GROUP_COLORS } from './groupLogic';

test('getGroupTheme returns valid translucent theme for default groups', () => {
  const theme = getGroupTheme('Comunicação');
  assert.equal(theme.colorKey, 'sky');
  assert.ok(theme.glow.includes('bg-sky'));
});

test('getGroupTheme falls back deterministically for unknown groups', () => {
  const theme1 = getGroupTheme('GrupoCustomizado123');
  assert.ok(theme1.glow.length > 0);
  assert.ok(GROUP_COLOR_THEMES[theme1.colorKey]);
});

test('getGroupColorKey respects custom colors mapping', () => {
  const custom = { 'MeusProjetos': 'purple' };
  const key = getGroupColorKey('MeusProjetos', custom);
  assert.equal(key, 'purple');
});
