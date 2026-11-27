import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PWA_WINDOW_WIDTH,
  PWA_WINDOW_HEIGHT,
  getPopupWindowFeatures,
  encodeBase64Url,
  decodeBase64Url,
  encodeLaunchBridgePayload,
  decodeLaunchBridgePayload,
  buildLaunchBridgeUrl,
  extractExecFromDesktopContent,
  applyWindowSizeToChromeExec,
  buildLinuxLaunchCandidates,
  parseDirectSpawnCommand,
  normalizeLaunchUrl,
  tryAcquirePwaLaunchSlot,
  PWA_SAME_ITEM_COOLDOWN_MS,
  shouldUseWaylandCloneBridge,
} from './launchConfig';

test('default PWA launch dimensions match 539x993 reference size', () => {
  assert.equal(PWA_WINDOW_WIDTH, 539);
  assert.equal(PWA_WINDOW_HEIGHT, 993);
  const features = getPopupWindowFeatures();
  assert.match(features, /width=539/);
  assert.match(features, /height=993/);
  assert.match(features, /popup=yes/);
});

test('launch bridge payload and title encode/decode cleanly and reject unsafe schemes', () => {
  const url = 'https://37a.com/lobby?ref=hub&tab=1';
  const payload = encodeLaunchBridgePayload(url);
  assert.ok(payload);
  assert.equal(payload.includes('&'), false);
  assert.equal(payload.includes('?'), false);
  assert.equal(decodeLaunchBridgePayload(payload), url);
  assert.equal(encodeLaunchBridgePayload('javascript:alert(1)'), null);
  assert.equal(decodeLaunchBridgePayload('aW52YWxpZA'), null);

  const hubName = '37A.COM (Perfil 1) - Promoção';
  const encodedTitle = encodeBase64Url(hubName);
  assert.equal(decodeBase64Url(encodedTitle), hubName);
});

test('applyWindowSizeToChromeExec strips placeholders/old sizes, rewrites --app URL via bridge with title, and appends 539,993', () => {
  const result = applyWindowSizeToChromeExec(
    '/opt/google/chrome/google-chrome --profile-directory="Profile 1" --window-size=1280,800 --app="https://37a.com/?a=1" %U',
    539,
    993,
    'http://127.0.0.1:3000',
    '37A.COM (Perfil 1)'
  );
  assert.match(result, /--app="http:\/\/127\.0\.0\.1:3000\/api\/launch-bridge\/[^"]+&t=[^"]+"/);
  assert.match(result, /--window-size=539,993$/);
  assert.equal(result.includes('1280,800'), false);
  assert.equal(result.includes('%U'), false);
});

test('extractExecFromDesktopContent parses Exec line from [Desktop Entry]', () => {
  const content = `[Desktop Entry]
Name=Prosperity Mouse
Exec=/opt/google/chrome/google-chrome --profile-directory=Default --app-id=xyz %U
Type=Application`;
  assert.equal(
    extractExecFromDesktopContent(content),
    '/opt/google/chrome/google-chrome --profile-directory=Default --app-id=xyz %U'
  );
});

test('buildLinuxLaunchCandidates routes cloned URL PWAs through self-resizing launch bridge with --window-size=539,993 and Hub title', () => {
  const cloneCandidates = buildLinuxLaunchCandidates({
    profileDirectory: 'Profile 1',
    url: 'https://37a.com/game',
    windowTitle: '37A.COM (Perfil 1)',
    bridgeOrigin: 'http://127.0.0.1:3000',
    hasGtkLaunch: true,
    hasGio: true,
    hasChrome: true,
  });

  const expectedBridge = buildLaunchBridgeUrl(
    'https://37a.com/game',
    'http://127.0.0.1:3000',
    539,
    993,
    '37A.COM (Perfil 1)'
  );
  assert.ok(expectedBridge);
  assert.match(cloneCandidates[0], /--profile-directory="Profile 1"/);
  assert.ok(cloneCandidates[0].includes(`--app="${expectedBridge}"`));
  assert.match(cloneCandidates[0], /--window-size=539,993/);
});

test('buildLinuxLaunchCandidates prioritizes Chrome CLI with --window-size=539,993 ahead of gio/gtk-launch', () => {
  const candidates = buildLinuxLaunchCandidates({
    desktopExecLine: '/opt/google/chrome/google-chrome --profile-directory="Profile 2" --app-id=myid',
    desktopPath: '/home/user/.local/share/applications/chrome-myid-Profile_2.desktop',
    desktopPathExists: true,
    rawFileName: 'chrome-myid-Profile_2.desktop',
    appId: 'myid',
    profileDirectory: 'Profile 2',
    url: 'https://example.com',
    windowTitle: 'Meu App',
    bridgeOrigin: 'http://127.0.0.1:3000',
    hasGtkLaunch: true,
    hasGio: true,
    hasChrome: true,
  });

  assert.ok(candidates.length >= 4);
  assert.match(candidates[0], /--window-size=539,993/);
  assert.ok(
    candidates.findIndex((c) => c.includes('--window-size=539,993')) <
      candidates.findIndex((c) => c.startsWith('gio launch')),
    'Sized Chrome command must run before raw gio launch fallback'
  );
});

test('buildLinuxLaunchCandidates limits Chrome binaries when chromeBinaries is specified and skips bridge hop when bridgeOrigin is omitted', () => {
  const directCandidates = buildLinuxLaunchCandidates({
    profileDirectory: 'Profile 3',
    url: 'https://35c.com/',
    windowTitle: '35C.COM',
    chromeBinaries: ['google-chrome'],
    hasGtkLaunch: true,
    hasGio: true,
    hasChrome: true,
  });

  const chromeCmds = directCandidates.filter((c) => !c.startsWith('gtk-launch') && !c.startsWith('gio'));
  assert.equal(chromeCmds.length, 1);
  assert.equal(
    chromeCmds[0],
    'google-chrome --profile-directory="Profile 3" --app="https://35c.com/" --window-size=539,993 2>/dev/null'
  );
});

