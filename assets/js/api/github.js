export async function getLatestGitHubVersion(repo)
{
 const cacheKey = `github:release:${repo}`;
 try
 {
  const raw = sessionStorage.getItem(cacheKey);
  if (raw)
  {
   const cached = JSON.parse(raw);
   if (cached && cached.ts && (Date.now() - cached.ts) < 10 * 60_000) return cached.value;
  }
 } catch { }

 const value = await fetchLatestRelease(repo) || await fetchLatestTag(repo);
 if (value)
 {
  try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), value })); } catch { }
 }
 return value;
}

export async function getLatestGitHubReleases(repos)
{
 const results = await Promise.all((repos || []).map(async (repo) =>
 {
  const latest = await getLatestGitHubVersion(repo);
  return latest ? { repo, ...latest } : null;
 }));
 return results.filter(Boolean);
}

async function fetchLatestRelease(repo)
{
 try
 {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
   cache: 'no-store',
   headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const tag = normalizeVersion(data.tag_name || data.name || '');
  if (!tag) return null;
  return {
   version: tag,
   rawTag: data.tag_name || tag,
   url: data.html_url || `https://github.com/${repo}/releases/tag/${encodeURIComponent(data.tag_name || tag)}`,
   title: data.name || data.tag_name || `v${tag}`,
   date: data.published_at || data.created_at || '',
  };
 } catch { return null; }
}

async function fetchLatestTag(repo)
{
 try
 {
  const res = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=1`, {
   cache: 'no-store',
   headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const tags = await res.json();
  const name = Array.isArray(tags) ? tags[0]?.name : '';
  const version = normalizeVersion(name || '');
  if (!version) return null;
  return {
   version,
   rawTag: name,
   url: `https://github.com/${repo}/releases/tag/${encodeURIComponent(name)}`,
   title: name,
   date: '',
  };
 } catch { return null; }
}

function normalizeVersion(value)
{
 return String(value || '').trim().replace(/^v/i, '');
}
