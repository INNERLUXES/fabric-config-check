# fabric-config-check

Fabric config check. Give it the configtx.yaml of a Hyperledger Fabric network. It reads the file as text with a small
strict YAML reader of its own, runs nothing, and lists the governance and safety gaps it can see before members join a
consortium network: a single organization in a channel or consortium, channel and application policies whose Admins
rule is `ANY Admins` so that any one member can change the channel, Readers and Writers set to `ANY`, endorsement
policies set to `ANY`, organizations with no anchor peers, the solo orderer, Raft or BFT consenter sets that are too
small or on a single host, consenters with no TLS certificate paths, missing batch settings, missing or disabled
capabilities, organizations with no MSPDir or ID, and duplicate MSP IDs. Every finding has its id, level, message and
file and line, and the run exits with a code a pipeline can act on.

**It is an input to a governance review before members join a network: not a security audit and not a guarantee that
the network is safe.** It is not an auditor. It reads one file only: it runs nothing, deploys nothing, fetches nothing
and reads no clock, so it does not see the nodes, the certificates, the signature policies in full, the channel
configuration on a running ledger or the contracts between the members; the checks are a heuristic. A clean run means
only that none of the forms of its checks were found in the file, and the members still have to review the network
before they join it.

A consortium network is only as well governed as its configtx.yaml says. The policies decide who can change a channel,
who can add a member, who must endorse a chaincode and who orders the blocks, and they are agreed once, when the network
is set up. The Hyperledger Fabric documentation describes the policies, the capabilities and the ordering service
settings (https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html and
https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html). Before an organization
signs up to a network, it needs the list: which profiles, which settings, which lines. This tool writes that list from
the file, on every change.

- **One check per setting.** Eighteen checks, each with what it looks at, what it cannot see, the public pages it rests
  on and what to change. Each check is either documented (the setting is named in the Fabric documentation or its sample
  file) or a best practice of this tool, and its message says which.
- **A YAML reader of its own.** Mappings, sequences, anchors and aliases, merge keys, quoted strings, comments and short
  flow lists, with the line of every value, also when it comes through an alias; what it does not read (block scalars,
  tags, complex keys, a second document) is listed in the report, never skipped.
- **Profiles, not files.** Every check looks at one profile after the aliases and merge keys are applied; a setting that
  several profiles share is one finding at the line where it is written, with the profiles listed. `--profile` checks
  one.
- Reports as text, markdown, JSON and SARIF, with an exit code for a pipeline: `0` no finding at or above the
  `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network.

```
npm test
```

```
tests 170
pass 168
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link or a device (links to a file and to a folder, and `/dev/null` named as a file); they are guarded with
`process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same tests
with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/fabric-config-check.git
cd fabric-config-check
node bin/fabric-config-check.js examples/weak
```

Or without a clone, in the folder of your own network:

```
npx --yes github:INNERLUXES/fabric-config-check configtx.yaml
```

`examples/` holds two made-up configurations of a harbor consortium. `examples/weak/configtx.yaml` has three profiles
that between them hold a finding of every check except the two that cannot appear in a file that was read: a solo
orderer with one organization, two Raft consenters on one host with a missing certificate, three BFT consenters, a
policy that says `ANY Admins`, an organization with no MSPDir, one with no ID, a duplicate MSP ID, a capability level that
is off, and a block scalar the reader lists and does not read. `examples/good/configtx.yaml` passes at error and warning
level; the two notes it still shows are the documented defaults for Readers and Writers. The configurations are
minimal illustrations, never used to build a channel, with hosts on the reserved `.test` domain.

## Usage

```
fabric-config-check <configtx.yaml | folder> [--profile <name>] [options]
```

```
--profile <name>          check one profile of the Profiles section, and the organizations it uses
--format <name>           text, markdown, json or sarif (default: text)
--json                    the same as --format json
--min-severity <level>    the lowest level of a finding that is shown: info, warning, error (default: info)
--fail-on <level>         the lowest level of a finding that fails the run: info, warning, error (default: error)
--explain                 show the points of the documentation behind each finding (text, markdown and JSON)
--list-checks             list the checks with their level and kind, and exit
--help                    show the usage
--version                 show the version
```

Name one file, or one folder that holds `configtx.yaml` or `configtx.yml`. The path in the report is relative to the
folder you run the command in, with forward slashes on every system, followed by the line.

The report of the weak example starts with what was read, the profiles, the findings in one line, and the checks with the
number of findings of each; then the findings, errors first, each with what to change; then what was not read:

