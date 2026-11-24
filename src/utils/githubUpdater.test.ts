import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isUpdateAvailable,
  parseGitHubCommitResponse,
  formatCommitDate,
} from './githubUpdater';
import { copyUpdateDirectory, findExtractedRepoDirectory } from './githubUpdaterFs';

test('isUpdateAvailable returns true when local and remote SHAs differ', () => {
  const local = '92ba6d88bd06e2d6350d78c55ab4698c6568a595';
  const remoteNew = 'a1b2c3d4e5f678901234567890abcdef12345678';
  assert.equal(isUpdateAvailable(local, remoteNew), true);
});

test('isUpdateAvailable returns false when local and remote SHAs match', () => {
  const local = '92ba6d88bd06e2d6350d78c55ab4698c6568a595';
  const remoteSame = '92ba6d88bd06e2d6350d78c55ab4698c6568a595';
  assert.equal(isUpdateAvailable(local, remoteSame), false);
});

test('parseGitHubCommitResponse extracts commit info accurately', () => {
  const mockGhResponse = {
    sha: '92ba6d88bd06e2d6350d78c55ab4698c6568a595',
    commit: {
      author: {
        name: 'pinguelanarosca',
        date: '2026-10-29T12:58:32Z',
      },
      message: 'feat: initialize Chrome PWA Hub project\n\nSetup project structure',
    },
    author: {
      login: 'pinguelanarosca',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
    },
    html_url: 'https://github.com/pinguelanarosca/HubPWA/commit/92ba6d88bd06e2d6350d78c55ab4698c6568a595',
  };

  const parsed = parseGitHubCommitResponse(mockGhResponse);
  assert.equal(parsed.sha, '92ba6d88bd06e2d6350d78c55ab4698c6568a595');
  assert.equal(parsed.shortSha, '92ba6d8');
  assert.equal(parsed.author, 'pinguelanarosca');
  assert.match(parsed.message, /feat: initialize Chrome PWA Hub/);
  assert.equal(parsed.avatarUrl, 'https://avatars.githubusercontent.com/u/12345?v=4');
});

test('formatCommitDate returns formatted string', () => {
  const formatted = formatCommitDate('2026-10-29T12:58:32Z');
  assert.ok(formatted.includes('29'));
  assert.ok(formatted.includes('2026'));
});

test('findExtractedRepoDirectory and copyUpdateDirectory copy updated files without rsync while preserving protected paths', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hubpwa-upd-test-'));
  try {
    const extractRoot = path.join(tmpRoot, 'extracted');
    const repoInner = path.join(extractRoot, 'pinguelanarosca-HubPWA-6773fb3');
    const destRoot = path.join(tmpRoot, 'applet');

    // Existing protected user files in destRoot
    fs.mkdirSync(path.join(destRoot, 'data'), { recursive: true });
    fs.mkdirSync(path.join(destRoot, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(destRoot, 'data', 'hubpwa_state.json'), '{"keep":true}', 'utf8');
    fs.writeFileSync(path.join(destRoot, 'node_modules', 'pkg', 'index.js'), 'keep', 'utf8');
    fs.writeFileSync(path.join(destRoot, '.env'), 'SECRET=keep', 'utf8');

    // Incoming extracted tarball contents
    fs.mkdirSync(path.join(repoInner, 'src'), { recursive: true });
    fs.mkdirSync(path.join(repoInner, 'data'), { recursive: true });
    fs.mkdirSync(path.join(repoInner, '.git'), { recursive: true });
    fs.writeFileSync(path.join(extractRoot, 'pax_global_header'), 'header', 'utf8');
    fs.writeFileSync(path.join(repoInner, 'src', 'App.tsx'), 'updated app', 'utf8');
    fs.writeFileSync(path.join(repoInner, 'package.json'), '{"name":"hubpwa"}', 'utf8');
    fs.writeFileSync(path.join(repoInner, 'data', 'hubpwa_state.json'), '{"overwrite":false}', 'utf8');
    fs.writeFileSync(path.join(repoInner, '.env'), 'SECRET=bad', 'utf8');
    fs.writeFileSync(path.join(repoInner, '.git', 'HEAD'), 'ref: refs/heads/main', 'utf8');

    const detected = findExtractedRepoDirectory(extractRoot);
    assert.equal(detected, path.resolve(repoInner));

    const result = copyUpdateDirectory(detected!, destRoot);
    assert.equal(result.copiedFiles, 2);
    assert.equal(fs.readFileSync(path.join(destRoot, 'src', 'App.tsx'), 'utf8'), 'updated app');
    assert.equal(fs.readFileSync(path.join(destRoot, 'package.json'), 'utf8'), '{"name":"hubpwa"}');
    assert.equal(fs.readFileSync(path.join(destRoot, 'data', 'hubpwa_state.json'), 'utf8'), '{"keep":true}');
    assert.equal(fs.readFileSync(path.join(destRoot, '.env'), 'utf8'), 'SECRET=keep');
    assert.equal(fs.readFileSync(path.join(destRoot, 'node_modules', 'pkg', 'index.js'), 'utf8'), 'keep');
    assert.equal(fs.existsSync(path.join(destRoot, '.git')), false);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

