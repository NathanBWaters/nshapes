import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const {
  handlePostToolUse,
  handleStop,
  summarizeRunJobs,
} = require('../scripts/agy-ci-hook.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHA_A = '1111111111111111111111111111111111111111';
const SHA_B = '2222222222222222222222222222222222222222';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nshapes-ci-hooks-test-'));
}

describe('CI & Antigravity verification hooks', () => {
  const tempDirs: string[] = [];

  const nextArtifactDir = () => {
    const dir = makeTempDir();
    tempDirs.push(dir);
    return dir;
  };

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('configures .agents/hooks.json with valid PostToolUse and Stop schemas', () => {
    const hooksPath = path.join(REPO_ROOT, '.agents', 'hooks.json');
    expect(fs.existsSync(hooksPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    const gate = parsed['github-ci-gate'];
    expect(gate).toBeDefined();

    // PostToolUse uses grouped matcher + hooks wrapper
    expect(Array.isArray(gate.PostToolUse)).toBe(true);
    expect(gate.PostToolUse[0].matcher).toBe('edit_file|write_file|run_command');
    expect(Array.isArray(gate.PostToolUse[0].hooks)).toBe(true);
    expect(gate.PostToolUse[0].hooks[0].command).toBe('node ../scripts/agy-ci-hook.js post-tool');

    // Stop uses flat handler objects
    expect(Array.isArray(gate.Stop)).toBe(true);
    expect(gate.Stop[0].command).toBe('node ../scripts/agy-ci-hook.js stop');
    expect(gate.Stop[0].matcher).toBeUndefined();

    // Command relative paths resolve from .agents/
    const resolvedScript = path.resolve(REPO_ROOT, '.agents', '../scripts/agy-ci-hook.js');
    expect(fs.existsSync(resolvedScript)).toBe(true);
  });

  it('ships an executable .githooks/pre-push enforcing version bumps and verification gates', () => {
    const prePushPath = path.join(REPO_ROOT, '.githooks', 'pre-push');
    expect(fs.existsSync(prePushPath)).toBe(true);
    const mode = fs.statSync(prePushPath).mode;
    expect(mode & 0o111).not.toBe(0);

    const content = fs.readFileSync(prePushPath, 'utf8');
    expect(content).toContain('refs/heads/main');
    expect(content).toContain('package.json');
    expect(content).toContain('npm run typecheck');
    expect(content).toContain('npm run lint');
    expect(content).toContain('npm run validate:icons');
    expect(content).toContain('npm run test:fast');
  });

  it('allows read-only turns immediately with zero git or network calls', async () => {
    const artifactDir = nextArtifactDir();
    const fetchJson = jest.fn();
    const getGitStatusPorcelain = jest.fn();

    const decision = await handleStop(
      {
        terminationReason: 'NO_TOOL_CALL',
        fullyIdle: true,
        artifactDirectoryPath: artifactDir,
      },
      { repoRoot: REPO_ROOT, fetchJson, getGitStatusPorcelain }
    );

    expect(decision).toEqual({ decision: 'allow' });
    expect(getGitStatusPorcelain).not.toHaveBeenCalled();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('allows yielding turns when fullyIdle is false or when terminationReason is non-completion', async () => {
    const artifactDir = nextArtifactDir();
    const getGitStatusPorcelain = jest.fn(() => ' M src/index.ts\n');

    handlePostToolUse(
      {
        toolCall: { name: 'edit_file', args: { Path: path.join(REPO_ROOT, 'package.json') } },
        artifactDirectoryPath: artifactDir,
      },
      { repoRoot: REPO_ROOT, getHeadSha: () => SHA_A }
    );

    expect(
      await handleStop(
        { terminationReason: 'NO_TOOL_CALL', fullyIdle: false, artifactDirectoryPath: artifactDir },
        { repoRoot: REPO_ROOT, getGitStatusPorcelain }
      )
    ).toEqual({ decision: 'allow' });

    expect(
      await handleStop(
        { terminationReason: 'TERMINAL_STEP_TYPE', fullyIdle: true, artifactDirectoryPath: artifactDir },
        { repoRoot: REPO_ROOT, getGitStatusPorcelain }
      )
    ).toEqual({ decision: 'allow' });

    expect(getGitStatusPorcelain).not.toHaveBeenCalled();
  });

  it('blocks dirty working trees up to 3 bounces before failing open', async () => {
    const artifactDir = nextArtifactDir();
    handlePostToolUse(
      {
        toolCall: { name: 'edit_file', args: { Path: path.join(REPO_ROOT, 'AGENTS.md') } },
        artifactDirectoryPath: artifactDir,
      },
      { repoRoot: REPO_ROOT, getHeadSha: () => SHA_A }
    );

    const deps = {
      repoRoot: REPO_ROOT,
      getGitStatusPorcelain: () => ' M AGENTS.md\n',
    };

    for (let i = 0; i < 3; i += 1) {
      const res = await handleStop(
        { terminationReason: 'NO_TOOL_CALL', fullyIdle: true, artifactDirectoryPath: artifactDir },
        deps
      );
      expect(res.decision).toBe('continue');
      expect(res.reason).toContain('uncommitted changes');
    }

    const fourth = await handleStop(
      { terminationReason: 'NO_TOOL_CALL', fullyIdle: true, artifactDirectoryPath: artifactDir },
      deps
    );
    expect(fourth).toEqual({ decision: 'allow' });
  });

  it('blocks unpushed commits ahead of origin/main', async () => {
    const artifactDir = nextArtifactDir();
    handlePostToolUse(
      {
        toolCall: { name: 'run_command', args: { CommandLine: 'git commit -m "test"' } },
        artifactDirectoryPath: artifactDir,
      },
      { repoRoot: REPO_ROOT, getHeadSha: () => SHA_A }
    );

    const res = await handleStop(
      { terminationReason: 'NO_TOOL_CALL', fullyIdle: true, artifactDirectoryPath: artifactDir },
      {
        repoRoot: REPO_ROOT,
        getGitStatusPorcelain: () => '',
        getAheadCount: () => 1,
      }
    );
    expect(res.decision).toBe('continue');
    expect(res.reason).toContain('unpushed commits');
  });

  it('continues with schedule instructions when GitHub Actions is in_progress', async () => {
    const artifactDir = nextArtifactDir();
    handlePostToolUse(
      {
        toolCall: { name: 'run_command', args: { CommandLine: 'git push origin main' } },
        artifactDirectoryPath: artifactDir,
      },
      { repoRoot: REPO_ROOT, getHeadSha: () => SHA_B, now: () => 1_000_000 }
    );

    const fetchJson = jest.fn(async (url: string) => {
      if (url.includes('/jobs')) {
        return {
          jobs: [
            {
              name: 'build',
              status: 'in_progress',
              conclusion: null,
              steps: [
                { number: 5, name: 'Run guardrails', status: 'completed', conclusion: 'success' },
                { number: 6, name: 'Run Jest fast', status: 'in_progress', conclusion: null },
              ],
            },
          ],
        };
      }
      return {
        workflow_runs: [
          {
            run_number: 169,
            head_sha: SHA_B,
            status: 'in_progress',
            conclusion: null,
            html_url: 'https://github.com/NathanBWaters/nshapes/actions/runs/999',
            jobs_url: 'https://api.github.com/repos/NathanBWaters/nshapes/actions/runs/999/jobs',
          },
        ],
      };
    });

    const res = await handleStop(
      { terminationReason: 'NO_TOOL_CALL', fullyIdle: true, artifactDirectoryPath: artifactDir },
      {
        repoRoot: REPO_ROOT,
        getGitStatusPorcelain: () => '',
        getAheadCount: () => 0,
        getHeadSha: () => SHA_B,
        fetchJson,
      }
    );

    expect(res.decision).toBe('continue');
    expect(res.reason).toContain('run #169');
    expect(res.reason).toContain('build -> Run Jest fast');
    expect(res.reason).toContain('schedule');
  });

  it('forces self-heal when GitHub Actions fails and reports the failed step', async () => {
    const artifactDir = nextArtifactDir();
    handlePostToolUse(
      {
        toolCall: { name: 'run_command', args: { CommandLine: 'git push origin main' } },
        artifactDirectoryPath: artifactDir,
      },
      { repoRoot: REPO_ROOT, getHeadSha: () => SHA_B, now: () => 1_000_000 }
    );

    const fetchJson = jest.fn(async (url: string) => {
      if (url.includes('/jobs')) {
        return {
          jobs: [
            {
              name: 'build',
              status: 'completed',
              conclusion: 'failure',
              steps: [
                { number: 7, name: 'Install Playwright Chromium', status: 'completed', conclusion: 'failure' },
              ],
            },
          ],
        };
      }
      return {
        workflow_runs: [
          {
            run_number: 170,
            head_sha: SHA_B,
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/NathanBWaters/nshapes/actions/runs/1000',
            jobs_url: 'https://api.github.com/repos/NathanBWaters/nshapes/actions/runs/1000/jobs',
          },
        ],
      };
    });

    const res = await handleStop(
      { terminationReason: 'NO_TOOL_CALL', fullyIdle: true, artifactDirectoryPath: artifactDir },
      {
        repoRoot: REPO_ROOT,
        getGitStatusPorcelain: () => '',
        getAheadCount: () => 0,
        getHeadSha: () => SHA_B,
        fetchJson,
      }
    );

    expect(res.decision).toBe('continue');
    expect(res.reason).toContain('FAILED');
    expect(res.reason).toContain('build -> Install Playwright Chromium');
    expect(res.reason).toContain('https://github.com/NathanBWaters/nshapes/actions/runs/1000');
  });

  it('allows completion and caches verifiedSha once GitHub Actions passes', async () => {
    const artifactDir = nextArtifactDir();
    handlePostToolUse(
      {
        toolCall: { name: 'run_command', args: { CommandLine: 'git push origin main' } },
        artifactDirectoryPath: artifactDir,
      },
      { repoRoot: REPO_ROOT, getHeadSha: () => SHA_B, now: () => 1_000_000 }
    );

    const fetchJson = jest.fn(async (url: string) => {
      if (url.includes('/jobs')) return { jobs: [{ name: 'build', status: 'completed', conclusion: 'success', steps: [] }] };
      return {
        workflow_runs: [
          {
            run_number: 171,
            head_sha: SHA_B,
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/NathanBWaters/nshapes/actions/runs/1001',
            jobs_url: 'https://api.github.com/repos/NathanBWaters/nshapes/actions/runs/1001/jobs',
          },
        ],
      };
    });

    const deps = {
      repoRoot: REPO_ROOT,
      getGitStatusPorcelain: () => '',
      getAheadCount: () => 0,
      getHeadSha: () => SHA_B,
      fetchJson,
    };

    const first = await handleStop(
      { terminationReason: 'NO_TOOL_CALL', fullyIdle: true, artifactDirectoryPath: artifactDir },
      deps
    );
    expect(first).toEqual({ decision: 'allow' });
    expect(fetchJson).toHaveBeenCalledTimes(2);

    // Second Stop call reuses cached verifiedSha with zero extra API requests
    const second = await handleStop(
      { terminationReason: 'NO_TOOL_CALL', fullyIdle: true, artifactDirectoryPath: artifactDir },
      deps
    );
    expect(second).toEqual({ decision: 'allow' });
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('summarizes job steps cleanly via summarizeRunJobs', () => {
    expect(
      summarizeRunJobs({
        jobs: [
          { name: 'build', status: 'completed', conclusion: 'success', steps: [] },
          {
            name: 'deploy',
            status: 'in_progress',
            conclusion: null,
            steps: [{ name: 'Deploy to GitHub Pages', status: 'in_progress' }],
          },
        ],
      })
    ).toEqual({ activeStep: 'deploy -> Deploy to GitHub Pages', failedStep: null });
  });

  it('runs cleanly as a subprocess invoked from .agents/ matching hooks.json cwd', () => {
    const artifactDir = nextArtifactDir();
    const agentsCwd = path.join(REPO_ROOT, '.agents');

    const postTool = spawnSync('node', ['../scripts/agy-ci-hook.js', 'post-tool'], {
      cwd: agentsCwd,
      input: JSON.stringify({
        toolCall: { name: 'edit_file', args: { Path: path.join(REPO_ROOT, 'package.json') } },
        artifactDirectoryPath: artifactDir,
      }),
      encoding: 'utf8',
    });
    expect(postTool.status).toBe(0);
    expect(JSON.parse(postTool.stdout.trim())).toEqual({});
    expect(fs.existsSync(path.join(artifactDir, 'ci-gate-state.json'))).toBe(true);

    const stopYield = spawnSync('node', ['../scripts/agy-ci-hook.js', 'stop'], {
      cwd: agentsCwd,
      input: JSON.stringify({
        terminationReason: 'NO_TOOL_CALL',
        fullyIdle: false,
        artifactDirectoryPath: artifactDir,
      }),
      encoding: 'utf8',
    });
    expect(stopYield.status).toBe(0);
    expect(JSON.parse(stopYield.stdout.trim())).toEqual({ decision: 'allow' });
  });
});
