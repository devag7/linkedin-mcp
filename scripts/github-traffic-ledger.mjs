#!/usr/bin/env node

// Owner-run, local-only GitHub traffic capture. No LinkedIn or volunteer data.
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'devag7/linkedin-mcp';
const PROJECT_ROOT = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_FILE = join(homedir(), '.codex', 'backups', 'linkedin-mcp', 'adoption-ledger', 'traffic.json');
const DAY_RE = /^\d{4}-\d{2}-\d{2}T00:00:00Z$/;

function nonnegative(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid nonnegative count: ' + label);
  }
  return value;
}

function validUTC(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Invalid UTC timestamp: ' + label);
  }
  return value;
}

export function normalizeSeries(value, key) {
  if (!value || typeof value !== 'object' || !Array.isArray(value[key])) {
    throw new Error('Invalid GitHub traffic series: ' + key);
  }
  const seen = new Set();
  const days = value[key].map((row) => {
    if (!row || typeof row !== 'object' || !DAY_RE.test(row.timestamp) ||
        !Number.isFinite(Date.parse(row.timestamp)) ||
        new Date(row.timestamp).toISOString().slice(0, 10) !== row.timestamp.slice(0, 10) ||
        seen.has(row.timestamp)) {
      throw new Error('Invalid or duplicate GitHub traffic day: ' + key);
    }
    seen.add(row.timestamp);
    return {
      timestamp: row.timestamp,
      count: nonnegative(row.count, key + ' day count'),
      uniques: nonnegative(row.uniques, key + ' day uniques'),
    };
  });
  if (days.length > 20) {
    throw new Error('Unexpected GitHub traffic window length');
  }
  days.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return {
    count: nonnegative(value.count, key + ' total'),
    uniques: nonnegative(value.uniques, key + ' uniques'),
    days,
  };
}

function normalizeTopRows(value, kind) {
  if (!Array.isArray(value) || value.length > 10) {
    throw new Error('Invalid GitHub traffic top-' + kind + ' response');
  }
  return value.map((row) => {
    const label = kind === 'referrers' ? row?.referrer : row?.path;
    if (typeof label !== 'string' || !label || label.length > 2048) {
      throw new Error('Invalid GitHub traffic ' + kind + ' label');
    }
    return {
      [kind === 'referrers' ? 'referrer' : 'path']: label,
      count: nonnegative(row.count, kind + ' count'),
      uniques: nonnegative(row.uniques, kind + ' uniques'),
    };
  });
}

export function makeCapture({ repo, views, clones, referrers, paths, capturedAt }) {
  if (!repo || repo.full_name !== REPOSITORY) {
    throw new Error('Unexpected repository identity');
  }
  return {
    capturedAt: validUTC(capturedAt, 'capture'),
    stars: nonnegative(repo.stargazers_count, 'stars'),
    forks: nonnegative(repo.forks_count, 'forks'),
    views: normalizeSeries(views, 'views'),
    clones: normalizeSeries(clones, 'clones'),
    referrers: normalizeTopRows(referrers, 'referrers'),
    paths: normalizeTopRows(paths, 'paths'),
  };
}

function monthlyRows(viewDays, cloneDays, asOfDay) {
  const months = new Set([...viewDays.keys(), ...cloneDays.keys()].map((day) => day.slice(0, 7)));
  return [...months].sort().map((month) => {
    const observed = (days) => [...days.entries()].filter(([day]) => day.startsWith(month));
    const views = observed(viewDays);
    const clones = observed(cloneDays);
    const monthStart = new Date(month + '-01T00:00:00Z');
    const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    const currentMonth = asOfDay.slice(0, 7);
    const expectedDays = month < currentMonth ? daysInMonth
      : month === currentMonth ? Number(asOfDay.slice(8, 10)) : 0;
    return {
      month,
      viewsObserved: views.reduce((sum, [, row]) => sum + row.count, 0),
      clonesObserved: clones.reduce((sum, [, row]) => sum + row.count, 0),
      viewsCoverageDays: views.length,
      clonesCoverageDays: clones.length,
      expectedDays,
      complete: month < currentMonth && views.length === expectedDays && clones.length === expectedDays,
    };
  });
}

