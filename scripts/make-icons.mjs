import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#1e3a8a"/>
  <circle cx="50" cy="52" r="30" fill="none" stroke="#fff" stroke-width="6"/>
  <circle cx="50" cy="52" r="17" fill="#fff"/>
  <rect x="14" y="26" width="6" height="40" rx="3" fill="#fff"/>
  <rect x="80" y="26" width="6" height="40" rx="3" fill="#fff"/>
</svg>`

mkdirSync('public/icons', { recursive: true })
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}
console.log('icons written')