```
fabric-config-check: examples/weak/configtx.yaml
input: 227 lines, 5,775 bytes; 3 profiles checked; 5 organizations; 1 construct passed over
profiles: DevSolo, TwoNodeRaft and BftSmall
findings: 24 (6 error, 16 warning, 2 info)

Checks (18)

  check                   level    kind           findings
  config-unreadable       error    input          0
  unsupported-construct   warning  input          1
  no-profiles             error    input          0
  single-organization     warning  best practice  3
  admins-any              error    documented     1
  readers-writers-any     info     best practice  2
  endorsement-any         warning  documented     1
  anchor-peers-missing    warning  documented     1
  orderer-solo            error    documented     1
  raft-consenter-count    warning  best practice  1
  bft-consenter-count     warning  documented     1
  consenters-single-host  warning  best practice  1
  consenter-tls-missing   error    documented     1
  batch-settings-missing  warning  documented     3
  capabilities-missing    warning  documented     3
  capability-disabled     warning  documented     1
  org-msp-incomplete      error    documented     2
  duplicate-msp-id        error    documented     1
```

A finding names its check, its level, the file and the line where the setting is written, the profiles that use it and
what to change. With `--explain` it also gives the points of the documentation behind it and, for a best practice check,
the tool's own choice:

```
  ERROR    orderer-solo            examples/weak/configtx.yaml:163
           OrdererType is solo. The current sample file says Solo was removed in V3.0, and the documentation says a production network should use a multi-node ordering service.
           profiles: DevSolo
           fix: Use etcdraft, or BFT where the release supports it, with several ordering nodes.
```

The end of the report lists what the reader did not read, the notes, the notice and the result:

```
           fix: Confirm that open reading and submitting is intended. The documentation defaults are ANY, and MAJORITY on Writers would need several organizations to sign every submission, so this is a note and not a fault.

Not read (1)

  examples/weak/configtx.yaml:27  a block scalar (| or >)

note: 1 construct was passed over by the reader; each is listed as an unsupported-construct finding and what it holds was not checked

This report is an input to a governance review before members join a network: not a security audit and not a guarantee that the network is safe.

RESULT: FAIL - 6 findings at or above error (6 error, 16 warning, 2 info)
```

The good example passes:

```

This report is an input to a governance review before members join a network: not a security audit and not a guarantee that the network is safe.

RESULT: PASS - no finding at or above error (2 info)
```

## How the file is read

1. The path is resolved against the folder you run the command in; a folder is searched for `configtx.yaml` and then
   `configtx.yml`. A link, a device or a file over 2 MB is refused, and so is a file that is not UTF-8 (or UTF-16 with a
   byte order mark) or holds a null byte, with exit code `2` and no report.
2. The YAML reader of the tool reads the file with the line and column of every value. An alias is the node of its
   anchor and a merge key (`<<: *name`) brings in the keys of a mapping, with the keys written in the mapping winning;
   a value that comes through them keeps the line where it is defined, so a finding points at the line to change.
3. Every profile of the `Profiles` section is checked on its own, with its `Application`, `Orderer`, `Consortiums` and
   `Capabilities` as `configtxgen` would gather them. The organizations it uses are checked for an ID, an MSPDir and a
   unique MSP ID.
4. What the reader does not read is listed as an `unsupported-construct` finding and in the "Not read" part of the
   report, and a value it passed over is never reported as missing. A file that is not well formed is one
   `config-unreadable` finding that names the line.

[docs/method.md](docs/method.md) says what each check reads, and [docs/inputs.md](docs/inputs.md) lists the YAML forms.

## What it checks

| Check | Level | Kind | What it reports |
| --- | --- | --- | --- |
| `single-organization` | warning | best practice | one organization in the Application section of a profile, or in a consortium |
| `admins-any` | error | documented | an Admins policy of `ANY Admins` in the Application, Orderer or channel section: any one member can change it |
| `readers-writers-any` | info | best practice | Readers or Writers set to `ANY`; the documented default, so a note to confirm it is intended |
| `endorsement-any` | warning | documented | `LifecycleEndorsement` or `Endorsement` set to `ANY` |
| `anchor-peers-missing` | warning | documented | an organization used in the Application section with no `AnchorPeers` |
| `orderer-solo` | error | documented | `OrdererType: solo` |
| `raft-consenter-count` | warning | best practice | an etcdraft orderer with fewer than 3 consenters, or none |
| `bft-consenter-count` | warning | documented | a BFT orderer with fewer than 4 consenters in `ConsenterMapping` |
| `consenters-single-host` | warning | best practice | all consenters on one host |
| `consenter-tls-missing` | error | documented | a consenter with no `ClientTLSCert` or no `ServerTLSCert` |
| `batch-settings-missing` | warning | documented | no `BatchTimeout`, no `BatchSize`, or one of its three values missing |
| `capabilities-missing` | warning | documented | no `Capabilities` for the channel, Application or Orderer group of a profile |
| `capability-disabled` | warning | documented | a `Capabilities` group with no level set to true, such as `V2_0: false` |
| `org-msp-incomplete` | error | documented | an organization with no `ID` or no `MSPDir` |
| `duplicate-msp-id` | error | documented | two organization definitions with the same MSP ID |
| `no-profiles` | error | input | no `Profiles` section, or an empty file |
| `config-unreadable` | error | input | the file is not YAML the reader can follow |
| `unsupported-construct` | warning | input | a construct the reader passed over, listed with its line |

