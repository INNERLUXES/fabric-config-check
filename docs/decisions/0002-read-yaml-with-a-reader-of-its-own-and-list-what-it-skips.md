# 2. Read YAML with a reader of its own, and list what it does not read

## Status

Accepted

## Context

The facts the checks need sit in the text of configtx.yaml: the policies of each section, the organizations, the
consenters, the batch settings, the capabilities and the profiles that gather them. A YAML library would read more of
the language, but it would be code that this project does not review, it would apply tags and types by rules of its own,
it would resolve aliases and merge keys in ways the tool cannot tie back to a line, and a library that builds objects
from keys of the file has to be trusted not to be moved by a key such as `__proto__`. A library that expands aliases can
also be made slow by a file of a few kilobytes.

Fabric sample files use a small part of YAML. A reader of that part, written for this tool, can keep the line and column
of every node, keep the line of a value that comes through an alias, and stop at limits.

## Decision

1. The file is read by src/yaml.js, a reader of the tool's own for the forms that Fabric sample files use: block
   mappings and sequences, plain and quoted scalars, comments, short flow collections, anchors, aliases and merge keys.
2. Every construct the reader does not read is returned with its line and shown as a finding and in a list. The reader
   never skips a construct without a word, and a check never takes a value it did not read for a value that is missing.
3. A file that is not well formed stops the reader with an error and a line, and the run reports one finding; the tool
   does not guess at the rest of the file.
4. An alias is the node of its anchor, never a copy, and a merge copies the entries of a mapping and not what is below
   them, so the work does not grow with the number of aliases. The only recursion is over the nesting of the document and
   of a flow collection, and both stop at a limit.
5. The tool applies no tag, runs nothing and evaluates nothing. The checks are a heuristic over the text as written, and
   every report says so; docs/method.md says what each check reads and docs/limits.md what it cannot see. The result is
   an input to a governance review before members join a network: not a security audit and not a guarantee that the
   network is safe.

## Consequences

- The tool needs no install and no network, reads a file that `configtxgen` has never seen, and the same file gives the
  same report on Linux, Windows and macOS.
- A file that uses YAML the reader does not read gets findings that say so, and the values in those places are not
  checked; the fix is to write them in a plain form.
- What only `configtxgen` or the running network knows is not seen (docs/limits.md).
