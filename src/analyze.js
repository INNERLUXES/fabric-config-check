// The checks over the parsed file. Every check looks at one profile at a time, because a profile is what configtxgen turns
// into a channel or a consortium, and a setting that several profiles share through an alias is reported once, at the
// line where it is written, with the profiles that use it. A check reads what is written in the file: it follows aliases
// and merge keys, and it never guesses what a missing value would be.

import { entryOf, isBlank, isMap, isScalar, isSeq, textOf, valueOf } from './yaml.js';

const BEST = 'This is a best practice of this tool, not a rule in the Fabric documentation.';

// A rule text with its white space folded: "ANY   Admins" is "ANY Admins".
const ruleText = (node) => (isScalar(node) ? node.value.trim().replace(/\s+/g, ' ') : null);

// The organizations written in an Organizations list: the mapping items, with an alias to one counted as the one it points to.
const orgItems = (node) => (isSeq(node) ? node.items.filter(isMap) : []);

// What to call an organization in a message.
export function orgLabel(org) {
  const id = textOf(valueOf(org, 'ID'));
  const name = textOf(valueOf(org, 'Name'));
  if (id && name && id !== name) return `${name} (MSP ID ${id})`;
  if (id) return id;
  if (name) return name;
  return `the organization written at line ${org.line}`;
}

// The organizations of a list, with one entry for each MSP ID (or for each definition when it has none).
function distinctOrgs(items) {
  const seen = new Map();
  for (const org of items) {
    const id = textOf(valueOf(org, 'ID'));
    const key = id && id.trim() !== '' ? `id:${id}` : org;
    if (!seen.has(key)) seen.set(key, org);
  }
  return [...seen.values()];
}

// The findings of one run, with a finding that several profiles share written once.
class Collector {
  constructor() {
    this.map = new Map();
  }

  add(id, entryOrNode, message, profile) {
    const line = entryOrNode.keyLine ?? entryOrNode.line;
    const column = entryOrNode.keyCol ?? entryOrNode.col ?? 1;
    const key = `${id}\u0000${line}\u0000${column}\u0000${message}`;
    let f = this.map.get(key);
    if (!f) {
      f = { id, line, column, message, profiles: [] };
      this.map.set(key, f);
    }
    if (profile !== null && !f.profiles.includes(profile)) f.profiles.push(profile);
  }

  list() {
    return [...this.map.values()];
  }
}

// Admins, Readers and Writers of the Application, Orderer and Channel sections, and the two endorsement policies.
function checkPolicies(profileMap, app, orderer, name, c) {
  const groups = [['Channel', valueOf(profileMap, 'Policies')], ['Application', valueOf(app, 'Policies')], ['Orderer', valueOf(orderer, 'Policies')]];
  for (const [group, policies] of groups) {
    if (!isMap(policies)) continue;
    const open = [];
    for (const [policy, pattern] of [['Admins', /^any admins$/i], ['Readers', /^any readers$/i], ['Writers', /^any writers$/i]]) {
      const ruleEntry = entryOf(valueOf(policies, policy), 'Rule');
      const text = ruleText(ruleEntry?.value);
      if (text === null || !pattern.test(text)) continue;
      if (policy === 'Admins') {
        const what = group === 'Channel' ? 'the channel configuration' : `the ${group} group`;
        c.add('admins-any', ruleEntry, `The ${group} Admins policy is "${text}", so the admins of any one organization can approve a change to ${what}. The documentation describes Admins as the modification policy and names MAJORITY Admins as the default.`, name);
      } else if (group !== 'Channel') open.push({ policy, text, ruleEntry });
    }
    if (open.length) {
      const names = open.map((o) => o.policy).join(' and ');
      const rules = open.map((o) => `"${o.text}"`).join(' and ');
      c.add('readers-writers-any', open[0].ruleEntry, `The ${group} ${names} ${open.length === 1 ? 'policy is' : 'policies are'} ${rules}, so any one organization can ${open.length === 1 ? (open[0].policy === 'Readers' ? 'read' : 'submit') : 'read and submit'}. The documentation defaults are ANY, so confirm it is intended. ${BEST}`, name);
    }
  }
  for (const policy of ['LifecycleEndorsement', 'Endorsement']) {
    const ruleEntry = entryOf(valueOf(valueOf(app, 'Policies'), policy), 'Rule');
    const text = ruleText(ruleEntry?.value);
    if (text !== null && /^any\b/i.test(text)) {
      const what = policy === 'LifecycleEndorsement' ? 'approve a chaincode definition' : 'endorse a transaction by default';
      c.add('endorsement-any', ruleEntry, `The Application ${policy} policy is "${text}", so one organization can ${what}. The documentation default is MAJORITY Endorsement and it says the definition should be customized in production.`, name);
    }
  }
}

