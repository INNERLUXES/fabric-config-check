# Inputs

The tool takes one path: a configtx.yaml, or a folder that holds `configtx.yaml` or `configtx.yml` (the first wins when
both exist). There is no configuration file, no environment variable and no standard input; the options are on the
command line.

```
fabric-config-check <configtx.yaml | folder> [--profile <name>] [--format text|markdown|json|sarif]
                    [--json] [--min-severity <level>] [--fail-on <level>] [--explain] [--list-checks]
```

| Option | Meaning |
| --- | --- |
| `--profile <name>` | check one profile of `Profiles`, and the organizations it uses; the name must be in the file |
| `--format <name>` | `text` (default), `markdown`, `json` or `sarif` |
| `--json` | the same as `--format json` |
| `--min-severity <level>` | the lowest level shown: `info` (default), `warning` or `error` |
| `--fail-on <level>` | the lowest level that fails the run: `info`, `warning` or `error` (default) |
| `--explain` | add the points of the documentation behind each finding to the text, markdown and JSON reports |
| `--list-checks` | list the checks with their level and kind, in text, markdown or JSON, and exit |
| `--help`, `--version` | the usage, the version |

Every option that takes a value takes it once. A value may not start with `--`. `-` (standard input) and an address
such as `https://...` are refused. Two paths are a usage error: check two networks in two runs.

## The YAML that is read

The reader of `src/yaml.js` reads the forms that Fabric sample files use. Everything else is listed, not skipped.

| Form | How it is read |
| --- | --- |
| block mapping and block sequence | indentation by spaces; a tab in the indentation is an error; a sequence may sit at the same indent as its key |
| plain scalar | typed as bool (`true`, `false` in three cases), int, float, null (`~`, `null`, empty) or string |
| quoted scalar | single quoted with `''`; double quoted with `\\`, `\"`, `\n`, `\t`, `\xNN`, `\uNNNN`, `\UNNNNNNNN` and the other YAML escapes; an unknown escape is an error |
| comment | `#` at the start of a line or after a space, outside quotes |
| flow list and flow map | `[a, b]` and `{k: v}`, nested up to 16 levels, over one line or several |
| anchor and alias | `&name` on a value or on its own after a key or dash; `*name` as a value, an item or inside a flow collection; the anchor must come before the alias |
| merge key | `<<: *a` and `<<: [*a, *b]` and `<<:` with an inline mapping; keys written in the mapping win, then the first source |
| document start | `---` once, at the top |

| Form that is listed and not read | Finding |
| --- | --- |
| block scalar (`|`, `>`) | `unsupported-construct`, its lines passed over |
| tag (`!!str`, `!name`) | `unsupported-construct`, the value is still read without the tag |
| complex key (`?`) | `unsupported-construct`, its lines passed over |
| second document, content after `...` | `unsupported-construct`, the rest is not read |
| directive (`%YAML`) | `unsupported-construct` |
| quoted string over several lines | `unsupported-construct`, its lines passed over |
| merge key whose value is not a mapping or a list of mappings | `unsupported-construct`, nothing merged |

| Form that stops the reader | Finding |
| --- | --- |
| tab in the indentation, a duplicate key in one mapping, an alias with no anchor before it, a line that does not fit the structure, a quoted string or flow collection that is not closed, text after a quoted string, nesting past the limits | `config-unreadable` with the line |

Line ends may be LF, CRLF or CR, and the file may be UTF-8 with or without a byte order mark or UTF-16 with one; the
same findings are written for each.

## Output paths

The path shown in a report is relative to the folder the command runs in, with forward slashes on every system, and the
whole path when the file is outside that folder. A finding is `file:line`; the JSON, markdown and SARIF reports also
carry the column.
