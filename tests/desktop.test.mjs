import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
const require = createRequire(import.meta.url)
const core = require('../electron/core.cjs')
const area = { x: -1920, y: 30, width: 1920, height: 1010 }
const bounds = { x: -300, y: 800, width: 96, height: 80 }

test('dog stays within usable areas, including negative monitor coordinates and tiny displays', () => {
  for (const candidate of [{ ...bounds, x:-9000, y:-2000 }, { ...bounds, x:9000, y:9000 }]) {
    const result = core.clampBounds(candidate, area)
    assert.ok(result.x >= area.x && result.y >= area.y)
    assert.ok(result.x + result.width <= area.x + area.width)
    assert.ok(result.y + result.height <= area.y + area.height)
  }
  assert.deepEqual(core.clampBounds(bounds, { x:0,y:0,width:60,height:40 }), { x:0,y:0,width:60,height:40 })
})
test('walking bounces at both boundaries without stepping past them', () => {
  const left = core.stepWalk({ ...bounds, x: area.x }, area, -1, .25)
  assert.equal(left.bounds.x, area.x); assert.equal(left.direction, 1)
  const right = core.stepWalk({ ...bounds, x:area.x+area.width-bounds.width }, area, 1, .25)
  assert.equal(right.bounds.x + right.bounds.width, area.x + area.width); assert.equal(right.direction,-1)
})
test('click versus drag uses a six-DIP threshold and remembers a drag even if returned to origin', () => {
  const start = { x:100, y:100 }
  const gesture = core.beginGesture(start, bounds)
  assert.equal(core.updateGesture(gesture,{x:103,y:102},area).gesture.dragged,false)
  const dragged = core.updateGesture(gesture,{x:107,y:100},area)
  assert.equal(dragged.gesture.dragged,true)
  assert.equal(core.updateGesture(dragged.gesture,start,area).gesture.dragged,true)
  assert.equal(core.updateGesture(gesture,{x:9999,y:9999},area).bounds.x + bounds.width, area.x+area.width)
})
test('sleep overrides walking during focus; happiness briefly overrides sleep', () => {
  const state = { focus:{running:true,endsAt:2000},happyUntil:0,moving:true,now:1000 }
  assert.equal(core.animationMode(state),'sleep')
  assert.equal(core.animationMode({...state,happyUntil:1100}),'happy')
  assert.equal(core.animationMode({...state,now:3000}),'walk')
  assert.equal(core.animationMode({...state,moving:false,focus:{running:false}}),'idle')
})
test('desktop preferences reject arbitrary IPC values and startup is opt-in', () => {
  assert.equal(core.DEFAULTS.launchAtLogin,false)
  for(const [key,value] of [['size',400],['visible','yes'],['launchAtLogin',1],['path','C:/']]) assert.throws(()=>core.validatePreference(key,value))
  const result=core.readPreferences({visible:false,size:128,paused:true,position:{x:-200,y:70},launchAtLogin:false})
  assert.equal(result.visible,false);assert.equal(result.size,128);assert.equal(result.position.x,-200)
  assert.equal(core.readPreferences({size:999}).size,96)
  assert.throws(()=>core.validateFocus({running:true,endsAt:Infinity}))
})
test('all original dog animations have distinct frames and valid pixel hit regions at every size', async () => {
  const metadata = JSON.parse((await readFile(new URL('../electron/pet/assets/animations.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''))
  for(const mode of ['idle','walk','sleep','happy']) {
    const svg = await readFile(new URL(`../electron/pet/assets/${mode}.svg`,import.meta.url),'utf8')
    assert.match(svg,/shape-rendering="crispEdges"/)
    assert.ok(metadata[mode].frames.length>=2)
    assert.ok(new Set(metadata[mode].frames.map(frame=>JSON.stringify(frame))).size>1)
    for(const frame of metadata[mode].frames) for(const size of core.SIZES) for(const direction of [-1,1]) {
      const dimensions=core.dimensions(size)
      const shape=core.shapeForFrame(frame,size,direction)
      assert.ok(shape.length>0)
      for(const rectangle of shape) assert.ok(rectangle.x>=0 && rectangle.y>=0 && rectangle.x+rectangle.width<=dimensions.width && rectangle.y+rectangle.height<=dimensions.height)
    }
  }
})
test('bundled asset routing prevents traversal, unknown origins and access to preload code', () => {
  const roots={app:path.resolve('dist'),pet:path.resolve('electron/pet')}
  assert.equal(core.resolveAsset('lau://app/',roots,path),path.resolve('dist/index.html'))
  for(const url of ['https://example.com/', 'lau://other/', 'lau://app/%2e%2e%2fpackage.json', 'lau://app/%5c..%5cpackage.json','lau://pet/../main.cjs','lau://app/%00.js']) assert.throws(()=>core.resolveAsset(url,roots,path))
})