function checkOrganizations(app, consortiums, name, c) {
  if (isMap(app)) {
    const entry = entryOf(app, 'Organizations');
    const orgs = distinctOrgs(orgItems(entry?.value));
    if (orgs.length === 1) c.add('single-organization', entry, `The Application section lists one organization, ${orgLabel(orgs[0])}, so no other organization takes part in the channel. ${BEST}`, name);
    for (const org of orgs) {
      const peers = valueOf(org, 'AnchorPeers');
      if (isBlank(peers)) {
        const own = entryOf(org, 'AnchorPeers');
        c.add('anchor-peers-missing', own ?? org, `The organization ${orgLabel(org)} is used in the Application section and has no AnchorPeers. The documentation says at least one anchor peer must be defined in the channel configuration for gossip across organizations.`, name);
      }
    }
  }
  if (isMap(consortiums)) {
    for (const e of consortiums.entries) {
      const entry = entryOf(e.value, 'Organizations');
      const orgs = distinctOrgs(orgItems(entry?.value));
      if (orgs.length === 1) c.add('single-organization', entry, `The consortium ${e.key} lists one organization, ${orgLabel(orgs[0])}, so no other organization is a member. ${BEST}`, name);
    }
  }
}

// A consenter list: the TLS certificates of each consenter and the hosts.
function checkConsenters(list, listEntry, label, name, c) {
  const items = isSeq(list) ? list.items.filter(isMap) : [];
  for (const consenter of items) {
    const host = textOf(valueOf(consenter, 'Host'));
    const port = textOf(valueOf(consenter, 'Port'));
    const where = host ? (port ? `${host}:${port}` : host) : `written at line ${consenter.line}`;
    for (const field of ['ClientTLSCert', 'ServerTLSCert']) {
      if (isBlank(valueOf(consenter, field))) c.add('consenter-tls-missing', entryOf(consenter, field) ?? consenter, `The consenter ${where} in ${label} has no ${field}. The documentation identifies each consenter by its endpoint and its client and server TLS certificates.`, name);
    }
  }
  const hosts = items.map((i) => textOf(valueOf(i, 'Host'))).filter((h) => h !== null && h.trim() !== '');
  if (items.length >= 2 && hosts.length === items.length && new Set(hosts.map((h) => h.trim().toLowerCase())).size === 1) {
    c.add('consenters-single-host', listEntry, `All ${items.length} consenters in ${label} are on the host ${hosts[0]}, so one host failure stops ordering. ${BEST}`, name);
  }
  return items.length;
}

function checkOrderer(orderer, ordererEntry, name, c) {
  const typeEntry = entryOf(orderer, 'OrdererType');
  const type = textOf(typeEntry?.value)?.trim().toLowerCase() ?? null;
  const at = typeEntry ?? ordererEntry;
  if (type === 'solo') c.add('orderer-solo', at, 'OrdererType is solo. The current sample file says Solo was removed in V3.0, and the documentation says a production network should use a multi-node ordering service.', name);
  const raft = entryOf(orderer, 'EtcdRaft');
  const consenters = entryOf(raft?.value, 'Consenters');
  if (type === 'etcdraft' || (type === null && consenters)) {
    if (consenters && !isBlank(consenters.value)) {
      const n = checkConsenters(consenters.value, consenters, 'EtcdRaft.Consenters', name, c);
      if (n < 3) c.add('raft-consenter-count', consenters, `EtcdRaft.Consenters lists ${n} ${n === 1 ? 'consenter' : 'consenters'}. The documentation says a production network should use a multi-node ordering service and shows a set of three; a majority of consenters must be up to order. The minimum of 3 is a best practice of this tool.`, name);
    } else if (type === 'etcdraft') {
      c.add('raft-consenter-count', consenters ?? raft ?? at, 'OrdererType is etcdraft and no consenters are listed under EtcdRaft.Consenters, so the ordering service has no nodes to start from.', name);
    }
  }
  const mapping = entryOf(orderer, 'ConsenterMapping');
  if (type === 'bft' || (type === null && mapping)) {
    if (mapping && !isBlank(mapping.value)) {
      const n = checkConsenters(mapping.value, mapping, 'ConsenterMapping', name, c);
      if (n < 4) c.add('bft-consenter-count', mapping, `ConsenterMapping lists ${n} ${n === 1 ? 'consenter' : 'consenters'}. The sample file says a BFT set needs at least 3F+1 servers to tolerate F failures, so at least four for one failure.`, name);
    } else if (type === 'bft') {
      c.add('bft-consenter-count', mapping ?? at, 'OrdererType is BFT and no consenters are listed under ConsenterMapping.', name);
    }
  }
  // Batch settings.
  const timeout = entryOf(orderer, 'BatchTimeout');
  if (isBlank(timeout?.value)) c.add('batch-settings-missing', timeout ?? ordererEntry, 'The Orderer section sets no BatchTimeout. The documentation and the sample file set it to say how often a block is cut.', name);
  const size = entryOf(orderer, 'BatchSize');
  if (isBlank(size?.value)) c.add('batch-settings-missing', size ?? ordererEntry, 'The Orderer section sets no BatchSize. The documentation and the sample file set MaxMessageCount, AbsoluteMaxBytes and PreferredMaxBytes to say how large a block is.', name);
  else if (isMap(size.value)) {
    for (const field of ['MaxMessageCount', 'AbsoluteMaxBytes', 'PreferredMaxBytes']) {
      if (isBlank(valueOf(size.value, field))) c.add('batch-settings-missing', entryOf(size.value, field) ?? size, `BatchSize sets no ${field}. The documentation and the sample file set all three values of BatchSize.`, name);
    }
  }
}

