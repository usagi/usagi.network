#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/data/software.json');

function localAssetPath(url)
{
 if (!url || /^https?:\/\//.test(url)) return null;
 return path.join(root, String(url).split('?')[0].replace(/^\//, ''));
}

function preferWebp(url)
{
 if (!url || !/\.png(?:$|\?)/i.test(url)) return url;
 const webp = url.replace(/\.png(?=$|\?)/i, '.webp');
 const webpPath = localAssetPath(webp);
 return webpPath && fs.existsSync(webpPath) ? webp : url;
}

function main()
{
 if (!fs.existsSync(file)) return;
 const data = JSON.parse(fs.readFileSync(file, 'utf8'));
 let changed = false;

 for (const group of data.groups || [])
 {
  for (const item of group.items || [])
  {
   if (!item.media) continue;
   const screenshot = preferWebp(item.media.screenshot);
   if (screenshot !== item.media.screenshot)
   {
    item.media.screenshot = screenshot;
    changed = true;
   }
  }
 }

 if (changed)
 {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`, 'utf8');
  console.log('normalized software media to WebP');
 } else {
  console.log('software media already normalized');
 }
}

main();
