// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// networks to examples/output. CI runs it and then fails if those files changed, so the example output in the repository is
// always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const WEAK = ['examples/weak'];
export const GOOD = ['examples/good'];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the weak network: the counts, the profiles, one finding of nearly every check, and the result.
export const EXPECTED = [
  'input: 227 lines, 5,775 bytes; 3 profiles checked; 5 organizations; 1 construct passed over',
  'profiles: DevSolo, TwoNodeRaft and BftSmall',
  'findings: 24 (6 error, 16 warning, 2 info)',
  'The organization DockOrg (MSP ID DockMSP) has no MSPDir.',
  'The organization QuayOrg has no ID.',
  'The MSP ID HarborMSP is defined for two organizations (first at line 7).',
  'The Application Admins policy is "ANY Admins"',
  'OrdererType is solo.',
  'The consenter raft.harbor.test:7060 in EtcdRaft.Consenters has no ServerTLSCert.',
  'The organization HarborOrg (MSP ID HarborMSP) is used in the Application section and has no AnchorPeers.',
  'Not read: a block scalar (| or >) (Description: |).',
  'The Orderer Capabilities group has no level set to true (V2_0: false)',
  'The Application LifecycleEndorsement policy is "ANY Endorsement"',
  'BatchSize sets no PreferredMaxBytes.',
  'The Application section lists one organization, HarborOrg (MSP ID HarborMSP)',
  'The consortium HarborConsortium lists one organization',
  'The Channel group has no Capabilities',
  'The Orderer section sets no BatchTimeout.',
  'The Orderer section sets no BatchSize.',
  'The Orderer group has no Capabilities',
  'All 2 consenters in EtcdRaft.Consenters are on the host raft.harbor.test',
  'EtcdRaft.Consenters lists 2 consenters.',
  'The Application group has no Capabilities',
  'ConsenterMapping lists 3 consenters.',
  'The Application Readers and Writers policies are "ANY Readers" and "ANY Writers"',
  'The Orderer Readers and Writers policies are "ANY Readers" and "ANY Writers"',
  'not a security audit and not a guarantee that the network is safe',
  'RESULT: FAIL - 6 findings at or above error (6 error, 16 warning, 2 info)'
];
// What must not be reported: the checks that need a file the example does not have, and a pass.
export const UNWANTED = ['ERROR    config-unreadable', 'ERROR    no-profiles', 'RESULT: PASS'];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const weak = await run(WEAK);
  process.stdout.write(weak.out);
  expect('weak network', weak, 1, EXPECTED, UNWANTED);

  const good = await run(GOOD);
  expect('good network', good, 0, ['input: 201 lines, 5,107 bytes; 2 profiles checked; 4 organizations; 0 constructs passed over', 'findings: 2 (2 info)', 'RESULT: PASS - no finding at or above error (2 info)'], ['ERROR    ', 'WARNING  ', 'RESULT: FAIL']);
  // The good network also passes when warnings fail the run, and fails only when notes do.
  expect('good, fail on warning', await run([...GOOD, '--fail-on', 'warning']), 0, ['RESULT: PASS - no finding at or above warning (2 info)'], []);
  expect('good, fail on info', await run([...GOOD, '--fail-on', 'info']), 1, ['RESULT: FAIL - 2 findings at or above info (2 info)'], []);
  // One profile of the weak network.
  expect('weak, one profile', await run([...WEAK, '--profile', 'BftSmall']), 1, ['profile BftSmall only', 'ConsenterMapping lists 3 consenters.', 'note: only the profile BftSmall was checked'], ['OrdererType is solo.', 'EtcdRaft.Consenters lists 2 consenters.']);
  // A profile that is not in the file stops the run.
  expect('unknown profile', await run([...WEAK, '--profile', 'Nope']), 2, ['no profile named Nope in the file; the profiles are DevSolo, TwoNodeRaft, BftSmall'], [], 'err');

  // The README shows the head of the report of the weak network with its table of checks, two findings, the not read list and the
  // result, and the end of the report of the good network.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const head = weak.out.split('\n').slice(0, 26).join('\n');
  if (!readme.includes(head)) problems.push('README: the head of the sample output of the weak network differs from a real run');
  const lines = weak.out.split('\n');
  const at = lines.findIndex((l) => l.includes('orderer-solo') && l.includes('examples/weak/configtx.yaml'));
  const sample = lines.slice(at, at + 4).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the sample finding of the solo orderer differs from a real run');
  const tail = weak.out.split('\n').slice(-12).join('\n');
  if (!readme.includes(tail)) problems.push('README: the tail of the sample output of the weak network differs from a real run');
  const goodTail = good.out.split('\n').slice(-5).join('\n');
  if (!readme.includes(goodTail)) problems.push('README: the tail of the sample output of the good network differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/weak.txt'), weak.out);
  await writeFile(resolve(root, 'examples/output/good.txt'), good.out);
  const outputs = [
    ['weak-explain.txt', [...WEAK, '--explain'], 1],
    ['weak.md', [...WEAK, '--format', 'markdown'], 1],
    ['weak-explain.md', [...WEAK, '--format', 'markdown', '--explain'], 1],
    ['weak.json', [...WEAK, '--json', '--explain'], 1],
    ['weak.sarif', [...WEAK, '--format', 'sarif'], 1],
    ['good.sarif', [...GOOD, '--format', 'sarif'], 0],
    ['checks.txt', ['--list-checks'], 0],
    ['checks.json', ['--list-checks', '--format', 'json'], 0]
  ];
  for (const [name, args, code] of outputs) {
    const r = await run(args);
    if (r.code !== code) problems.push(`${name}: exit code ${r.code}, expected ${code}`);
    await writeFile(resolve(root, 'examples/output', name), r.out);
  }

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
