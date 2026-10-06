import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');
const HOMEPAGE = 'https://innerluxes.dev/blockchain/implementation';
const DECISIONS = ['docs/decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md', 'docs/decisions/0002-read-yaml-with-a-reader-of-its-own-and-list-what-it-skips.md', 'docs/decisions/0003-check-the-file-on-disk-and-fetch-nothing.md'];
const YEAR = /\b(?:19|20)\d{2}\b/;
const DATE = /\b\d{4}-\d{2}-\d{2}\b/;
const NOT_A = 'not a security audit and not a guarantee that the network is safe';
const norm = (t) => t.replace(/\s+/g, ' ');

// Every file below a folder of the repository, with forward slashes.
async function filesOf(dir) {
  const out = [];
  const walk = async (rel) => {
    for (const e of await readdir(resolve(root, rel), { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) await walk(r);
      else out.push(r);
    }
  };
  await walk(dir);
  return out.sort();
}

// Every file of the repository that is committed.
async function allFiles() {
  const out = [];
  const walk = async (rel) => {
    for (const e of await readdir(resolve(root, rel || '.'), { withFileTypes: true })) {
      if (['.git', 'coverage'].includes(e.name) || (!rel && ['dist', 'node_modules'].includes(e.name))) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(r);
      else out.push(r);
    }
  };
  await walk('');
  return out.sort();
}

const docFiles = async () => ['README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'research/sources.md', ...(await filesOf('docs')).filter((f) => f.endsWith('.md'))];

test('package.json: a zero-dependency Node 22 ES module with the bin, the scripts, the author and the homepage', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.name, 'fabric-config-check');
  assert.equal(pkg.version, '1.0.0');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '>=22');
  assert.equal(pkg.homepage, HOMEPAGE);
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.author, 'INNERLUXES <info@innerluxes.dev>');
  assert.equal(pkg.repository.url, 'git+https://github.com/INNERLUXES/fabric-config-check.git');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.bin['fabric-config-check'], 'bin/fabric-config-check.js');
  for (const k of ['hyperledger-fabric', 'blockchain', 'configtx', 'governance', 'consortium', 'static-analysis', 'cli']) assert.ok(pkg.keywords.includes(k), k);
  assert.match(pkg.description, /^Fabric config check: /);
  for (const script of ['test', 'check', 'example', 'test:coverage']) assert.ok(pkg.scripts[script], script);
  assert.equal(pkg.scripts.test, 'node --test "test/*.test.js"');
  const lock = JSON.parse(await read('package-lock.json'));
  assert.deepEqual(Object.keys(lock.packages), ['']);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.name, pkg.name);
  assert.ok((await read('bin/fabric-config-check.js')).startsWith('#!/usr/bin/env node\n'));
});

