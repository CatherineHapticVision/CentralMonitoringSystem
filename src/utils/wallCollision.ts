import { getWallSegmentsForFloor, MAP_VIEWBOX, type WallSegment } from '../data/floorWallSegments';
import { randomHallwayPositionPct } from '../data/floorHallways';

export interface MapPosition {
  x: number;
  y: number;
}

/** Marker radius in SVG units (~20px marker on map). */
const MARKER_RADIUS_SVG = 9;
/** Looser clearance at door gaps so markers do not jitter on jamb segments. */
const DOOR_PASSAGE_RADIUS_SVG = 28;
const MAX_SUBSTEP_PCT = 0.05;

/** Floor 1 doorway centers (SVG) — matches mapNavigation *_door waypoints. */
const F1_DOOR_CENTERS_SVG: ReadonlyArray<readonly [number, number]> = [
  [368, 250],
  [808, 250],
  [708, 342],
  [728, 554],
  [318, 568],
  [438, 568],
  [607, 507],
  [548, 632],
];

function nearDoorPassageSvg(svg: MapPosition, floor: number): boolean {
  if (floor !== 1) return false;
  for (const [x, y] of F1_DOOR_CENTERS_SVG) {
    if (Math.hypot(svg.x - x, svg.y - y) < DOOR_PASSAGE_RADIUS_SVG) return true;
  }
  return false;
}

function pctToSvg(p: MapPosition): MapPosition {
  return {
    x: (p.x / 100) * MAP_VIEWBOX.w,
    y: (p.y / 100) * MAP_VIEWBOX.h,
  };
}

function svgToPct(p: MapPosition): MapPosition {
  return {
    x: (p.x / MAP_VIEWBOX.w) * 100,
    y: (p.y / MAP_VIEWBOX.h) * 100,
  };
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function segmentsIntersectInterior(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const r = { x: bx - ax, y: by - ay };
  const s = { x: dx - cx, y: dy - cy };
  const denom = cross(r.x, r.y, s.x, s.y);
  if (Math.abs(denom) < 1e-9) return false;

  const t = cross(cx - ax, cy - ay, s.x, s.y) / denom;
  const u = cross(cx - ax, cy - ay, r.x, r.y) / denom;
  const eps = 1e-5;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(px - x1, py - y1);

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointTooCloseToWall(px: number, py: number, walls: WallSegment[]): boolean {
  for (const w of walls) {
    if (pointToSegmentDistance(px, py, w.x1, w.y1, w.x2, w.y2) < MARKER_RADIUS_SVG) {
      return true;
    }
  }
  return false;
}

/** True when movement segment crosses a wall or passes within marker radius of one. */
function movementBlocked(
  fromSvg: MapPosition,
  toSvg: MapPosition,
  walls: WallSegment[],
  floor: number,
): boolean {
  const span = Math.hypot(toSvg.x - fromSvg.x, toSvg.y - fromSvg.y);
  if (span < 0.2) return false;

  for (const w of walls) {
    if (
      segmentsIntersectInterior(
        fromSvg.x,
        fromSvg.y,
        toSvg.x,
        toSvg.y,
        w.x1,
        w.y1,
        w.x2,
        w.y2,
      )
    ) {
      return true;
    }
  }

  const relaxJamb =
    (nearDoorPassageSvg(fromSvg, floor) || nearDoorPassageSvg(toSvg, floor)) &&
    !segmentCrossesPtNorthWall(fromSvg, toSvg);
  if (!relaxJamb) {
    const samples = Math.max(6, Math.ceil(span / 5));
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const px = fromSvg.x + (toSvg.x - fromSvg.x) * t;
      const py = fromSvg.y + (toSvg.y - fromSvg.y) * t;
      if (pointTooCloseToWall(px, py, walls)) return true;
    }
  }

  return false;
}

/** Move from → to in map %, stopping before brown wall lines (door gaps stay open). */
export function clampMovementAgainstWalls(
  from: MapPosition,
  to: MapPosition,
  floor: number,
): MapPosition {
  const walls = getWallSegmentsForFloor(floor);
  const fromSvg = pctToSvg(from);
  const toSvg = pctToSvg(to);

  if (!movementBlocked(fromSvg, toSvg, walls, floor)) {
    return to;
  }

  return from;
}

/** Wall-clamped step toward target (simulation only). */
export function moveTowardWithWalls(
  from: MapPosition,
  target: MapPosition,
  maxStepPct: number,
  floor: number,
): MapPosition {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const total = Math.hypot(dx, dy);
  if (total < 0.004) return from;

  const step = Math.min(maxStepPct, total);
  const desired = {
    x: from.x + (dx / total) * step,
    y: from.y + (dy / total) * step,
  };

  if (step <= MAX_SUBSTEP_PCT) {
    return clampMovementAgainstWalls(from, desired, floor);
  }

  const steps = Math.max(2, Math.ceil(step / MAX_SUBSTEP_PCT));
  const stepLen = step / steps;
  let pos = from;

  for (let i = 0; i < steps; i++) {
    const nextDesired = {
      x: pos.x + (dx / total) * stepLen,
      y: pos.y + (dy / total) * stepLen,
    };
    const next = clampMovementAgainstWalls(pos, nextDesired, floor);
    if (Math.hypot(next.x - pos.x, next.y - pos.y) < 0.0005) {
      return pos;
    }
    pos = next;
  }

  return pos;
}

export function smoothTowardWithWalls(
  current: MapPosition,
  target: MapPosition,
  maxStep: number,
  floor: number,
): MapPosition {
  return moveTowardWithWalls(current, target, maxStep, floor);
}

export function randomHallwayTarget(floor: number): MapPosition {
  return randomHallwayPositionPct(floor);
}

export const stepTowardWithWalls = moveTowardWithWalls;

/** Physiotherapy block — north facade blocks shortcuts from the nurse corridor (y≈250). */
const PT_BOX = { left: 708, right: 908, north: 288 };

function segmentCrossesPtNorthWall(a: MapPosition, b: MapPosition): boolean {
  if (a.y >= PT_BOX.north - 1 && b.y >= PT_BOX.north - 1) return false;
  if (a.y < PT_BOX.north && b.y < PT_BOX.north) return false;
  const dy = b.y - a.y;
  if (Math.abs(dy) < 1e-6) return false;
  const t = (PT_BOX.north - a.y) / dy;
  if (t <= 0.01 || t >= 0.99) return false;
  const x = a.x + t * (b.x - a.x);
  return x >= PT_BOX.left && x <= PT_BOX.right;
}

/** True when a straight segment crosses the physiotherapy north wall from above. */
export function crossesPhysioNorthWall(from: MapPosition, to: MapPosition): boolean {
  const a = pctToSvg(from);
  const b = pctToSvg(to);
  if (a.y >= PT_BOX.north - 1 && b.y >= PT_BOX.north - 1) return false;
  if (a.y < PT_BOX.north && b.y < PT_BOX.north) return false;
  const dy = b.y - a.y;
  if (Math.abs(dy) < 1e-6) return false;
  const t = (PT_BOX.north - a.y) / dy;
  if (t <= 0.01 || t >= 0.99) return false;
  const x = a.x + t * (b.x - a.x);
  return x >= PT_BOX.left && x <= PT_BOX.right;
}
