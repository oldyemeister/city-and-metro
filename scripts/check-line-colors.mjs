import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window: {}, performance, console, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout });
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), context, { filename: src });
  if (src === 'js/save.js') break;
}
const CM = context.window.CM, palette = CM.LineColors;
const counts = { tk: 77, hz: 13, gz: 21, hk: 11, tp: 12 };
for (const [id, count] of Object.entries(counts)) {
  CM.useMap(id);
  const originals = JSON.stringify(CM.DATA.lineColorsNice);
  const groups = palette.forMap(id, CM.DATA.lineColorsNice);
  assert.equal(groups.flatMap(g => g.entries).length, count);
  const names = groups.flatMap(g => g.entries.map(e => g.operator + ':' + e.name));
  assert.equal(new Set(names).size, names.length);
  assert(groups.every(g => g.source?.startsWith('https://en.wikipedia.org/')));
  assert(groups.every(g => g.entries.every(e => /^#[0-9A-F]{6}$/.test(e.color))));
  assert.equal(JSON.stringify(CM.DATA.lineColorsNice), originals);
  if (id !== 'tk') assert(!groups.some(g => g.operator === '東京メトロ'));
}
const fixture = [
  ['hz', '1号线', '#DF4661'], ['gz', '10号线', '#7389B2'],
  ['hk', '荃灣綫', '#ED1D24'], ['tp', '三鶯線', '#79BCE8'],
];
for (const [id, name, color] of fixture) assert.equal(palette.byMap[id].flatMap(g => g.entries).find(e => e.name === name).color, color);
for (const input of ['#12abef', '12ABEF', ' 12abef ']) assert.equal(palette.parseHex(input), '#12ABEF');
for (const input of ['', '#123', '#12345', '#1234567', '#GG00FF', '#12345678', '12 3456', 'red', 'url(x)']) assert.equal(palette.parseHex(input), null);
assert.equal(palette.fromHSV(0, 100, 100), '#FF0000');
assert.equal(palette.fromHSV(120, 100, 100), '#00FF00');
assert.equal(palette.fromHSV(240, 100, 100), '#0000FF');
assert.equal(palette.fromHSV(60, 0, 100), '#FFFFFF');
assert.equal(palette.fromHSV(60, 100, 0), '#000000');
assert.equal(palette.fromHSV(0, 100, 50), '#800000');
for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const hsv = palette.toHSV(hex);
  assert.equal(palette.fromHSV(hsv.h, hsv.s, hsv.v), hex);
}
const hk = palette.byMap.hk[0];
assert(palette.matches(hk, hk.entries[1], '荃湾线'));
assert(palette.matches(hk, hk.entries[0], '港铁'));
assert(palette.matches(palette.byMap.tp[0], palette.byMap.tp[0].entries[0], '台北捷运'));
CM.useMap('tutorial');
assert.equal(palette.forMap('tutorial', ['#123456'])[0].entries[0].color, '#123456');

const savePath = process.argv[2];
if (savePath) {
  const original = fs.readFileSync(savePath, 'utf8');
  const parsed = CM.Save.parseEnvelope(original);
  CM.useMap(parsed.payload.meta.map);
  const before = JSON.stringify(parsed.payload.net);
  const game = CM.Game.restore(parsed.payload);
  assert.equal(JSON.stringify(game.net), before);
  const id = Object.keys(game.net.lines)[0], originalColor = game.net.lines[id].color;
  const count = Object.keys(game.net.stations).length;
  for (const color of ['#12ABEF', '#000000', '#FFFFFF']) {
    const previous = game.net.lines[id].color;
    game.edit(net => { net.lines[id].color = color; });
    assert.equal(game.net.lines[id].color, previous);
    assert(game.undo()); assert.equal(game.draft.net.lines[id].color, previous);
    assert(game.redo()); assert.equal(game.draft.net.lines[id].color, color);
    assert.equal(game.confirmDraft().ok, true);
    const envelope = CM.Save.envelope(game);
    assert.equal(envelope.version, parsed.env.version);
    const restored = CM.Game.restore(CM.Save.parseEnvelope(JSON.stringify(envelope)).payload);
    assert.equal(restored.net.lines[id].color, color);
    assert.equal(Object.keys(restored.net.stations).length, count);
  }
  assert.equal(fs.readFileSync(savePath, 'utf8'), original);
  console.log(`Save round-trip passed: ${count} stations, original color ${originalColor}, custom / black / white.`);
}
console.log('Passed: city routing, source fixtures, unique line entries, search aliases, HEX validation, 4096 HSV round-trips, tutorial fallback.');
