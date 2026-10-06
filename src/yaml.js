// A small strict reader for the part of YAML that Fabric configtx.yaml files use: block mappings and sequences, plain,
// single quoted and double quoted scalars, short flow lists and maps, comments, anchors (&name), aliases (*name) and
// merge keys (<<). It is a reader written for this tool and reads text only: nothing is evaluated, no tag is applied and
// nothing is fetched.
//
// What it does not read is listed, never skipped without a word: every construct it passes over is returned in
// `unsupported` with its line, so a check can say that the file holds something the tool did not read. A file that is
// not well formed (a tab in the indentation, a duplicate key, an alias with no anchor, a line that does not fit the
// structure) stops with a YamlError and the line.
//
// The reader works through a list of lines. The only recursion is over the nesting of the document, which stops at
// YAML_LIMITS.maxDepth, and over the nesting of a flow list, which stops at YAML_LIMITS.maxFlowDepth.

export const YAML_LIMITS = { maxLines: 200000, maxLineLength: 20000, maxDepth: 64, maxFlowDepth: 16, maxNodes: 400000, maxFlowLines: 500 };

export class YamlError extends Error {
  constructor(message, line = 1, column = 1) {
    super(message);
    this.name = 'YamlError';
    this.line = line;
    this.column = column;
  }
}

// A node: { kind, line, col, anchor }.
//   kind 'map'         entries: [{ key, keyLine, keyCol, value, merged }]
//   kind 'seq'         items: [node]
//   kind 'scalar'      value (the text), type ('str', 'bool', 'int', 'float'), quoted, bool (for type 'bool')
//   kind 'null'        an empty value, ~ or null
//   kind 'unsupported' construct (what was passed over)

export const isMap = (n) => Boolean(n) && n.kind === 'map';
export const isSeq = (n) => Boolean(n) && n.kind === 'seq';
export const isScalar = (n) => Boolean(n) && n.kind === 'scalar';

// The entry of a mapping for a key, or undefined.
export function entryOf(map, key) {
  if (!isMap(map)) return undefined;
  return map.entries.find((e) => e.key === key);
}

// The value node of a key, or undefined.
export const valueOf = (map, key) => entryOf(map, key)?.value;

// The text of a scalar, or null for anything else.
export const textOf = (node) => (isScalar(node) ? node.value : null);

// True when a node holds nothing the tool can use: no node, an empty value, or an empty string. A construct the reader
// passed over is not blank, because the tool cannot tell what it holds.
export function isBlank(node) {
  if (!node) return true;
  if (node.kind === 'null') return true;
  if (node.kind === 'scalar') return node.value.trim() === '';
  if (node.kind === 'seq') return node.items.length === 0;
  if (node.kind === 'map') return node.entries.length === 0;
  return false;
}

const SPACE = /[ \t]/;

