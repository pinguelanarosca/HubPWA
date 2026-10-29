import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDesktopFile, mapDesktopCategory, convertParsedToPWAs } from './desktopParser';

test('parseDesktopFile correctly parses Chrome PWA with --app URL', () => {
  const content = `
[Desktop Entry]
Version=1.0
Terminal=false
Type=Application
Name=WhatsApp Web
Exec=/opt/google/chrome/google-chrome --profile-directory=Default --app=https://web.whatsapp.com/
Icon=chrome-hnpfjngllnobngcgfapefoaidbinmjnm-Default
StartupWMClass=crx_hnpfjngllnobngcgfapefoaidbinmjnm
Comment=Mensagens e chamadas no navegador
Categories=Network;Chat;
  `;

  const parsed = parseDesktopFile(content, 'chrome-whatsapp.desktop');
  assert.ok(parsed);
  assert.equal(parsed.name, 'WhatsApp Web');
  assert.equal(parsed.url, 'https://web.whatsapp.com/');
  assert.equal(parsed.hasExactUrl, true);
  assert.equal(parsed.category, 'Comunicação');
  assert.match(parsed.notes, /Mensagens e chamadas/);
});

test('parseDesktopFile resolves Chrome --app-id for known apps', () => {
  const content = `
[Desktop Entry]
Version=1.0
Terminal=false
Type=Application
Name=Notion
Exec=/opt/google/chrome/google-chrome --profile-directory=Default --app-id=cifhbcnohmdccbgoicgdjpfamggdegmo
Icon=chrome-cifhbcnohmdccbgoicgdjpfamggdegmo-Default
StartupWMClass=crx_cifhbcnohmdccbgoicgdjpfamggdegmo
Comment=Notion Workspace
Categories=Office;
  `;

  const parsed = parseDesktopFile(content, 'chrome-notion.desktop');
  assert.ok(parsed);
  assert.equal(parsed.name, 'Notion');
  assert.equal(parsed.url, 'https://notion.so');
  assert.equal(parsed.appId, 'cifhbcnohmdccbgoicgdjpfamggdegmo');
  assert.equal(parsed.hasExactUrl, true);
  assert.equal(parsed.category, 'Produtividade');
});

test('parseDesktopFile parses desktop file with URL field and localized name', () => {
  const content = `
[Desktop Entry]
Version=1.0
Type=Application
Name=GitHub Code
Name[pt_BR]=GitHub Repositórios
URL=https://github.com
Comment[pt_BR]=Acompanhamento de repositórios
Categories=Development;
  `;

  const parsed = parseDesktopFile(content, 'github.desktop');
  assert.ok(parsed);
  assert.equal(parsed.name, 'GitHub Repositórios');
  assert.equal(parsed.url, 'https://github.com');
  assert.equal(parsed.category, 'Dev & Código');
  assert.equal(parsed.hasExactUrl, true);
});

test('convertParsedToPWAs turns parsed items into valid PWAItems with daily pending state', () => {
  const parsed = parseDesktopFile(`
[Desktop Entry]
Name=Linear
Exec=google-chrome --app=https://linear.app
Categories=Office;
  `);

  assert.ok(parsed);
  const pwas = convertParsedToPWAs([parsed]);
  assert.equal(pwas.length, 1);
  assert.equal(pwas[0].name, 'Linear');
  assert.equal(pwas[0].url, 'https://linear.app');
  assert.equal(pwas[0].lastAccessedDate, null);
  assert.equal(pwas[0].accessCount, 0);
});

test('mapDesktopCategory maps XDG categories correctly', () => {
  assert.equal(mapDesktopCategory('Development;IDE;'), 'Dev & Código');
  assert.equal(mapDesktopCategory('Office;Finance;'), 'Produtividade');
  assert.equal(mapDesktopCategory('AudioVideo;Player;'), 'Design & Criatividade');
  assert.equal(mapDesktopCategory('Network;Chat;'), 'Comunicação');
});
