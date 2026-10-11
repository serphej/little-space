import { writeFile, mkdir } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
const directory = new URL('../electron/pet/assets/', import.meta.url)
await mkdir(directory, { recursive: true })
const palette = { outline: '#654638', fur: '#dda974', light: '#f9ddac', shade: '#b8784c', ear: '#a6613f', dark: '#352f38', collar: '#537fc6', heart: '#e688a3', z: '#afc9ed' }
function dog(mode, frame) {
  const grid = Array.from({ length: 40 }, () => Array(48).fill(null))
  function rect(x, y, w, h, color) {
    for (let row = Math.max(0,y); row < Math.min(40,y+h); row++) for (let col = Math.max(0,x); col < Math.min(48,x+w); col++) grid[row][col] = palette[color] || color
  }
  const bob = mode === 'happy' ? [0,-2,-3,-1][frame] : mode === 'walk' ? frame % 2 : mode === 'idle' ? frame : 0
  if (mode === 'sleep') {
    rect(8,26,30,8,'outline'); rect(10,24,24,10,'outline'); rect(11,25,22,8,'fur'); rect(14,26,15,5,'light')
    rect(28,24,12,9,'outline'); rect(29,25,10,7,'light'); rect(27,24,5,8,'ear'); rect(33,28,4,1,'dark'); rect(39,29,3,3,'dark')
    rect(7,28,8,3,'shade'); rect(13,32,6,2,'light'); rect(28,32,6,2,'light')
    const zy = 9 - frame
    rect(34,zy,5,1,'z'); rect(37,zy+1,1,1,'z'); rect(36,zy+2,1,1,'z'); rect(35,zy+3,1,1,'z'); rect(34,zy+4,5,1,'z')
    if (frame > 0) { rect(41,zy-3,4,1,'z'); rect(43,zy-2,1,1,'z'); rect(42,zy-1,1,1,'z'); rect(41,zy,4,1,'z') }
  } else {
    const dy = bob
    // A cream-and-caramel pup with floppy ears and a blue bandana.
    const wag = frame % 2
    rect(5,17+dy-wag*2,3,7,'outline'); rect(7,21+dy,6,3,'outline'); rect(6,18+dy-wag*2,2,5,'fur')
    rect(11,21+dy,22,11,'outline'); rect(12,20+dy,19,2,'outline'); rect(12,22+dy,20,8,'fur'); rect(14,24+dy,14,5,'light')
    const leg = mode === 'walk' ? [0,2,0,-2][frame] : 0
    rect(12+leg,29+dy,4,6-dy,'outline'); rect(13+leg,30+dy,2,4-dy,'light')
    rect(26-leg,29+dy,4,6-dy,'outline'); rect(27-leg,30+dy,2,4-dy,'light')
    rect(27,13+dy,11,15,'outline'); rect(29,11+dy,7,3,'outline'); rect(28,14+dy,10,12,'light')
    rect(34,20+dy,7,6,'outline'); rect(35,21+dy,5,4,'light'); rect(39,21+dy,3,3,'dark')
    rect(26,14+dy,5,12,'outline'); rect(27,15+dy,4,10,'ear'); rect(28,16+dy,2,7,'shade')
    if (mode === 'happy') { rect(34,17+dy,3,1,'dark'); rect(33,18+dy,1,1,'dark'); rect(37,25+dy,2,2,'heart') }
    else if (mode === 'idle' && frame === 1) rect(34,18+dy,3,1,'dark')
    else { rect(35,17+dy,2,3,'dark'); rect(35,17+dy,1,1,'#ffffff') }
    rect(27,27+dy,8,2,'collar'); rect(29,29+dy,4,3,'collar'); rect(30,32+dy,2,1,'collar')
    if (mode === 'happy') {
      const heartY = 5 - frame
      rect(17,heartY,2,2,'heart'); rect(21,heartY,2,2,'heart'); rect(16,heartY+2,8,2,'heart'); rect(17,heartY+4,6,1,'heart'); rect(18,heartY+5,4,1,'heart'); rect(19,heartY+6,2,1,'heart')
    }
  }
  return grid
}
function rectangles(grid) {
  const rects = []
  for (let y = 0; y < 40; y++) {
    let x = 0
    while (x < 48) {
      if (!grid[y][x]) { x++; continue }
      const start = x
      while (x < 48 && grid[y][x]) x++
      rects.push({ x:start, y, width:x-start, height:1 })
    }
  }
  return rects
}
const animations = {}
for (const [mode, count, interval] of [['idle',2,650], ['walk',4,160], ['sleep',3,700], ['happy',4,150]]) {
  const frames = Array.from({ length: count }, (_, frame) => dog(mode, frame))
  const pixels = frames.flatMap((grid, frame) => grid.flatMap((row, y) => row.map((color,x) => color ? `<rect x="${frame*48+x}" y="${y}" width="1" height="1" fill="${color}"/>` : '').filter(Boolean)))
  await writeFile(new URL(`${mode}.svg`, directory), `<svg xmlns="http://www.w3.org/2000/svg" width="${count*48}" height="40" viewBox="0 0 ${count*48} 40" shape-rendering="crispEdges">${pixels.join('')}</svg>`)
  animations[mode] = { interval, frames: frames.map(rectangles) }
}
await writeFile(new URL('animations.json', directory), JSON.stringify(animations))
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name,data])))
  return Buffer.concat([length,name,data,crc])
}
const face = Array.from({length:32},()=>Array(32).fill(null))
function faceRect(x,y,w,h,color) { for(let row=y;row<y+h;row++) for(let col=x;col<x+w;col++) face[row][col]=palette[color] }
faceRect(7,5,18,22,'outline'); faceRect(8,6,16,20,'light'); faceRect(3,7,6,17,'ear'); faceRect(23,7,6,17,'ear')
faceRect(10,12,3,3,'dark');faceRect(19,12,3,3,'dark');faceRect(14,18,4,3,'dark');faceRect(15,21,2,2,'shade');faceRect(8,26,16,4,'collar')
const size = 256
const raw = Buffer.alloc(size*(size*4+1))
for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
  const color = face[Math.floor(y/8)][Math.floor(x/8)]
  if(!color) continue
  const index = y*(size*4+1)+1+x*4
  raw[index]=parseInt(color.slice(1,3),16);raw[index+1]=parseInt(color.slice(3,5),16);raw[index+2]=parseInt(color.slice(5,7),16);raw[index+3]=255
}
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])
await writeFile(new URL('../../icon.png',directory),png)
const icoHeader=Buffer.alloc(22);icoHeader.writeUInt16LE(1,2);icoHeader.writeUInt16LE(1,4);icoHeader.writeUInt16LE(1,10);icoHeader.writeUInt16LE(32,12);icoHeader.writeUInt32LE(png.length,14);icoHeader.writeUInt32LE(22,18)
await writeFile(new URL('../../icon.ico',directory),Buffer.concat([icoHeader,png]))
console.log('Created original Mochi dog: idle, walk, sleep, happy, pixel hit shapes, and desktop icons.')
