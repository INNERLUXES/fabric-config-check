# Method

This document says how the tool reads a configtx.yaml and what each check looks at. The tool is an input to a governance
review before members join a network: not a security audit and not a guarantee that the network is safe. A clean run
means only that none of the forms below were found in the file.

## Reading the file

1. The path is resolved against the folder the command runs in. A folder is searched for `configtx.yaml` and then
   `configtx.yml`. A link, a device or a pipe is refused; a file over 2 MB is refused before it is read; a file with a
   null byte, or bytes that are not UTF-8 (or UTF-16 with a byte order mark), is refused with exit code `2` and no report.
2. The text goes to a YAML reader of the tool's own (`src/yaml.js`). It reads the parts of YAML that Fabric sample
   files use:
   - block mappings and block sequences, with a sequence allowed at the same indent as its key, and a mapping that
     starts on the line of its dash;
   - plain scalars (typed as bool, int, float, null or string), single quoted and double quoted scalars with their
     escapes, and a quoted scalar as a key;
   - comments, with a `#` inside a quoted string kept;
   - short flow lists and maps, nested up to 16 levels and allowed over several lines;
   - anchors (`&name`) and aliases (`*name`), where an alias is the node of its anchor and an anchor must come before
     its alias;
   - merge keys (`<<: *name` and `<<: [*a, *b]`), where a key written in the mapping wins over a merged one and the
     first source wins over a later one;
   - a document start marker `---` at the top.
3. Every node keeps the line and column where it is written. A value that comes through an alias or a merge key keeps
   the line of the place where it is defined, so a finding points at the line to change.
4. A construct the reader does not read is listed: a block scalar (`|` or `>`), a tag such as `!!str`, a complex key
   (`?`), a second document or content after `...`, a directive, a quoted string over several lines, and a merge key
   whose value is not a mapping. Each one is returned with its line, shown as an `unsupported-construct` finding and
   in the "Not read" list of the text report. A value the reader passed over is never reported as missing.
5. A file that is not well formed stops the reader with one `config-unreadable` finding that names the line: a tab in
   the indentation, a duplicate key, an alias with no anchor before it, a line that does not fit the structure, a
   quoted string or a flow list that is not closed, nesting past 64 levels.

## The profile is the unit

`configtxgen` turns a profile of the `Profiles` section into a channel or a consortium, so every check looks at one
profile at a time: its `Application`, `Orderer`, `Consortiums` and `Capabilities` after the aliases and merge keys are
applied. A setting that several profiles share through an alias is one finding at the line where it is written, with
the profiles that use it listed. `--profile <name>` checks one profile and the organizations it uses; an unknown name
stops the run with exit code `2` and the profiles of the file.

Organizations are checked wherever they are used (the `Application` and `Orderer` lists and every consortium) and, for a
run over the whole file, in the top-level `Organizations` list too. The same organization written twice through an alias
or a merge key is one organization.

## The checks

Each check says whether it is documented or a best practice. A documented check names a setting that a page of the
Hyperledger Fabric documentation or its sample configtx.yaml describes. A best practice check is the tool's own
choice; its message says so, and so does `--list-checks`. [rules-and-sources.md](rules-and-sources.md) lists the pages
and the points of each page behind each check.

| Check | Looks at | Level |
| --- | --- | --- |
| `single-organization` | the number of distinct organizations (by MSP ID) in a profile's `Application.Organizations` and in each `Consortiums.<name>.Organizations`; exactly one is reported | warning |
| `admins-any` | the `Rule` of `Policies.Admins` in the `Application`, `Orderer` and channel (profile level) sections; `ANY Admins`, with spaces and case folded | error |
| `readers-writers-any` | the `Rule` of `Readers` and `Writers` in the `Application` and `Orderer` sections; `ANY Readers` and `ANY Writers`; one finding for the group | info |
| `endorsement-any` | the `Rule` of `LifecycleEndorsement` and `Endorsement` in the `Application` section; a rule that starts with `ANY` | warning |
| `anchor-peers-missing` | each organization in `Application.Organizations`: no `AnchorPeers` key, or an empty one | warning |
| `orderer-solo` | `Orderer.OrdererType` equal to `solo`, in any case | error |
| `raft-consenter-count` | the length of `Orderer.EtcdRaft.Consenters` for an etcdraft orderer: none, or fewer than 3 | warning |
| `bft-consenter-count` | the length of `Orderer.ConsenterMapping` for a BFT orderer: none, or fewer than 4 | warning |
| `consenters-single-host` | two or more consenters whose `Host` values are all the same (case folded) | warning |
| `consenter-tls-missing` | each consenter of either list: no `ClientTLSCert` or no `ServerTLSCert`, or an empty one | error |
| `batch-settings-missing` | `Orderer.BatchTimeout`, `Orderer.BatchSize`, and when `BatchSize` is a mapping its `MaxMessageCount`, `AbsoluteMaxBytes` and `PreferredMaxBytes` | warning |
| `capabilities-missing` | the `Capabilities` of the channel (profile level), of `Application` when the profile has one and of `Orderer` when the profile has one | warning |
| `capability-disabled` | a `Capabilities` group that has entries and none of them set to `true`, for example `V2_0: false` | warning |
| `org-msp-incomplete` | each organization: no `ID`, or no `MSPDir`, or an empty one | error |
| `duplicate-msp-id` | two organization definitions with the same `ID`, counting an alias or a merge copy of one definition as one | error |
| `no-profiles` | no `Profiles` section, or an empty one, or an empty file | error |
| `config-unreadable` | the file is not YAML the reader can follow | error |
| `unsupported-construct` | a construct the reader passed over | warning |

### Why some levels are what they are

- `admins-any` is an error because the Admins policy is the modification policy of its group in the documentation, and
  the sample file and the documented defaults use `MAJORITY Admins`; `ANY Admins` lets the admins of any one
  organization change the group alone.
- `readers-writers-any` is only a note. The documented defaults for Readers and Writers are `ANY`, and a `MAJORITY`
  rule on Writers would need several organizations to sign every submission, so the tool does not ask for it; it asks
  for the choice to be deliberate.
- `raft-consenter-count` and `consenters-single-host` are best practices of the tool. The documentation says a
  production network should use a multi-node ordering service and shows a set of three, and it never says that fewer
  than three is wrong or that consenters must be on separate hosts.
- `anchor-peers-missing` rests on the page that says at least one anchor peer must be defined in the channel
  configuration. The current sample file no longer lists `AnchorPeers`, and anchor peers can be set in a channel update
  after the channel exists, which the tool cannot see; the rule's own note says so.
- `batch-settings-missing` asks for the values to be written. The pages the tool reads do not say what `configtxgen`
  does when a value is left out, so the tool does not claim a missing value is a fault in the network, only that it is
  not written.
- A capability level is read as enabled when it is the boolean `true`. The tool does not ask for a particular level,
  because the right one depends on the versions of the binaries.

## Findings

Every finding has `id`, `severity`, `message`, `file`, `line` and `column`, `at` (`file:line`), the `profiles` that use
the setting, `fix`, and with `--explain` the points of the documentation behind it. They are sorted errors first, then
by line. `--min-severity` hides the findings below a level and says how many; a hidden finding still counts for the
result. The result is `FAIL` when a finding is at or above `--fail-on` (default `error`) and `PASS` otherwise.
