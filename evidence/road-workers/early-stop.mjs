// Experimental source transform only. Production sim.js remains untouched.
import assert from 'node:assert/strict';
export function roadFunctions(source){
  const names=['carTree','carOriginRow','carWork'];
  const parts=names.map(name=>{const at=source.indexOf('  function '+name+'(');assert.ok(at>=0);return source.slice(at,source.indexOf('\n  }',at)+4);});
  return Function('const INF=1e30;'+parts.join('\n')+';return {carTree,carOriginRow,carWork};')();
}
function once(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
export function candidateSource(source){
  const end=source.indexOf('  function carWorkerMain()');assert.ok(end>0);
  let s=source.slice(0,end);
  s=once(s,'    let no = 0;\n    while (count) {','    let no = 0, pending = W.targetPending, upper = 0, limit = INF;\n    while (count) {');
  s=once(s,'      if (du > dist[u]) continue;','      if (du > limit) break;\n      if (du > dist[u]) continue;');
  s=once(s,'      if (need > 0 && mark[u] === stamp && --need === 0) break;',`      if (need > 0 && mark[u] === stamp) {
        if (--need === 0) break;
        if (pending > 0 && W.earlyEligible) {
          for (let j = W.nodeStart[u]; j < W.nodeStart[u + 1]; j++) {
            const k = W.nodeConn[j], z = W.connZone[k];
            if (W.targetZone[z] !== stamp) continue;
            W.targetZone[z] = -stamp; pending--;
            const bound = du + initial[k];
            if (bound > upper) upper = bound;
          }
          if (pending === 0) limit = upper;
        }
      }`);
  s=once(s,'    let need = 0;','    let need = 0; W.targetPending = 0;');
  s=once(s,'if (W.stamp >= 2147480000) { mark.fill(0); W.stamp = 0; }','if (W.stamp >= 2147480000) { mark.fill(0); W.targetZone.fill(0); W.stamp = 0; }');
  s=once(s,'      for (let k = connStart[d]; k < connStart[d + 1]; k++) { const nd = connNode[k];',`      if (connStart[d] < connStart[d + 1] && W.targetZone[d] !== stamp) { W.targetZone[d] = stamp; W.targetPending++; }
      for (let k = connStart[d]; k < connStart[d + 1]; k++) { const nd = connNode[k];`);
  s=once(s,'  function carWork(G) {\n    return {',`  function carWork(G) {
    const nodeStart = new Int32Array(G.nN + 1), nodeConn = new Int32Array(G.nodes.length), connZone = new Int32Array(G.nodes.length);
    let earlyEligible = true;
    for (let k = 0; k < G.nodes.length; k++) { nodeStart[G.nodes[k] + 1]++; if (!(G.times[k] >= 0 && G.times[k] < INF)) earlyEligible = false; }
    for (let v = 0; v < G.nN; v++) nodeStart[v + 1] += nodeStart[v];
    const cursor = nodeStart.slice();
    for (let z = 0; z < G.Z; z++) for (let k = G.start[z]; k < G.start[z + 1]; k++) { nodeConn[cursor[G.nodes[k]]++] = k; connZone[k] = z; }
    return { nodeStart, nodeConn, connZone, earlyEligible, targetZone: new Int32Array(G.Z), targetPending: 0,`);
  return s+source.slice(end);
}