test('Wayland clone bridge applies only to real URL clones', () => {
  const wayland = { XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'wayland-0' };
  const x11 = { XDG_SESSION_TYPE: 'x11', WAYLAND_DISPLAY: '' };
  const clone = { clonedFromId: 'original-pwa', url: 'https://53h.com', appId: undefined };
  assert.equal(shouldUseWaylandCloneBridge(clone, wayland), true);
  assert.equal(shouldUseWaylandCloneBridge(clone, x11), false);
  assert.equal(shouldUseWaylandCloneBridge({ ...clone, appId: 'installed-id' }, wayland), false);
  assert.equal(shouldUseWaylandCloneBridge({ url: clone.url }, wayland), false);
  assert.equal(shouldUseWaylandCloneBridge({ ...clone, url: 'javascript:alert(1)' }, wayland), false);
});

test('parseDirectSpawnCommand splits direct Chrome argv without shell fork and rejects shell expressions', () => {
  const parsed = parseDirectSpawnCommand(
    '/opt/google/chrome/google-chrome --profile-directory="Profile 5" --app-id="agimnkijcaahngcdmfeangaknmldooml" --window-size=539,993 2>/dev/null'
  );
  assert.deepEqual(parsed, {
    executable: '/opt/google/chrome/google-chrome',
    args: [
      '--profile-directory=Profile 5',
      '--app-id=agimnkijcaahngcdmfeangaknmldooml',
      '--window-size=539,993',
    ],
  });

  const urlCmd = parseDirectSpawnCommand(
    `google-chrome --profile-directory='Default' --app="https://35m.com/?a=1&b=2" --window-size=539,993 2>/dev/null`
  );
  assert.deepEqual(urlCmd, {
    executable: 'google-chrome',
    args: [
      '--profile-directory=Default',
      '--app=https://35m.com/?a=1&b=2',
      '--window-size=539,993',
    ],
  });

  assert.equal(parseDirectSpawnCommand('gio launch "$HOME/.local/share/applications/a.desktop"'), null);
  assert.equal(parseDirectSpawnCommand('google-chrome || chromium'), null);
  assert.equal(parseDirectSpawnCommand(''), null);
});

test('tryAcquirePwaLaunchSlot blocks rapid double-click on same PWA but allows instant launch of distinct PWAs', () => {
  const cooldowns = new Map<string, number>();

  assert.equal(tryAcquirePwaLaunchSlot(cooldowns, 'pwa_1', 1000, PWA_SAME_ITEM_COOLDOWN_MS), true);
  // Same PWA clicked 100ms later -> blocked (anti-double-click)
  assert.equal(tryAcquirePwaLaunchSlot(cooldowns, 'pwa_1', 1100, PWA_SAME_ITEM_COOLDOWN_MS), false);
  // Different PWA clicked 1ms later -> allowed immediately (no cross-PWA global block)
  assert.equal(tryAcquirePwaLaunchSlot(cooldowns, 'pwa_2', 1001, PWA_SAME_ITEM_COOLDOWN_MS), true);
  assert.equal(tryAcquirePwaLaunchSlot(cooldowns, 'pwa_3', 1002, PWA_SAME_ITEM_COOLDOWN_MS), true);
  // Same PWA after cooldown window -> allowed again
  assert.equal(tryAcquirePwaLaunchSlot(cooldowns, 'pwa_1', 1000 + PWA_SAME_ITEM_COOLDOWN_MS, PWA_SAME_ITEM_COOLDOWN_MS), true);
});

test('normalizeLaunchUrl adds safe protocol to bare domains and rejects unsafe schemes', () => {
  assert.equal(normalizeLaunchUrl('https://35m.com/play'), 'https://35m.com/play');
  assert.equal(normalizeLaunchUrl('http://localhost:8080/app'), 'http://localhost:8080/app');
  assert.equal(normalizeLaunchUrl('  35m.com  '), 'https://35m.com');
  assert.equal(normalizeLaunchUrl('sub.example.com/login?x=1'), 'https://sub.example.com/login?x=1');
  assert.equal(normalizeLaunchUrl('localhost:3000'), 'http://localhost:3000');
  assert.equal(normalizeLaunchUrl('javascript:alert(1)'), '');
  assert.equal(normalizeLaunchUrl('data:text/html,hi'), '');
  assert.equal(normalizeLaunchUrl(''), '');
});

test('buildLinuxLaunchCandidates normalizes bare domain URLs and parseDirectSpawnCommand handles escaped spaces and chained redirections', () => {
  const candidates = buildLinuxLaunchCandidates({
    profileDirectory: 'Profile 5',
    url: '35m.com',
    chromeBinaries: ['/opt/google/chrome/google-chrome'],
    hasGtkLaunch: false,
    hasGio: false,
    hasChrome: true,
  });
  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0],
    '/opt/google/chrome/google-chrome --profile-directory="Profile 5" --app="https://35m.com" --window-size=539,993 2>/dev/null'
  );

  const escapedCmd = parseDirectSpawnCommand(
    '"/opt/google/chrome/google-chrome" --profile-directory=Profile\\ 5 --app="https://35m.com" >/dev/null 2>&1'
  );
  assert.deepEqual(escapedCmd, {
    executable: '/opt/google/chrome/google-chrome',
    args: ['--profile-directory=Profile 5', '--app=https://35m.com'],
  });
});


