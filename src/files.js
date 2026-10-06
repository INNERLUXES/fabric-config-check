// Reading the file: a regular file of bounded size, opened without following a link where the system allows, decoded as
// UTF-8 or as UTF-16 by its byte order mark, and refused when it holds a null byte. Nothing else is opened, and nothing is
// written.

import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { safeText } from './text.js';

export const FILE_LIMITS = { maxBytes: 2 * 1024 * 1024 };

// Names looked for when the path given is a folder.
export const CONFIG_NAMES = ['configtx.yaml', 'configtx.yml'];

export class InputError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.name = 'InputError';
    this.problems = problems;
  }
}

// The path as the report shows it: relative to the folder the command runs in, with forward slashes; a path outside that
// folder is shown whole.
export function displayPath(absolute, base) {
  const rel = relative(base, absolute);
  const shown = rel === '' || rel.startsWith('..') || isAbsolute(rel) ? absolute : rel;
  return safeText(shown.split(sep).join('/'), 400);
}

async function kindOf(path) {
  try {
    const s = await lstat(path);
    if (s.isSymbolicLink()) return 'link';
    if (s.isDirectory()) return 'folder';
    if (s.isFile()) return 'file';
    return 'other';
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return 'missing';
    throw new InputError([`${safeText(path, 300)}: ${error.code ?? 'cannot be read'}`]);
  }
}

// The file to read for a path given on the command line: the file itself, or configtx.yaml (or configtx.yml) in the folder.
export async function locateConfig(given, base) {
  const absolute = resolve(base, given);
  const shown = displayPath(absolute, base);
  const kind = await kindOf(absolute);
  if (kind === 'missing') throw new InputError([`${shown}: does not exist`]);
  if (kind === 'link') throw new InputError([`${shown}: is a symbolic link; give the file it points to`]);
  if (kind === 'other') throw new InputError([`${shown}: is not a regular file or a folder`]);
  if (kind === 'file') return absolute;
  for (const name of CONFIG_NAMES) {
    const candidate = resolve(absolute, name);
    const k = await kindOf(candidate);
    if (k === 'file') return candidate;
    if (k === 'link') throw new InputError([`${displayPath(candidate, base)}: is a symbolic link; give the file it points to`]);
    if (k !== 'missing') throw new InputError([`${displayPath(candidate, base)}: is not a regular file`]);
  }
  throw new InputError([`${shown}: holds no ${CONFIG_NAMES.join(' or ')}; give the file`]);
}

// The text of bytes: UTF-8 (a byte order mark is dropped) or UTF-16 with a byte order mark.
export function decode(buffer) {
  const bytes = buffer;
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) {
    if ((bytes.length - 2) % 2 !== 0) throw new Error('has an odd number of bytes for UTF-16');
    const body = Buffer.from(bytes.subarray(2));
    if (bytes[0] === 0xfe) body.swap16();
    return new TextDecoder('utf-16le', { fatal: true }).decode(body);
  }
  if (bytes.includes(0)) throw new Error('holds a null byte; it is not a text file');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('is not valid UTF-8');
  }
}

// The text of a file, read through one open handle whose type and size are checked before the read.
export async function readConfigText(absolute, base, limits = FILE_LIMITS) {
  const shown = displayPath(absolute, base);
  let handle;
  try {
    handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const s = await handle.stat();
    if (!s.isFile()) throw new InputError([`${shown}: is not a regular file`]);
    if (s.size > limits.maxBytes) throw new InputError([`${shown}: is larger than ${limits.maxBytes} bytes`]);
    const buffer = await handle.readFile();
    if (buffer.length > limits.maxBytes) throw new InputError([`${shown}: is larger than ${limits.maxBytes} bytes`]);
    try {
      return { text: decode(buffer), bytes: buffer.length };
    } catch (error) {
      throw new InputError([`${shown}: ${error.message}`]);
    }
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError([`${shown}: ${error.code === 'ELOOP' ? 'is a symbolic link; give the file it points to' : (error.code ?? 'cannot be read')}`]);
  } finally {
    await handle?.close();
  }
}
