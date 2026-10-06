import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, checkText, ruleById } from '../src/index.js';
import { BATCH, CAPS, GOOD, GOOD_APPLICATION, GOOD_ORDERER, consenter, file, fileRaw, idsIn, indent, lineOf, ofCheck, org, orgList, raftOrderer } from './helpers.js';

const app = (orgs, policies = '') => `Application:\n${indent([orgList(...orgs), policies, CAPS].filter(Boolean).join('\n'), 2)}`;
const policies = (name, rule) => `Policies:\n  ${name}:\n    Type: ImplicitMeta\n    Rule: "${rule}"`;
const orderer = (body, caps = true) => `Orderer:\n${indent([body, BATCH, caps ? CAPS : ''].filter(Boolean).join('\n'), 2)}`;

test('the good file gives no finding', () => {
  assert.deepEqual(idsIn(GOOD), []);
});

test('every rule has a unique id, a level, a kind, a fix and basis points that exist', () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  for (const r of RULES) {
    assert.ok(['error', 'warning', 'info'].includes(r.severity), r.id);
    assert.ok(['documented', 'best practice', 'input'].includes(r.kind), r.id);
    assert.ok(r.fix.length > 10, r.id);
    assert.equal(ruleById(r.id), r);
  }
});

test('a best practice check says so in its message', () => {
  for (const id of RULES.filter((r) => r.kind === 'best practice').map((r) => r.id)) {
    const text = {
      'single-organization': file(app([org('A')])),
      'readers-writers-any': file(app([org('A'), org('B')], policies('Readers', 'ANY Readers'))),
      'raft-consenter-count': file(raftOrderer(consenter('a.test'), consenter('b.test'))),
      'consenters-single-host': file(raftOrderer(consenter('a.test', { port: 7050 }), consenter('a.test', { port: 7051 }), consenter('a.test', { port: 7052 })))
    }[id];
    const f = ofCheck(text, id)[0];
    assert.ok(f, id);
    assert.match(f.message, /best practice of this tool/, id);
  }
});

// single-organization

test('single-organization: one organization in the Application section is reported at the Organizations key', () => {
  const text = file(app([org('A')]));
  const f = ofCheck(text, 'single-organization');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text, 'Organizations:'));
  assert.match(f[0].message, /AOrg \(MSP ID AMSP\)/);
});

test('single-organization: two organizations, and the same organization written twice through an alias, near misses', () => {
  assert.deepEqual(ofCheck(file(app([org('A'), org('B')])), 'single-organization'), []);
  const twice = 'Organizations:\n  - &A\n    Name: AOrg\n    ID: AMSP\n    MSPDir: a\n    AnchorPeers:\n      - Host: h\nProfiles:\n  P:\n    Capabilities:\n      V2_0: true\n    Application:\n      Capabilities:\n        V2_0: true\n      Organizations:\n        - *A\n        - *A\n';
  assert.equal(ofCheck(twice, 'single-organization').length, 1, 'one organization written twice is still one');
});

test('single-organization: a consortium with one organization is reported at its Organizations key', () => {
  const body = `${app([org('A'), org('B')])}\nConsortiums:\n  Harbor:\n${indent(orgList(org('A')), 4)}`;
  const text = file(body);
  const f = ofCheck(text, 'single-organization');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /consortium Harbor/);
  assert.equal(f[0].line, lineOf(text, 'Organizations:', 2));
});

test('single-organization: an empty Organizations list is not a single organization', () => {
  assert.deepEqual(ofCheck(file('Application:\n  Organizations:\n  Capabilities:\n    V2_0: true'), 'single-organization'), []);
});

// admins-any

test('admins-any: ANY Admins in the Application section is an error at the Rule line', () => {
  const text = file(app([org('A'), org('B')], policies('Admins', 'ANY Admins')));
  const f = ofCheck(text, 'admins-any');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text, 'Rule: "ANY Admins"'));
  assert.equal(ruleById('admins-any').severity, 'error');
});

