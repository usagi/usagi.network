const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/data/dictionary.json');
const apiRoot = 'https://api.github.com';

async function main()
{
 const data = JSON.parse(await fs.readFile(file, 'utf8'));
 const repo = String(data.repo || '').trim();
 if (!repo) throw new Error('dictionary repo is missing');

 const repository = await githubJson(`/repos/${repo}`);
 const branch = repository.default_branch || 'main';
 const release = await githubJson(`/repos/${repo}/releases/latest`);
 const commits = await fetchCommitRange(repo, branch);
 const tree = await githubJson(`/repos/${repo}/git/trees/${commits.last.sha}?recursive=1`);
 const asset = (release.assets || []).find(item => item.name === data.downloadAssetName);
 if (!asset) throw new Error(`release asset not found: ${data.downloadAssetName}`);
 const sourceFiles = (tree.tree || []).filter(item =>
  item.type === 'blob'
  && /\.txt$/i.test(item.path || '')
  && String(item.path || '').includes('/')
  && item.path !== data.downloadAssetName);
 const sourceCounts = await mapLimit(sourceFiles, 8, async item => ({
  path: item.path,
  count: countEntries(await fetchRawFile(repo, commits.last.sha, item.path)),
 }));
 const countsByRoot = new Map();
 for (const item of sourceCounts)
 {
  const rootName = String(item.path || '').split('/')[0];
  countsByRoot.set(rootName, (countsByRoot.get(rootName) || 0) + item.count);
 }

 data.fallbackVersion = String(release.tag_name || data.fallbackVersion || '').replace(/^v/i, '');
 data.fallbackReleaseTag = release.tag_name || data.fallbackReleaseTag;
 data.fallbackReleaseDate = release.published_at || release.created_at || data.fallbackReleaseDate;
 data.downloadUrl = asset.browser_download_url || data.downloadUrl;
 data.downloadDigest = asset.digest || data.downloadDigest;
 data.downloadSize = Number(asset.size || data.downloadSize || 0);
 data.firstCommittedAt = commits.first.committer.date;
 data.lastCommittedAt = commits.last.committer.date;
 data.sourceFileCount = sourceFiles.length;
 data.entryCount = sourceCounts.reduce((sum, item) => sum + item.count, 0);
 for (const category of data.categories || [])
 {
  category.entryCount = (category.roots || []).reduce((sum, rootName) => sum + (countsByRoot.get(rootName) || 0), 0);
 }

 await fs.writeFile(file, `${JSON.stringify(data, null, 1)}\n`);
 console.log(`updated ${path.relative(root, file)} (${data.sourceFileCount} files, ${data.entryCount} entries)`);
}

async function fetchCommitRange(repo, branch)
{
 const firstResponse = await githubResponse(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`);
 const newest = await firstResponse.json();
 if (!Array.isArray(newest) || !newest[0]) throw new Error('latest commit not found');

 const lastPageUrl = parseLastLink(firstResponse.headers.get('link'));
 const oldest = lastPageUrl ? await githubJson(lastPageUrl) : newest;
 if (!Array.isArray(oldest) || !oldest[0]) throw new Error('first commit not found');

 return {
  first: normalizeCommit(oldest[oldest.length - 1]),
  last: normalizeCommit(newest[0]),
 };
}

function normalizeCommit(item)
{
 const commit = item?.commit || {};
 return {
  sha: item?.sha || '',
  committer: {
   date: commit.committer?.date || commit.author?.date || '',
  },
 };
}

function parseLastLink(value)
{
 for (const part of String(value || '').split(','))
 {
  const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
  if (match?.[2] === 'last') return match[1];
 }
 return '';
}

function countEntries(text)
{
 return text.split(/\r?\n/).filter(line => line.trim()).length;
}

async function fetchRawFile(repo, sha, filePath)
{
 const encodedPath = String(filePath || '').split('/').map(encodeURIComponent).join('/');
 const url = `https://raw.githubusercontent.com/${repo}/${sha}/${encodedPath}`;
 const response = await fetch(url, { headers: { 'User-Agent': 'usagi-network-refresh' } });
 if (!response.ok) throw new Error(`dictionary source failed ${response.status}: ${filePath}`);
 return response.text();
}

async function mapLimit(items, limit, mapper)
{
 const results = new Array(items.length);
 let cursor = 0;
 async function worker()
 {
  while (cursor < items.length)
  {
   const index = cursor++;
   results[index] = await mapper(items[index], index);
  }
 }
 await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
 return results;
}

async function githubJson(resource)
{
 const response = await githubResponse(resource);
 return response.json();
}

async function githubResponse(resource)
{
 const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
 const url = /^https?:\/\//.test(resource) ? resource : `${apiRoot}${resource}`;
 const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'usagi-network-refresh',
  'X-GitHub-Api-Version': '2022-11-28',
 };
 if (token) headers.Authorization = `Bearer ${token}`;
 const response = await fetch(url, { headers });
 if (!response.ok) throw new Error(`GitHub API ${response.status}: ${url}`);
 return response;
}

main().catch(err =>
{
 console.error(err);
 process.exit(1);
});