// The quoted string that starts at text[start], or null when it does not end in the text. Returns { value, end } with end
// the index after the closing quote.
function readQuoted(text, start, line) {
  const quote = text[start];
  let out = '';
  let i = start + 1;
  if (quote === "'") {
    while (i < text.length) {
      if (text[i] === "'") {
        if (text[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        return { value: out, end: i + 1 };
      }
      out += text[i];
      i += 1;
    }
    return null;
  }
  const simple = { 0: '\0', a: '\x07', b: '\b', t: '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b', ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\x85', _: '\xa0', L: '\u2028', P: '\u2029' };
  while (i < text.length) {
    const c = text[i];
    if (c === '"') return { value: out, end: i + 1 };
    if (c !== '\\') {
      out += c;
      i += 1;
      continue;
    }
    const next = text[i + 1];
    if (next === undefined) return null;
    if (Object.hasOwn(simple, next)) {
      out += simple[next];
      i += 2;
    } else if (next === 'x' || next === 'u' || next === 'U') {
      const width = next === 'x' ? 2 : next === 'u' ? 4 : 8;
      const hex = text.slice(i + 2, i + 2 + width);
      if (hex.length !== width || !/^[0-9a-fA-F]+$/.test(hex)) throw new YamlError(`bad escape \\${next} in a double quoted string`, line, i + 1);
      const code = parseInt(hex, 16);
      if (code > 0x10ffff) throw new YamlError(`bad escape \\${next} in a double quoted string`, line, i + 1);
      out += String.fromCodePoint(code);
      i += 2 + width;
    } else throw new YamlError(`unknown escape \\${next} in a double quoted string`, line, i + 1);
  }
  return null;
}

// Comments out of a line, with the quotes of the line respected. A quote opens only where a scalar can start, so an
// apostrophe inside a word is not one. Returns the text with trailing white space removed, and whether a quote is still
// open at the end of the line.
function stripComment(text) {
  let quote = null;
  let prev = ' ';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote === '"') {
      if (c === '\\') i += 1;
      else if (c === '"') quote = null;
    } else if (quote === "'") {
      if (c === "'") {
        if (text[i + 1] === "'") i += 1;
        else quote = null;
      }
    } else if ((c === '"' || c === "'") && (SPACE.test(prev) || '[{,:'.includes(prev) || i === 0)) quote = c;
    else if (c === '#' && (i === 0 || SPACE.test(prev))) return { text: text.slice(0, i).trimEnd(), open: null };
    prev = c;
  }
  return { text: text.trimEnd(), open: quote };
}

// The lines of the text that hold content: { n, ri, indent, col, text, open, badIndent }.
function splitLines(source) {
  let text = String(source);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const raw = text.split(/\r\n|\r|\n/);
  if (raw.length > YAML_LIMITS.maxLines) throw new YamlError(`more than ${YAML_LIMITS.maxLines} lines`, YAML_LIMITS.maxLines);
  const lines = [];
  for (let ri = 0; ri < raw.length; ri += 1) {
    const line = raw[ri];
    if (line.length > YAML_LIMITS.maxLineLength) throw new YamlError(`a line is longer than ${YAML_LIMITS.maxLineLength} characters`, ri + 1);
    let indent = 0;
    while (line[indent] === ' ') indent += 1;
    const rest = line.slice(indent);
    if (rest.trim() === '') continue;
    const stripped = stripComment(rest);
    if (stripped.text === '') continue;
    lines.push({ n: ri + 1, ri, indent, col: indent + 1, text: stripped.text, open: stripped.open, badIndent: rest[0] === '\t' });
  }
  return { raw, lines };
}

const isSeqItem = (t) => t === '-' || t.startsWith('- ');

// The key that starts a line, or null when the line is not a mapping line. { key, quoted, rest }.
function splitKey(text, line) {
  const c = text[0];
  if (c === '[' || c === '{' || c === '*' || c === '&' || c === '!' || c === '|' || c === '>') return null;
  if (c === '?' && (text.length === 1 || text[1] === ' ')) return { complex: true };
  if (c === '"' || c === "'") {
    const q = readQuoted(text, 0, line);
    if (!q) return null;
    let i = q.end;
    while (text[i] === ' ') i += 1;
    if (text[i] !== ':' || (i + 1 < text.length && text[i + 1] !== ' ')) return null;
    return { key: q.value, quoted: true, rest: text.slice(i + 1).trim() };
  }
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === ':' && (i + 1 === text.length || text[i + 1] === ' ')) {
      const key = text.slice(0, i).trimEnd();
      if (key === '') throw new YamlError('a mapping line with no key', line);
      return { key, quoted: false, rest: text.slice(i + 1).trim() };
    }
  }
  return null;
}

// Anchors and tags at the start of a value: { anchor, tag, text }.
function readProps(text, line, col) {
  let anchor = null;
  let tag = null;
  let rest = text;
  for (let guard = 0; guard < 4; guard += 1) {
    if (rest[0] === '&') {
      const m = /^&([^\s,[\]{}]+)/.exec(rest);
      if (!m) throw new YamlError('an anchor with no name', line, col);
      if (anchor !== null) throw new YamlError('two anchors on one value', line, col);
      anchor = m[1];
      rest = rest.slice(m[0].length).trimStart();
    } else if (rest[0] === '!') {
      const m = /^!\S*/.exec(rest);
      tag = m[0];
      rest = rest.slice(m[0].length).trimStart();
    } else break;
  }
  return { anchor, tag, text: rest };
}