test('admins-any: MAJORITY Admins, ALL Admins and a signature rule are near misses', () => {
  for (const rule of ['MAJORITY Admins', 'ALL Admins']) assert.deepEqual(ofCheck(file(app([org('A'), org('B')], policies('Admins', rule))), 'admins-any'), [], rule);
  const signature = 'Policies:\n  Admins:\n    Type: Signature\n    Rule: "AND(\'AMSP.admin\', \'BMSP.admin\')"';
  assert.deepEqual(ofCheck(file(app([org('A'), org('B')], signature)), 'admins-any'), []);
});

test('admins-any: the rule is read with its spaces and case folded', () => {
  for (const rule of ['any   Admins', 'ANY Admins', 'Any admins']) assert.equal(ofCheck(file(app([org('A'), org('B')], policies('Admins', rule))), 'admins-any').length, 1, rule);
});

test('admins-any: the Orderer and the Channel sections are checked too, ANY Readers is not an Admins policy', () => {
  const o = file(orderer('OrdererType: solo\nPolicies:\n  Admins:\n    Type: ImplicitMeta\n    Rule: "ANY Admins"'));
  assert.equal(ofCheck(o, 'admins-any').length, 1);
  assert.match(ofCheck(o, 'admins-any')[0].message, /Orderer Admins/);
  const channel = `Policies:\n  Admins:\n    Type: ImplicitMeta\n    Rule: "ANY Admins"\n${GOOD_APPLICATION}`;
  const c = ofCheck(file(channel), 'admins-any');
  assert.equal(c.length, 1);
  assert.match(c[0].message, /Channel Admins/);
  assert.deepEqual(ofCheck(file(app([org('A'), org('B')], 'Policies:\n  Admins:\n    Type: ImplicitMeta\n    Rule: "ANY Readers"')), 'admins-any'), []);
});

test('admins-any: a policy that several profiles share through an alias is one finding with the profiles listed', () => {
  const text = `Application: &Defaults\n  Policies:\n    Admins:\n      Type: ImplicitMeta\n      Rule: "ANY Admins"\n  Capabilities:\n    V2_0: true\nProfiles:\n  One:\n    Capabilities:\n      V2_0: true\n    Application:\n      <<: *Defaults\n  Two:\n    Capabilities:\n      V2_0: true\n    Application:\n      <<: *Defaults\n`;
  const f = ofCheck(text, 'admins-any');
  assert.equal(f.length, 1);
  assert.deepEqual(f[0].profiles, ['One', 'Two']);
  assert.equal(f[0].line, lineOf(text, 'Rule: "ANY Admins"'));
});

// readers-writers-any

test('readers-writers-any: ANY Writers and ANY Readers are one note for the group', () => {
  const both = file(app([org('A'), org('B')], 'Policies:\n  Readers:\n    Type: ImplicitMeta\n    Rule: "ANY Readers"\n  Writers:\n    Type: ImplicitMeta\n    Rule: "ANY Writers"'));
  const f = ofCheck(both, 'readers-writers-any');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /Readers and Writers policies/);
  assert.equal(ruleById('readers-writers-any').severity, 'info');
});

test('readers-writers-any: MAJORITY Writers and an explicit signature rule are near misses; the Channel group is not reported', () => {
  assert.deepEqual(ofCheck(file(app([org('A'), org('B')], policies('Writers', 'MAJORITY Writers'))), 'readers-writers-any'), []);
  const channel = `Policies:\n  Writers:\n    Type: ImplicitMeta\n    Rule: "ANY Writers"\n${GOOD_APPLICATION}`;
  assert.deepEqual(ofCheck(file(channel), 'readers-writers-any'), []);
});

// endorsement-any

test('endorsement-any: ANY on LifecycleEndorsement and on Endorsement are warnings at their lines', () => {
  const text = file(app([org('A'), org('B')], 'Policies:\n  LifecycleEndorsement:\n    Type: ImplicitMeta\n    Rule: "ANY Endorsement"\n  Endorsement:\n    Type: ImplicitMeta\n    Rule: "ANY Endorsement"'));
  const f = ofCheck(text, 'endorsement-any');
  assert.equal(f.length, 2);
  assert.deepEqual(f.map((x) => x.line), [lineOf(text, 'Rule: "ANY Endorsement"', 1), lineOf(text, 'Rule: "ANY Endorsement"', 2)]);
  assert.match(f[0].message, /LifecycleEndorsement/);
  assert.equal(ruleById('endorsement-any').severity, 'warning');
});

