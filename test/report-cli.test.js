import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, USAGE, VERSION, decide, parseArgs, toSarif } from '../src/index.js';
import { GOOD, GOOD_APPLICATION, cli, file, fileRaw, indent, run } from './helpers.js';

const WEAK_BODY = 'Orderer:\n  OrdererType: solo\n  BatchTimeout: 2s\n  BatchSize:\n    MaxMessageCount: 5\n    AbsoluteMaxBytes: 1 MB\n    PreferredMaxBytes: 1 MB\n  Capabilities:\n    V2_0: true\nApplication:\n  Organizations:\n    - Name: AOrg\n      ID: AMSP\n      MSPDir: m\n      AnchorPeers:\n        - Host: h\n  Capabilities:\n    V2_0: true\n';
const WEAK = fileRaw(`Capabilities:\n  V2_0: true\n${WEAK_BODY}`);
const FILES = { 'weak/configtx.yaml': WEAK, 'good/configtx.yaml': GOOD };

test('exit codes: 0 for a pass, 1 for a finding at or above the fail-on level, 2 for a usage or input error', async () => {
  assert.equal((await run(FILES, ['good'])).code, 0);
  assert.equal((await run(FILES, ['weak'])).code, 1);
  assert.equal((await run(FILES, ['nothing'])).code, 2);
  assert.equal((await run(FILES, [])).code, 2);
  assert.equal((await run(FILES, ['weak', '--bogus'])).code, 2);
});

test('--fail-on: a warning fails the run at warning and passes at error', async () => {
  const warn = fileRaw(`Capabilities:\n  V2_0: true\n${GOOD_APPLICATION.replace('MAJORITY Endorsement', 'ANY Endorsement')}`);
  const files = { 'w/configtx.yaml': warn };
  assert.equal((await run(files, ['w'])).code, 0);
  assert.equal((await run(files, ['w', '--fail-on', 'warning'])).code, 1);
  assert.equal((await run(files, ['w', '--fail-on', 'info'])).code, 1);
  assert.equal((await run(FILES, ['good', '--fail-on', 'info'])).code, 0, 'the good file has no finding at any level');
});

test('--min-severity hides findings below it and says how many, and a hidden finding still counts for the result', async () => {
  const r = await run(FILES, ['weak', '--min-severity', 'error']);
  assert.match(r.out, /findings: 1 \(1 error\); \d+ below error not shown/);
  assert.doesNotMatch(r.out, /WARNING /);
  assert.equal((await run(FILES, ['weak', '--min-severity', 'error', '--fail-on', 'warning'])).code, 1);
});

test('a path may be the file or a folder holding configtx.yaml or configtx.yml', async () => {
  const files = { 'a/configtx.yml': GOOD, 'b/net.yaml': GOOD };
  const folder = await run(files, ['a']);
  assert.equal(folder.code, 0);
  assert.match(folder.out, /fabric-config-check: a\/configtx\.yml/);
  assert.equal((await run(files, ['b/net.yaml'])).code, 0);
  const none = await run(files, ['b']);
  assert.equal(none.code, 2);
  assert.match(none.err, /holds no configtx\.yaml or configtx\.yml/);
});

test('the text report names the file with its line, the checks table, the fix, and ends with the notice and the result', async () => {
  const r = await run(FILES, ['weak']);
  assert.match(r.out, /^fabric-config-check: weak\/configtx\.yaml\n/);
  assert.match(r.out, /ERROR {4}orderer-solo {12}weak\/configtx\.yaml:\d+\n/);
  assert.match(r.out, /fix: Use etcdraft/);
  assert.match(r.out, /\nChecks \(18\)\n/);
  assert.match(r.out, /not a security audit and not a guarantee that the network is safe\.\n\nRESULT: FAIL - 1 finding at or above error/);
  assert.ok(r.out.endsWith('\n'));
});

test('--explain adds the points of the documentation with their pages to the text report', async () => {
  const r = await run(FILES, ['weak', '--explain']);
  assert.match(r.out, /basis: .*\(The sample configtx\.yaml of the Fabric repository, https:\/\/github\.com\/hyperledger\/fabric\/blob\/main\/sampleconfig\/configtx\.yaml\)/);
  assert.doesNotMatch((await run(FILES, ['weak'])).out, /basis:/);
});