test('README: one link to the page on blockchain implementation services, in the closing Background section, with the page title as its text', async () => {
  const readme = await read('README.md');
  const parts = readme.split(/^## /m);
  const background = parts.find((p) => p.startsWith('Background'));
  assert.ok(background, 'a Background section');
  assert.ok(norm(background).includes(`[Blockchain Implementation Services](${HOMEPAGE})`));
  assert.equal(readme.split('innerluxes.dev/').length - 1, 1, 'the README links to the site once');
  assert.equal(parts.at(-1).split('\n')[0], 'License');
  assert.equal(parts.at(-2).split('\n')[0], 'Background');
});

test('README: the npm test block shows the summary counts with no symbol in front, and they add up', async () => {
  const readme = await read('README.md');
  const block = /```\n(tests (\d+)\npass (\d+)\nfail (\d+)\nskipped (\d+))\n```/.exec(readme);
  assert.ok(block, 'the npm test block');
  const [, , tests, pass, fail, skipped] = block.map(Number);
  assert.equal(pass + fail + skipped, tests);
  assert.equal(fail, 0);
  assert.ok(tests >= 80);
});

test('README: what it checks, how to run it with npx or node, the options, the example output and the limits', async () => {
  const readme = await read('README.md');
  for (const heading of ['## Quick start', '## Usage', '## How the file is read', '## What it checks', '## What is not checked', '## Formats', '## Exit codes', '## Limits', '## Architecture', '## Where the facts come from']) assert.ok(readme.includes(`\n${heading}\n`), heading);
  assert.match(readme, /npx --yes github:INNERLUXES\/fabric-config-check configtx\.yaml/);
  assert.match(readme, /node bin\/fabric-config-check\.js examples\/weak/);
  for (const option of ['--profile', '--format', '--json', '--min-severity', '--fail-on', '--explain', '--list-checks', '--help', '--version']) assert.ok(readme.includes(option), option);
  for (const r of RULES) assert.ok(readme.includes(`| \`${r.id}\` | ${r.severity} | ${r.kind} |`), `README: ${r.id}`);
  for (const s of ['policies/policies.html', 'create_channel/channel_policies.html', 'create_channel/create_channel_config.html', 'raft_configuration.html', 'capabilities_concept.html', 'gossip.html', 'sampleconfig/configtx.yaml']) assert.ok(readme.includes(s), s);
  for (const f of ['text', 'markdown', 'JSON', 'SARIF']) assert.ok(readme.includes(f), f);
  assert.match(readme, /Eighteen checks/);
  assert.equal(RULES.length, 18);
  assert.ok(!readme.includes('@@'), 'no placeholder is left');
});

test('README and documents: an input to a governance review, not a security audit and not a guarantee', async () => {
  for (const file of ['README.md', 'docs/limits.md', 'docs/method.md', 'docs/secure-defaults.md', 'docs/threat-model.md', 'docs/rules-and-sources.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'research/sources.md', DECISIONS[1]]) assert.ok(norm(await read(file)).includes(NOT_A), file);
  const readme = await read('README.md');
  assert.ok(readme.indexOf(NOT_A.split(' ').slice(0, 6).join(' ')) < readme.indexOf('## Quick start'), 'said before the quick start');
  assert.ok(norm(readme).includes('It is not an auditor.'));
  assert.ok(norm(readme).includes('runs nothing, deploys nothing, fetches nothing and reads no clock'));
  assert.ok(readme.includes('heuristic'));
  assert.match(await read('docs/limits.md'), /^The tool is not an auditor/m);
});

test('README and documents: no number that reads like a year, no date in words and no full date', async () => {
  for (const file of await docFiles()) {
    const text = await read(file);
    assert.doesNotMatch(text, YEAR, file);
    assert.doesNotMatch(text, /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/, file);
    assert.doesNotMatch(text, DATE, file);
  }
  for (const file of ['package.json', ...DECISIONS, ...(await filesOf('examples')), ...(await filesOf('test')), ...(await filesOf('src'))]) {
    const text = await read(file);
    assert.doesNotMatch(text, DATE, file);
    assert.doesNotMatch(text, YEAR, file);
  }
  assert.match(await read('CHANGELOG.md'), /^## 1\.0\.0$/m);
});

test('the year pattern passes over versions, capability levels and ports and still catches a year', () => {
  for (const ok of ['1.0.0', 'V2_0', 'V3_0', '7050', '7051', '3F+1', 'Node 22', 'RFC 8259', '10 MB', '2.1.0', '200000', '400,000']) assert.doesNotMatch(ok, YEAR, ok);
  const year = ['20', '24'].join('');
  const old = ['19', '99'].join('');
  for (const bad of [year, `in ${year}`, old, `${year}.`]) assert.match(bad, YEAR, bad);
});

test('README and documents: plain ASCII, with no emoji and no decorative character', async () => {
  for (const file of [...(await docFiles()), '.github/pull_request_template.md', '.github/CODEOWNERS', 'package.json']) {
    const text = await read(file);
    assert.ok([...text].every((c) => c.charCodeAt(0) < 128), file);
  }
});

test('every file: none of the words this project keeps out of its prose, and no name of a tool that wrote it', async () => {
  // Built from pieces, so that this file does not hold the words; a word is matched at its start.
  const words = [['har', 'ness'], ['del', 'v'], ['lever', 'ag'], ['seam', 'less'], ['rob', 'ust'], ['cutting', '-edg'], ['un', 'lock'], ['em', 'power'], ['ele', 'vat'], ['stream', 'lin'], ['game', '-changer'], ['tap', 'estr'], ['re', 'alm'], ['further', 'more'], ['more', 'over'], ['in today', "'s"], ['gene', 'rated'], ['trans', 'form']].map((p) => p.join(''));
  const banned = new RegExp(`\\b(?:${words.join('|')})`, 'i');
  const names = new RegExp(`${['cla', 'ude'].join('')}|${['anthro', 'pic'].join('')}|\\b${['A', 'I'].join('')}\\b|\\b${['assis', 'tant'].join('')}|\\b${['ch', 'at'].join('')}\\b|\\b${['ses', 'sion'].join('')}|${['co-', 'authored'].join('')}`, 'i');
  for (const file of await allFiles()) {
    if (file === 'tools/check.mjs' || file.startsWith('research/sources/')) continue;
    const text = await read(file);
    assert.doesNotMatch(text, banned, file);
    assert.doesNotMatch(text, names, file);
  }
  assert.match(`an ${['assis', 'tant'].join('')} wrote this`, names);
});

test('no file holds a string shaped like a token or a private key', async () => {
  const shapes = [new RegExp(`\\b(?:${['gh', 'p'].join('')}|${['gh', 'o'].join('')}|${['gh', 's'].join('')}|${['github', '_pat'].join('')})_[A-Za-z0-9_]{6,}`), new RegExp(`-----BEGIN [A-Z ]*${['PRIVATE', ' KEY'].join('')}-----`), new RegExp(`\\b${['AK', 'IA'].join('')}[0-9A-Z]{16}\\b`)];
  for (const file of await allFiles()) {
    const text = await read(file);
    for (const shape of shapes) assert.doesNotMatch(text, shape, file);
  }
  assert.ok(!(await read('README.md')).includes(['gh', 'p_'].join('')));
});

test('LICENSE: MIT with the copyright line of INNERLUXES and no year', async () => {
  const license = await read('LICENSE');
  assert.ok(license.startsWith('MIT License\n\nCopyright (c) INNERLUXES\n'));
});

test('SECURITY.md: how to report, and no promise about reply times or fixes', async () => {
  const text = await read('SECURITY.md');
  assert.match(text, /info@innerluxes\.dev/);
  assert.match(text, /"fabric-config-check security"/);
  assert.doesNotMatch(text, /within\s+\d|business days|within a (?:day|week)|\d+\s*(?:hours|days)\b|we will|we guarantee|guaranteed|respond within|reply within/i);
});

test('workflows: every action is pinned to a commit, the CI runs three systems, two Node versions and coverage, and the SSDF gate is there', async () => {
  for (const name of ['ci.yml', 'codeql.yml', 'release.yml']) {
    const text = await read(`.github/workflows/${name}`);
    assert.match(text, /^permissions:\n {2}contents: read$/m, name);
    const uses = [...text.matchAll(/^\s*- uses: (\S+)/gm)].map((m) => m[1]);
    assert.ok(uses.length > 0, name);
    for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, `${name}: ${u}`);
    assert.doesNotMatch(text, /solidity/i, name);
  }
  const ci = await read('.github/workflows/ci.yml');
  assert.match(ci, /os: \[ubuntu-latest, windows-latest, macos-latest\]/);
  assert.match(ci, /node: \[22, 24\]/);
  assert.match(ci, /run: npm run test:coverage/);
  assert.match(ci, /node \.ssdf\/bin\/ssdf-repo-check\.js repo --require-all --fail-on-problem/);
  assert.match(ci, /repository: INNERLUXES\/ssdf-repo-check/);
  assert.match(ci, /ref: dfda194a3ed35623b8b420df05e110b66d984586 # v1\.0\.0/);
  for (const s of [/npm ci/, /npm run check/, /npm run example/, /git diff --exit-code -- examples/]) assert.match(ci, s);
});

test('codeql: JavaScript only, with the security-extended queries, and the examples and saved pages left out', async () => {
  const codeql = await read('.github/workflows/codeql.yml');
  assert.match(codeql, /languages: javascript-typescript/);
  assert.doesNotMatch(codeql, /autobuild/i);
  assert.match(codeql, /security-extended/);
  assert.match(codeql, /paths-ignore:\n\s+- examples\n\s+- research/);
  const attributes = await read('.gitattributes');
  assert.match(attributes, /^examples\/\*\* linguist-documentation$/m);
  assert.match(attributes, /^examples\/\*\* linguist-detectable=false$/m);
  assert.match(attributes, /^research\/sources\/\*\* -text$/m);
  assert.doesNotMatch(await read('.github/dependabot.yml'), /package-ecosystem: (?:nuget|pip|maven)/);
});

test('release workflow: the SSDF gate, then a tgz, a CycloneDX SBOM, SHA256SUMS and a provenance attestation named for this package', async () => {
  const release = await read('.github/workflows/release.yml');
  assert.match(release, /node \.ssdf\/bin\/ssdf-repo-check\.js repo --require-all --fail-on-problem/);
  assert.match(release, /ref: dfda194a3ed35623b8b420df05e110b66d984586 # v1\.0\.0/);
  assert.ok(release.indexOf('ssdf-repo-check.js') < release.indexOf('npm pack'), 'the gate runs before the package is made');
  assert.match(release, /npm pack --pack-destination dist/);
  assert.match(release, /npm sbom --sbom-format cyclonedx > dist\/fabric-config-check\.cdx\.json/);
  assert.match(release, /sha256sum \* > SHA256SUMS/);
  assert.match(release, /actions\/attest-build-provenance@/);
  assert.match(release, /tags: \['v\*'\]/);
});

test('repository files: Dependabot for actions and npm, CODEOWNERS, a pull request template and the line-end rules', async () => {
  const dependabot = await read('.github/dependabot.yml');
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(await read('.github/CODEOWNERS'), /^\* @innerluxesdev$/m);
  assert.match(await read('.github/pull_request_template.md'), /Conventional Commits/);
  assert.match(await read('.gitattributes'), /^\* text=auto eol=lf$/m);
  assert.match(await read('.gitignore'), /^\*\.pem$/m);
});

test('docs/secure-defaults.md is long enough for the SSDF gate, and every document the README links to exists', async () => {
  assert.ok(norm(await read('docs/secure-defaults.md')).length > 4000);
  const readme = await read('README.md');
  for (const link of readme.matchAll(/\]\(((?:docs|research|examples)\/[^)#]*)\)/g)) assert.ok((await allFiles()).includes(link[1].replace(/\/$/, '')) || (await allFiles()).some((f) => f.startsWith(link[1])), link[1]);
});

test('src never reaches the network, runs a program or reads a clock, and builds no regular expression from input', async () => {
  const banned = [/node:(?:net|http|https|http2|dgram|tls|dns|child_process|worker_threads|vm|cluster)/, /\bfetch\(/, /\bXMLHttpRequest\b/, /\beval\(/, /new Function\(/, /\bDate\b/, /Date\.now/, /Math\.random/, /process\.env/, /Intl\./];
  for (const file of await filesOf('src')) {
    const text = await read(file);
    for (const b of banned) {
      if (b.source === '\\bDate\\b' && text.includes('NODE_V8_COVERAGE')) continue;
      assert.doesNotMatch(text.replace(/^\s*\/\/.*$/gm, ''), b, `${file}: ${b}`);
    }
    if (file !== 'src/text.js') assert.ok(!/new RegExp/.test(text), `${file} builds a regular expression`);
  }
  assert.ok((await read('src/size.js')).includes('toLocaleString'), 'grouped() fixes the locale in the call');
});

test('src is only written to standard output and standard error, never to the disk', async () => {
  for (const file of await filesOf('src')) {
    const text = await read(file);
    assert.doesNotMatch(text, /writeFile|appendFile|createWriteStream|mkdir|unlink|rmSync|rename\(/, file);
  }
});

test('the reader stops its only two recursions at a limit: the nesting of the document and of a flow collection', async () => {
  const text = await read('src/yaml.js');
  assert.match(text, /depth > YAML_LIMITS.maxDepth/);
  assert.match(text, /level > YAML_LIMITS.maxFlowDepth/);
  assert.match(text, /nodes > YAML_LIMITS.maxNodes/);
});

test('a guarded test never asserts a line of its own', async () => {
  const text = await read('test/files.test.js');
  for (const block of text.split(/\ntest\(/).filter((b) => b.includes("process.platform === 'win32'"))) assert.doesNotMatch(block, /\.line\b|lineOf\(/);
});

test('every test file builds its paths with resolve(), and no test writes a backslash into a file name', async () => {
  for (const file of (await filesOf('test')).filter((f) => f.endsWith('.js'))) {
    const text = await read(file);
    assert.doesNotMatch(text, /\bjoin\(\s*(?:dir|tmpdir|root)/, `${file} joins an absolute path`);
    assert.doesNotMatch(text, /['"`][A-Za-z0-9_]+\\\\[A-Za-z0-9_]+\.(?:yaml|yml)['"`]/, `${file} writes a backslash into a file name`);
  }
});

test('tools/check.mjs and tools/example.mjs exist and the saved example outputs are all there', async () => {
  const files = await filesOf('examples/output');
  for (const f of ['weak.txt', 'good.txt', 'weak-explain.txt', 'weak.md', 'weak-explain.md', 'weak.json', 'weak.sarif', 'good.sarif', 'checks.txt', 'checks.json']) assert.ok(files.includes(`examples/output/${f}`), f);
  assert.ok((await read('tools/check.mjs')).includes('no problems'));
  assert.ok((await read('tools/example.mjs')).includes('examples/output'));
});

test('the docs name every check id and every option of the command line', async () => {
  const method = await read('docs/method.md');
  for (const r of RULES) assert.ok(method.includes(`\`${r.id}\``), `docs/method.md: ${r.id}`);
  const inputs = await read('docs/inputs.md');
  for (const option of ['--profile', '--format', '--json', '--min-severity', '--fail-on', '--explain', '--list-checks']) assert.ok(inputs.includes(option), option);
  const changelog = await read('CHANGELOG.md');
  for (const r of RULES) assert.ok(changelog.includes(`\`${r.id}\``), `CHANGELOG.md: ${r.id}`);
});