test('endorsement-any: MAJORITY Endorsement and a signature rule are near misses', () => {
  assert.deepEqual(ofCheck(GOOD, 'endorsement-any'), []);
  const sig = 'Policies:\n  Endorsement:\n    Type: Signature\n    Rule: "OR(\'AMSP.peer\', \'BMSP.peer\')"';
  assert.deepEqual(ofCheck(file(app([org('A'), org('B')], sig)), 'endorsement-any'), []);
});

// anchor-peers-missing

test('anchor-peers-missing: an organization with no AnchorPeers is reported at the organization; one with them is not', () => {
  const text = file(app([org('A', { anchor: false }), org('B')]));
  const f = ofCheck(text, 'anchor-peers-missing');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /AOrg/);
  assert.equal(f[0].line, lineOf(text, 'Name: AOrg'));
});

test('anchor-peers-missing: an AnchorPeers key with an empty list is reported at the key, and an organization outside the Application section is not', () => {
  const text = file(app([org('A', { anchor: false, extra: '  AnchorPeers: []' }), org('B')]));
  const f = ofCheck(text, 'anchor-peers-missing');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text, 'AnchorPeers: []'));
  const ordererOnly = file(`Orderer:\n${indent(['Organizations:\n  - Name: OrdererOrg\n    ID: OrdererMSP\n    MSPDir: o', 'OrdererType: solo', BATCH, CAPS].join('\n'), 2)}`);
  assert.deepEqual(ofCheck(ordererOnly, 'anchor-peers-missing'), []);
});

// orderer-solo

test('orderer-solo: OrdererType solo is an error at its line, in any case', () => {
  for (const type of ['solo', 'Solo', 'SOLO']) {
    const text = file(orderer(`OrdererType: ${type}`));
    const f = ofCheck(text, 'orderer-solo');
    assert.equal(f.length, 1, type);
    assert.equal(f[0].line, lineOf(text, 'OrdererType'));
  }
  assert.equal(ruleById('orderer-solo').severity, 'error');
});

test('orderer-solo: etcdraft and BFT are near misses', () => {
  for (const type of ['etcdraft', 'BFT']) assert.deepEqual(ofCheck(file(orderer(`OrdererType: ${type}`)), 'orderer-solo'), [], type);
});

// raft-consenter-count

test('raft-consenter-count: one and two consenters are warnings, three is not', () => {
  assert.equal(ofCheck(file(raftOrderer(consenter('a.test'))), 'raft-consenter-count').length, 1);
  const two = file(raftOrderer(consenter('a.test'), consenter('b.test')));
  const f = ofCheck(two, 'raft-consenter-count');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /lists 2 consenters/);
  assert.equal(f[0].line, lineOf(two, 'Consenters:'));
  assert.deepEqual(ofCheck(file(raftOrderer(consenter('a.test'), consenter('b.test'), consenter('c.test'))), 'raft-consenter-count'), []);
});

test('raft-consenter-count: etcdraft with no consenters is reported at the type, a solo orderer with none is not a Raft finding', () => {
  const none = file(orderer('OrdererType: etcdraft'));
  const f = ofCheck(none, 'raft-consenter-count');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /no consenters/);
  assert.deepEqual(ofCheck(file(orderer('OrdererType: solo')), 'raft-consenter-count'), []);
});

test('bft-consenter-count: fewer than four consenters in a ConsenterMapping is a warning, four is not', () => {
  const map = (n) => Array.from({ length: n }, (_, i) => consenter(`b${i}.test`)).join('\n');
  const three = file(orderer(`OrdererType: BFT\nConsenterMapping:\n${indent(map(3), 2)}`));
  const f = ofCheck(three, 'bft-consenter-count');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(three, 'ConsenterMapping:'));
  assert.deepEqual(ofCheck(file(orderer(`OrdererType: BFT\nConsenterMapping:\n${indent(map(4), 2)}`)), 'bft-consenter-count'), []);
  assert.equal(ofCheck(file(orderer('OrdererType: BFT')), 'bft-consenter-count').length, 1);
});

// consenters-single-host

