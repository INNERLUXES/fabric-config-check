import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POINTS, RULES, SOURCES, analyze, flat, grouped, listText, orgLabel, plural, pointPage, profileOrgs, readYaml, safeText, source, valueOf } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');

test('every source has an address on the Fabric documentation or the Fabric repository, and no number that reads like a year', () => {
  for (const s of SOURCES) {
    assert.match(s.url, /^https:\/\/(?:hyperledger-fabric\.readthedocs\.io\/en\/latest\/|github\.com\/hyperledger\/fabric\/blob\/main\/)/, s.id);
    assert.doesNotMatch(s.url, /\b(?:19|20)\d{2}\b/, s.id);
    assert.ok(s.title.length > 5);
  }
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
});

test('every source has a text copy under research/sources that starts with its address, and research/sources.md lists it', async () => {
  const notes = await read('research/sources.md');
  for (const s of SOURCES) {
    const copy = await read(s.file);
    assert.ok(copy.startsWith(`Source: ${s.url}\n`), s.file);
    assert.ok(copy.length > 1500, `${s.file} holds the page`);
    assert.ok(notes.includes(s.url), `research/sources.md lists ${s.id}`);
    assert.ok(notes.includes(s.file), `research/sources.md names ${s.file}`);
  }
});

test('every point belongs to a listed source, is written in a sentence of its own and is not a long quotation of its page', async () => {
  for (const [id, p] of Object.entries(POINTS)) {
    const page = source(p.source);
    assert.ok(page, `${id}: the source ${p.source}`);
    assert.equal(pointPage(id), page);
    assert.ok(p.text.length > 40 && p.text.length < 400, id);
    assert.match(p.text, /\.$/, id);
    const copy = (await read(page.file)).replace(/\s+/g, ' ');
    // No run of 14 words of the point appears word for word in its page.
    const words = p.text.replace(/\s+/g, ' ').split(' ');
    for (let i = 0; i + 14 <= words.length; i += 1) assert.ok(!copy.includes(words.slice(i, i + 14).join(' ')), `${id} quotes its page`);
  }
});

test('every point is used by a rule, and every basis of a rule is a point', () => {
  const used = new Set(RULES.flatMap((r) => r.basis));
  for (const id of Object.keys(POINTS)) assert.ok(used.has(id), `${id} is not used by a rule`);
  for (const id of used) assert.ok(Object.hasOwn(POINTS, id), `${id} is not a point`);
});

test('docs/rules-and-sources.md lists every page with its copy and every check with its level, kind and points', async () => {
  const doc = await read('docs/rules-and-sources.md');
  for (const s of SOURCES) assert.ok(doc.includes(s.url) && doc.includes(s.file), s.id);
  for (const r of RULES) {
    const section = doc.split(/^## /m).find((p) => p.startsWith(`${r.id}\n`));
    assert.ok(section, r.id);
    assert.ok(section.includes(`- Level: ${r.severity}`), r.id);
    for (const b of r.basis) assert.ok(section.includes(POINTS[b].text), `${r.id}: ${b}`);
    if (r.kind === 'best practice') assert.match(section, /best practice of this tool, not a rule in the Fabric documentation/, r.id);
    if (r.own) assert.ok(section.includes(r.own), `${r.id}: its own choice`);
  }
});

test('the documented checks name a documentation page or the sample file, and the best practice checks say what the page does say', () => {
  for (const r of RULES.filter((x) => x.kind === 'documented')) assert.ok(r.basis.length > 0, r.id);
  for (const r of RULES.filter((x) => x.kind === 'best practice')) assert.ok(r.own, `${r.id} says what is its own choice`);
});

test('the sample file of the Fabric repository is read without a finding about the input', async () => {
  const sample = (await read('research/sources/configtx-sample.yaml.txt')).split('\n').slice(3).join('\n');
  const parsed = readYaml(sample);
  assert.deepEqual(parsed.unsupported, []);
  const profiles = valueOf(parsed.root, 'Profiles');
  assert.equal(profiles.entries.length, 8);
  const result = analyze(parsed.root);
  assert.ok(result.findings.length > 0);
  assert.ok(!result.findings.some((f) => ['config-unreadable', 'no-profiles'].includes(f.id)));
  assert.ok(result.findings.some((f) => f.id === 'orderer-solo'), 'the sample still names the solo profiles');
  assert.ok(!result.findings.some((f) => ['consenter-tls-missing', 'capabilities-missing', 'org-msp-incomplete', 'duplicate-msp-id', 'admins-any', 'endorsement-any'].includes(f.id)), 'the sample sets these');
});

test('the sample file: the organizations a profile uses are the ones it lists, with an alias counted once', async () => {
  const sample = (await read('research/sources/configtx-sample.yaml.txt')).split('\n').slice(3).join('\n');
  const { root: r } = readYaml(sample);
  const profile = valueOf(valueOf(r, 'Profiles'), 'SampleAppChannelEtcdRaft');
  const orgs = profileOrgs(profile);
  assert.equal(orgs.length, 2);
  assert.equal(orgLabel(orgs[0]), 'SampleOrg');
});

test('orgLabel: the name with the MSP ID, the ID alone, the name alone, or the line', () => {
  const org = (text) => profileOrgs(valueOf(readYaml(`P:\n  Application:\n    Organizations:\n${text}`).root, 'P'))[0];
  assert.equal(orgLabel(org('      - Name: A\n        ID: B')), 'A (MSP ID B)');
  assert.equal(orgLabel(org('      - Name: A\n        ID: A')), 'A');
  assert.equal(orgLabel(org('      - ID: B')), 'B');
  assert.equal(orgLabel(org('      - Name: A')), 'A');
  assert.match(orgLabel(org('      - MSPDir: m')), /written at line 4/);
});

test('size helpers: grouped numbers, lists for a sentence and plurals', () => {
  assert.equal(grouped(12345), '12,345');
  assert.equal(listText(['a']), 'a');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listText(['a', 'b', 'c', 'd', 'e'], 3), 'a, b, c and 2 more');
  assert.equal(plural(1, 'line'), '1 line');
  assert.equal(plural(2, 'line'), '2 lines');
  assert.equal(plural(2, 'library', 'libraries'), '2 libraries');
});

test('text helpers: safeText replaces control, direction and separator characters and caps the length; flat folds white space', () => {
  const bad = ['a', '\u001b', '[31m', '\u202e', 'b', '\u2028', 'c', '\u0007', 'd', '\u0085', 'e'].join('');
  const out = safeText(bad);
  assert.ok(![...out].some((c) => c.charCodeAt(0) < 32 || [0x202e, 0x2028, 0x85].includes(c.charCodeAt(0))));
  assert.equal(safeText('x'.repeat(50), 10), 'xxxxxxx...');
  assert.equal(safeText('short', 10), 'short');
  assert.equal(flat('  a \n  b\t c '), 'a b c');
});
