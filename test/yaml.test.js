import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YAML_LIMITS, YamlError, entryOf, isBlank, isMap, isScalar, isSeq, readYaml, textOf, valueOf } from '../src/index.js';

const read = (text) => readYaml(text);
const root = (text) => readYaml(text).root;
const unsupported = (text) => readYaml(text).unsupported;
const fails = (text, pattern, line) => {
  assert.throws(() => readYaml(text), (e) => {
    assert.ok(e instanceof YamlError, String(e));
    assert.match(e.message, pattern);
    if (line !== undefined) assert.equal(e.line, line);
    return true;
  });
};

test('a mapping of scalars keeps the keys in order with their lines and columns', () => {
  const r = root('Name: harbor\nPort: 7050\n  \nMode: dev\n');
  assert.ok(isMap(r));
  assert.deepEqual(r.entries.map((e) => e.key), ['Name', 'Port', 'Mode']);
  assert.deepEqual(r.entries.map((e) => e.keyLine), [1, 2, 4]);
  assert.equal(r.entries[0].keyCol, 1);
  assert.equal(textOf(valueOf(r, 'Name')), 'harbor');
});

test('scalars are typed: bool, int, float, null and strings', () => {
  const r = root('a: true\nb: False\nc: 12\nd: -3.5\ne: ~\nf: null\ng:\nh: V2_0\ni: 10 MB\nj: 2s\n');
  assert.equal(valueOf(r, 'a').type, 'bool');
  assert.equal(valueOf(r, 'a').bool, true);
  assert.equal(valueOf(r, 'b').bool, false);
  assert.equal(valueOf(r, 'c').type, 'int');
  assert.equal(valueOf(r, 'd').type, 'float');
  for (const k of ['e', 'f', 'g']) assert.equal(valueOf(r, k).kind, 'null', k);
  for (const k of ['h', 'i', 'j']) assert.equal(valueOf(r, k).type, 'str', k);
  assert.equal(textOf(valueOf(r, 'i')), '10 MB');
});

test('a quoted true is a string, not a bool', () => {
  const r = root('a: "true"\nb: \'false\'\n');
  assert.equal(valueOf(r, 'a').type, 'str');
  assert.equal(valueOf(r, 'a').quoted, true);
  assert.equal(valueOf(r, 'b').value, 'false');
});

test('nested mappings and sequences', () => {
  const r = root('A:\n  B:\n    - x\n    - y\n  C: 1\n');
  const b = valueOf(valueOf(r, 'A'), 'B');
  assert.ok(isSeq(b));
  assert.deepEqual(b.items.map(textOf), ['x', 'y']);
  assert.equal(textOf(valueOf(valueOf(r, 'A'), 'C')), '1');
});

test('a sequence at the same indent as its key is read', () => {
  const r = root('Key:\n- a\n- b\nNext: c\n');
  assert.deepEqual(valueOf(r, 'Key').items.map(textOf), ['a', 'b']);
  assert.equal(textOf(valueOf(r, 'Next')), 'c');
});

test('a sequence item that is a mapping continues on the lines below it', () => {
  const r = root('- Host: a\n  Port: 1\n- Host: b\n  Port: 2\n');
  assert.ok(isSeq(r));
  assert.equal(r.items.length, 2);
  assert.equal(textOf(valueOf(r.items[1], 'Host')), 'b');
  assert.equal(r.items[1].entries[1].keyLine, 4);
  assert.equal(r.items[1].entries[0].keyCol, 3);
});

test('a dash with the item on the next line, and a sequence of sequences', () => {
  const r = root('-\n  Name: a\n- - x\n  - y\n');
  assert.equal(textOf(valueOf(r.items[0], 'Name')), 'a');
  assert.deepEqual(r.items[1].items.map(textOf), ['x', 'y']);
});

