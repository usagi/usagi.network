const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/data/software.json');

async function main()
{
 const data = JSON.parse(await fs.readFile(file, 'utf8'));
 for (const group of data.groups || [])
 {
  for (const item of group.items || [])
  {
   if (!item.repo) continue;
   const release = await fetchLatestRelease(item.repo) || await fetchLatestTag(item.repo);
   if (!release) continue;
   item.fallbackVersion = release.tag.startsWith('v') ? release.tag : `v${release.tag}`;
   if (release.date) item.fallbackReleaseDate = release.date;
  }
 }
 await fs.writeFile(file, `${JSON.stringify(data, null, 1)}\n`);
 console.log(`updated ${path.relative(root, file)}`);
}

async function fetchLatestRelease(repo)
{
 try
 {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
   headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const tag = String(data.tag_name || '').trim();
  if (!tag) return null;
  return {
   tag,
   date: data.published_at || data.created_at || '',
  };
 } catch { return null; }
}

async function fetchLatestTag(repo)
{
 try
 {
  const res = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=1`, {
   headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const tag = String(Array.isArray(data) ? data[0]?.name || '' : '').trim();
  if (!tag) return null;
  return { tag, date: '' };
 } catch { return null; }
}

main().catch(err =>
{
 console.error(err);
 process.exit(1);
});
