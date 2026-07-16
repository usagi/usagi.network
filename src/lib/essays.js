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
   const normalizedData = {
    title: data.title || toSlug(file),
    subtitle: data.subtitle || '',
    author: data.author || 'USAGI.NETWORK',
    date: data.date ? new Date(data.date) : new Date(0),
    lang: data.lang || 'ja',
    description: data.description || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
   };
   const displayBody = stripCoverBlock(parsed.content, normalizedData);
   const text = displayBody.replace(/```[\s\S]*?```/g, '').replace(/[#>*_`~\-[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
   return {
    slug: toSlug(file),
    body: parsed.content,
    html: marked.parse(displayBody),
    readingMinutes: Math.max(1, Math.ceil(text.length / 650)),
    data: normalizedData,
   };
  })
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function getEssay(slug)
{
 return getEssays().find(essay => essay.slug === slug);
}

function stripCoverBlock(content, data)
{
 const lines = String(content || '').split(/\r?\n/);
 let index = 0;
 while (index < lines.length && !lines[index].trim()) index++;

 const titlePattern = new RegExp(`^#\\s+${escapeRegExp(data.title)}\\s*$`);
 if (titlePattern.test(lines[index] || '')) {
  index++;
  while (index < lines.length && !lines[index].trim()) index++;
 }

 const plainSubtitle = String(data.subtitle || '').trim();
 if (plainSubtitle) {
  const subtitle = (lines[index] || '').trim().replace(/^[-—\s]+|[-—\s]+$/g, '').trim();
  if (subtitle === plainSubtitle) {
   index++;
   while (index < lines.length && !lines[index].trim()) index++;
  }
 }

 const coverLabels = new Set(['Author', 'Published', 'Keywords']);
 while (coverLabels.has((lines[index] || '').trim()) && /^\s*:\s*\S/.test(lines[index + 1] || '')) {
  index += 2;
  while (index < lines.length && !lines[index].trim()) index++;
 }

 const author = String(data.author || '').trim();
 const authorLine = (lines[index] || '').trim().replace(/^\*\*|\*\*$/g, '').trim();
 if (author && authorLine === author) {
  index++;
  while (index < lines.length && !lines[index].trim()) index++;
 }

 return lines.slice(index).join('\n');
}

function escapeRegExp(value)
{
 return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