test('an empty item and an empty value are null nodes', () => {
  const r = root('List:\n  -\n  - a\nEmpty:\n');
  assert.equal(valueOf(r, 'List').items[0].kind, 'null');
  assert.equal(valueOf(r, 'Empty').kind, 'null');
  assert.ok(isBlank(valueOf(r, 'Empty')));
  assert.ok(isBlank(undefined));
});

test('comments are dropped, a hash inside a quoted string or a word is kept', () => {
  const r = root('# top\nA: b # note\nB: "c # not a comment"\nC: \'d # kept\'\nD: e#f\nE: it\'s fine # comment\n');
  assert.equal(textOf(valueOf(r, 'A')), 'b');
  assert.equal(textOf(valueOf(r, 'B')), 'c # not a comment');
  assert.equal(textOf(valueOf(r, 'C')), 'd # kept');
  assert.equal(textOf(valueOf(r, 'D')), 'e#f');
  assert.equal(textOf(valueOf(r, 'E')), "it's fine");
});

test('double quoted strings read their escapes', () => {
  const r = root('a: "x\\ty\\n\\"q\\" \\\\ \\x41 \\u00e9 \\U0001F600"\n');
  assert.equal(textOf(valueOf(r, 'a')), 'x\ty\n"q" \\ A \u00e9 \u{1F600}');
});

test('single quoted strings read a doubled quote', () => {
  assert.equal(textOf(valueOf(root("a: 'it''s'\n"), 'a')), "it's");
});

test('a quoted string may hold a colon, brackets and a rule with quotes inside', () => {
  const r = root('Rule: "OR(\'Org1MSP.admin\', \'Org1MSP.peer\')"\nHost: "127.0.0.1:7050"\n');
  assert.equal(textOf(valueOf(r, 'Rule')), "OR('Org1MSP.admin', 'Org1MSP.peer')");
  assert.equal(textOf(valueOf(r, 'Host')), '127.0.0.1:7050');
});

test('a quoted key is read', () => {
  const r = root('"a b": 1\n\'c\': 2\n');
  assert.deepEqual(r.entries.map((e) => e.key), ['a b', 'c']);
});

test('a plain value with a colon that is not followed by a space is one scalar', () => {
  const r = root('a: 127.0.0.1:7050\nb: http://x.test/y\n- c\n'.split('\n').slice(0, 2).join('\n'));
  assert.equal(textOf(valueOf(r, 'a')), '127.0.0.1:7050');
  assert.equal(textOf(valueOf(r, 'b')), 'http://x.test/y');
});

test('flow lists and maps on one line, empty ones, and nested ones', () => {
  const r = root('a: [x, "y z", 3]\nb: {k: v, n: 1}\nc: []\nd: {}\ne: [[1, 2], {p: q}]\n');
  assert.deepEqual(valueOf(r, 'a').items.map(textOf), ['x', 'y z', '3']);
  assert.equal(textOf(valueOf(valueOf(r, 'b'), 'k')), 'v');
  assert.equal(valueOf(r, 'c').items.length, 0);
  assert.equal(valueOf(r, 'd').entries.length, 0);
  assert.equal(valueOf(r, 'e').items[0].items.length, 2);
});

test('a flow list over several lines is read', () => {
  const r = root('a: [x,\n  y,\n  z]\nb: 1\n');
  assert.deepEqual(valueOf(r, 'a').items.map(textOf), ['x', 'y', 'z']);
  assert.equal(textOf(valueOf(r, 'b')), '1');
});

test('a flow list that is not closed is an error with its line', () => {
  fails('a: [x, y\nb: 1\n', /not closed/, 1);
});

test('anchors and aliases share the node, and a nested anchor on its own line is read', () => {
  const r = root('Orgs:\n  - &A\n    Name: a\n  - *A\nOther: &B\n  K: v\nUse: *B\n');
  const orgs = valueOf(r, 'Orgs').items;
  assert.equal(orgs[0], orgs[1]);
  assert.equal(orgs[0].anchor, 'A');
  assert.equal(valueOf(r, 'Use'), valueOf(r, 'Other'));
});

