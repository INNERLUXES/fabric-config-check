import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/index.js';
import { EXPECTED, GOOD, UNWANTED, WEAK, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');
const W = 'examples/weak/configtx.yaml';
const G = 'examples/good/configtx.yaml';

test('examples: the weak network fails with the report that is saved in examples/output', async () => {
  const r = await run(WEAK);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('weak.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the good network passes at error and warning level with the report that is saved', async () => {
  const r = await run(GOOD);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('good.txt'));
  assert.match(r.out, /\nfindings: 2 \(2 info\)\n/);
  assert.equal((await run([...GOOD, '--fail-on', 'warning'])).code, 0);
  assert.doesNotMatch(r.out, /ERROR {4}|WARNING {2}/);
});

test('examples: every output saved in examples/output is the real output', async () => {
  const outputs = {
    'weak-explain.txt': [...WEAK, '--explain'],
    'weak.md': [...WEAK, '--format', 'markdown'],
    'weak-explain.md': [...WEAK, '--format', 'markdown', '--explain'],
    'weak.json': [...WEAK, '--json', '--explain'],
    'weak.sarif': [...WEAK, '--format', 'sarif'],
    'good.sarif': [...GOOD, '--format', 'sarif'],
    'checks.txt': ['--list-checks'],
    'checks.json': ['--list-checks', '--format', 'json']
  };
  for (const [name, args] of Object.entries(outputs)) assert.equal((await run(args)).out, await saved(name), name);
});

test('examples: every check except the two input errors fires on the weak network, each on the line built for it', async () => {
  const report = JSON.parse((await run([...WEAK, '--json'])).out);
  const lines = (await readFile(resolve(root, W), 'utf8')).split('\n');
  const at = (needle, n = 1) => {
    let seen = 0;
    for (let i = 0; i < lines.length; i += 1) if (lines[i].includes(needle) && (seen += 1) === n) return i + 1;
    throw new Error(`${needle} x${n}`);
  };
  const of = (id) => report.findings.filter((f) => f.id === id).map((f) => f.line);
  assert.deepEqual(of('org-msp-incomplete'), [at('Name: DockOrg'), at('Name: QuayOrg')]);
  assert.deepEqual(of('duplicate-msp-id'), [at('ID: HarborMSP', 2)]);
  assert.deepEqual(of('admins-any'), [at('Rule: "ANY Admins"')]);
  assert.deepEqual(of('orderer-solo'), [at('OrdererType: solo')]);
  assert.deepEqual(of('consenter-tls-missing'), [at('Host: raft.harbor.test', 2)]);
  assert.deepEqual(of('endorsement-any'), [at('Rule: "ANY Endorsement"')]);
  assert.deepEqual(of('capability-disabled'), [at('V2_0: false')]);
  assert.deepEqual(of('unsupported-construct'), [at('Description: |')]);
  assert.deepEqual(of('bft-consenter-count'), [at('ConsenterMapping:')]);
  assert.deepEqual(of('raft-consenter-count'), [at('Consenters:')]);
  assert.deepEqual(of('consenters-single-host'), [at('Consenters:')]);
  assert.deepEqual(of('anchor-peers-missing'), [at('Name: HarborOrg')]);
  assert.equal(of('single-organization').length, 3);
  assert.equal(of('batch-settings-missing').length, 3);
  assert.equal(of('capabilities-missing').length, 3);
  assert.equal(of('readers-writers-any').length, 2);
  assert.deepEqual(report.rules.filter((r) => r.findings === 0).map((r) => r.id), ['config-unreadable', 'no-profiles']);
  assert.equal(report.rules.length, RULES.length);
});

test('examples: each profile of the weak network has its own findings under --profile', async () => {
  const only = async (p) => JSON.parse((await run([...WEAK, '--profile', p, '--json'])).out).findings.map((f) => f.id);
  assert.ok((await only('DevSolo')).includes('orderer-solo'));
  assert.ok(!(await only('DevSolo')).includes('bft-consenter-count'));
  assert.ok((await only('TwoNodeRaft')).includes('consenter-tls-missing'));
  assert.ok(!(await only('TwoNodeRaft')).includes('orderer-solo'));
  assert.ok((await only('BftSmall')).includes('duplicate-msp-id'));
});

test('examples: the same files written with CRLF line ends and as UTF-16 give the same findings', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'fabric-config-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    const base = JSON.parse((await run([...WEAK, '--json'], dir)).out).findings.map((f) => `${f.id}:${f.line}:${f.column}`);
    const text = await readFile(resolve(root, W), 'utf8');
    await writeFile(resolve(dir, W), text.split('\n').join('\r\n'));
    assert.deepEqual(JSON.parse((await run([...WEAK, '--json'], dir)).out).findings.map((f) => `${f.id}:${f.line}:${f.column}`), base);
    await writeFile(resolve(dir, W), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
    assert.deepEqual(JSON.parse((await run([...WEAK, '--json'], dir)).out).findings.map((f) => `${f.id}:${f.line}:${f.column}`), base);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('examples: the files are plain ASCII with LF line ends, made up, and hold no year-like number', async () => {
  for (const f of [W, G]) {
    const text = await readFile(resolve(root, f), 'utf8');
    assert.ok([...text].every((c) => c.charCodeAt(0) < 128), f);
    assert.ok(!text.includes('\r'), f);
    assert.doesNotMatch(text, /\b(?:19|20)\d{2}\b/, f);
    for (const host of text.match(/\b[a-z0-9.-]+\.(?:test|com|org|net|io)\b/g) ?? []) assert.ok(host.endsWith('.test') || host.endsWith('.crt'), `${f}: ${host}`);
  }
});

test('examples: the sample output of the weak network is the one the README shows', async () => {
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const weak = await saved('weak.txt');
  assert.ok(readme.includes(weak.split('\n').slice(0, 26).join('\n')));
  assert.ok(readme.includes(weak.split('\n').slice(-12).join('\n')));
});
