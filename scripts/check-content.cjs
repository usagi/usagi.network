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

function requireText(value, source)
{
 if (!String(value || '').trim()) failures.push(`${source}: missing text`);
}

function requireIsoDate(value, source)
{
 if (!String(value || '').trim()) failures.push(`${source}: missing date`);
 else if (Number.isNaN(Date.parse(value))) failures.push(`${source}: invalid date ${value}`);
}

function checkUniqueIds(groups, source)
{
 const seen = new Set();
 for (const group of groups || [])
 {
  if (!group.id) failures.push(`${source}: group missing id`);
  else if (seen.has(group.id)) failures.push(`${source}: duplicate group id ${group.id}`);
  else seen.add(group.id);
 }
}

function checkSoftware()
{
 const data = readJson('assets/data/software.json');
 checkUniqueIds(data.groups, 'software');
 for (const group of data.groups || [])
 {
  for (const item of group.items || [])
  {
   requireText(item.title, `${group.id} item title`);
   requireText(item.tag, `${item.title} tag`);
   requireText(item.description, `${item.title} description`);
   existsAsset(item.media?.screenshot, `${item.title} screenshot`);
   existsAsset(item.media?.icon, `${item.title} icon`);
   if (!item.repo) failures.push(`${item.title}: missing repo`);
   if (!item.fallbackVersion) failures.push(`${item.title}: missing fallbackVersion`);
   requireIsoDate(item.fallbackReleaseDate, `${item.title} fallbackReleaseDate`);
   checkProtocolOrder(item);
  }
 }
}

function checkProtocolOrder(item)
{
 const specs = item.specs || [];
 const order = ['UNMF/Z', 'VMC/UDP', 'VMC/OSC', 'iFacialMocap'];
 const present = order
  .map(name => ({ name, index: specs.indexOf(name) }))
  .filter(x => x.index >= 0);
 for (let i = 1; i < present.length; i++)
 {
  if (present[i - 1].index > present[i].index)
  {
   failures.push(`${item.title}: protocol order should keep UNMF/Z before VMC before iFacialMocap`);
   return;
  }
 }
}

function checkArtwork()
{
 const data = readJson('assets/data/artwork.json');
 checkUniqueIds(data.groups, 'artwork');
 for (const group of data.groups || [])
 {
  requireText(group.title, `${group.id} title`);
  for (const item of group.items || [])
  {
   requireText(item.title, `${group.id} artwork title`);
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
