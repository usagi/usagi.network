#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const catalogFile = path.resolve(process.argv[2] || 'assets/data/software.json');
const refreshedFile = path.resolve(process.argv[3] || 'assets/data/software.json');
const releaseFields = ['fallbackVersion', 'fallbackReleaseTag', 'fallbackReleaseDate'];

const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const refreshed = JSON.parse(fs.readFileSync(refreshedFile, 'utf8'));
const refreshedByRepo = new Map(
 (refreshed.groups || [])
  .flatMap(group => group.items || [])
  .filter(item => item.repo)
  .map(item => [item.repo, item]),
);

for (const item of (catalog.groups || []).flatMap(group => group.items || []))
{
 const update = refreshedByRepo.get(item.repo);
 if (!update) continue;
 for (const field of releaseFields)
 {
  if (update[field]) item[field] = update[field];
 }
}

fs.writeFileSync(refreshedFile, `${JSON.stringify(catalog, null, 1)}\n`, 'utf8');
console.log(`merged refreshed release data into ${path.relative(process.cwd(), refreshedFile)}`);
