// Test-only transform. No heap ordering or arithmetic changes.
import assert from 'node:assert/strict';
export {roadFunctions} from './early-stop.mjs';
export const originalChildRead = `          const right = left + 1, child = right < n && keys[right] < keys[left] ? right : left;
          if (keys[child] >= key) break;
          keys[i] = keys[child]; values[i] = values[child]; i = child;`;
export const cachedChildRead = `          const right = left + 1;
          let child = left, childKey = keys[left];
          if (right < n) {
            const rightKey = keys[right];
            if (rightKey < childKey) { child = right; childKey = rightKey; }
          }
          if (childKey >= key) break;
          keys[i] = childKey; values[i] = values[child]; i = child;`;
export function candidateSource(source){
  assert.equal(source.split(originalChildRead).length,2,'Expected exactly one original road downheap');
  return source.replace(originalChildRead,cachedChildRead);
}
