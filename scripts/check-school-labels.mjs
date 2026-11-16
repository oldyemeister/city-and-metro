// Focused school label checks; synthetic canvas and map, no player storage.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const c = { console, CM: {}, performance }; c.window = c; vm.createContext(c);
const load = file => vm.runInContext(readFileSync(new URL(file, root), 'utf8'), c, { filename: file });
load('js/util.js'); load('js/config.js');
c.CM.DATA = { plans: {}, landmarks: [] };
c.CM.GEOS = { sh: { proj: { lon0: 121.31, lat0: 31.42, kx: 380.6, ky: 442.3 } } };
load('js/data_sh.js');
const data = c.CM.MAP_LIST.find(m => m.id === 'sh').data;
c.CM.MAP_LIST = [];
vm.runInContext(execFileSync('git', ['show', 'HEAD:js/data_sh.js'], { cwd: root, encoding: 'utf8' }), c);
const baseline = c.CM.MAP_LIST.find(m => m.id === 'sh').data;
const plain = x => JSON.parse(JSON.stringify(x));
const withoutNames = x => { const v = plain(x); for (const f of v.facilities) { delete f.n; delete f.label; } return v; };
// Facility data may evolve under P1; this check owns rendering and legacy label behavior.
// IDs, dates, weights and event invariants are covered by check-shanghai-p1.mjs.
assert.deepEqual(data.landmarks.map(f=>f.id), baseline.landmarks.map(f=>f.id), 'Preserve landmark IDs');
const ids = ['sh_fudan', 'sh_sjtu', 'sh_shu', 'sh_dhu', 'sh_sisu_hongkou', 'sh_ecupl_changning', 'sh_shcm_fenyang'];
for (const f of data.facilities) {
  if (ids.includes(f.id)) assert.equal(f.label.replace('\n', ''), f.n);
  else if (f.label?.includes('\n')) assert.equal(f.label.replace('\n', ''), f.n);
}
load('js/accessibility.js'); load('js/facility.js'); load('js/render.js');
const C = c.CM, calls = [];
const ctx = new Proxy({ measureText: text => ({ width: text.length * 12 }), fillText: (text, x, y) => calls.push({ text, x, y }) }, { get: (o, k) => o[k] || (() => {}) });
const r = new C.Renderer({ getContext: () => ctx });
Object.assign(r, { w: 1800, h: 500, z: 20, layer: 'fac', dt: .25, P: (x, y) => ({ x, y }) });
const schools = ids.map((id, i) => ({ ...data.facilities.find(f => f.id === id), x: 120 + 240 * i, y: 80, p: { sc: 1 } }));
const items = schools.map(s => ({ f: { ...s, name: s.n }, v: 5000, tv: 5000, share: .4, tshare: .4, cov: .5, alpha: 1, la: 0 }));
r.facSmooth = () => ({ vmax: 5000, list: items });
for (const layer of ['fac', 'gap']) {
  r.layer = layer; calls.length = 0; items.forEach(it => { it.cov = .1; }); r.drawFacilities(ctx);
  for (const s of schools) {
    const [name, campus] = s.label.split('\n');
    const a = calls.find(q => q.text === name), b = calls.find(q => q.text === campus && q.x === a.x), val = calls.find(q => q.text.includes('人次') && q.x === a.x);
    assert.equal(b.y - a.y, 14); assert.equal(val.y - b.y, 14);
  }
  assert.equal(r._layerRects.filter(b => b[3] - b[1] === 42).length, ids.length);
}
// Existing single-line university and non-school labels keep the old short-name behavior.
for (const t of ['uni', 'hosp']) {
  calls.length = 0; r.facSmooth = () => ({ vmax: 5000, list: [{ ...items[0], f: { ...items[0].f, name: '原名称（备注）', label: '原名称（备注）', t } }] });
  r.drawFacilities(ctx); assert.ok(calls.some(q => q.text === '原名称')); assert.equal(calls.length, 2);
}
// Exercise the normal map layout with both landmark-linked and standalone campuses.
C.DATA.landmarks = [{ x: 120, y: 80, name: '旧地标名' }];
C.Settings = { get: () => false };
const facilities = [{ ...schools[0], lmK: 0, T: {} }, { ...schools[2], lmK: -1, T: {} }, ...schools.slice(4).map(s => ({ ...s, lmK: -1, T: {} }))];
C.Fac.list = () => facilities; C.Fac.active = () => true;
Object.assign(r, { layer: 'none', game: { clock: { y: 2026, m: 1 }, city: { landmarkOn: [true], regions: [], lockState: () => ({ info: [] }) } }, view: { x0: 0, y0: 0, x1: 1800, y1: 500 }, extraModels: () => [], labelsBegin: () => {}, textW: (_, text) => text.length * 12, labelSprite: text => ({ text, width: text.length * 12, left: 0, top: 0 }), drawnC: null });
const layout = r.layoutLabels({}, '', '', 0, false);
assert.deepEqual(Array.from(layout.items, it => it.e.text), facilities.flatMap(f => { const [name, campus] = f.label.split('\n'); return ['◆ ' + name, campus]; }));
for (let i = 0; i < layout.items.length; i += 2) assert.equal(layout.items[i + 1].oy - layout.items[i].oy, 14);
console.log('PASS: data invariants, facility/gap label spacing and collision heights, single-line compatibility, normal map labels');