test('the JSON report has the id, severity, message, file and line of every finding', async () => {
  const r = await run(FILES, ['weak', '--json']);
  const report = JSON.parse(r.out);
  assert.equal(report.tool, 'fabric-config-check');
  assert.equal(report.version, VERSION);
  const f = report.findings.find((x) => x.id === 'orderer-solo');
  assert.equal(f.severity, 'error');
  assert.equal(f.file, 'weak/configtx.yaml');
  assert.equal(typeof f.line, 'number');
  assert.equal(f.at, `weak/configtx.yaml:${f.line}`);
  assert.match(f.message, /OrdererType is solo/);
  assert.equal(f.basis, undefined, 'the basis only with --explain');
  assert.equal(JSON.parse((await run(FILES, ['weak', '--json', '--explain'])).out).findings[0].basis.length > 0, true);
  assert.equal(report.result.pass, false);
  assert.equal(report.rules.length, RULES.length);
});

test('--json and --format json are the same, and --json with another format is a usage error', async () => {
  assert.equal((await run(FILES, ['good', '--json'])).out, (await run(FILES, ['good', '--format', 'json'])).out);
  const r = await run(FILES, ['good', '--json', '--format', 'text']);
  assert.equal(r.code, 2);
  assert.match(r.err, /two formats/);
});

test('the markdown report has a findings table and escapes what markdown gives a meaning to', async () => {
  const r = await run(FILES, ['weak', '--format', 'markdown']);
  assert.match(r.out, /^# fabric-config-check: weak\/configtx\.yaml\n/);
  assert.match(r.out, /\| Level \| Check \| Where \| Message \| Profiles \|/);
  assert.match(r.out, /\| error \| orderer-solo \| weak\/configtx\.yaml:\d+ \|/);
  assert.match(r.out, /- Result: \*\*FAIL - 1 finding at or above error/);
  const hostile = await run({ 'x/configtx.yaml': 'Profiles:\n  "[a](http://x.test)|<b>":\n    Orderer:\n      OrdererType: solo\n' }, ['x', '--format', 'markdown']);
  assert.ok(!hostile.out.includes('[a](http'), 'a link written in a profile name is escaped');
  assert.ok(hostile.out.includes('\\[a\\]\\(http'));
});

test('the SARIF report is SARIF 2.1.0 with the checks as rules and a result for every finding with its file, line and column', async () => {
  const r = await run(FILES, ['weak', '--format', 'sarif']);
  const sarif = JSON.parse(r.out);
  assert.equal(sarif.version, '2.1.0');
  assert.match(sarif.$schema, /sarif-2\.1\.0/);
  const run0 = sarif.runs[0];
  assert.equal(run0.tool.driver.name, 'fabric-config-check');
  assert.equal(run0.tool.driver.rules.length, RULES.length);
  const result = run0.results.find((x) => x.ruleId === 'orderer-solo');
  assert.equal(result.level, 'error');
  assert.equal(run0.tool.driver.rules[result.ruleIndex].id, 'orderer-solo');
  const loc = result.locations[0].physicalLocation;
  assert.equal(loc.artifactLocation.uri, 'weak/configtx.yaml');
  assert.ok(loc.region.startLine >= 1 && loc.region.startColumn >= 1);
});

test('SARIF levels: error, warning and info are error, warning and note', async () => {
  const sarif = JSON.parse((await run({ 'x/configtx.yaml': fileRaw(`${WEAK_BODY}${indent('Policies:\n  Readers:\n    Type: ImplicitMeta\n    Rule: "ANY Readers"', 2)}`) }, ['x', '--format', 'sarif'])).out);
  const levels = Object.fromEntries(sarif.runs[0].results.map((x) => [x.ruleId, x.level]));
  assert.equal(levels['orderer-solo'], 'error');
  assert.equal(levels['capabilities-missing'], 'warning');
  assert.equal(levels['readers-writers-any'], 'note');
});

test('--explain has no place in the SARIF report and is a usage error there', async () => {
  const r = await run(FILES, ['good', '--format', 'sarif', '--explain']);
  assert.equal(r.code, 2);
  assert.match(r.err, /sarif format has no place/);
});

test('--list-checks lists every check with its level and kind, in text, markdown and JSON, and needs no file', async () => {
  const text = await cli(['--list-checks'], process.cwd());
  assert.equal(text.code, 0);
  for (const r of RULES) assert.ok(text.out.includes(r.id), r.id);
  assert.match(text.out, /orderer-solo +error +documented/);
  assert.match(text.out, /raft-consenter-count +warning +best practice/);
  const md = await cli(['--list-checks', '--format', 'markdown'], process.cwd());
  assert.match(md.out, /\| orderer-solo \| error \| documented \|/);
  const json = JSON.parse((await cli(['--list-checks', '--json'], process.cwd())).out);
  assert.equal(json.length, RULES.length);
  assert.equal((await cli(['--list-checks', '--format', 'sarif'], process.cwd())).code, 2);
});

test('--profile checks one profile; an unknown profile is an input error naming the ones in the file', async () => {
  const text = `Profiles:\n  Weak:\n    Orderer:\n      OrdererType: solo\n  Strong:\n${indent(file(GOOD_APPLICATION).split('\n').slice(2).join('\n'), 0)}`;
  const files = { 'x/configtx.yaml': text };
  const only = await run(files, ['x', '--profile', 'Strong']);
  assert.match(only.out, /profile Strong only/);
  assert.match(only.out, /note: only the profile Strong was checked/);
  assert.doesNotMatch(only.out, /orderer-solo +weak/);
  const missing = await run(files, ['x', '--profile', 'Nope']);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /no profile named Nope in the file; the profiles are Weak, Strong/);
});