test('an anchor on a scalar and an alias to it', () => {
  const r = root('a: &x 5\nb: *x\n');
  assert.equal(valueOf(r, 'b'), valueOf(r, 'a'));
  assert.equal(textOf(valueOf(r, 'b')), '5');
});

test('an alias with no anchor before it is an error with its line', () => {
  fails('a: *missing\n', /no anchor/, 1);
  fails('a: *later\nb: &later 1\n', /no anchor/, 1);
});

test('an alias to its own mapping cannot be written, because the anchor exists only after the node is read', () => {
  fails('a: &x\n  b: *x\n', /no anchor/, 2);
});

test('merge keys: the written keys win, the first source wins over the later, and lines point to the source', () => {
  const text = 'Base: &base\n  A: 1\n  B: 2\nOther: &other\n  B: 9\n  C: 3\nUse:\n  <<: [*base, *other]\n  A: 10\n';
  const use = valueOf(root(text), 'Use');
  assert.deepEqual(use.entries.map((e) => e.key), ['A', 'B', 'C']);
  assert.equal(textOf(valueOf(use, 'A')), '10');
  assert.equal(textOf(valueOf(use, 'B')), '2');
  assert.equal(textOf(valueOf(use, 'C')), '3');
  assert.equal(entryOf(use, 'B').keyLine, 3);
  assert.equal(entryOf(use, 'B').merged, true);
  assert.equal(entryOf(use, 'A').merged, false);
});

test('a merge key inside a sequence item and beside other keys', () => {
  const r = root('Org: &o\n  Name: n\n  ID: i\nList:\n  - <<: *o\n    ID: other\n');
  const item = valueOf(r, 'List').items[0];
  assert.equal(textOf(valueOf(item, 'ID')), 'other');
  assert.equal(textOf(valueOf(item, 'Name')), 'n');
  assert.deepEqual(item.merges, [5]);
});

test('a merge key whose value is not a mapping is listed, never silently dropped', () => {
  const u = unsupported('a: 1\nb:\n  <<: 5\n  c: 1\n');
  assert.equal(u.length, 1);
  assert.match(u[0].construct, /merge key/);
  assert.equal(u[0].line, 3);
});

test('a quoted << is an ordinary key', () => {
  const r = root('"<<": 1\n');
  assert.equal(r.entries[0].key, '<<');
});

test('the document start marker is allowed once; a second document is listed and not read', () => {
  const r = read('---\na: 1\n---\nb: 2\n');
  assert.deepEqual(r.root.entries.map((e) => e.key), ['a']);
  assert.equal(r.unsupported.length, 1);
  assert.match(r.unsupported[0].construct, /second YAML document/);
  assert.equal(r.unsupported[0].line, 3);
});

test('content after a document end marker is listed', () => {
  const r = read('a: 1\n...\nb: 2\n');
  assert.equal(r.unsupported.length, 1);
  assert.match(r.unsupported[0].construct, /after the document end/);
});

test('a YAML directive is listed', () => {
  const r = read('%YAML 1.2\n---\na: 1\n');
  assert.equal(r.unsupported[0].construct, 'a YAML directive');
  assert.equal(textOf(valueOf(r.root, 'a')), '1');
});

test('a block scalar is listed with its line and its lines are passed over', () => {
  const r = read('a: |\n  text one\n  text two\nb: 2\nc: >\n  folded\n');
  assert.deepEqual(r.unsupported.map((u) => u.line), [1, 5]);
  assert.equal(valueOf(r.root, 'a').kind, 'unsupported');
  assert.equal(textOf(valueOf(r.root, 'b')), '2');
  assert.equal(isBlank(valueOf(r.root, 'a')), false);
});

