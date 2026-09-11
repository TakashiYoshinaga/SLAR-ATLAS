import { BODY_BY_ID, EARTH_YEAR_SECONDS } from './data.js';

export const TAU = 2 * Math.PI;
export function createSimulation() { return { elapsedSeconds:0, speed:1, paused:false }; }
export function advanceSimulation(state, deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) return;
  if (!state.paused) state.elapsedSeconds += deltaSeconds * state.speed;
}
export function orbitAngle(body, seconds) {
  if (!body.orbitalPeriodYears) return body.phase;
  const period = EARTH_YEAR_SECONDS * body.orbitalPeriodYears;
  return body.phase + (seconds % period) / period * TAU;
}
export function localPosition(body, seconds) {
  const angle = orbitAngle(body, seconds);
  return { x:Math.cos(angle)*body.orbitRadius, y:0, z:-Math.sin(angle)*body.orbitRadius };
}
export function spinAngle(body, seconds) {
  // The Moon's local -X face always points at Earth. Its parent only translates.
  if (body.id === 'moon') return orbitAngle(body, seconds);
  return body.spinPeriodSeconds ? (seconds % body.spinPeriodSeconds) / body.spinPeriodSeconds * TAU : 0;
}
const centerScratch = {x:0,y:0,z:0};
// A body's world position is the sum of its own circle and its ancestors'.
export function worldPosition(body, seconds, out) {
  out.x=0;out.y=0;out.z=0;
  for (let node=body; node; node=BODY_BY_ID.get(node.parentId)) {
    if (!node.orbitRadius) continue;
    const angle=orbitAngle(node,seconds);
    out.x+=Math.cos(angle)*node.orbitRadius;out.z-=Math.sin(angle)*node.orbitRadius;
  }
  return out;
}
// Where `target` appears to be for an observer riding `center`.
export function relativePosition(target, center, seconds, out) {
  worldPosition(target,seconds,out);worldPosition(center,seconds,centerScratch);
  out.x-=centerScratch.x;out.y-=centerScratch.y;out.z-=centerScratch.z;return out;
}
// Circles shared by both bodies cancel exactly; the rest beat against each other.
function apparentRates(target, center) {
  const ids=[];
  for (let node=target; node; node=BODY_BY_ID.get(node.parentId)) if (node.orbitRadius) ids.push(node.id);
  for (let node=center; node; node=BODY_BY_ID.get(node.parentId)) if (node.orbitRadius) {
    const index=ids.indexOf(node.id);
    if (index<0) ids.push(node.id); else ids.splice(index,1);
  }
  return ids.map(id=>TAU/(EARTH_YEAR_SECONDS*BODY_BY_ID.get(id).orbitalPeriodYears));
}
// One surviving circle closes in its own period; two or more close on the fastest
// beat, so every trail shows the same number of loops at the same smoothness.
export function apparentTrailSeconds(target, center, loops) {
  const rates=apparentRates(target,center);
  if (!rates.length) return 0;
  if (rates.length===1) return TAU/rates[0];
  let beat=0;
  for (let i=0;i<rates.length;i++) for (let j=i+1;j<rates.length;j++) beat=Math.max(beat,Math.abs(rates[i]-rates[j]));
  return beat?loops*TAU/beat:0;
}