export function buildReport(ledger) {
  if (ledger?.schemaVersion !== 1 || ledger.repository !== REPOSITORY ||
      !Array.isArray(ledger.captures) || ledger.captures.length === 0) {
    throw new Error('Invalid or empty traffic ledger');
  }
  const captures = [...ledger.captures].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const views = new Map();
  const clones = new Map();
  for (const capture of captures) {
    for (const row of capture.views.days) views.set(row.timestamp.slice(0, 10), row);
    for (const row of capture.clones.days) clones.set(row.timestamp.slice(0, 10), row);
  }
  const first = captures[0];
  const last = captures.at(-1);
  const asOfDay = last.capturedAt.slice(0, 10);
  return {
    repository: REPOSITORY,
    captures: captures.length,
    firstCaptureAt: first.capturedAt,
    latestCaptureAt: last.capturedAt,
    stars: last.stars,
    starChangeSinceFirstCapture: captures.length > 1 ? last.stars - first.stars : null,
    latest14DayWindow: {
      views: last.views.count,
      viewUniques: last.views.uniques,
      clones: last.clones.count,
      cloneUniques: last.clones.uniques,
    },
    months: monthlyRows(views, clones, asOfDay),
    interpretation: 'Clones are not installs; daily and overlapping-window uniques are never summed.',
  };
}

function privateFile(file, createParent) {
  if (process.platform === 'win32') {
    throw new Error('Private ledger writing requires a reviewed native Windows ACL path');
  }
  if (!isAbsolute(file)) throw new Error('Use an absolute private ledger path');
  const parent = dirname(file);
  if (createParent) mkdirSync(parent, { recursive: true, mode: 0o700 });
  const realParent = realpathSync(parent);
  let ancestor = realParent;
  while (true) {
    if (ancestor === PROJECT_ROOT || existsSync(join(ancestor, '.git'))) {
      throw new Error('Keep the private ledger outside a Git repository');
    }
    const next = dirname(ancestor);
    if (next === ancestor) break;
    ancestor = next;
  }
  if ((statSync(realParent).mode & 0o077) !== 0) {
    throw new Error('Ledger directory must be private (mode 0700)');
  }
  if (existsSync(file)) {
    const state = lstatSync(file);
    if (!state.isFile() || state.isSymbolicLink() || (state.mode & 0o077) !== 0) {
      throw new Error('Ledger file must be a private regular file (mode 0600)');
    }
  }
}

function readLedger(file) {
  if (!existsSync(file)) return { schemaVersion: 1, repository: REPOSITORY, captures: [] };
  const ledger = JSON.parse(readFileSync(file, 'utf8'));
  if (ledger?.schemaVersion !== 1 || ledger.repository !== REPOSITORY || !Array.isArray(ledger.captures)) {
    throw new Error('Unknown traffic ledger format');
  }
  return ledger;
}

function writeLedger(file, ledger) {
  const temporary = file + '.' + process.pid + '.tmp';
  let descriptor;
  try {
    descriptor = openSync(temporary, 'wx', 0o600);
    writeFileSync(descriptor, JSON.stringify(ledger, null, 2) + '\n');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function gh(endpoint) {
  try {
    return JSON.parse(execFileSync('gh', ['api', endpoint], {
      encoding: 'utf8',
      timeout: 20000,
      maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }));
  } catch {
    throw new Error('GitHub read failed at ' + endpoint + '; no ledger update was written');
  }
}

function main() {
  const [command, ...arguments_] = process.argv.slice(2);
  if (!['capture', 'report'].includes(command) ||
      (arguments_.length !== 0 && (arguments_.length !== 2 || arguments_[0] !== '--file'))) {
    throw new Error('Usage: node scripts/github-traffic-ledger.mjs capture|report [--file /absolute/private/traffic.json]');
  }
  const file = arguments_.length === 2 ? arguments_[1] : DEFAULT_FILE;
  privateFile(file, command === 'capture');
  const ledger = readLedger(file);
  if (command === 'capture') {
    const prefix = 'repos/' + REPOSITORY;
    const capture = makeCapture({
      repo: gh(prefix),
      views: gh(prefix + '/traffic/views?per=day'),
      clones: gh(prefix + '/traffic/clones?per=day'),
      referrers: gh(prefix + '/traffic/popular/referrers'),
      paths: gh(prefix + '/traffic/popular/paths'),
      capturedAt: new Date().toISOString(),
    });
    ledger.captures.push(capture);
    writeLedger(file, ledger);
  }
  process.stdout.write(JSON.stringify(buildReport(ledger), null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write('Traffic ledger: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
