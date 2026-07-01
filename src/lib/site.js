export const site = {
  title: 'USAGI.NETWORK',
  description: 'Dr.USAGI / USAGI.NETWORK official website.',
  url: 'https://usagi.network',
  image: '/ogp/usagi-network.png',
};

export const navItems = [
  { href: '/', label: 'Home', key: 'home' },
  { href: '/stream/', label: 'Stream', key: 'stream' },
  { href: '/music/', label: 'Music', key: 'music' },
  { href: '/beatsaber/', label: 'Beat Saber', key: 'beatsaber' },
  { href: '/software/', label: 'Software', key: 'software' },
  { href: '/essay/', label: 'Essay', key: 'essay' },
  { href: '/artwork/', label: 'Artwork', key: 'artwork' },
  { href: '/about/', label: 'About', key: 'about' },
];

export function formatDate(value)
{
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toISOString().slice(0, 10);
}

export function slugify(value)
{
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function resolveThumb(url)
{
  let out = String(url || '');
  if (!out) return '';
  return out
    .replace('%{width}x%{height}', '640x360')
    .replace('{width}x{height}', '640x360');
}
