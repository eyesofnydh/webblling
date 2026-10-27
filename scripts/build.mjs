// Clean build: runs the test suite, copies only the files the extension needs
// into dist/webling/, verifies every path the manifest references, and packs
// dist/webling-<version>.zip (ready for "Load unpacked" or the store).
//
// Usage: node scripts/build.mjs [--skip-tests]
// No dependencies; uses Node's built-in zlib for the zip.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const outDir = path.join(distDir, 'webling');

const RUNTIME_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'onboarding.html',
  'onboarding.css',
  'onboarding.js',
  'modules/storage.js',
  'modules/achievements.js',
  'modules/dialogue.js',
  'assets/icon-16.png',
  'assets/icon-32.png',
  'assets/icon-48.png',
  'assets/icon-128.png',
  'assets/hero-webling.png',
  'assets/hero-titan.png',
  'assets/hero-stormbringer.png',
  'assets/hero-classic.png',
  'assets/hero-lineup.png',
];

function fail(message) {
  console.error(`\n✗ Build failed: ${message}`);
  process.exit(1);
}

// 1. Tests
if (!process.argv.includes('--skip-tests')) {
  console.log('Running tests…');
  try {
    execFileSync(process.execPath, [path.join(root, 'tests', 'test-suite.mjs')], { stdio: 'pipe' });
    console.log('  ✓ test suite passed');
  } catch (err) {
    process.stdout.write(err.stdout?.toString() || '');
    fail('test suite failed');
  }
}

// 2. Fresh output folder
fs.rmSync(distDir, { recursive: true, force: true });
for (const rel of RUNTIME_FILES) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) fail(`missing file ${rel}`);
  const dest = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// 3. Every path referenced by the manifest and the HTML pages must be in the build
const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
const referenced = new Set([
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
  ...(manifest.content_scripts || []).flatMap((c) => [...(c.js || []), ...(c.css || [])]),
  ...(manifest.web_accessible_resources || []).flatMap((w) => w.resources),
].filter(Boolean));

for (const page of ['popup.html', 'onboarding.html']) {
  const html = fs.readFileSync(path.join(outDir, page), 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) referenced.add(ref);
}
for (const script of ['background.js', 'content.js', 'popup.js', 'onboarding.js']) {
  const js = fs.readFileSync(path.join(outDir, script), 'utf8');
  for (const [, ref] of js.matchAll(/getURL\(\s*'([^']+)'\s*\)/g)) referenced.add(ref);
  for (const [, ref] of js.matchAll(/from\s+'\.\/([^']+)'/g)) referenced.add(ref);
}
for (const ref of referenced) {
  if (!fs.existsSync(path.join(outDir, ref))) fail(`"${ref}" is referenced but not in the build`);
}
console.log(`  ✓ ${referenced.size} referenced files present`);

// 4. Zip (store-only for PNGs, deflate for text)
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const locals = [];
const centrals = [];
let offset = 0;
for (const rel of RUNTIME_FILES) {
  const data = fs.readFileSync(path.join(outDir, rel));
  const deflate = !rel.endsWith('.png');
  const body = deflate ? zlib.deflateRawSync(data, { level: 9 }) : data;
  const name = Buffer.from(rel.replace(/\\/g, '/'));
  const crc = crc32(data);
  const method = deflate ? 8 : 0;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(0, 10); // time/date
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, name, body);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(0, 12);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);
  offset += local.length + name.length + body.length;
}
const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(RUNTIME_FILES.length, 8);
end.writeUInt16LE(RUNTIME_FILES.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const zipPath = path.join(distDir, `webling-${manifest.version}.zip`);
fs.writeFileSync(zipPath, Buffer.concat([...locals, ...centrals, end]));

const kb = (fs.statSync(zipPath).size / 1024).toFixed(0);
console.log(`  ✓ dist/webling/ (${RUNTIME_FILES.length} files)`);
console.log(`  ✓ ${path.relative(root, zipPath)} (${kb} KB)`);
console.log('\nLoad unpacked: select the dist/webling folder.');
