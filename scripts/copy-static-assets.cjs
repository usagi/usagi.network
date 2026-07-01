#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function copyFile(rel)
{
 const src = path.join(root, rel);
 const dst = path.join(dist, rel);
 if (!fs.existsSync(src)) return;
 fs.mkdirSync(path.dirname(dst), { recursive: true });
 fs.copyFileSync(src, dst);
}

function copyDir(srcRel, dstRel = srcRel)
{
 const src = path.join(root, srcRel);
 const dst = path.join(dist, dstRel);
 if (!fs.existsSync(src)) return;
 fs.cpSync(src, dst, { recursive: true });
}

fs.mkdirSync(dist, { recursive: true });
copyFile('CNAME');
copyFile('favicon.ico');
copyDir('assets', 'assets');
copyDir('assets/icons', 'icons');
copyDir('assets/image', 'image');
console.log('static assets copied');

