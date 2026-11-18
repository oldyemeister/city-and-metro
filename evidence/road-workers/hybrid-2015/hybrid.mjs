// Offline only. Build a directed arterial graph with private entry/exit stubs.
// Every reduced arc maps back to one or more original directed road arcs.
import assert from 'node:assert/strict';

export function extendGraph(G, model, shortKm = 5) {
  if (!(Number.isFinite(shortKm) && shortKm >= 0)) throw Error('Invalid short-trip threshold');
  const classes = model.arcClass || Uint8Array.from(G.arcTo, (_, a) => model.road.links[a >> 1].cls);
  const degree = new Int32Array(G.nN);
  for (let a = 0; a < G.nA; a++) {
    assert.equal(G.arcTo[a ^ 1], G.arcFrom[a], 'paired reverse arc');
    if (classes[a] >= 3) degree[G.arcFrom[a]]++;
  }

  const component = new Int32Array(G.nN).fill(-1), stack = [];
  let components = 0;
  for (let n = 0; n < G.nN; n++) {
    if (component[n] >= 0) continue;
    component[n] = components;
    stack.push(n);
    while (stack.length) {
      const u = stack.pop();
      for (let i = G.outStart[u]; i < G.outStart[u+1]; i++) {
        const v = G.arcTo[G.outArc[i]];
        if (component[v] < 0) { component[v] = components; stack.push(v); }
      }
    }
    components++;
  }

  // Stop each feeder as soon as it touches *any* arterial. A gate on an
  // arterial therefore has only a zero-length feeder. Search by actual length.
  const cache = new Map();
  function feeders(node) {
    if (cache.has(node)) return cache.get(node);
    const result = [];
    const distance = new Map([[node, 0]]), parent = new Map(), queue = [[0, node]];
    while (queue.length && result.length < 3) {
      let best = 0;
      for (let i = 1; i < queue.length; i++) if (queue[i][0] < queue[best][0]) best = i;
      const [cost, u] = queue[best];
      queue[best] = queue[queue.length - 1];
      queue.pop();
      if (cost !== distance.get(u)) continue;
      if (degree[u]) {
        const path = [];
        let v = u;
        while (v !== node) { const a = parent.get(v); path.push(a); v = G.arcFrom[a]; }
        result.push({node:u, path:path.reverse()});
        continue;
      }
      for (let i = G.outStart[u]; i < G.outStart[u+1]; i++) {
        const a = G.outArc[i], v = G.arcTo[a], next = cost + G.arcKm[a];
        if (next < (distance.get(v) ?? Infinity)) {
          distance.set(v,next); parent.set(v,a); queue.push([next,v]);
        }
      }
    }
    cache.set(node,result);
    return result;
  }

  const retain = Uint8Array.from(degree, d => d && d !== 2 ? 1 : 0);
  for (const node of G.nodes) for (const gate of feeders(node)) retain[gate.node] = 1;
  let nN = 0;
  const reindex = new Int32Array(G.nN).fill(-1);
  for (let u = 0; u < G.nN; u++) if (retain[u]) reindex[u] = nN++;
  const arterialNodes = nN;
  const from = [], to = [], arcKm = [], liftStart = [0], liftArcs = [];
  function addArc(u,v,path) {
    from.push(u); to.push(v);
    let km = 0;
    for (const a of path) { km += G.arcKm[a]; liftArcs.push(a); }
    arcKm.push(km); liftStart.push(liftArcs.length);
  }
  for (let u = 0; u < G.nN; u++) {
    if (!retain[u]) continue;
    for (let i = G.outStart[u]; i < G.outStart[u+1]; i++) {
      let a = G.outArc[i];
      if (classes[a] < 3) continue;
      const path = [a];
      let v = G.arcTo[a];
      while (!retain[v]) {
        const reverse = a ^ 1;
        let next = -1;
        for (let k = G.outStart[v]; k < G.outStart[v+1]; k++) {
          const b = G.outArc[k];
          if (classes[b] >= 3 && b !== reverse) { next = b; break; }
        }
        assert.notEqual(next,-1);
        a = next; path.push(a); v = G.arcTo[a];
      }
      addArc(reindex[u],reindex[v],path);
    }
  }
  const arterialArcs = to.length;
  const start = [0], nodes = [], times = [], km = [], zones = [];
  let noGate = 0, indirect = 0, direct = 0;
  function addConnector(n,k) { nodes.push(n); times.push(G.times[k]); km.push(G.km[k]); }
  for (let z = 0; z < G.Z; z++) {
    for (let k = G.start[z]; k < G.start[z+1]; k++) {
      const u = G.nodes[k], options = feeders(u);
      if (!options.length) { noGate++; continue; }
      if (degree[u]) { direct++; addConnector(reindex[u],k); continue; }
      indirect++;
      // Distinct per zone and per original gate. Exit stubs have no outgoing
      // arcs and entry stubs have no incoming arcs, so they cannot be through roads.
      const src = nN++, sink = nN++;
      addConnector(src,k); addConnector(sink,k);
      for (const gate of options) {
        addArc(src,reindex[gate.node],gate.path);
        addArc(reindex[gate.node],sink,gate.path.slice().reverse().map(a => a ^ 1));
      }
    }
    if (nodes.length > start[z]) zones.push(z);
    start.push(nodes.length);
  }
  const outStart = new Int32Array(nN+1);
  for (const n of from) outStart[n+1]++;
  for (let n = 0; n < nN; n++) outStart[n+1] += outStart[n];
  const cursor = outStart.slice(), outArc = new Int32Array(to.length);
  for (let a = 0; a < to.length; a++) outArc[cursor[from[a]]++] = a;
  const core = {nN, nA:to.length, Z:G.Z, outStart, outArc, arcTo:Int32Array.from(to), arcFrom:Int32Array.from(from),
    start:Int32Array.from(start), nodes:Int32Array.from(nodes), times:Float64Array.from(times), km:Float64Array.from(km),
    zones:Int32Array.from(zones), arcKm:Float64Array.from(arcKm)};
  const zoneCols = model.ZW || G.zoneCols, zoneKm = model.zoneKm || G.zoneKm || 1;
  assert.ok(Number.isInteger(zoneCols) && zoneCols > 0 && zoneKm > 0);
  G.hybrid = {core, component, liftStart:Int32Array.from(liftStart), liftArcs:Int32Array.from(liftArcs),
    zoneCols,zoneKm,shortKm};
  return {arterialNodes,arterialArcs,expandedNodes:nN,expandedArcs:to.length,originalConnectors:G.nodes.length,
    direct,indirect,noGate,zoneCols,zoneKm,shortKm,feederLimit:3};
}

