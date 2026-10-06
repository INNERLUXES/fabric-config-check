// A run: locate and read the file, read the YAML, run the checks and build the report object that the formats write.

import { analyze } from './analyze.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { FILE_LIMITS, InputError, displayPath, locateConfig, readConfigText } from './files.js';
import { RULES, decide, ruleById } from './rules.js';
import { safeText } from './text.js';
import { YamlError, readYaml } from './yaml.js';

export const LIMITS = { ...FILE_LIMITS };

export { InputError };

const clean = (t, max = 600) => safeText(t, max);

const ORDER = { error: 0, warning: 1, info: 2 };

// The basis of a rule: the points with their pages.
function basisOf(rule) {
  return rule.basis.map((id) => {
    const page = pointPage(id);
    return { text: POINTS[id].text, source: page.title, url: page.url };
  });
}

const profileNames = (root) => {
  if (root.kind !== 'map') return [];
  const profiles = root.entries.find((e) => e.key === 'Profiles')?.value;
  return profiles && profiles.kind === 'map' ? profiles.entries.map((e) => e.key) : [];
};

// The findings of a text, with no file system: { findings, profiles, organizations, unsupported, names }. A text that is
// not YAML the reader can follow gives one config-unreadable finding.
export function checkText(text, { profile = null } = {}) {
  let parsed;
  try {
    parsed = readYaml(text);
  } catch (error) {
    if (!(error instanceof YamlError)) throw error;
    return { findings: [{ id: 'config-unreadable', line: error.line, column: error.column, message: `${error.message}. Nothing in the file was checked.`, profiles: [] }], profiles: [], organizations: 0, unsupported: [], names: [] };
  }
  const { root, unsupported } = parsed;
  const names = profileNames(root);
  if (profile !== null && !names.includes(profile)) throw new InputError([`no profile named ${clean(profile, 120)} in the file${names.length ? `; the profiles are ${names.map((n) => clean(n, 120)).join(', ')}` : ''}`]);
  if (root.kind === 'null') {
    return { findings: [{ id: 'no-profiles', line: 1, column: 1, message: 'The file holds nothing, so it has no Profiles section and there is no channel or consortium to check.', profiles: [] }, ...unsupported.map((u) => ({ id: 'unsupported-construct', line: u.line, column: 1, message: `Not read: ${u.construct} (${clean(u.text, 80)}). What it holds was not checked.`, profiles: [] }))], profiles: [], organizations: 0, unsupported, names };
  }
  if (root.kind !== 'map') {
    return { findings: [{ id: 'config-unreadable', line: root.line, column: root.col, message: 'The top level of the file is not a mapping of sections (Organizations, Profiles and the others). Nothing in the file was checked.', profiles: [] }], profiles: [], organizations: 0, unsupported, names };
  }
  const result = analyze(root, { profile });
  const extra = unsupported.map((u) => ({ id: 'unsupported-construct', line: u.line, column: 1, message: `Not read: ${u.construct} (${clean(u.text, 80)}). What it holds was not checked.`, profiles: [] }));
  return { findings: [...result.findings, ...extra], profiles: result.profiles, organizations: result.organizations, unsupported, names };
}

// The report object for the findings of one file.
export function buildReport({ file, bytes, lineCount, checked, version, minSeverity = 'info', failOn = 'error', profile = null }) {
  const all = checked.findings.map((f) => {
    const rule = ruleById(f.id);
    return {
      id: f.id,
      severity: rule.severity,
      message: clean(f.message),
      file,
      line: f.line,
      column: f.column,
      at: `${file}:${f.line}`,
      profiles: f.profiles.map((p) => clean(p, 120)),
      fix: rule.fix,
      kind: rule.kind,
      basis: basisOf(rule),
      own: rule.own ?? null
    };
  });
  all.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.line - b.line || a.column - b.column || a.id.localeCompare(b.id, 'en'));
  const shown = all.filter((f) => LEVELS.indexOf(f.severity) >= LEVELS.indexOf(minSeverity));
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.severity] += 1;
  const allByLevel = { error: 0, warning: 0, info: 0 };
  for (const f of all) allByLevel[f.severity] += 1;
  const notes = [];
  if (profile !== null) notes.push(`only the profile ${clean(profile, 120)} was checked; the other profiles and the organizations only they use were not`);
  if (checked.unsupported.length) notes.push(`${checked.unsupported.length} ${checked.unsupported.length === 1 ? 'construct was' : 'constructs were'} passed over by the reader; each is listed as an unsupported-construct finding and what it holds was not checked`);
  return {
    tool: 'fabric-config-check',
    version,
    input: { file, bytes, lines: lineCount, profile },
    profiles: checked.profiles.map((p) => clean(p, 120)),
    totals: { findings: shown.length, byLevel, hidden: all.length - shown.length },
    summary: { profiles: checked.profiles.length, organizations: checked.organizations, unsupported: checked.unsupported.length },
    rules: RULES.map((r) => ({ id: r.id, level: r.severity, kind: r.kind, findings: shown.filter((f) => f.id === r.id).length })),
    config: { minSeverity, failOn },
    unsupported: checked.unsupported.map((u) => ({ line: u.line, construct: u.construct, text: clean(u.text, 80), at: `${file}:${u.line}` })),
    findings: shown,
    notes,
    notice: NOTICE,
    result: decide(allByLevel, failOn)
  };
}

export async function checkFile({ path, profile = null, minSeverity = 'info', failOn = 'error', version, limits = LIMITS, base = process.cwd() }) {
  const absolute = await locateConfig(path, base);
  const { text, bytes } = await readConfigText(absolute, base, limits);
  const file = displayPath(absolute, base);
  const checked = checkText(text, { profile });
  const parts = text === '' ? [] : text.split(/\r\n|\r|\n/);
  const lineCount = parts.length > 0 && parts.at(-1) === '' ? parts.length - 1 : parts.length;
  return buildReport({ file, bytes, lineCount, checked, version, minSeverity, failOn, profile });
}
