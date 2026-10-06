# Changes

## 1.0.0

First release.

- Lists governance and safety gaps in the configtx.yaml of a Hyperledger Fabric network, with file and line, as an input
  to a governance review before members join a consortium network: not a security audit and not a guarantee that the
  network is safe. It reads the file as text, runs nothing, fetches nothing, opens no certificate, follows no symbolic
  link and reads no clock. The path may be the file or a folder that holds `configtx.yaml` or `configtx.yml`.
- A small strict YAML reader with no dependency for the forms Fabric sample files use: block mappings and sequences,
  plain, single quoted and double quoted scalars, comments, short flow collections, anchors, aliases and merge keys,
  with the line and column of every node and the line of a value that comes through an alias. A construct it does not
  read (a block scalar, a tag, a complex key, a second document, a directive, a quoted string over several lines, a
  merge key that is not a mapping) is listed with its line and never skipped; a file that is not well formed stops with
  the line. Limits of size, lines, line length, nodes and nesting.
- Eighteen checks in three levels, each documented or a best practice of the tool and saying which: a single
  organization in a channel or consortium (`single-organization`), `ANY Admins` (`admins-any`), `ANY` on Readers and
  Writers (`readers-writers-any`), `ANY` on the endorsement policies (`endorsement-any`), no anchor peers
  (`anchor-peers-missing`), the solo orderer (`orderer-solo`), fewer than three Raft consenters
  (`raft-consenter-count`), fewer than four BFT consenters (`bft-consenter-count`), consenters on one host
  (`consenters-single-host`), consenters without TLS certificates (`consenter-tls-missing`), missing batch settings
  (`batch-settings-missing`), missing or disabled capabilities (`capabilities-missing`, `capability-disabled`),
  organizations without an ID or an MSPDir (`org-msp-incomplete`), duplicate MSP IDs (`duplicate-msp-id`); and three
  checks about the input (`no-profiles`, `config-unreadable`, `unsupported-construct`).
- A setting that several profiles share through an alias is one finding at the line where it is written, with the
  profiles that use it listed; `--profile` checks one profile and the organizations it uses.
- Reports as text, markdown, JSON and SARIF 2.1.0; every finding has its id, severity, message, file, line and column;
  `--min-severity`, `--fail-on`, `--explain` with the points of the documentation behind each finding, and
  `--list-checks`. Exit code `0` when no finding is at or above the fail-on level, `1` when one is, `2` for a usage or
  input error, with no result.
- Plain text copies of the public pages the checks rest on, under research/sources, with a note on each page.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
