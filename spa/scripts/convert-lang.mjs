import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(import.meta.dirname, '../../web/templates');
const OUT = resolve(import.meta.dirname, '../src/i18n/lang');
const LINE = /^\s*\$(_[A-Z0-9_]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/;

mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(SRC).filter((f) => /^emmalang_[a-z]+\.php$/.test(f))) {
  const lang = file.slice('emmalang_'.length, -'.php'.length);
  const strings = {};
  for (const line of readFileSync(resolve(SRC, file), 'utf8').split('\n')) {
    const m = LINE.exec(line);
    if (m) strings[m[1]] = m[2].replace(/\\(.)/g, '$1');
  }
  writeFileSync(resolve(OUT, `${lang}.json`), JSON.stringify(strings, null, 2) + '\n');
  console.log(`${lang}: ${Object.keys(strings).length} strings`);
}
