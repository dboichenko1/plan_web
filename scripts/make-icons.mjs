// Генерирует PNG-иконки приложения без зависимостей: плоская мозаика из четырёх
// плиток срочности на графитовом фоне — та же композиция, что логотип на входе.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const GAP = 1 / 22 // зазор между плитками в долях стороны
const COLORS = {
  bg: [0x0f, 0x11, 0x14],
  u4: [0xdc, 0x34, 0x35],
  u3: [0xe8, 0x95, 0x2e],
  u2: [0x3f, 0xa9, 0x7a],
  u1: [0x47, 0x57, 0x6f],
}

// Раскладка иконки: ключевая 2×2 сверху слева, остальные вокруг (в долях стороны)
const tiles = [
  { c: 'u4', x: 0.14, y: 0.14, w: 0.44, h: 0.44 },
  { c: 'u3', x: 0.14 + 0.44 + GAP, y: 0.14, w: 0.28, h: 0.21 },
  { c: 'u1', x: 0.14 + 0.44 + GAP, y: 0.14 + 0.21 + GAP, w: 0.28, h: 0.21 },
  { c: 'u2', x: 0.14, y: 0.14 + 0.44 + GAP, w: 0.44 + GAP + 0.28, h: 0.24 },
]

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, c])
}

function png(size, padScale = 1) {
  const px = Buffer.alloc(size * size * 3)
  const put = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 3
    px[i] = r; px[i + 1] = g; px[i + 2] = b
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, COLORS.bg)
  const pad = (1 - padScale) / 2
  for (const t of tiles) {
    const x0 = Math.round((pad + t.x * padScale) * size)
    const y0 = Math.round((pad + t.y * padScale) * size)
    const x1 = Math.round((pad + (t.x + t.w) * padScale) * size)
    const y1 = Math.round((pad + (t.y + t.h) * padScale) * size)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(x, y, COLORS[t.c])
  }
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8 бит, truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true })
const out = (name, buf) => writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), buf)
out('icon-192.png', png(192))
out('icon-512.png', png(512))
out('maskable-512.png', png(512, 0.72))
out('apple-touch-icon.png', png(180))
out('favicon.png', png(32))
console.log('Иконки записаны в public/icons/')