test('--help, --version and usage errors', async () => {
  const help = await cli(['--help'], process.cwd());
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const option of ['--profile', '--format', '--json', '--min-severity', '--fail-on', '--explain', '--list-checks', '--help', '--version']) assert.ok(USAGE.includes(option), option);
  assert.equal((await cli(['--version'], process.cwd())).out, `${VERSION}\n`);
  for (const bad of [['x', 'y'], ['--format'], ['--format', 'xml', 'x'], ['--fail-on', 'high', 'x'], ['x', '--profile', 'a', '--profile', 'b'], ['https://example.test/configtx.yaml'], ['-']]) {
    const r = await cli(bad, process.cwd());
    assert.equal(r.code, 2, bad.join(' '));
    assert.match(r.err, /^fabric-config-check: /);
  }
});

test('parseArgs: values may not look like flags, and a flag given twice is an error', () => {
  assert.throws(() => parseArgs(['x', '--profile', '--json']), /needs a value/);
  assert.throws(() => parseArgs(['x', '--format', 'json', '--format', 'text']), /given twice/);
  assert.equal(parseArgs(['x', '--profile', 'P']).profile, 'P');
});

test('decide: pass and fail texts, with the counts', () => {
  assert.equal(decide({ error: 0, warning: 0, info: 0 }, 'error').text, 'PASS - no finding at or above error');
  assert.equal(decide({ error: 0, warning: 2, info: 1 }, 'error').text, 'PASS - no finding at or above error (2 warning, 1 info)');
  assert.equal(decide({ error: 1, warning: 2, info: 1 }, 'error').text, 'FAIL - 1 finding at or above error (1 error, 2 warning, 1 info)');
  assert.equal(decide({ error: 1, warning: 2, info: 1 }, 'warning').text, 'FAIL - 3 findings at or above warning (1 error, 2 warning, 1 info)');
});

test('text from the file is cleaned: control characters, escapes and direction controls in a profile name or an organization', async () => {
  const bad = `Profiles:\n  "P\\u001b[31m\\u202e\\u2028x":\n    Application:\n      Organizations:\n        - Name: "Org\\u001b]0;t\\u0007"\n          ID: A\n          MSPDir: m\n`;
  for (const format of ['text', 'markdown', 'json']) {
    const r = await run({ 'x/configtx.yaml': bad }, ['x', '--format', format]);
    assert.ok(![...r.out].some((c) => ['\u001b', '\u0007', '\u202e', '\u2028'].includes(c)), format);
  }
});

test('the same findings are written for LF, CRLF and CR line ends, and for UTF-16', async () => {
  const base = JSON.parse((await run({ 'x/configtx.yaml': WEAK }, ['x', '--json'])).out).findings.map((f) => `${f.id}:${f.line}:${f.column}`);
  assert.ok(base.length > 0);
  for (const sep of ['\r\n', '\r']) {
    const r = JSON.parse((await run({ 'x/configtx.yaml': WEAK.split('\n').join(sep) }, ['x', '--json'])).out);
    assert.deepEqual(r.findings.map((f) => `${f.id}:${f.line}:${f.column}`), base);
  }
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(WEAK, 'utf16le')]);
  const r = JSON.parse((await run({ 'x/configtx.yaml': utf16 }, ['x', '--json'])).out);
  assert.deepEqual(r.findings.map((f) => `${f.id}:${f.line}:${f.column}`), base);
});

test('toSarif is deterministic and the report object is the same for the same input', async () => {
  const a = (await run(FILES, ['weak', '--format', 'sarif'])).out;
  const b = (await run(FILES, ['weak', '--format', 'sarif'])).out;
  assert.equal(a, b);
  assert.equal(typeof toSarif, 'function');
});
