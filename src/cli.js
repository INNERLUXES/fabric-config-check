// Command line: fabric-config-check <configtx.yaml or folder> [--profile <name>] [options]

import { readFileSync } from 'node:fs';
import { InputError, LIMITS, checkFile } from './check.js';
import { LEVELS } from './data.js';
import { listChecksJson, listChecksMarkdown, listChecksText, toJson, toMarkdown, toSarif, toText } from './report.js';
import { RULES } from './rules.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, sarif: toSarif };
const LISTS = { text: listChecksText, markdown: listChecksMarkdown, json: listChecksJson };

export const USAGE = `Usage: fabric-config-check <configtx.yaml | folder> [--profile <name>] [options]

Checks the configtx.yaml of a Hyperledger Fabric network for governance and safety gaps before members join a
consortium network: a single organization in a channel or consortium, Admins policies set to ANY, Readers and Writers
set to ANY, endorsement policies set to ANY, organizations without anchor peers, the solo orderer, Raft and BFT
consenter sets that are too small or on one host, consenters without TLS certificates, missing batch settings, missing
or disabled capabilities, organizations without an ID or an MSPDir, and duplicate MSP IDs. It reads the file as text
with a small YAML reader of its own, lists every construct it does not read, and is not an audit: it runs nothing,
fetches nothing, reads no clock and writes nothing to disk. A folder is searched for configtx.yaml and configtx.yml.

Options:
  --profile <name>          check one profile of the Profiles section, and the organizations it uses
  --format <name>           text, markdown, json or sarif (default: text)
  --json                    the same as --format json
  --min-severity <level>    the lowest level of a finding that is shown: ${LEVELS.join(', ')} (default: info)
  --fail-on <level>         the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: error)
  --explain                 show the points of the documentation behind each finding (text, markdown and JSON)
  --list-checks             list the checks with their level and kind, and exit
  --help                    show this text
  --version                 show the version

Checks: ${RULES.map((r) => r.id).join(', ')}.

Exit codes: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

export function parseArgs(argv) {
  const o = { path: null, profile: null, format: null, json: false, minSeverity: null, failOn: null, explain: false, listChecks: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file or a folder');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--json') o.json = true;
    else if (a === '--list-checks') o.listChecks = true;
    else if (a === '--profile') o.profile = once(a, o.profile, next());
    else if (a === '--format') o.format = once(a, o.format, next());
    else if (a === '--min-severity') o.minSeverity = once(a, o.minSeverity, next());
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '-') throw new Error('reading from standard input is not supported; give a file or a folder');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else {
      if (o.path !== null) throw new Error('give one file or folder; check two networks in two runs');
      o.path = a;
    }
  }
  if (o.json) {
    if (o.format !== null && o.format !== 'json') throw new Error(`--json and --format ${o.format} ask for two formats; give one`);
    o.format = 'json';
  }
  if (o.format === null) o.format = 'text';
  if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or sarif)`);
  for (const [flag, v] of [['--min-severity', o.minSeverity], ['--fail-on', o.failOn]]) if (v !== null && !LEVELS.includes(v)) throw new Error(`${flag}: unknown level ${v} (${LEVELS.join(', ')})`);
  if (o.listChecks && o.format === 'sarif') throw new Error('--list-checks has no SARIF form; use text, markdown or json');
  if (!o.help && !o.version && !o.listChecks) {
    if (o.path === null) throw new Error('give the configtx.yaml to check, or the folder that holds it, such as fabric-config-check configtx.yaml');
    if (isUrl(o.path)) throw new Error('give a local path; the tool never fetches a URL');
    if (o.explain && o.format === 'sarif') throw new Error('--explain adds the documentation points to the text, markdown and JSON reports; the sarif format has no place for them');
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`fabric-config-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (o.listChecks) {
    io.out(LISTS[o.format]());
    return 0;
  }
  let report;
  try {
    report = await checkFile({ path: o.path, profile: o.profile, minSeverity: o.minSeverity ?? 'info', failOn: o.failOn ?? 'error', version: VERSION, limits: { ...LIMITS, ...(limits ?? {}) }, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`fabric-config-check: no result, the input has ${error.problems.length === 1 ? 'a problem' : 'problems'}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`fabric-config-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report, { explain: o.explain }));
  return report.result.pass ? 0 : 1;
}