test('consenters-single-host: three consenters on one host are a warning at the list, two hosts are not', () => {
  const same = file(raftOrderer(consenter('a.test', { port: 7050 }), consenter('a.test', { port: 7051 }), consenter('A.test', { port: 7052 })));
  const f = ofCheck(same, 'consenters-single-host');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(same, 'Consenters:'));
  const two = file(raftOrderer(consenter('a.test'), consenter('a.test', { port: 7051 }), consenter('b.test')));
  assert.deepEqual(ofCheck(two, 'consenters-single-host'), []);
});

test('consenters-single-host: one consenter is only a count finding, and consenters with a missing host are not guessed at', () => {
  assert.deepEqual(ofCheck(file(raftOrderer(consenter('a.test'))), 'consenters-single-host'), []);
  const noHost = file(raftOrderer('- Port: 7050\n  ClientTLSCert: c\n  ServerTLSCert: s', '- Port: 7051\n  ClientTLSCert: c\n  ServerTLSCert: s', '- Host: x.test\n  ClientTLSCert: c\n  ServerTLSCert: s'));
  assert.deepEqual(ofCheck(noHost, 'consenters-single-host'), []);
});

// consenter-tls-missing

test('consenter-tls-missing: a missing ClientTLSCert or ServerTLSCert is an error at the consenter, each field its own finding', () => {
  const text = file(raftOrderer(consenter('a.test', { client: false }), consenter('b.test', { server: false }), consenter('c.test', { client: false, server: false })));
  const f = ofCheck(text, 'consenter-tls-missing');
  assert.equal(f.length, 4);
  assert.deepEqual(f.map((x) => /(Client|Server)TLSCert/.exec(x.message)[1]).sort(), ['Client', 'Client', 'Server', 'Server']);
  assert.equal(f[0].line, lineOf(text, 'Host: a.test'));
  assert.match(f[0].message, /a\.test:7050/);
  assert.equal(ruleById('consenter-tls-missing').severity, 'error');
});

test('consenter-tls-missing: an empty certificate path is missing, a path is not, and a BFT mapping is checked too', () => {
  const empty = file(raftOrderer('- Host: a.test\n  ClientTLSCert:\n  ServerTLSCert: ""', consenter('b.test'), consenter('c.test')));
  assert.equal(ofCheck(empty, 'consenter-tls-missing').length, 2);
  assert.deepEqual(ofCheck(GOOD, 'consenter-tls-missing'), []);
  const bft = file(orderer(`OrdererType: BFT\nConsenterMapping:\n${indent([consenter('a.test', { server: false }), consenter('b.test'), consenter('c.test'), consenter('d.test')].join('\n'), 2)}`));
  assert.equal(ofCheck(bft, 'consenter-tls-missing').length, 1);
});

// batch-settings-missing

test('batch-settings-missing: no BatchTimeout and no BatchSize are two warnings at the Orderer key', () => {
  const text = file(`Orderer:\n  OrdererType: etcdraft\n${indent(`EtcdRaft:\n  Consenters:\n${indent([consenter('a.test'), consenter('b.test'), consenter('c.test')].join('\n'), 4)}\n${CAPS}`, 2)}`);
  const f = ofCheck(text, 'batch-settings-missing');
  assert.equal(f.length, 2);
  assert.deepEqual(f.map((x) => x.line), [lineOf(text, 'Orderer:'), lineOf(text, 'Orderer:')]);
  assert.ok(f.some((x) => /BatchTimeout/.test(x.message)) && f.some((x) => /BatchSize/.test(x.message)));
});

test('batch-settings-missing: each missing value of BatchSize is reported at BatchSize, and the full set is a near miss', () => {
  for (const field of ['MaxMessageCount', 'AbsoluteMaxBytes', 'PreferredMaxBytes']) {
    const batch = BATCH.split('\n').filter((l) => !l.includes(field)).join('\n');
    const text = file(`Orderer:\n${indent(['OrdererType: solo', batch, CAPS].join('\n'), 2)}`);
    const f = ofCheck(text, 'batch-settings-missing');
    assert.equal(f.length, 1, field);
    assert.match(f[0].message, new RegExp(field));
    assert.equal(f[0].line, lineOf(text, 'BatchSize:'));
  }
  assert.deepEqual(ofCheck(GOOD, 'batch-settings-missing'), []);
});

