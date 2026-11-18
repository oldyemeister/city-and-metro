'use strict';
// 上海的永久坐标系。冻结扩图前已经使用的东方明珠点位和 250 m 格尺度。
// window.col/row 是相对第 3 版西北格边界的整数格偏移，独立于浮点设施坐标。
(function (CM) {
  const datum = 'sh-pearl-250m-v1';
  const base = { lon0: 121.31 - 40 / 380.6, lat0: 31.42, kx: 380.6, ky: 442.3 };
  const round = n => +n.toFixed(2);
  const pearl = [round((121.4968 - base.lon0) * base.kx), round((base.lat0 - 31.2415) * base.ky)];
  const legacy = { col: 0, row: 0, width: 192, height: 180 };
  function windowFor(proj, width, height) {
    const col = (proj.lon0 - base.lon0) * base.kx, row = (base.lat0 - proj.lat0) * base.ky;
    if (proj.kx !== base.kx || proj.ky !== base.ky ||
        [col, row].some(n => Math.abs(n - Math.round(n / 4) * 4) > 1e-6)) throw Error('上海底图未对齐固定交通小区格网');
    return { col: Math.round(col), row: Math.round(row), width, height };
  }
  function fromWGS(lat, lon) {
    return [round(round((lon - base.lon0) * base.kx) - pearl[0]), round(round((base.lat0 - lat) * base.ky) - pearl[1])];
  }
  function localPoint(world, w) {
    return [round(world[0] + pearl[0] - w.col), round(world[1] + pearl[1] - w.row)];
  }
  function current(map) { return windowFor(map.geo.proj, map.cfg.W, map.cfg.H); }

  // Only the persistence boundary needs to know the spatial representations.
  // Engine objects use viewport indices; saved points and zone addresses never do.
  function spatial(p, w, writing) {
    const sign = writing ? 1 : -1, dx = sign * (w.col - pearl[0]), dy = sign * (w.row - pearl[1]);
    const cols = w.width / 4, col0 = w.col / 4 - Math.floor(pearl[0] / 4), row0 = w.row / 4 - Math.floor(pearl[1] / 4);
    function zone(value) {
      if (writing) {
        if (!Number.isInteger(value) || value < 0 || value >= cols * w.height / 4) throw Error('上海交通小区编号无效');
        return [value % cols + col0, Math.floor(value / cols) + row0].join(',');
      }
      if (typeof value !== 'string' || !/^-?\d+,-?\d+$/.test(value)) throw Error('上海世界交通小区坐标无效');
      const [col, row] = value.split(',').map(Number);
      if (col < col0 || row < row0 || col >= col0 + cols || row >= row0 + w.height / 4) throw Error('上海交通小区超出地图');
      return (row - row0) * cols + col - col0;
    }
    function key(k) {
      return k.replace(/^(z|cong|cov):(.+)$/, (_, type, value) => type + ':' + zone(writing ? Number(value) : value));
    }
    // Canonicalize sub-micrometre floating point noise when saving via different windows.
    const move = (value, delta) => writing ? +(value + delta).toFixed(10) : value + delta;
    function pair(a) { a[0] = move(a[0], dx); a[1] = move(a[1], dy); }
    function walk(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (typeof obj.x === 'number' && typeof obj.y === 'number') { obj.x = move(obj.x, dx); obj.y = move(obj.y, dy); }
      if (Array.isArray(obj.site)) pair(obj.site);
      if (Array.isArray(obj.pts)) obj.pts.forEach(pair);
      if (obj.zone != null && (typeof obj.zone === 'number' || typeof obj.zone === 'string')) obj.zone = zone(obj.zone);
      if (typeof obj.coolKey === 'string') obj.coolKey = key(obj.coolKey);
      if (obj.cool) obj.cool = Object.fromEntries(Object.entries(obj.cool).map(([k,v]) => [key(k), v]));
      for (const child of Object.values(obj)) if (child && typeof child === 'object') walk(child);
    }
    for (const domain of ['net', 'netGone', 'tasks', 'corp', 'impactReport', 'voices']) walk(p[domain]);
    const box = p.macro && p.macro.areaRebase && p.macro.areaRebase.oldBox;
    if (box) pair(box);
  }
  function fitRaster(p, old, next, version) {
    const dx = old.col - next.col, dy = old.row - next.row;
    if (![old.col, old.row, old.width, old.height, next.width, next.height].every(v => Number.isSafeInteger(v) && v % 4 === 0) ||
        old.width <= 0 || old.height <= 0 || dx < 0 || dy < 0 || dx + old.width > next.width || dy + old.height > next.height) throw Error('上海存档格网与地图范围不兼容');
    if (old.width === next.width && old.height === next.height) return;
    const city = p.city, n = old.width * old.height;
    for (const k of ['pop','jobs','bh','taken','lu','street','urbanYear','fillNew']) {
      const packed = city[k];
      if ((!packed && k !== 'fillNew') || (packed && packed.n !== n)) throw Error('上海存档城市数据尺寸错误');
      const src = packed ? CM.U.unpackTyped(packed) : new Uint8Array(n);
      const dst = new src.constructor(next.width * next.height);
      if (k === 'fillNew') dst.fill(1);
      for (let y = 0; y < old.height; y++) dst.set(src.subarray(y * old.width, (y + 1) * old.width), (dy + y) * next.width + dx);
      city[k] = CM.U.packTyped(dst, packed ? packed.t : 'u8');
    }
    city.fillYear = city.fillYear || p.clock.y;
    if (p.macro && !p.macro.areaRebase) p.macro.areaRebase = { from: p.meta.mapVersion, oldBox: [dx, dy, old.width, old.height] };
    p.mapUpgrade = { from: p.meta.mapVersion, to: version, at: [p.clock.y,p.clock.m,p.clock.d], note: '上海地图范围扩大，保留世界坐标' };
    p.__mapMigratedFrom = p.meta.mapVersion;
  }
  function encode(p, map) {
    // serialize() shares live network, contract and task records. JSON also splits
    // aliases such as a contract area referenced again in its anchors array.
    const copy = JSON.parse(JSON.stringify(p)), w = current(map);
    spatial(copy, w, true);
    copy.meta.mapVersion = map.mapVersion;
    copy.meta.worldGrid = { datum, ...w };
    return copy;
  }
  function decode(p, map, version) {
    const w = current(map);
    if (version < 4) {
      if (version < 3) map.migrate(p, version);
      else map.repairObjectiveLocations(p);
      if (w.col || w.row || w.width !== legacy.width) { spatial(p, legacy, true); spatial(p, w, false); }
      fitRaster(p, legacy, w, map.mapVersion);
      p.__mapMigratedFrom = version;
    } else {
      const stored = p.meta.worldGrid;
      if (!stored || stored.datum !== datum) throw Error('上海存档缺少受支持的世界坐标基准');
      spatial(p, w, false);
      fitRaster(p, stored, w, map.mapVersion);
      delete p.meta.worldGrid;
    }
    p.meta.mapVersion = map.mapVersion;
  }
  CM.ShanghaiGrid = { windowFor, fromWGS, localPoint, encode, decode };
})(window.CM);
