# Threat model

The tool is an input to a governance review before members join a network: not a security audit and not a guarantee that
the network is safe. This document is about the tool itself: what it touches, what a hostile configtx.yaml can try, and
what stops it.

## What the tool touches

- It reads the one file named on the command line, or the `configtx.yaml` or `configtx.yml` of the folder named. Nothing
  else is opened: the paths written in the file (MSP folders, certificates) are read as text and never opened, and no
  other file is read.
- It writes the report to standard output and its errors to standard error. It writes nothing to disk.
- It opens no network connection, fetches no URL it reads, follows no symbolic link, runs nothing it reads, evaluates
  nothing and reads no clock and no locale.

## What the input may hold

The file comes from a repository, and in a pipeline that checks every pull request it may be written by whoever opened
the pull request. Through it, a person can try to:

- make the tool read outside the file: a link named on the command line or in the folder, a path in the file that the
  tool might open, an address given as the path;
- exhaust the memory, the stack or the time: a file of many megabytes, a very long line, very many lines, mappings
  nested very deep, flow collections nested very deep, a chain of aliases that merge one another, thousands of aliases to
  one large node, long runs of quotes, colons or comment marks;
- move the result: a construct the reader passes over, a duplicate key, an alias that stands in for another value, a
  merge key that overrides a setting, an organization written twice, a profile name that looks like another;
- slip in something that is not text: a binary file named `configtx.yaml`, bytes that are not valid UTF-8 or UTF-16;
- rewrite the terminal or break the output: control characters, escape sequences, direction controls and line
  separators in a profile name, an organization name, a host or a construct;
- hide markup in the markdown report: a link, a table separator or a tag in a name;
- change how objects behave: a profile, a key or an organization named `__proto__`, `constructor` or `toString`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A link makes the tool read a file it was not given | The path is checked with `lstat` and a link is refused by name; the file is opened with `O_NOFOLLOW` where the system has it, and its type and size are taken from the open handle. A test puts links in the folder |
| The tool fetches, connects or runs something | No module of the network or of child processes is imported, nothing is evaluated, and a path that looks like an address is refused. A test checks the imports of src |
| The memory, the stack or the time is exhausted | The file has a size limit checked on the open handle before it is read; the reader has limits of lines, line length, nodes and nesting (docs/limits.md); the only recursion is over the nesting of the document and of a flow collection, and both stop at a limit with an error; aliases are shared nodes and are never expanded; the checks follow named keys and do not walk the whole tree. Tests check the time, with limits that widen under coverage only |
| An alias or a merge key hides a setting | Merged keys keep the line where they are defined, so a finding points at the place to change; a key written in a mapping is the one used, as YAML says, and a duplicate key in one mapping is an error |
| What the reader passes over hides a problem | Every construct passed over is an `unsupported-construct` finding with its line, and a value passed over is never reported as missing; a run does not pass because something could not be read |
| A binary file or bytes in another encoding are read as text | A null byte in UTF-8, an odd number of bytes in UTF-16 and bytes that are not valid make the file an input error with exit code `2` and no report |
| Text from the file rewrites the terminal | Every text from the input goes through `safeText`, which replaces control, line separator and direction characters and caps the length. A test puts escapes and direction controls in a profile name and an organization, in every format |
| Markup in a name changes the markdown report | The markdown report escapes the characters markdown gives a meaning to. A test writes a link into a profile name |
| `__proto__` changes how objects behave | Mappings are lists of entries searched by key, and no object is built with a key from the file. A test uses `__proto__`, `constructor` and `toString` as names |
| A device or a pipe hangs the tool | A path that is not a regular file or a folder is refused before it is read |
| The tool leaves files behind | Nothing is written to disk; there is no cache, no temporary file and no log. A test checks that a run leaves the folder as it was |

## Out of scope

Whether the network is safe, what the nodes do when they run, the forms docs/limits.md leaves out, who may change the
file in your repository, and where your pipeline keeps the output.