function checkCapabilities(profileEntry, profileMap, app, appEntry, orderer, ordererEntry, name, c) {
  const groups = [['Channel', profileMap, profileEntry], ...(isMap(app) ? [['Application', app, appEntry]] : []), ...(isMap(orderer) ? [['Orderer', orderer, ordererEntry]] : [])];
  for (const [group, holder, holderEntry] of groups) {
    const caps = entryOf(holder, 'Capabilities');
    if (!caps || isBlank(caps.value) || !isMap(caps.value)) {
      if (caps && caps.value.kind === 'unsupported') continue;
      c.add('capabilities-missing', caps ?? holderEntry, `The ${group} group has no Capabilities, so the channel does not say which level of binaries may take part. The documentation sets all three groups.`, name);
      continue;
    }
    const levels = caps.value.entries;
    if (levels.some((e) => isScalar(e.value) && e.value.type === 'bool' && e.value.bool === true)) continue;
    const off = levels.find((e) => isScalar(e.value) && e.value.type === 'bool') ?? levels[0];
    c.add('capability-disabled', off, `The ${group} Capabilities group has no level set to true (${off.key}: ${textOf(off.value) ?? 'not a value'}), so it requires nothing of the binaries.`, name);
  }
}

// The organizations a profile uses, in all of its sections.
export function profileOrgs(profileMap) {
  const out = [];
  const add = (node) => out.push(...orgItems(valueOf(node, 'Organizations')));
  add(valueOf(profileMap, 'Application'));
  add(valueOf(profileMap, 'Orderer'));
  const consortiums = valueOf(profileMap, 'Consortiums');
  if (isMap(consortiums)) for (const e of consortiums.entries) add(e.value);
  return out;
}

// Organizations: an ID and an MSPDir for each, and no two definitions with one MSP ID.
function checkOrgDefinitions(orgs, c, profileOf) {
  const nodes = [...new Set(orgs)];
  for (const org of nodes) {
    const ps = profileOf.get(org) ?? [];
    for (const field of ['ID', 'MSPDir']) {
      if (isBlank(valueOf(org, field))) {
        const own = entryOf(org, field);
        const message = `The organization ${orgLabel(org)} has no ${field}. The documentation uses the ID as the MSP ID that policies refer to and the MSPDir as the folder the channel MSP is built from.`;
        for (const p of ps.length ? ps : [null]) c.add('org-msp-incomplete', own ?? org, message, p);
      }
    }
  }
  const firstOf = new Map();
  for (const org of nodes) {
    const idNode = valueOf(org, 'ID');
    const id = textOf(idNode);
    if (id === null || id.trim() === '') continue;
    const first = firstOf.get(id);
    if (!first) firstOf.set(id, { org, idNode });
    else if (first.idNode !== idNode) {
      const entry = entryOf(org, 'ID');
      const message = `The MSP ID ${id} is defined for two organizations (first at line ${entryOf(first.org, 'ID').keyLine}). The documentation calls the MSP ID the unique identifier of an organization.`;
      for (const p of profileOf.get(org) ?? [null]) c.add('duplicate-msp-id', entry, message, p);
    }
  }
}

// All the findings of a file: [{ id, line, column, message, profiles }].
export function analyze(root, { profile = null, unusedOrgs = true } = {}) {
  const c = new Collector();
  const profiles = valueOf(root, 'Profiles');
  const profilesEntry = entryOf(root, 'Profiles');
  if (!isMap(profiles) || profiles.entries.length === 0) {
    c.add('no-profiles', profilesEntry ?? { line: 1, col: 1 }, 'The file has no Profiles section with a profile in it, so there is no channel or consortium to check.', null);
    return { findings: c.list(), profiles: [], organizations: 0 };
  }
  const selected = profile === null ? profiles.entries : profiles.entries.filter((e) => e.key === profile);
  const orgs = [];
  const profileOf = new Map();
  for (const e of selected) {
    const P = e.value;
    if (!isMap(P)) continue;
    const app = valueOf(P, 'Application');
    const orderer = valueOf(P, 'Orderer');
    const consortiums = valueOf(P, 'Consortiums');
    checkPolicies(P, app, orderer, e.key, c);
    checkOrganizations(app, consortiums, e.key, c);
    if (isMap(orderer)) checkOrderer(orderer, entryOf(P, 'Orderer'), e.key, c);
    checkCapabilities(e, P, app, entryOf(P, 'Application'), orderer, entryOf(P, 'Orderer'), e.key, c);
    for (const org of profileOrgs(P)) {
      orgs.push(org);
      if (!profileOf.has(org)) profileOf.set(org, []);
      profileOf.get(org).push(e.key);
    }
  }
  if (profile === null && unusedOrgs) orgs.push(...orgItems(valueOf(root, 'Organizations')));
  checkOrgDefinitions(orgs, c, profileOf);
  return { findings: c.list(), profiles: selected.map((e) => e.key), organizations: new Set(orgs).size };
}
