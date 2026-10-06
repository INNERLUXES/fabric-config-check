// The reports: text for a terminal, markdown for a job summary or a pull request, JSON for other tools and SARIF for code
// scanning. Every text that comes from the input (the file name, an organization, a host, a profile, a construct) was
// cleaned by safeText before it reached the report object. The markdown format also escapes what markdown gives a meaning
// to, and the SARIF format is built as an object and written by JSON.stringify.

import { SOURCES } from './data.js';
import { RULES } from './rules.js';
import { grouped, listText, plural } from './size.js';

const URI = 'https://github.com/INNERLUXES/fabric-config-check';

function findingsLine(r) {
  const b = r.totals.byLevel;
  const parts = ['error', 'warning', 'info'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.totals.findings)}${parts.length ? ` (${parts.join(', ')})` : ''}${r.totals.hidden ? `; ${grouped(r.totals.hidden)} below ${r.config.minSeverity} not shown` : ''}`;
}

function table(head, rows, indent = '  ') {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => `${indent}${cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ')}`.trimEnd();
  return [line(head), ...rows.map(line)];
}

const PAD = ' '.repeat(11);

const usedBy = (f) => (f.profiles.length ? `profiles: ${listText(f.profiles, 8)}` : null);

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`fabric-config-check: ${r.input.file}`);
  out.push(`input: ${plural(r.input.lines, 'line')}, ${plural(r.input.bytes, 'byte')}; ${r.input.profile ? `profile ${r.input.profile} only` : `${plural(r.summary.profiles, 'profile')} checked`}; ${plural(r.summary.organizations, 'organization')}; ${plural(r.summary.unsupported, 'construct')} passed over`);
  out.push(`profiles: ${r.profiles.length ? listText(r.profiles, 30) : 'none'}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Checks (${grouped(r.rules.length)})`, '');
  out.push(...table(['check', 'level', 'kind', 'findings'], r.rules.map((x) => [x.id, x.level, x.kind, grouped(x.findings)])), '');
  out.push(`Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const width = Math.max(...RULES.map((x) => x.id.length));
  for (const f of r.findings) {
    out.push(`  ${f.severity.toUpperCase().padEnd(8)} ${f.id.padEnd(width)}  ${f.at}`);
    out.push(`${PAD}${f.message}`);
    if (usedBy(f)) out.push(`${PAD}${usedBy(f)}`);
    out.push(`${PAD}fix: ${f.fix}`);
    if (explain) {
      for (const b of f.basis) out.push(`${PAD}basis: ${b.text} (${b.source}, ${b.url})`);
      if (f.own) out.push(`${PAD}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  if (r.unsupported.length) {
    out.push(`Not read (${grouped(r.unsupported.length)})`, '');
    for (const u of r.unsupported) out.push(`  ${u.at}  ${u.construct}`);
    out.push('');
  }
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

// Text for a markdown table cell or line: the characters markdown gives a meaning to are escaped.
const md = (t) => String(t).replace(/[\\`*_{}[\]<>()#+!|~]/g, (c) => `\\${c}`).replace(/\r?\n/g, ' ');

export function toMarkdown(r, { explain = false } = {}) {
  const out = [];
  out.push(`# fabric-config-check: ${md(r.input.file)}`, '');
  out.push(`- Input: ${plural(r.input.lines, 'line')}; ${r.input.profile ? `profile ${md(r.input.profile)} only` : `${plural(r.summary.profiles, 'profile')} checked`}; ${plural(r.summary.organizations, 'organization')}; ${plural(r.summary.unsupported, 'construct')} passed over`);
  out.push(`- Findings: ${md(findingsLine(r))}`);
  out.push(`- Result: **${md(r.result.text)}**`, '');
  out.push('## Findings', '');
  if (!r.findings.length) out.push('None.', '');
  else {
    out.push('| Level | Check | Where | Message | Profiles |', '| --- | --- | --- | --- | --- |');
    for (const f of r.findings) out.push(`| ${f.severity} | ${f.id} | ${md(f.at)} | ${md(f.message)} Fix: ${md(f.fix)} | ${f.profiles.length ? md(listText(f.profiles, 8)) : ''} |`);
    out.push('');
  }
  if (explain) {
    out.push('## Basis', '');
    const seen = new Set();
    for (const f of r.findings) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push(`### ${f.id}`, '');
      for (const b of f.basis) out.push(`- ${md(b.text)} (${md(b.source)}, <${b.url}>)`);
      if (f.own) out.push(`- The tool's own choice: ${md(f.own)}`);
      out.push('');
    }
  }
  if (r.unsupported.length) {
    out.push('## Not read', '');
    for (const u of r.unsupported) out.push(`- ${md(u.at)}: ${md(u.construct)}`);
    out.push('');
  }
  for (const n of r.notes) out.push(`Note: ${md(n)}`, '');
  out.push(`${md(r.notice)}`, '');
  return `${out.join('\n')}`;
}

export function toJson(r, { explain = false } = {}) {
  const out = { ...r, findings: r.findings.map((f) => (explain ? f : { ...f, basis: undefined, own: undefined })) };
  return `${JSON.stringify(out, null, 2)}\n`;
}

const SARIF_LEVEL = { error: 'error', warning: 'warning', info: 'note' };

// SARIF 2.1.0: the checks as rules of the driver, and one result for each finding with its file, line and column.
export function toSarif(r) {
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'fabric-config-check',
            version: r.version,
            informationUri: URI,
            rules: RULES.map((x) => ({
              id: x.id,
              name: x.id,
              shortDescription: { text: x.summary },
              help: { text: `${x.fix} (${x.kind})` },
              defaultConfiguration: { level: SARIF_LEVEL[x.severity] },
              properties: { kind: x.kind }
            }))
          }
        },
        artifacts: [{ location: { uri: r.input.file } }],
        results: r.findings.map((f) => ({
          ruleId: f.id,
          ruleIndex: RULES.findIndex((x) => x.id === f.id),
          level: SARIF_LEVEL[f.severity],
          message: { text: `${f.message} Fix: ${f.fix}` },
          locations: [{ physicalLocation: { artifactLocation: { uri: f.file }, region: { startLine: f.line, startColumn: f.column } } }],
          properties: { kind: f.kind, profiles: f.profiles }
        })),
        properties: { notice: r.notice, result: r.result.text, sources: SOURCES.map((s) => s.url) }
      }
    ]
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}

// The list of checks, for --list-checks.
export function listChecksText() {
  const width = Math.max(...RULES.map((x) => x.id.length));
  const out = ['fabric-config-check checks', ''];
  for (const x of RULES) out.push(`  ${x.id.padEnd(width)}  ${x.severity.padEnd(7)}  ${x.kind.padEnd(13)}  ${x.summary}`);
  out.push('', 'A documented check rests on a page of the Fabric documentation or on its sample file; a best practice check is this tool\'s own choice and says so in its message. An input check is about the file itself.', '');
  return out.join('\n');
}

export function listChecksMarkdown() {
  const out = ['# fabric-config-check checks', '', '| Check | Level | Kind | What it looks at |', '| --- | --- | --- | --- |'];
  for (const x of RULES) out.push(`| ${x.id} | ${x.severity} | ${x.kind} | ${md(x.summary)} |`);
  out.push('');
  return out.join('\n');
}

export function listChecksJson() {
  return `${JSON.stringify(RULES.map((x) => ({ id: x.id, severity: x.severity, kind: x.kind, summary: x.summary, fix: x.fix, basis: x.basis, own: x.own ?? null })), null, 2)}\n`;
}