function makeHybridKernel(G,module) {
  const H = G.hybrid, C = H.core;
  const fullWork = carWork(G), coreWork = carWork(C), reducedTime = new Float32Array(C.nA);
  // One additional start and finish node per connector reaching an arterial
  // by a feeder path. Synthetic test cases may have more seed nodes than arcs.
  coreWork.heapK = new Float64Array(C.nA+C.nodes.length+4);
  coreWork.heapV = new Int32Array(coreWork.heapK.length);
  let wasm;
  const kmInZones2 = (H.shortKm/H.zoneKm)**2;
  function short(o,d) {
    const dx = o % H.zoneCols - d % H.zoneCols;
    const dy = Math.floor(o/H.zoneCols) - Math.floor(d/H.zoneCols);
    return dx*dx+dy*dy <= kmInZones2;
  }
  function nearbyRow(m,o,near,len,rowsT,rowsK,aux) {
    const W=fullWork, mark=W.mark, stamp=++W.stamp;
    const originComponents = [];
    for(let k=G.start[o]; k<G.start[o+1]; k++) originComponents.push(H.component[G.nodes[k]]);
    let need=0;
    for(let i=0;i<len;i++) {
      const d=m.tDest[near[i]];
      for(let k=G.start[d]; k<G.start[d+1]; k++) {
        const n=G.nodes[k];
        if(mark[n]!==stamp && originComponents.includes(H.component[n])) {mark[n]=stamp; need++;}
      }
    }
    if(!need) return;
    const no=carTree(G,m.time,o,W,need,stamp);
    for(let i=0;i<len;i++) {
      const q=near[i], d=m.tDest[q];
      let best=INF, bn=-1, gate=-1;
      for(let k=G.start[d]; k<G.start[d+1]; k++) {
        const n=G.nodes[k], t=W.dist[n]+G.times[k];
        if(t<best) {best=t; bn=n; gate=k;}
      }
      if(bn<0) continue;
      rowsT[q]=best; rowsK[q]=W.dkm[bn]+G.km[gate];
      if(m.dem[q]>0) W.accN[bn]+=m.dem[q];
    }
    for(let i=no-1;i>=0;i--) {
      const n=W.order[i], v=W.accN[n];
      if(v>0) {
        const a=W.pred[n];
        if(a>=0) {aux[a]+=v; W.accN[G.arcFrom[a]]+=v;}
        W.accN[n]=0;
      }
    }
  }
  return {solve(m) {
    const O=m.origins.length, Q=m.tDest.length;
    const rowsT=new Float32Array(Q).fill(NaN), rowsK=new Float32Array(Q).fill(NaN);
    const aux=new Float32Array(G.nA), near=new Int32Array(G.Z);
    const farDest=new Int32Array(Q), farDem=new Float32Array(Q), farIndex=new Int32Array(Q), farStart=new Int32Array(O+1);
    let far=0, nearRequests=0, nearMissing=0, farMissing=0;
    for(let i=0;i<O;i++) {
      const o=m.origins[i];
      let len=0;
      for(let q=m.tStart[i];q<m.tStart[i+1];q++) {
        const d=m.tDest[q];
        if(d===o) continue;
        if(short(o,d)) {near[len++]=q;}
        else {farDest[far]=d;farDem[far]=m.dem[q];farIndex[far++]=q;}
      }
      farStart[i+1]=far;
      if(len) {
        nearbyRow(m,o,near,len,rowsT,rowsK,aux);
        nearRequests+=len;
        for(let k=0;k<len;k++) if(Number.isNaN(rowsT[near[k]])) nearMissing++;
      }
    }
    for(let a=0;a<C.nA;a++) {
      let t=0;
      for(let k=H.liftStart[a]; k<H.liftStart[a+1];k++) t+=m.time[H.liftArcs[k]];
      reducedTime[a]=t;
    }
    let coreAux;
    const useWasm = Boolean(module && C.nN && Q >= O*G.Z*0.10);
    if(far && useWasm) {
      if(!wasm) wasm=roadKernelWorker(module,C);
      const dense=new Float32Array(O*G.Z);
      for(let i=0;i<O;i++) for(let k=farStart[i]; k<farStart[i+1];k++) dense[i*G.Z+farDest[k]]=farDem[k];
      const result=wasm.solve({origins:m.origins,time:reducedTime,dem:dense});
      for(let i=0;i<O;i++) for(let k=farStart[i]; k<farStart[i+1];k++) {
        const at=i*G.Z+farDest[k], q=farIndex[k]; rowsT[q]=result.rowsT[at]; rowsK[q]=result.rowsK[at];
      }
      coreAux=result.aux;
    } else if(far) {
      coreAux=new Float32Array(C.nA);
      const t=new Float32Array(far).fill(NaN), km=new Float32Array(far).fill(NaN);
      for(let i=0;i<O;i++) if(farStart[i]<farStart[i+1])
        carOriginRow(C,reducedTime,m.origins[i],farDest,farStart[i],farStart[i+1],farDem,coreWork,t,km,0,coreAux);
      for(let k=0;k<far;k++) { const q=farIndex[k]; rowsT[q]=t[k]; rowsK[q]=km[k]; }
    }
    if(coreAux) for(let a=0; a<C.nA; a++) {
      const v=coreAux[a];
      if(v) for(let k=H.liftStart[a]; k<H.liftStart[a+1];k++) aux[H.liftArcs[k]]+=v;
    }
    for(let k=0;k<far;k++) if(Number.isNaN(rowsT[farIndex[k]])) farMissing++;
    return {rowsT,rowsK,aux,stats:{nearRequests,farRequests:far,nearMissing,farMissing,wasm:useWasm}};
  }};
}
export function workerSource() { return makeHybridKernel.toString(); }
