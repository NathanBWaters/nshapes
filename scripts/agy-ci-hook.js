#!/usr/bin/env node
'use strict';

/**
 * Antigravity lifecycle hooks (`PostToolUse` & `Stop`) and CLI verifier (`check`)
 * ensuring every pushed commit is clean, version-bumped, and green on GitHub Actions.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_REPO_ROOT = process.env.NSHAPES_REPO_ROOT || path.resolve(__dirname, '..');
const GITHUB_RUNS_URL =
  'https://api.github.com/repos/NathanBWaters/nshapes/actions/runs?branch=main&per_page=5';

const WORKSPACE_EDIT_TOOLS = new Set(['edit_file', 'write_file']);
const GIT_MUTATION_RE = /\bgit\s+(?:\S+\s+)*(?:commit|push|merge|rebase|cherry-pick)\b/;
const GIT_PUSH_RE = /\bgit\s+(?:\S+\s+)*push\b/;

function resolveStateFile(input, repoRoot) {
  if (input && typeof input.artifactDirectoryPath === 'string' && input.artifactDirectoryPath.trim()) {
    return path.join(input.artifactDirectoryPath, 'ci-gate-state.json');
  }
  const safeId = String((input && input.conversationId) || 'default').replace(/[^a-zA-Z0-9._-]/g, '_');
  const repoTag = path.basename(repoRoot || DEFAULT_REPO_ROOT).replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(os.tmpdir(), 'nshapes-ci-gate', `${repoTag}-${safeId}`, 'ci-gate-state.json');
}

function loadState(stateFile) {
  try {
    if (!fs.existsSync(stateFile)) return null;
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

function saveState(stateFile, state) {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', 'utf8');
  } catch {
    // State persistence must never break the agent hook runner
  }
}

function isWorkspaceEditPath(targetPath, repoRoot) {
  if (typeof targetPath !== 'string' || !targetPath.trim()) return false;
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedTarget = path.resolve(resolvedRoot, targetPath);
  const isInside =
    resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
  if (!isInside) return false;
  const relParts = path.relative(resolvedRoot, resolvedTarget).split(path.sep);
  return !relParts.includes('.gemini');
}

function createDefaultDeps() {
  return {
    repoRoot: DEFAULT_REPO_ROOT,
    now: () => Date.now(),
    fetchJson: async (url, timeoutMs) => {
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      const baseHeaders = {
        'User-Agent': 'nshapes-ci-hook',
        Accept: 'application/vnd.github+json',
      };
      let res = await fetch(url, {
        headers: token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders,
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Retry unauthenticated when a stale/unrelated env token yields 401 on public repos
      if (res.status === 401 && token) {
        res = await fetch(url, {
          headers: baseHeaders,
          signal: AbortSignal.timeout(timeoutMs),
        });
      }
      if (!res.ok) {
        const err = new Error(`GitHub API returned HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    getHeadSha: (repoRoot) =>
      execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
    getGitStatusPorcelain: (repoRoot) =>
      execSync('git status --porcelain', {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    getAheadCount: (repoRoot) => {
      try {
        const out = execSync('git rev-list --count origin/main..HEAD', {
          cwd: repoRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
        const count = Number.parseInt(out, 10);
        return Number.isFinite(count) ? count : 0;
      } catch {
        return 0;
      }
    },
  };
}

function withDeps(overrides) {
  const base = createDefaultDeps();
  return overrides ? { ...base, ...overrides } : base;
}

function summarizeRunJobs(jobsPayload) {
  const jobs = (jobsPayload && Array.isArray(jobsPayload.jobs) && jobsPayload.jobs) || [];
  let activeStep = null;
  let failedStep = null;

  for (const job of jobs) {
    const steps = Array.isArray(job.steps) ? job.steps : [];
    if (!failedStep && job.conclusion && job.conclusion !== 'success' && job.conclusion !== 'skipped') {
      const badStep = steps.find(
        (s) => s.conclusion && s.conclusion !== 'success' && s.conclusion !== 'skipped'
      );
      failedStep = badStep ? `${job.name} -> ${badStep.name}` : job.name;
    }
    if (!activeStep && (job.status === 'in_progress' || job.status === 'queued')) {
      const runningStep = steps.find((s) => s.status === 'in_progress') || steps.find((s) => s.status === 'queued');
      activeStep = runningStep ? `${job.name} -> ${runningStep.name}` : job.name;
    }
  }

  return { activeStep, failedStep };
}

async function fetchJobSummary(run, deps) {
  if (!run || !run.jobs_url) return { activeStep: null, failedStep: null };
  try {
    const jobsData = await deps.fetchJson(run.jobs_url, 4000);
    return summarizeRunJobs(jobsData);
  } catch {
    return { activeStep: null, failedStep: null };
  }
}

async function inspectCommitCi(headSha, overrides) {
  const deps = withDeps(overrides);
  let runsData;
  try {
    runsData = await deps.fetchJson(GITHUB_RUNS_URL, 10000);
  } catch (err) {
    return {
      outcome: 'unavailable',
      sha: headSha,
      error: err && err.message ? err.message : String(err),
    };
  }

  const runs = (runsData && Array.isArray(runsData.workflow_runs) && runsData.workflow_runs) || [];
  const matchingRun = runs.find((r) => r.head_sha === headSha);

  if (!matchingRun) {
    const newest = runs[0] || null;
    return {
      outcome: 'not_found',
      sha: headSha,
      newestRun: newest,
    };
  }

  // If this SHA's run was cancelled because a newer commit on main already passed, treat as superseded green
  if (
    matchingRun.status === 'completed' &&
    matchingRun.conclusion === 'cancelled' &&
    runs[0] &&
    runs[0].head_sha !== headSha &&
    runs[0].status === 'completed' &&
    runs[0].conclusion === 'success'
  ) {
    return {
      outcome: 'success',
      sha: headSha,
      run: runs[0],
      supersededBy: runs[0].head_sha,
    };
  }

  const jobSummary = await fetchJobSummary(matchingRun, deps);

  if (matchingRun.status !== 'completed') {
    return {
      outcome: 'in_progress',
      sha: headSha,
      run: matchingRun,
      activeStep: jobSummary.activeStep,
    };
  }

  if (matchingRun.conclusion === 'success') {
    return {
      outcome: 'success',
      sha: headSha,
      run: matchingRun,
    };
  }

  return {
    outcome: 'failure',
    sha: headSha,
    run: matchingRun,
    failedStep: jobSummary.failedStep,
  };
}

function handlePostToolUse(input, overrides) {
  const deps = withDeps(overrides);
  if (!input || input.error) return {};

  const toolName = input.toolCall && input.toolCall.name ? String(input.toolCall.name) : '';
  const args = (input.toolCall && input.toolCall.args) || {};

  const isEdit = WORKSPACE_EDIT_TOOLS.has(toolName) && isWorkspaceEditPath(args.Path, deps.repoRoot);
  const cmdLine = toolName === 'run_command' ? String(args.CommandLine || '') : '';
  const isGitMutation = Boolean(cmdLine && GIT_MUTATION_RE.test(cmdLine));
  const isGitPush = Boolean(cmdLine && GIT_PUSH_RE.test(cmdLine));

  if (!isEdit && !isGitMutation) return {};

  const stateFile = resolveStateFile(input, deps.repoRoot);
  const state = loadState(stateFile) || {};

  if (!state.initialHeadSha) {
    try {
      state.initialHeadSha = deps.getHeadSha(deps.repoRoot);
    } catch {
      // Ignore if repo has no HEAD yet
    }
  }

  state.touchedWorkspace = true;

  if (isGitPush) {
    state.gitPushInvoked = true;
    state.lastPushCommandAtMs = deps.now();
    state.pushCheckAttempts = 0;
    state.dirtyBounces = 0;
    state.unpushedBounces = 0;
  }

  saveState(stateFile, state);
  return {};
}

async function handleStop(input, overrides) {
  const deps = withDeps(overrides);

  // Allow non-completion stops (plan mode handoff, questions, cancel, error) and active background/timer waits
  if (!input || input.terminationReason !== 'NO_TOOL_CALL' || input.fullyIdle === false) {
    return { decision: 'allow' };
  }

  const stateFile = resolveStateFile(input, deps.repoRoot);
  const state = loadState(stateFile);
  if (!state || (!state.touchedWorkspace && !state.gitPushInvoked)) {
    return { decision: 'allow' };
  }

  let dirtyStatus = '';
  try {
    dirtyStatus = deps.getGitStatusPorcelain(deps.repoRoot);
  } catch {
    return { decision: 'allow' };
  }

  if (dirtyStatus.trim().length > 0) {
    const dirtyBounces = state.dirtyBounces || 0;
    if (dirtyBounces >= 3) {
      return { decision: 'allow' };
    }
    state.dirtyBounces = dirtyBounces + 1;
    saveState(stateFile, state);
    return {
      decision: 'continue',
      reason:
        '[CI Gate Hook] Working tree has uncommitted changes. Per AGENTS.md, increment package.json version, run verification, commit, push to origin/main, and confirm GitHub Actions passes before finishing.',
    };
  }

  const aheadCount = deps.getAheadCount(deps.repoRoot);
  if (aheadCount > 0) {
    const unpushedBounces = state.unpushedBounces || 0;
    if (unpushedBounces >= 3) {
      return { decision: 'allow' };
    }
    state.unpushedBounces = unpushedBounces + 1;
    saveState(stateFile, state);
    return {
      decision: 'continue',
      reason:
        '[CI Gate Hook] Local main has unpushed commits ahead of origin/main. Push to origin/main and confirm GitHub Actions passes before finishing.',
    };
  }

  let headSha;
  try {
    headSha = deps.getHeadSha(deps.repoRoot);
  } catch {
    return { decision: 'allow' };
  }

  const hasNewCommit = Boolean(state.initialHeadSha && state.initialHeadSha !== headSha);
  if (!state.gitPushInvoked && !hasNewCommit) {
    return { decision: 'allow' };
  }

  if (state.verifiedSha === headSha) {
    return { decision: 'allow' };
  }

  const nextAttempts = (state.pushCheckAttempts || 0) + 1;
  state.pushCheckAttempts = nextAttempts;
  if (nextAttempts > 8) {
    saveState(stateFile, state);
    return { decision: 'allow' };
  }

  const shortSha = headSha.slice(0, 7);
  const ci = await inspectCommitCi(headSha, deps);

  if (ci.outcome === 'unavailable') {
    saveState(stateFile, state);
    return { decision: 'allow' };
  }

  if (ci.outcome === 'not_found') {
    const elapsedMs = deps.now() - (state.lastPushCommandAtMs || 0);
    saveState(stateFile, state);
    if (elapsedMs < 90000) {
      return {
        decision: 'continue',
        reason: `[CI Gate Hook] GitHub Actions has not registered the workflow run for ${shortSha} yet. Call the \`schedule\` tool (DurationSeconds: 60) and end your turn to wait, then run \`npm run verify:ci\`.`,
      };
    }
    return { decision: 'allow' };
  }

  if (ci.outcome === 'in_progress') {
    const run = ci.run;
    const stepSuffix = ci.activeStep ? ` (step: ${ci.activeStep})` : '';
    saveState(stateFile, state);
    return {
      decision: 'continue',
      reason: `[CI Gate Hook] GitHub Actions run #${run.run_number} (${run.html_url}) for ${shortSha} is still ${run.status}${stepSuffix}. Do NOT use shell sleep — call the \`schedule\` tool (DurationSeconds: 75) and end your turn to wait, then verify with \`npm run verify:ci\`.`,
    };
  }

  if (ci.outcome === 'success') {
    state.verifiedSha = headSha;
    saveState(stateFile, state);
    return { decision: 'allow' };
  }

  const run = ci.run;
  const failedSuffix = ci.failedStep ? `, step: ${ci.failedStep}` : '';
  saveState(stateFile, state);
  return {
    decision: 'continue',
    reason: `[CI Gate Hook] GitHub Actions run #${run.run_number} (${run.html_url}) for ${shortSha} FAILED (${run.conclusion}${failedSuffix}). Fix the failure, bump package.json version, push to origin/main, and verify the new CI run succeeds.`,
  };
}

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function runCliCheck(targetShaArg) {
  const deps = createDefaultDeps();
  const sha = targetShaArg || deps.getHeadSha(deps.repoRoot);
  const shortSha = sha.slice(0, 7);
  const ci = await inspectCommitCi(sha, deps);

  if (ci.outcome === 'success') {
    const note = ci.supersededBy ? ` (superseded by ${ci.supersededBy.slice(0, 7)})` : '';
    console.log(`✓ GitHub Actions run #${ci.run.run_number} passed for ${shortSha}${note}: ${ci.run.html_url}`);
    return 0;
  }
  if (ci.outcome === 'not_found') {
    console.log(`⏳ Waiting for GitHub Actions to register run for ${shortSha}...`);
    return 2;
  }
  if (ci.outcome === 'in_progress') {
    const stepSuffix = ci.activeStep ? ` (step: ${ci.activeStep})` : '';
    console.log(`⏳ GitHub Actions run #${ci.run.run_number} for ${shortSha} is ${ci.run.status}${stepSuffix}: ${ci.run.html_url}`);
    return 2;
  }
  if (ci.outcome === 'failure') {
    const failedSuffix = ci.failedStep ? ` (step: ${ci.failedStep})` : '';
    console.log(`✗ GitHub Actions run #${ci.run.run_number} for ${shortSha} ${ci.run.conclusion}${failedSuffix}: ${ci.run.html_url}`);
    return 1;
  }
  console.log(`✗ Unable to query GitHub Actions for ${shortSha}: ${ci.error}`);
  return 1;
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'post-tool') {
    const input = readStdinJson();
    const out = handlePostToolUse(input);
    process.stdout.write(JSON.stringify(out) + '\n');
    return 0;
  }
  if (mode === 'stop') {
    const input = readStdinJson();
    const out = await handleStop(input);
    process.stdout.write(JSON.stringify(out) + '\n');
    return 0;
  }
  if (mode === 'check') {
    return runCliCheck(process.argv[3]);
  }
  console.error('Usage: node scripts/agy-ci-hook.js <post-tool|stop|check> [sha]');
  return 1;
}

if (require.main === module) {
  main()
    .then((code) => {
      if (code) process.exit(code);
    })
    .catch(() => {
      const mode = process.argv[2];
      if (mode === 'post-tool') process.stdout.write('{}\n');
      else if (mode === 'stop') process.stdout.write('{"decision":"allow"}\n');
      else process.exit(1);
    });
} else {
  module.exports = {
    handlePostToolUse,
    handleStop,
    inspectCommitCi,
    summarizeRunJobs,
    resolveStateFile,
    isWorkspaceEditPath,
  };
}
