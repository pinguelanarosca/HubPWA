import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUpdateAvailable,
  parseGitHubCommitResponse,
  formatCommitDate,
} from './githubUpdater';

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
