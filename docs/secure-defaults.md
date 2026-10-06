# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which file you give it, where the output goes, and who may
change the file. A clean result is not a security audit and not a guarantee that the network is safe; it is a file with
none of the forms the checks look for, not a finding that the network is governed well.

## How the tool behaves by default

- **Reads, never runs.** The tool reads the configtx.yaml it is given. It follows no symbolic link, fetches no URL,
  refuses an argument that looks like an address, opens none of the certificates or MSP folders the file names, connects
  to no node, evaluates nothing and writes nothing to disk.
- **Every check on from the first run.** An `ANY Admins` policy, the solo orderer, a consenter with no TLS certificate,
  an organization with no ID or MSPDir and a duplicate MSP ID are errors; a single organization, an `ANY` endorsement
  policy, a missing anchor peer, a small or single-host consenter set, missing batch settings and missing or disabled
  capabilities are warnings; `ANY` on Readers and Writers is a note. There is no configuration file that could set a
  check off.
- **Fail closed on what it cannot read.** A file that is not well formed is an error finding that fails the run at the
  default `--fail-on` of `error`. A construct the reader passes over is a warning finding and is listed, so a value it
  did not read is never taken for a value that is fine. A file that is not text, is too large or is a link stops the
  run with exit code `2` and no report.
- **Unknown arguments are errors.** An option the tool does not know, a value that looks like an option and an option
  given twice stop the run, so a typo such as `--fail-no` cannot leave a default in place.
- **No pattern from the input.** No regular expression is built from the file or from an argument.
- **Bounded work.** The reader has limits of size, lines, line length, nodes and nesting (docs/limits.md), and the
  only recursion stops at a limit with an error, so a deep or large file cannot exhaust the stack or the memory.
- **No prototype tricks.** Names from the file are never used as keys of an object, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names included, has control characters, line separators and direction
  controls replaced and its length capped before it reaches a report or an error message; the markdown report also
  escapes what markdown gives a meaning to.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`--fail-on warning`.** Single organizations, `ANY` endorsement policies, missing anchor peers, small consenter sets
  and missing capabilities fail the run too; use it once the errors are gone, so that new profiles keep to the same
  bar.
- **`--fail-on info`.** The `ANY` Readers and Writers notes fail the run too; use it only where open reading and
  submitting is not intended.
- **`--profile <name>`.** Check each profile that a channel is built from on its own in the pipeline, so a finding is
  tied to the profile that a change touched.
- **Read the notes about what was not read.** A run with `unsupported-construct` findings did not check those values.
  Keep the file to the forms in docs/inputs.md so that the whole file is read.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Fabric config check
    run: npx --yes github:INNERLUXES/fabric-config-check configtx/configtx.yaml --format markdown >> "$GITHUB_STEP_SUMMARY"
```

- Give the job read access to the contents and nothing more. The tool needs no secret, no node address and no key;
  never give it one.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Do not hide the exit code with a trailing `|| true`. To keep the report without failing, keep `--fail-on` at `error`
  and keep the SARIF or JSON report as an artifact of the job, or upload the SARIF to code scanning.
- Treat a report built from a file you do not trust as untrusted data.
- Run the other checks of your stack as well. This check is a first list for the governance review, and the review
  by the members comes after it.

## Protecting the file

The file decides who may change the channel, who orders, who endorses and which organizations are members. Keep it in a
repository, put its path in `CODEOWNERS` with the people who speak for each member, and require their review in branch
protection. Review a change that sets a policy to `ANY`, removes a consenter, drops a capability, adds an organization
or changes an MSP ID like a change to code: each of them can move the control of the network.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