test('a tag is listed and the value is still read', () => {
  const r = read('a: !!str 12\nb: !custom\n  c: 1\n');
  assert.equal(r.unsupported.length, 2);
  assert.match(r.unsupported[0].construct, /tag !!str/);
  assert.equal(textOf(valueOf(r.root, 'a')), '12');
  assert.equal(textOf(valueOf(valueOf(r.root, 'b'), 'c')), '1');
});

test('a complex key is listed and passed over with its lines', () => {
  const r = read('? [a, b]\n: value\nc: 1\n'.replace('? [a, b]\n: value\n', '? key\n  more\n'));
  assert.equal(r.unsupported[0].construct, 'a complex mapping key (?)');
  assert.equal(textOf(valueOf(r.root, 'c')), '1');
});

test('a quoted string over several lines is listed and its lines are passed over', () => {
  const r = read('a: "first\n  second"\nb: 1\n');
  assert.equal(r.unsupported.length, 1);
  assert.equal(r.unsupported[0].construct, 'a quoted string over several lines');
  assert.equal(valueOf(r.root, 'a').kind, 'unsupported');
  assert.equal(textOf(valueOf(r.root, 'b')), '1');
});

test('a quoted string that never closes is an error', () => {
  fails('a: "never\nb: 1\n', /not closed/, 1);
});

test('a tab in the indentation, a duplicate key, text after a quoted string and a bad escape are errors with their line', () => {
  fails('a:\n\tb: 1\n', /tab/, 2);
  fails('a: 1\nb: 2\na: 3\n', /duplicate key "a" \(first at line 1\)/, 3);
  fails('a: "x" y\n', /after a quoted string/, 1);
  fails('a: "\\q"\n', /unknown escape/, 1);
  fails('a: "\\xZZ"\n', /bad escape/, 1);
});

test('a line that does not fit the structure is an error with its line', () => {
  fails('a: 1\n  b: 2\n', /indentation/, 2);
  fails('a:\n  b: 1\n c: 2\n', /./, 3);
  fails('a: 1\n- b\n', /sequence item where a key was expected/, 2);
  fails('a: 1\njust text\n', /expected "key: value"/, 2);
});

test('an empty text, a text of comments and a byte order mark', () => {
  assert.equal(root('').kind, 'null');
  assert.equal(root('# only a comment\n\n').kind, 'null');
  assert.equal(textOf(valueOf(root('\ufeffa: 1\n'), 'a')), '1');
});

test('CRLF, CR and LF line ends read the same, with the same lines', () => {
  const lf = root('a: 1\nb:\n  c: 2\n');
  for (const sep of ['\r\n', '\r']) {
    const r = root(['a: 1', 'b:', '  c: 2', ''].join(sep));
    assert.equal(valueOf(valueOf(r, 'b'), 'c').line, 3);
    assert.equal(r.entries.length, lf.entries.length);
  }
});

test('a node tells what it is: isMap, isSeq, isScalar and entryOf on a node that is not a mapping', () => {
  const r = root('a: [1]\nb: x\n');
  assert.ok(isSeq(valueOf(r, 'a')));
  assert.ok(isScalar(valueOf(r, 'b')));
  assert.equal(entryOf(valueOf(r, 'b'), 'k'), undefined);
  assert.equal(textOf(valueOf(r, 'a')), null);
});

test('nesting past the limit stops the reader with an error, not the stack', () => {
  let text = '';
  for (let i = 0; i <= YAML_LIMITS.maxDepth + 2; i += 1) text += `${' '.repeat(i * 2)}k${i}:\n`;
  fails(`${text}${' '.repeat((YAML_LIMITS.maxDepth + 3) * 2)}v: 1\n`, /nested more than/);
});

test('flow collections nested past the limit are an error', () => {
  fails(`a: ${'['.repeat(YAML_LIMITS.maxFlowDepth + 3)}${']'.repeat(YAML_LIMITS.maxFlowDepth + 3)}\n`, /nested too deep/, 1);
});
