import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PWA_WINDOW_WIDTH,
  PWA_WINDOW_HEIGHT,
  getPopupWindowFeatures,
  extractExecFromDesktopContent,
  applyWindowSizeToChromeExec,
  buildLinuxLaunchCandidates,
} from './launchConfig';

test('default PWA launch dimensions match 539x993 reference size', () => {
  assert.equal(PWA_WINDOW_WIDTH, 539);
  assert.equal(PWA_WINDOW_HEIGHT, 993);
  const features = getPopupWindowFeatures();
  assert.match(features, /width=539/);
  assert.match(features, /height=993/);
  assert.match(features, /popup=yes/);
});

test('applyWindowSizeToChromeExec strips placeholders/old sizes and appends 539,993', () => {
  const result = applyWindowSizeToChromeExec(
    '/opt/google/chrome/google-chrome --profile-directory="Profile 1" --window-size=1280,800 --app-id=abc %U'
  );
  assert.equal(
    result,
    '/opt/google/chrome/google-chrome --profile-directory="Profile 1" --app-id=abc --window-size=539,993'
  );
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

test('buildLinuxLaunchCandidates prioritizes Chrome CLI with --window-size=539,993 ahead of gio/gtk-launch', () => {
  const candidates = buildLinuxLaunchCandidates({
    desktopExecLine: '/opt/google/chrome/google-chrome --profile-directory="Profile 2" --app-id=myid',
    desktopPath: '/home/user/.local/share/applications/chrome-myid-Profile_2.desktop',
    desktopPathExists: true,
    rawFileName: 'chrome-myid-Profile_2.desktop',
    appId: 'myid',
    profileDirectory: 'Profile 2',
    url: 'https://example.com',
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
