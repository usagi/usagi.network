#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

const catalogFile = path.resolve(process.argv[2] || 'assets/data/dictionary.json');
const refreshedFile = path.resolve(process.argv[3] || 'assets/data/dictionary.json');
const dynamicFields = [
 'fallbackVersion',
 'fallbackReleaseTag',
 'fallbackReleaseDate',
 'downloadUrl',
 'downloadDigest',
 'downloadSize',
 'firstCommittedAt',
 'lastCommittedAt',
 'sourceFileCount',
 'entryCount',
];

const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
const refreshed = JSON.parse(fs.readFileSync(refreshedFile, 'utf8'));
for (const field of dynamicFields)
{
 if (refreshed[field] !== undefined && refreshed[field] !== '') catalog[field] = refreshed[field];
}
const refreshedCategories = new Map((refreshed.categories || []).map(category => [category.id, category]));
for (const category of catalog.categories || [])
{
 const update = refreshedCategories.get(category.id);
 if (update && Number.isFinite(Number(update.entryCount))) category.entryCount = Number(update.entryCount);
}

fs.writeFileSync(refreshedFile, `${JSON.stringify(catalog, null, 1)}\n`, 'utf8');
console.log(`merged refreshed dictionary data into ${path.relative(process.cwd(), refreshedFile)}`);
