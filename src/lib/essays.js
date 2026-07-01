import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const essayDir = path.resolve('src/content/essays');

function toSlug(file)
{
 return path.basename(file, path.extname(file));
}

export function getEssays()
{
 if (!fs.existsSync(essayDir)) return [];
 return fs.readdirSync(essayDir)
  .filter(file => file.endsWith('.md'))
  .map(file =>
  {
   const fullPath = path.join(essayDir, file);
   const raw = fs.readFileSync(fullPath, 'utf8');
   const parsed = matter(raw);
   const data = parsed.data || {};
   return {
    slug: toSlug(file),
    body: parsed.content,
    html: marked.parse(parsed.content),
    data: {
     title: data.title || toSlug(file),
     subtitle: data.subtitle || '',
     author: data.author || 'USAGI.NETWORK',
     date: data.date ? new Date(data.date) : new Date(0),
     lang: data.lang || 'ja',
     description: data.description || '',
     tags: Array.isArray(data.tags) ? data.tags : [],
    },
   };
  })
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function getEssay(slug)
{
 return getEssays().find(essay => essay.slug === slug);
}

