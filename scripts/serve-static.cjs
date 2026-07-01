const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || process.env.PORT || 4173);

const types = {
 '.css': 'text/css; charset=utf-8',
 '.html': 'text/html; charset=utf-8',
 '.ico': 'image/x-icon',
 '.js': 'text/javascript; charset=utf-8',
 '.json': 'application/json; charset=utf-8',
 '.png': 'image/png',
 '.svg': 'image/svg+xml',
 '.wasm': 'application/wasm',
 '.webp': 'image/webp',
};

http.createServer((req, res) =>
{
 const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
 const pathname = decodeURIComponent(url.pathname);
 const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
 let file = path.resolve(root, rel);
 if (!file.startsWith(root))
 {
  res.writeHead(403);
  res.end('Forbidden');
  return;
 }
 try
 {
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  else if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  else if (!path.extname(file) && fs.existsSync(path.join(file, 'index.html'))) file = path.join(file, 'index.html');
 } catch { }
 fs.readFile(file, (err, data) =>
 {
  if (err)
  {
   res.writeHead(404);
   res.end('Not found');
   return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  res.end(data);
 });
}).listen(port, '127.0.0.1', () =>
{
 console.log(`serving ${root} at http://127.0.0.1:${port}/`);
});
