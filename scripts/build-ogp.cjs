const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets/brand/un-logo-2026c.png');
const output = path.join(root, 'public/ogp/usagi-network.png');

const width = 1200;
const height = 630;
const logoCrop = { left: 0, top: 0, width: 1254, height: 850 };
const logoWidth = 930;
const logoHeight = 630;
const logoLeft = Math.round((width - logoWidth) / 2);

async function main()
{
 await fs.mkdir(path.dirname(output), { recursive: true });

 const background = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
   <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0" stop-color="#050509"/>
     <stop offset="1" stop-color="#09080e"/>
    </linearGradient>
    <linearGradient id="a" x1="0" y1="0" x2="1" y2="0">
     <stop offset="0" stop-color="#c492ff" stop-opacity="0"/>
     <stop offset="0.12" stop-color="#c492ff" stop-opacity="0.34"/>
     <stop offset="0.88" stop-color="#c492ff" stop-opacity="0.34"/>
     <stop offset="1" stop-color="#c492ff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="0">
     <stop offset="0" stop-color="#f79cd3" stop-opacity="0"/>
     <stop offset="0.12" stop-color="#f79cd3" stop-opacity="0.31"/>
     <stop offset="0.88" stop-color="#f79cd3" stop-opacity="0.31"/>
     <stop offset="1" stop-color="#f79cd3" stop-opacity="0"/>
    </linearGradient>
   </defs>
   <rect width="1200" height="630" fill="url(#bg)"/>
   <line x1="120" y1="624" x2="1080" y2="624" stroke="url(#a)" stroke-width="1"/>
   <line x1="340" y1="617" x2="860" y2="617" stroke="url(#b)" stroke-width="1"/>
  </svg>`);

 const logo = await sharp(source)
  .extract(logoCrop)
  .resize(logoWidth, logoHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();

 await sharp(background)
  .composite([{ input: logo, left: logoLeft, top: 0 }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output);

 console.log(`Wrote ${path.relative(root, output)}`);
}

main().catch(err =>
{
 console.error(err);
 process.exit(1);
});
