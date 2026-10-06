# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "fabric-config-check security", or use private vulnerability
reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up configtx.yaml that shows the problem, the command you ran, what you expected and what happened.
Use made-up networks, organizations and people, never the configuration of a live network, and never a real key,
certificate, address or token, even an old one.

## Scope

In scope:

- an input that makes the tool read a file other than the one it was given, open a certificate or an MSP folder a file
  names, or follow a symbolic link
- an input that makes the tool open a network connection, fetch a URL it reads, call a node, run any other program, or
  evaluate anything it reads
- an input that makes the tool write a file
- an input that makes the tool hang, take very long, exhaust the stack or use unbounded memory, such as very large
  files, very long lines, mappings or flow collections nested deep, chains of aliases and merge keys, or long runs of
  quotes, colons or comment marks
- binary or invalid input that the tool reads as if it were YAML
- a construct the reader passes over without listing it, or a value it passed over that a check reports as missing
- a setting that docs/method.md says is reported but that a form of YAML it says it reads hides from the tool
- a run that passes at a `--fail-on` level although the input holds a finding at that level that docs/method.md says is
  reported
- text from a file or a file name that rewrites the terminal through control or direction characters, is shown
  unescaped in the output, or puts markup into the markdown report
- a name such as `__proto__` that changes how objects behave inside the tool

Out of scope: the forms docs/limits.md says the tool does not see, whether the network is safe (a clean result is not a
security audit and not a guarantee that the network is safe), who may change the file in your repository, and where
your pipeline keeps the output.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
