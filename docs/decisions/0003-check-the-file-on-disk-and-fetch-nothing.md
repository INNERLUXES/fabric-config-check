# 3. Check the file on disk, and fetch nothing

## Status

Accepted

## Context

Some facts about a network live elsewhere: the configuration on the ledger of a running channel, the certificates in the
MSP folders, the nodes' own settings, the latest release of Fabric, the pages of the documentation. A check could call a
node, open the certificates, download the latest sample or the documentation. Each would need the network and often a
key, would make the result depend on the state of a network or a server, and would let a file in a pull request make the
pipeline reach an address it names.

What a consortium needs first, before members join, is a list of what to look at and where: the policies, the number of
organizations, the consenters, the capabilities, as the repository holds them.

## Decision

1. The tool reads the file it is given, and nothing else. It fetches nothing, calls no node, opens no certificate, needs
   no key, runs no program and calls no service.
2. The settings the checks compare (the ImplicitMeta rule text, the orderer types, the consenter fields, the capability
   values) are the tool's own and are listed in docs/method.md, and the public pages each check rests on are named in
   src/data.js and research/sources.md, each fetched and read before it was listed, with a copy of its text under
   research/sources; the tool never looks them up while it runs.
3. The tool lists what to look at and what to change; it changes nothing.

## Consequences

- The result depends only on the file, and a run needs no network access, no secret and no node.
- A channel that only exists as a running network is not checked; check out the file it was built from.
- When the documentation or the sample file changes a setting the checks compare, the checks are updated in a release,
  with a test.