function plainScalar(text, line, col) {
  const lower = text;
  if (lower === '~' || lower === 'null' || lower === 'Null' || lower === 'NULL') return { kind: 'null', line, col };
  if (['true', 'True', 'TRUE', 'false', 'False', 'FALSE'].includes(lower)) return { kind: 'scalar', line, col, value: text, type: 'bool', quoted: false, bool: lower.toLowerCase() === 'true' };
  if (/^[-+]?\d+$/.test(text)) return { kind: 'scalar', line, col, value: text, type: 'int', quoted: false };
  if (/^[-+]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][-+]?\d+)?$/.test(text)) return { kind: 'scalar', line, col, value: text, type: 'float', quoted: false };
  return { kind: 'scalar', line, col, value: text, type: 'str', quoted: false };
}

export function readYaml(source) {
  const { raw, lines: all } = splitLines(source);
  const unsupported = [];
  const anchors = new Map();
  let nodes = 0;
  let depth = 0;
  let p = 0;

  // Document markers and directives: the first document is read, and what follows its end is listed.
  const lines = [];
  let seenContent = false;
  for (let k = 0; k < all.length; k += 1) {
    const ln = all[k];
    if (ln.indent === 0 && !ln.badIndent) {
      if (ln.text === '---' || ln.text.startsWith('--- ')) {
        if (!seenContent) {
          if (ln.text.length > 3) unsupported.push({ line: ln.n, construct: 'text after the document start marker', text: ln.text.slice(0, 80) });
          continue;
        }
        unsupported.push({ line: ln.n, construct: 'a second YAML document (only the first one is read)', text: ln.text.slice(0, 80) });
        break;
      }
      if (ln.text === '...') {
        if (k + 1 < all.length) unsupported.push({ line: all[k + 1].n, construct: 'content after the document end marker (not read)', text: all[k + 1].text.slice(0, 80) });
        break;
      }
      if (ln.text[0] === '%' && !seenContent) {
        unsupported.push({ line: ln.n, construct: 'a YAML directive', text: ln.text.slice(0, 80) });
        continue;
      }
    }
    seenContent = true;
    lines.push(ln);
  }

  const note = (line, construct, text) => unsupported.push({ line, construct, text: String(text).slice(0, 80) });
  const count = (line) => {
    nodes += 1;
    if (nodes > YAML_LIMITS.maxNodes) throw new YamlError(`more than ${YAML_LIMITS.maxNodes} values`, line);
  };
  const register = (node, props) => {
    if (props && props.anchor !== null) {
      node.anchor = props.anchor;
      anchors.set(props.anchor, node);
    }
    return node;
  };
  const tagged = (props, line, text) => {
    if (props.tag !== null) note(line, `the tag ${props.tag} (ignored)`, text);
  };
  const aliasNode = (text, line, col) => {
    const m = /^\*([^\s,[\]{}]+)\s*$/.exec(text);
    if (!m) throw new YamlError('text after an alias', line, col);
    const target = anchors.get(m[1]);
    if (!target) throw new YamlError(`the alias *${m[1]} has no anchor defined before it`, line, col);
    return target;
  };

  // Flow lists and maps on one line or joined from several lines.
  function flow(text, line, col) {
    let i = 0;
    const fail = (msg) => {
      throw new YamlError(msg, line, col + i);
    };
    const skip = () => {
      while (i < text.length && SPACE.test(text[i])) i += 1;
    };
    function value(level) {
      if (level > YAML_LIMITS.maxFlowDepth) fail('flow collections nested too deep');
      skip();
      const start = col + i;
      const props = readProps(text.slice(i), line, start);
      i = text.length - props.text.length;
      tagged(props, line, text);
      skip();
      const c = text[i];
      count(line);
      if (c === '[') {
        i += 1;
        const node = { kind: 'seq', line, col: start, items: [] };
        skip();
        while (text[i] !== ']') {
          if (i >= text.length) fail('a flow list that is not closed');
          node.items.push(value(level + 1));
          skip();
          if (text[i] === ',') {
            i += 1;
            skip();
          } else if (text[i] !== ']') fail('expected , or ] in a flow list');
        }
        i += 1;
        return register(node, props);
      }
      if (c === '{') {
        i += 1;
        const node = { kind: 'map', line, col: start, entries: [] };
        skip();
        while (text[i] !== '}') {
          if (i >= text.length) fail('a flow map that is not closed');
          skip();
          let key;
          if (text[i] === '"' || text[i] === "'") {
            const q = readQuoted(text, i, line);
            if (!q) fail('a quoted key that is not closed');
            key = q.value;
            i = q.end;
          } else {
            const from = i;
            while (i < text.length && text[i] !== ':' && text[i] !== ',' && text[i] !== '}') i += 1;
            key = text.slice(from, i).trim();
          }
          if (key === '') fail('a flow map entry with no key');
          skip();
          let val;
          if (text[i] === ':') {
            i += 1;
            skip();
            val = text[i] === ',' || text[i] === '}' ? { kind: 'null', line, col: col + i } : value(level + 1);
          } else val = { kind: 'null', line, col: col + i };
          if (node.entries.some((e) => e.key === key)) fail(`duplicate key "${key}"`);
          node.entries.push({ key, keyLine: line, keyCol: start, value: val, merged: false });
          skip();
          if (text[i] === ',') i += 1;
          else if (text[i] !== '}') fail('expected , or } in a flow map');
        }
        i += 1;
        return register(node, props);
      }
      if (c === '"' || c === "'") {
        const q = readQuoted(text, i, line);
        if (!q) fail('a quoted string that is not closed');
        i = q.end;
        return register({ kind: 'scalar', line, col: start, value: q.value, type: 'str', quoted: true }, props);
      }
      if (c === '*') {
        const m = /^\*([^\s,[\]{}]+)/.exec(text.slice(i));
        if (!m) fail('an alias with no name');
        i += m[0].length;
        const target = anchors.get(m[1]);
        if (!target) fail(`the alias *${m[1]} has no anchor defined before it`);
        return target;
      }
      const from = i;
      while (i < text.length && !',]}'.includes(text[i])) i += 1;
      const word = text.slice(from, i).trim();
      return register(word === '' ? { kind: 'null', line, col: start } : plainScalar(word, line, start), props);
    }
    const node = value(0);
    skip();
    if (i < text.length) fail('text after a flow collection');
    return node;
  }

  // Counts the open brackets of a flow collection in a text, quotes respected.
  function openBrackets(text) {
    let level = 0;
    let quote = null;
    let prev = ' ';
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (quote === '"') {
        if (c === '\\') i += 1;
        else if (c === '"') quote = null;
      } else if (quote === "'") {
        if (c === "'") quote = null;
      } else if ((c === '"' || c === "'") && (SPACE.test(prev) || '[{,:'.includes(prev))) quote = c;
      else if (c === '[' || c === '{') level += 1;
      else if (c === ']' || c === '}') level -= 1;
      prev = c;
    }
    return level;
  }

  // A value that is written on the line of its key or of its dash: a scalar, a quoted string, a flow collection, an
  // alias or a block scalar. The line has already been taken (p points past it).
  function inlineValue(props, ln, col) {
    const text = props.text;
    tagged(props, ln.n, text);
    count(ln.n);
    if (text[0] === '*') return aliasNode(text, ln.n, col);
    if (text[0] === '|' || text[0] === '>') {
      note(ln.n, 'a block scalar (| or >)', ln.text);
      while (p < lines.length && lines[p].indent > ln.indent) p += 1;
      return register({ kind: 'unsupported', line: ln.n, col, construct: 'a block scalar' }, props);
    }
    if (text[0] === '[' || text[0] === '{') {
      let joined = text;
      let guard = 0;
      while (openBrackets(joined) > 0 && p < lines.length) {
        guard += 1;
        if (guard > YAML_LIMITS.maxFlowLines) throw new YamlError('a flow collection that is not closed', ln.n, col);
        joined = `${joined} ${lines[p].text}`;
        p += 1;
      }
      if (openBrackets(joined) > 0) throw new YamlError('a flow collection that is not closed', ln.n, col);
      const node = flow(joined, ln.n, col);
      return props.anchor !== null && node.anchor !== props.anchor ? register(node, props) : node;
    }
    if (text[0] === '"' || text[0] === "'") {
      const q = readQuoted(text, 0, ln.n);
      if (q) {
        if (q.end < text.length) throw new YamlError('text after a quoted string', ln.n, col + q.end);
        return register({ kind: 'scalar', line: ln.n, col, value: q.value, type: 'str', quoted: true }, props);
      }
      // A quoted string over several lines is passed over, with its place.
      const quote = text[0];
      let found = -1;
      for (let r = ln.ri + 1; r < raw.length; r += 1) {
        const body = raw[r];
        let hit = false;
        for (let i = 0; i < body.length; i += 1) {
          if (quote === '"' && body[i] === '\\') i += 1;
          else if (body[i] === quote) {
            if (quote === "'" && body[i + 1] === "'") i += 1;
            else hit = true;
          }
        }
        if (hit) {
          found = r;
          break;
        }
      }
      if (found < 0) throw new YamlError('a quoted string that is not closed', ln.n, col);
      note(ln.n, 'a quoted string over several lines', text);
      while (p < lines.length && lines[p].ri <= found) p += 1;
      return register({ kind: 'unsupported', line: ln.n, col, construct: 'a quoted string over several lines' }, props);
    }
    return register(plainScalar(text, ln.n, col), props);
  }

  // What follows a key or a dash when nothing is written after it: a block that is indented deeper, a sequence at the same
  // indent as the key, or nothing.
  function childOf(indent, props, ln, col, allowSameIndentSeq) {
    count(ln.n);
    const next = lines[p];
    if (next && next.indent > indent) return parseNode(next.indent, props);
    if (allowSameIndentSeq && next && next.indent === indent && isSeqItem(next.text)) return parseNode(indent, props);
    return register({ kind: 'null', line: ln.n, col }, props);
  }

  function parseNode(indent, props = null) {
    depth += 1;
    if (depth > YAML_LIMITS.maxDepth) throw new YamlError(`nested more than ${YAML_LIMITS.maxDepth} levels`, lines[p].n);
    const ln = lines[p];
    if (ln.badIndent) throw new YamlError('a tab is used for indentation', ln.n, ln.col);
    let node;
    if (isSeqItem(ln.text)) node = parseSeq(indent, props);
    else {
      const key = splitKey(ln.text, ln.n);
      if (key) node = parseMap(indent, props);
      else {
        // A scalar or a flow collection standing alone on its line.
        p += 1;
        const own = readProps(ln.text, ln.n, ln.col);
        node = inlineValue({ anchor: props ? props.anchor : own.anchor, tag: own.tag, text: own.text }, ln, ln.col);
        if (p < lines.length && lines[p].indent > indent) throw new YamlError('unexpected indentation after a value', lines[p].n, lines[p].col);
      }
    }
    depth -= 1;
    return node;
  }

  function parseSeq(indent, props) {
    const first = lines[p];
    const node = { kind: 'seq', line: first.n, col: first.col, items: [] };
    count(first.n);
    while (p < lines.length && lines[p].indent === indent && isSeqItem(lines[p].text)) {
      const ln = lines[p];
      if (ln.badIndent) throw new YamlError('a tab is used for indentation', ln.n, ln.col);
      const after = ln.text.slice(1);
      const spaces = after.length - after.trimStart().length;
      const rest = after.trimStart();
      const col = ln.col + 1 + spaces;
      if (rest === '') {
        p += 1;
        node.items.push(childOf(indent, null, ln, col, false));
        continue;
      }
      const props2 = readProps(rest, ln.n, col);
      if (props2.text === '') {
        p += 1;
        node.items.push(childOf(indent, props2, ln, col, false));
        continue;
      }
      const blockStart = isSeqItem(props2.text) || (splitKey(props2.text, ln.n) !== null && props2.text[0] !== '*');
      if (blockStart) {
        const shift = 1 + spaces + (rest.length - props2.text.length);
        lines[p] = { ...ln, indent: indent + shift, col: ln.col + shift, text: props2.text };
        node.items.push(parseNode(indent + shift, props2.anchor !== null ? { anchor: props2.anchor } : null));
        tagged(props2, ln.n, rest);
      } else {
        p += 1;
        node.items.push(inlineValue(props2, ln, col + (rest.length - props2.text.length)));
      }
    }
    if (p < lines.length && lines[p].indent > indent) throw new YamlError('unexpected indentation in a sequence', lines[p].n, lines[p].col);
    return register(node, props);
  }

  function mergeSources(value, line) {
    if (isMap(value)) return [value];
    if (isSeq(value) && value.items.every(isMap)) return value.items;
    note(line, 'a merge key (<<) whose value is not a mapping or a list of mappings', 'value not merged');
    return [];
  }

  function parseMap(indent, props) {
    const first = lines[p];
    const node = { kind: 'map', line: first.n, col: first.col, entries: [] };
    count(first.n);
    const merges = [];
    const seen = new Map();
    while (p < lines.length && lines[p].indent === indent) {
      const ln = lines[p];
      if (ln.badIndent) throw new YamlError('a tab is used for indentation', ln.n, ln.col);
      if (isSeqItem(ln.text)) throw new YamlError('a sequence item where a key was expected', ln.n, ln.col);
      const parts = splitKey(ln.text, ln.n);
      if (parts === null) throw new YamlError('expected "key: value"', ln.n, ln.col);
      if (parts.complex) {
        note(ln.n, 'a complex mapping key (?)', ln.text);
        p += 1;
        while (p < lines.length && lines[p].indent > indent) p += 1;
        continue;
      }
      p += 1;
      const valueCol = ln.col + (ln.text.length - parts.rest.length);
      const props2 = readProps(parts.rest, ln.n, valueCol);
      let value;
      if (props2.text === '') {
        tagged(props2, ln.n, ln.text);
        value = childOf(indent, props2, ln, valueCol, true);
      } else value = inlineValue(props2, ln, valueCol);
      if (parts.key === '<<' && !parts.quoted) {
        merges.push({ value, line: ln.n });
        continue;
      }
      if (seen.has(parts.key)) throw new YamlError(`duplicate key "${parts.key}" (first at line ${seen.get(parts.key)})`, ln.n, ln.col);
      seen.set(parts.key, ln.n);
      node.entries.push({ key: parts.key, keyLine: ln.n, keyCol: ln.col, value, merged: false });
    }
    if (p < lines.length && lines[p].indent > indent) throw new YamlError('unexpected indentation', lines[p].n, lines[p].col);
    // Merge keys: the keys written in the mapping win, then the first source that has a key.
    for (const m of merges) {
      for (const source of mergeSources(m.value, m.line)) {
        for (const e of source.entries) {
          if (!node.entries.some((x) => x.key === e.key)) {
            count(m.line);
            node.entries.push({ ...e, merged: true });
          }
        }
      }
    }
    if (merges.length) node.merges = merges.map((m) => m.line);
    return register(node, props);
  }

  if (lines.length === 0) return { root: { kind: 'null', line: 1, col: 1 }, unsupported, anchors };
  const first = lines[0];
  const root = parseNode(first.indent);
  if (p < lines.length) throw new YamlError('content that does not belong to the document structure', lines[p].n, lines[p].col);
  return { root, unsupported, anchors };
}