test('batch-settings-missing: a profile with no Orderer section is not asked for batch settings', () => {
  assert.deepEqual(ofCheck(file(GOOD_APPLICATION), 'batch-settings-missing'), []);
});

// capabilities

test('capabilities-missing: a profile with no Capabilities for the channel, the Application section or the Orderer section', () => {
  const text = fileRaw(`${GOOD_APPLICATION.replace(CAPS.split('\n').map((l) => `  ${l}`).join('\n'), '')}\n${GOOD_ORDERER}`);
  const f = ofCheck(text, 'capabilities-missing');
  assert.ok(f.length >= 2, `found ${f.length}`);
  assert.ok(f.some((x) => /Channel group/.test(x.message)));
});

test('capabilities-missing: each of the three groups is reported on its own', () => {
  const channelOnly = fileRaw(`${GOOD_APPLICATION}\n${GOOD_ORDERER}`);
  const c = ofCheck(channelOnly, 'capabilities-missing');
  assert.equal(c.length, 1);
  assert.match(c[0].message, /Channel group/);
  assert.equal(c[0].line, lineOf(channelOnly, 'P:'));
  const noApp = file(app([org('A'), org('B')]).replace(/\n {2}Capabilities:\n {4}V2_0: true/, ''));
  assert.match(ofCheck(noApp, 'capabilities-missing')[0].message, /Application group/);
  const noOrderer = file(orderer('OrdererType: solo', false));
  assert.match(ofCheck(noOrderer, 'capabilities-missing')[0].message, /Orderer group/);
});

test('capability-disabled: a group with V2_0 false and no level true is a warning at the level; one true level is a near miss', () => {
  const off = file(app([org('A'), org('B')]).replace('V2_0: true', 'V2_0: false'));
  const f = ofCheck(off, 'capability-disabled');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(off, 'V2_0: false'));
  const mixed = file(app([org('A'), org('B')]).replace('V2_0: true', 'V1_4_2: false\n      V2_0: true'));
  assert.deepEqual(ofCheck(mixed, 'capability-disabled'), []);
  assert.deepEqual(ofCheck(GOOD, 'capability-disabled'), []);
});

test('capability-disabled: a Capabilities group with no entries is missing, not disabled', () => {
  const empty = file(app([org('A'), org('B')]).replace('Capabilities:\n    V2_0: true', 'Capabilities: {}'));
  assert.deepEqual(ofCheck(empty, 'capability-disabled'), []);
  assert.equal(ofCheck(empty, 'capabilities-missing').length, 1);
});

// org-msp-incomplete

test('org-msp-incomplete: no ID and no MSPDir are two errors at the organization, and a complete one is not', () => {
  const text = file(app([org('A', { id: null, mspdir: null }), org('B')]));
  const f = ofCheck(text, 'org-msp-incomplete');
  assert.equal(f.length, 2);
  assert.deepEqual(f.map((x) => /no (ID|MSPDir)/.exec(x.message)[1]).sort(), ['ID', 'MSPDir']);
  assert.equal(f[0].line, lineOf(text, 'Name: AOrg'));
  assert.deepEqual(ofCheck(GOOD, 'org-msp-incomplete'), []);
});

test('org-msp-incomplete: an empty ID or MSPDir is reported at its key, and the top-level Organizations list is checked without a profile using it', () => {
  const text = file(app([org('A', { id: '""' }), org('B')]));
  const f = ofCheck(text, 'org-msp-incomplete');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text, 'ID: ""'));
  const top = `Organizations:\n  - Name: LoneOrg\n    ID: LoneMSP\n${fileRaw(`${GOOD_APPLICATION}\n${GOOD_ORDERER}\n${CAPS}`)}`;
  const g = ofCheck(top, 'org-msp-incomplete');
  assert.equal(g.length, 1);
  assert.match(g[0].message, /LoneOrg.*MSPDir/);
});

// duplicate-msp-id

