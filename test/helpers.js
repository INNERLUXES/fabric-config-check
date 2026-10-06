// Shared test helpers: configurations built inline, read in memory or written into a temporary folder that is removed after
// the test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and Windows. The
// line a test expects is found with lineOf(), which counts lines the way the reader does, so a test never holds a line
// number worked out by hand for one system only. No test reads the clock, the time zone or the locale.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkText, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'fabric-config-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return text.slice(0, at).split('\n').length;
}

export const indent = (text, n) => text.split('\n').map((l) => (l === '' ? l : ' '.repeat(n) + l)).join('\n');

// An organization as a list item, with every field a check looks at.
export function org(name, { id = `${name}MSP`, mspdir = `../${name}/msp`, anchor = true, extra = '' } = {}) {
  const lines = [`- Name: ${name}Org`];
  if (id !== null) lines.push(`  ID: ${id}`);
  if (mspdir !== null) lines.push(`  MSPDir: ${mspdir}`);
  if (anchor) lines.push('  AnchorPeers:', `    - Host: peer0.${name.toLowerCase()}.test`, '      Port: 7051');
  if (extra) lines.push(extra);
  return lines.join('\n');
}

// An Organizations list of the organizations given as strings.
export const orgList = (...orgs) => `Organizations:\n${indent(orgs.join('\n'), 2)}`;

export const CAPS = 'Capabilities:\n  V2_0: true';

export const BATCH = 'BatchTimeout: 2s\nBatchSize:\n  MaxMessageCount: 500\n  AbsoluteMaxBytes: 10 MB\n  PreferredMaxBytes: 2 MB';

export function consenter(host, { port = 7050, client = true, server = true } = {}) {
  const lines = [`- Host: ${host}`, `  Port: ${port}`];
  if (client) lines.push(`  ClientTLSCert: ../${host}/client.crt`);
  if (server) lines.push(`  ServerTLSCert: ../${host}/server.crt`);
  return lines.join('\n');
}

export const raftOrderer = (...consenters) => `Orderer:\n${indent(['OrdererType: etcdraft', BATCH, `EtcdRaft:\n  Consenters:\n${indent(consenters.join('\n'), 4)}`, CAPS].join('\n'), 2)}`;

export const GOOD_APPLICATION = `Application:\n${indent([orgList(org('A'), org('B')), 'Policies:\n  Admins:\n    Type: ImplicitMeta\n    Rule: "MAJORITY Admins"\n  Endorsement:\n    Type: ImplicitMeta\n    Rule: "MAJORITY Endorsement"\n  LifecycleEndorsement:\n    Type: ImplicitMeta\n    Rule: "MAJORITY Endorsement"', CAPS].join('\n'), 2)}`;

export const GOOD_ORDERER = raftOrderer(consenter('o1.test'), consenter('o2.test'), consenter('o3.test'));

// A file with one profile P made of these sections, and Capabilities for the channel, that gives no finding.
export function file(...sections) {
  const body = [CAPS, ...sections].join('\n');
  return `Profiles:\n  P:\n${indent(body, 4)}\n`;
}

// The same, with the profile body written as given (no channel capabilities added).
export const fileRaw = (body) => `Profiles:\n  P:\n${indent(body, 4)}\n`;

export const GOOD = file(GOOD_APPLICATION, GOOD_ORDERER);

// The findings of a text, through the reader and the checks: [{ id, line, column, message, profiles }].
export const findingsIn = (text, options) => checkText(text, options).findings;

// The ids of the findings of a text.
export const idsIn = (text, options) => findingsIn(text, options).map((f) => f.id);

// The findings of one check in a text.
export const ofCheck = (text, id, options) => findingsIn(text, options).filter((f) => f.id === id);

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// Writes the files and runs the command line in the folder.
export async function run(files, args) {
  return withFiles(files, (dir) => cli(args, dir));
}

// The time a hostile test may take: four times as long when the runner collects coverage, which sets NODE_V8_COVERAGE.
export const allowed = (ms) => (process.env.NODE_V8_COVERAGE ? ms * 4 : ms);
