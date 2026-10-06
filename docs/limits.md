# Limits

The tool is not an auditor. It reads one configtx.yaml as text, and its result is an input to a governance review before
members join a network: not a security audit and not a guarantee that the network is safe. A clean run means only that
none of the forms in [method.md](method.md) were found in the file.

## What it cannot see

- **A network that only exists as running nodes.** It reads the file you give it, not the channel configuration on the
  ledger. A channel that was changed by updates after it was created can differ from the file it was created from.
- **Anchor peers set by a channel update.** The `anchor-peers-missing` check reads `AnchorPeers` in the file; a file
  for the current release may leave them out and set them after the channel exists.
- **The values `configtxgen` fills in.** A setting left out of the file is reported as not written; the tool does not
  know what the binary does with it.
- **The meaning of a signature policy.** A rule such as `OR('A.member')` or `AND('A.admin', 'B.admin')` is not parsed.
  The tool compares ImplicitMeta rule text (`ANY Admins`, `MAJORITY Endorsement`) and does not weigh a signature rule,
  so a weak signature rule on Admins is not reported, and an organization-level policy that lets any member act as an
  admin is not either.
- **Node-level settings.** `core.yaml`, `orderer.yaml`, the TLS settings of the nodes, the certificates the paths point
  to (the tool never opens them), the MSP folders, the node OU configuration, the ACL entries, the private data
  collections, the chaincode endorsement policies of a chaincode and the state of the certificate authorities.
- **Whether the paths exist.** `MSPDir`, `ClientTLSCert` and `ServerTLSCert` are checked for being written, not for
  pointing at a file.
- **Hosts that are the same machine under different names.** `consenters-single-host` compares the written `Host`
  values.
- **The operational facts.** Who holds the keys, how the organizations are run, how upgrades are agreed, and the
  contracts between the members.
- **Another release's rules.** The pages the checks rest on are the latest documentation and the sample file of the
  main branch. A file written for an older release (a Solo orderer, a system channel, `Consortiums`) is read and the
  settings it holds are checked, but the tool does not know which release the file is for.

## What the YAML reader does not read

[inputs.md](inputs.md) lists the forms. A construct the reader passes over (a block scalar, a tag, a complex key, a
second document, a quoted string over several lines, a merge key whose value is not a mapping) is reported as an
`unsupported-construct` finding and in the "Not read" list. What it holds was not checked, and a clean run says nothing
about it. A file that is not well formed is one `config-unreadable` finding, and nothing else in it is checked.

## Size limits

| Limit | Value |
| --- | --- |
| file size | 2 MB |
| lines | 200,000 |
| a line | 20,000 characters |
| nesting of mappings and sequences | 64 levels |
| nesting of a flow list or map | 16 levels |
| values (nodes) in the file | 400,000 |
| lines of one flow collection | 500 |

Input past a limit is a `config-unreadable` finding or, for the file size, an input error with exit code `2`. The tool
never passes a run because something could not be read.

## What a run does not do

It fetches nothing and connects to nothing, runs no program, evaluates nothing it reads, reads no clock and no
locale, follows no symbolic link and writes nothing to disk. [threat-model.md](threat-model.md) lists the risks of
reading a file from a pull request and their controls.
