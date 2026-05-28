const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];

function readJson(rel)
{
 return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function existsAsset(url, source)
{
 if (!url || /^https?:\/\//.test(url)) return;
 const clean = url.split('?')[0].replace(/^\//, '');
 const file = path.join(root, clean);
 if (!fs.existsSync(file)) failures.push(`${source}: missing ${url}`);
}

function checkSoftware()
{
 const data = readJson('assets/data/software.json');
 for (const group of data.groups || [])
 {
  for (const item of group.items || [])
  {
   existsAsset(item.media?.screenshot, `${item.title} screenshot`);
   existsAsset(item.media?.icon, `${item.title} icon`);
   if (!item.repo) failures.push(`${item.title}: missing repo`);
  }
 }
}

function checkArtwork()
{
 const data = readJson('assets/data/artwork.json');
 for (const group of data.groups || [])
 {
  for (const item of group.items || [])
  {
   existsAsset(item.src, `${group.title} / ${item.title}`);
  }
 }
}

checkSoftware();
checkArtwork();

if (failures.length)
{
 console.error(failures.join('\n'));
 process.exit(1);
}
console.log('content ok');
