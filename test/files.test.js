import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CONFIG_NAMES, FILE_LIMITS, InputError, checkFile, decode, displayPath, locateConfig, readConfigText } from '../src/index.js';
import { GOOD, cli, run, withFiles } from './helpers.js';

test('decode: UTF-8 with and without a byte order mark, and UTF-16 in both byte orders', () => {
  assert.equal(decode(Buffer.from('a: 1\n')), 'a: 1\n');
  assert.equal(decode(Buffer.from([0xef, 0xbb, 0xbf, 0x61])), 'a');
  assert.equal(decode(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('a: \u00e9', 'utf16le')])), 'a: \u00e9');
  const be = Buffer.from('a: b', 'utf16le').swap16();
  assert.equal(decode(Buffer.concat([Buffer.from([0xfe, 0xff]), be])), 'a: b');
});

test('decode: a null byte, bytes that are not UTF-8 and an odd number of UTF-16 bytes are refused', () => {
  assert.throws(() => decode(Buffer.from([0x61, 0x00, 0x62])), /null byte/);
  assert.throws(() => decode(Buffer.from([0xc3, 0x28])), /not valid UTF-8/);
  assert.throws(() => decode(Buffer.from([0xff, 0xfe, 0x61])), /odd number of bytes/);
});

test('displayPath: relative with forward slashes inside the folder, and the whole path outside it', () => {
  const base = resolve('/work/project');
  assert.equal(displayPath(resolve(base, 'net/configtx.yaml'), base), 'net/configtx.yaml');
  const outside = resolve(base, '..', 'elsewhere', 'configtx.yaml');
  assert.ok(!displayPath(outside, base).includes('\\'));
  assert.ok(displayPath(outside, base).endsWith('elsewhere/configtx.yaml'));
});

test('locateConfig: a file, a folder with configtx.yaml, one with only configtx.yml, and one with neither', async () => {
  await withFiles({ 'a/configtx.yaml': GOOD, 'b/configtx.yml': GOOD, 'c/other.txt': 'x', 'd/net.yaml': GOOD }, async (dir) => {
    assert.equal(await locateConfig('a', dir), resolve(dir, 'a/configtx.yaml'));
    assert.equal(await locateConfig('b', dir), resolve(dir, 'b/configtx.yml'));
    assert.equal(await locateConfig('d/net.yaml', dir), resolve(dir, 'd/net.yaml'));
    await assert.rejects(locateConfig('c', dir), /holds no configtx\.yaml or configtx\.yml/);
    await assert.rejects(locateConfig('missing', dir), /does not exist/);
  });
  assert.deepEqual(CONFIG_NAMES, ['configtx.yaml', 'configtx.yml']);
});

test('locateConfig: configtx.yaml wins over configtx.yml when a folder holds both', async () => {
  await withFiles({ 'a/configtx.yaml': GOOD, 'a/configtx.yml': 'x: 1\n' }, async (dir) => {
    assert.equal(await locateConfig('a', dir), resolve(dir, 'a/configtx.yaml'));
  });
});

test('an absolute path is used as it is, with resolve() and not a join', async () => {
  await withFiles({ 'net/configtx.yaml': GOOD }, async (dir) => {
    const abs = resolve(dir, 'net/configtx.yaml');
    const r = await cli([abs], process.cwd());
    assert.equal(r.code, 0, r.err);
  });
});

test('a file over the size limit is refused before it is read, and the limit is in the error', async () => {
  await withFiles({ 'x/configtx.yaml': `${'# padding\n'.repeat(100)}${GOOD}` }, async (dir) => {
    await assert.rejects(checkFile({ path: 'x', version: '0', base: dir, limits: { maxBytes: 200 } }), (e) => e instanceof InputError && /larger than 200 bytes/.test(e.message));
  });
  assert.ok(FILE_LIMITS.maxBytes >= 1024 * 1024);
});

test('a binary file, and bytes that are not UTF-8, are an input error with exit code 2 and no report', async () => {
  const bin = await run({ 'x/configtx.yaml': Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]) }, ['x']);
  assert.equal(bin.code, 2);
  assert.match(bin.err, /null byte/);
  assert.equal(bin.out, '');
  const bad = await run({ 'x/configtx.yaml': Buffer.from([0x61, 0x3a, 0x20, 0xc3, 0x28]) }, ['x']);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /not valid UTF-8/);
});

test('an empty file is a file with no profiles: an error finding, not a pass', async () => {
  const r = await run({ 'x/configtx.yaml': '' }, ['x']);
  assert.equal(r.code, 1);
  assert.match(r.out, /ERROR {4}no-profiles/);
});

test('a file that is not YAML the reader can follow is an error finding with its line, exit code 1, and no other finding', async () => {
  const r = await run({ 'x/configtx.yaml': 'Profiles:\n  P:\n    a: 1\n    a: 2\n' }, ['x', '--json']);
  assert.equal(r.code, 1);
  const report = JSON.parse(r.out);
  assert.deepEqual(report.findings.map((f) => f.id), ['config-unreadable']);
  assert.equal(report.findings[0].line, 4);
  assert.match(report.findings[0].message, /duplicate key "a"/);
});

test('a symbolic link is refused by name, not followed', { skip: process.platform === 'win32' ? 'creating symbolic links needs a privilege on Windows' : false }, async () => {
  await withFiles({ 'real/configtx.yaml': GOOD }, async (dir) => {
    await mkdir(resolve(dir, 'linked'));
    await symlink(resolve(dir, 'real/configtx.yaml'), resolve(dir, 'linked/configtx.yaml'));
    await symlink(resolve(dir, 'real/configtx.yaml'), resolve(dir, 'direct.yaml'));
    for (const p of ['linked', 'direct.yaml']) {
      const r = await cli([p], dir);
      assert.equal(r.code, 2, p);
      assert.match(r.err, /symbolic link/, p);
    }
  });
});

test('a device is refused as not a regular file', { skip: process.platform === 'win32' ? 'there is no /dev/null on Windows' : false }, async () => {
  const r = await cli(['/dev/null'], process.cwd());
  assert.equal(r.code, 2);
  assert.match(r.err, /not a regular file/);
});

test('readConfigText reads a file through a handle and reports its size in bytes', async () => {
  await withFiles({ 'x/configtx.yaml': 'a: \u00e9\n' }, async (dir) => {
    const r = await readConfigText(resolve(dir, 'x/configtx.yaml'), dir);
    assert.equal(r.text, 'a: \u00e9\n');
    assert.equal(r.bytes, 6);
  });
});