test('duplicate-msp-id: two definitions with one ID are an error at the second, and the same organization through an alias is not', () => {
  const dup = file(app([org('A'), org('B', { id: 'AMSP' })]));
  const f = ofCheck(dup, 'duplicate-msp-id');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(dup, 'ID: AMSP', 2));
  assert.match(f[0].message, new RegExp(`first at line ${lineOf(dup, 'ID: AMSP', 1)}`));
  const alias = 'Organizations:\n  - &A\n    Name: AOrg\n    ID: AMSP\n    MSPDir: a\n    AnchorPeers:\n      - Host: h\nProfiles:\n  P:\n    Capabilities:\n      V2_0: true\n    Application:\n      Capabilities:\n        V2_0: true\n      Organizations:\n        - *A\n        - <<: *A\n          Policies:\n            Admins:\n              Type: Signature\n              Rule: "OR(\'AMSP.admin\')"\n';
  assert.deepEqual(ofCheck(alias, 'duplicate-msp-id'), []);
});

test('duplicate-msp-id: two different IDs are a near miss, and a duplicate between the top list and a profile is found', () => {
  assert.deepEqual(ofCheck(GOOD, 'duplicate-msp-id'), []);
  const text = `Organizations:\n  - Name: Old\n    ID: AMSP\n    MSPDir: old\n${GOOD}`;
  assert.equal(ofCheck(text, 'duplicate-msp-id').length, 1);
});

// profiles and the file

test('no-profiles: a file with no Profiles section, or an empty one, is an error at the key or the first line', () => {
  const none = checkText('Organizations:\n  - Name: A\n').findings;
  assert.deepEqual(none.map((f) => f.id), ['no-profiles']);
  assert.equal(none[0].line, 1);
  const empty = checkText('Organizations: []\nProfiles:\n').findings;
  assert.equal(empty[0].line, 2);
  assert.equal(ruleById('no-profiles').severity, 'error');
});

test('--profile: only the named profile and the organizations it uses are checked; an unknown name stops the run', () => {
  const text = `Profiles:\n  Weak:\n    Orderer:\n      OrdererType: solo\n  Strong:\n${indent(file(GOOD_APPLICATION, GOOD_ORDERER).split('\n').slice(2).join('\n'), 0)}`;
  assert.ok(idsIn(text).includes('orderer-solo'));
  assert.deepEqual(idsIn(text, { profile: 'Strong' }), []);
  assert.ok(idsIn(text, { profile: 'Weak' }).includes('orderer-solo'));
  assert.throws(() => checkText(text, { profile: 'Nope' }), /no profile named Nope.*Weak, Strong/);
});

test('a text that is not YAML gives one config-unreadable error with its line, and nothing else', () => {
  const f = checkText('Profiles:\n  P:\n\tOrderer: x\n').findings;
  assert.equal(f.length, 1);
  assert.equal(f[0].id, 'config-unreadable');
  assert.equal(f[0].line, 3);
  const top = checkText('- a\n- b\n').findings;
  assert.equal(top[0].id, 'config-unreadable');
});

test('a construct the reader passes over is an unsupported-construct finding at its line, never silent', () => {
  const text = `${GOOD}Notes: |\n  text\n`;
  const f = ofCheck(text, 'unsupported-construct');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text, 'Notes:'));
  assert.match(f[0].message, /block scalar/);
});

test('a value the reader passed over is never reported as missing', () => {
  const text = file(app([`- Name: AOrg\n  ID: AMSP\n  MSPDir: |\n    ../a/msp\n  AnchorPeers:\n    - Host: h`, org('B')]));
  assert.deepEqual(ofCheck(text, 'org-msp-incomplete'), []);
});

test('findings through an alias point at the line where the value is written', () => {
  const text = 'Defs: &d\n  OrdererType: solo\nProfiles:\n  P:\n    Capabilities:\n      V2_0: true\n    Orderer:\n      <<: *d\n';
  assert.equal(ofCheck(text, 'orderer-solo')[0].line, 2);
});

test('the checks never throw on odd shapes: a profile that is a scalar, sections that are lists, organizations that are scalars', () => {
  for (const text of ['Profiles:\n  P: x\n', 'Profiles:\n  P:\n    Application: [1, 2]\n    Orderer: text\n    Consortiums: 5\n', 'Profiles:\n  P:\n    Application:\n      Organizations: [a, b]\n      Policies: x\n', 'Profiles: [a]\n', 'Profiles:\n  P:\n    Orderer:\n      EtcdRaft:\n        Consenters: [x, y, z]\n      OrdererType: etcdraft\n']) {
    assert.doesNotThrow(() => checkText(text), text);
  }
});
