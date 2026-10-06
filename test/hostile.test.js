import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YAML_LIMITS, checkText } from '../src/index.js';
import { allowed, run } from './helpers.js';

// Each test builds input meant to make the reader slow or to exhaust the stack, and checks that it ends with an answer in
// good time. The time allowed is four times as long under coverage (NODE_V8_COVERAGE is set only when coverage is on).

function timed(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

test('thousands of profiles and organizations are read in good time', () => {
  let text = 'Profiles:\n';
  for (let i = 0; i < 3000; i += 1) text += `  P${i}:\n    Application:\n      Organizations:\n        - Name: O${i}\n          ID: M${i}\n          MSPDir: m\n`;
  const { value, ms } = timed(() => checkText(text));
  assert.ok(value.findings.length > 3000);
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
});

test('a chain of aliases that each merge the one before does not blow up', () => {
  let text = 'a0: &x0\n  k: v\n';
  for (let i = 1; i < 500; i += 1) text += `a${i}: &x${i}\n  <<: *x${i - 1}\n  k${i}: v\n`;
  const { value, ms } = timed(() => checkText(`${text}Profiles:\n  P:\n    Orderer:\n      <<: *x499\n`));
  assert.ok(Array.isArray(value.findings));
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
});

test('many aliases to one large node are read once, not expanded', () => {
  let text = 'Big: &big\n';
  for (let i = 0; i < 200; i += 1) text += `  k${i}: v\n`;
  text += 'Many:\n';
  for (let i = 0; i < 5000; i += 1) text += '  - *big\n';
  const { value, ms } = timed(() => checkText(`${text}Profiles:\n  P:\n    Orderer: {}\n`));
  assert.ok(Array.isArray(value.findings));
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
});

test('deep nesting ends with an error finding at the limit, never a stack overflow', () => {
  let text = '';
  for (let i = 0; i < 5000; i += 1) text += `${' '.repeat(i)}k${i}:\n`;
  const { value } = timed(() => checkText(text));
  assert.equal(value.findings[0].id, 'config-unreadable');
  assert.match(value.findings[0].message, new RegExp(`nested more than ${YAML_LIMITS.maxDepth}`));
});

test('thousands of nested brackets in a flow list end with an error, not a stack overflow', () => {
  const { value } = timed(() => checkText(`a: ${'['.repeat(100000)}${']'.repeat(100000)}\n`));
  assert.equal(value.findings[0].id, 'config-unreadable');
});

test('a very long line, and very many lines, are refused with the limit named', () => {
  assert.match(checkText(`a: ${'x'.repeat(YAML_LIMITS.maxLineLength + 1)}\n`).findings[0].message, /longer than/);
  const lines = `${'a: 1\n'.repeat(YAML_LIMITS.maxLines + 1)}`;
  assert.match(checkText(lines).findings[0].message, /more than \d+ lines/);
});

test('long runs of quotes, colons and comment marks are read in good time', () => {
  const text = `Profiles:\n  P:\n    Orderer:\n      OrdererType: ${'"'.repeat(1) + 'a'.repeat(50000) + '"'}\n      Note: ${"'".repeat(1000)}\n      Other: ${':'.repeat(20000)} # ${'#'.repeat(20000)}\n`;
  const { value, ms } = timed(() => checkText(text));
  assert.ok(Array.isArray(value.findings) || value.findings === undefined);
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
});

test('names such as __proto__, constructor and toString are only names', () => {
  const text = 'Profiles:\n  __proto__:\n    Orderer:\n      OrdererType: solo\n  constructor:\n    Application:\n      Organizations:\n        - Name: toString\n          ID: hasOwnProperty\n          MSPDir: m\n  toString: {}\n__proto__: 1\n';
  const { value } = timed(() => checkText(text));
  assert.ok(value.findings.some((f) => f.id === 'orderer-solo' && f.profiles[0] === '__proto__'));
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(Object.prototype, 'OrdererType'), false);
});

test('a run leaves the folder as it was: the tool writes nothing', async () => {
  const files = { 'x/configtx.yaml': 'Profiles:\n  P:\n    Orderer:\n      OrdererType: solo\n' };
  const { readdir } = await import('node:fs/promises');
  const { withFiles, cli } = await import('./helpers.js');
  await withFiles(files, async (dir) => {
    const before = (await readdir(dir, { recursive: true })).sort();
    await cli(['x'], dir);
    assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before);
  });
  assert.equal((await run(files, ['x'])).code, 1);
});
