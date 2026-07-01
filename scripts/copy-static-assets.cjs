#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function copyFile(srcRel, dstRel = srcRel)
{
 const src = path.join(root, srcRel);
 const dst = path.join(dist, dstRel);
 if (!fs.existsSync(src)) return;
 fs.mkdirSync(path.dirname(dst), { recursive: true });
 fs.copyFileSync(src, dst);
}

function copyDir(srcRel, dstRel = srcRel, options = {})
{
 const src = path.join(root, srcRel);
 const dst = path.join(dist, dstRel);
 if (!fs.existsSync(src)) return;
 fs.cpSync(src, dst, {
  recursive: true,
  filter: source =>
  {
   const rel = path.relative(root, source).replace(/\\/g, '/');
   return !(options.exclude || []).some(prefix => rel === prefix || rel.startsWith(`${prefix}/`));
  },
 });
}

fs.mkdirSync(dist, { recursive: true });
copyFile('CNAME');
copyFile('favicon.ico');
copyDir('assets', 'assets', {
 exclude: [
  'assets/brand',
  'assets/icons',
  'assets/image',
  'assets/views',
  'assets/js/main.js',
  'assets/js/router.js',
  'assets/js/views/about.js',
  'assets/js/views/artwork.js',
  'assets/js/views/music.js',
  'assets/js/views/software.js',
  'assets/js/views/stream.js',
  'assets/software/un-avatar/screenshot-0.png',
  'assets/software/un-motion/screenshot-0.png',
  'assets/software/un-virtual-eye-tracker/screenshot-0.png',
 ],
});
copyDir('assets/icons', 'icons');
copyFile('assets/image/hero-noise.svg', 'image/hero-noise.svg');
copyFile('assets/image/usagi-portrait.webp', 'image/usagi-portrait.webp');
console.log('static assets copied');
