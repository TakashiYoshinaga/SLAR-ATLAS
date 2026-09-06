import { BODIES, EARTH_YEAR_SECONDS } from './data.js';

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
export function worldPositions(seconds) {
  const positions = new Map();
  for (const body of BODIES) {
    const local = localPosition(body, seconds);
    const parent = positions.get(body.parentId) ?? { x:0,y:0,z:0 };
    positions.set(body.id, { x:parent.x+local.x,y:parent.y+local.y,z:parent.z+local.z });
  }
  return positions;
}