A documented check names a setting that a page of the Fabric documentation or its sample configtx.yaml describes. A
best practice check is this tool's own choice, and its message says "a best practice of this tool, not a rule in the
Fabric documentation". `--list-checks` shows the kind of each check. Three of the levels are worth a word:

- `readers-writers-any` is only a note. The documentation defaults for Readers and Writers are `ANY`, and a `MAJORITY`
  rule on Writers would need several organizations to sign every submission, so the tool asks for the choice to be
  deliberate and does not ask for `MAJORITY`.
- `anchor-peers-missing` rests on the page that says at least one anchor peer must be defined in the channel
  configuration. The current sample file no longer lists `AnchorPeers`, and a channel update can set them after the
  channel exists, which the tool cannot see; the finding says so.
- `batch-settings-missing` asks for the values to be written. The pages the tool reads do not say what `configtxgen`
  fills in when a value is left out.

## What is not checked

[docs/limits.md](docs/limits.md) lists what the tool cannot see. Among them: a network that only exists as running
nodes, the meaning of signature policies such as `AND('A.admin', 'B.admin')`, the node settings (`core.yaml`,
`orderer.yaml`), whether the certificate and MSP paths point at files, ACL entries, private data collections,
chaincode endorsement policies, and which release of Fabric the file is written for. A construct the YAML reader does
not read is not checked either, and the report says where it is.

## Formats

`--format text` (the default) is for a terminal. `--format markdown` is a report for a job summary or a pull request, with
a table of findings. `--format json` writes every finding with its `id`, `severity`, `message`, `file`, `line`,
`column`, `profiles` and `fix`, and with `--explain` its points of the documentation. `--format sarif` writes SARIF
2.1.0, with the checks as rules and a result for each finding with its file, line and column, for code scanning. The
saved output of the examples is in [examples/output](examples/output).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | no finding at or above the `--fail-on` level (default `error`) |
| `1` | a finding at or above it |
| `2` | a usage error, or an input error such as a path that does not exist, a link, a file that is not text or is too large, or a profile that is not in the file; there is no report |

Findings below `--min-severity` are not shown, and still count for the result.

## Limits

The tool reads one file; it fetches nothing and connects to nothing. A run reports the forms of docs/method.md that the
file holds. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size limits: 2 MB for a file, 200,000
lines, lines of 20,000 characters, mappings nested up to 64 deep, flow collections up to 16 deep and 400,000 values.
[docs/threat-model.md](docs/threat-model.md) lists the risks of reading a file from a pull request and their controls,
and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the file, runs the reader and the checks and builds the report of the run |
| `src/files.js` | the bounded reading of the file by its byte order mark, with no link followed |
| `src/yaml.js` | the YAML reader: anchors, aliases, merge keys, lines and columns, the list of what it does not read, with limits |
| `src/analyze.js` | the checks of the profiles and the organizations |
| `src/rules.js` | the checks, their levels and kinds, and the result |
| `src/report.js`, `src/text.js`, `src/size.js` | the text, markdown, JSON and SARIF output, the cleaning of text from the input and number formats |
| `src/data.js` | the public pages and the points the checks rest on, in this project's own words |
| `research/sources/` | text copies of the pages, as they were read |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

The checks rest on the Hyperledger Fabric documentation and its sample configtx.yaml, nothing else. Each page was read
before it was listed, a text copy of it is kept in [research/sources](research/sources), and
[research/sources.md](research/sources.md) has a note on each. [docs/rules-and-sources.md](docs/rules-and-sources.md)
lists every check with the points of the pages it rests on, what it cannot see and what to change. Where a check is a
best practice and not a rule in the documentation, it says so.

- Policies: https://hyperledger-fabric.readthedocs.io/en/latest/policies/policies.html
- Channel policies: https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/channel_policies.html
- Using configtx.yaml to build a channel configuration: https://hyperledger-fabric.readthedocs.io/en/latest/create_channel/create_channel_config.html
- Configuring and operating a Raft ordering service: https://hyperledger-fabric.readthedocs.io/en/latest/raft_configuration.html
- Capabilities: https://hyperledger-fabric.readthedocs.io/en/latest/capabilities_concept.html
- Gossip data dissemination protocol: https://hyperledger-fabric.readthedocs.io/en/latest/gossip.html
- The sample configtx.yaml: https://github.com/hyperledger/fabric/blob/main/sampleconfig/configtx.yaml

## Background

The governance of a consortium network is written into its channel configuration when the network is set up: who may
change a channel, who may join it, who must endorse a chaincode and which nodes order the blocks. These settings are read
side by side when a consortium prepares to launch a network or brings in engineers to implement or review it. How such
work is staffed and carried out is described on the page
[Blockchain Implementation Services](https://innerluxes.dev/blockchain/implementation).

## License

MIT
