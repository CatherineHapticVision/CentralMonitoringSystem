/**
 * Walkable regions — beige halls and room interiors (light blue / cream fills).
 * SVG viewBox coords; must match FloorMapLayouts.
 */

import {
  EAST_CORE,
  FLOOR3_WING,
  RESIDENTIAL_WING,
  svgToPct,
  VIEWBOX,
  WEST_CORE,
} from '../components/floorPlanConstants';
import { getRoomsForFloor } from './roomInventory';

type HallRect = { x: number; y: number; w: number; h: number };

const FLOOR1_HALLS: HallRect[] = [
  { x: 268, y: 362, w: 412, h: 52 },
  { x: 680, y: 362, w: 252, h: 52 },
  { x: WEST_CORE.stairShaft.x, y: WEST_CORE.stairShaft.y, w: WEST_CORE.stairShaft.w, h: WEST_CORE.stairShaft.h },
  { x: EAST_CORE.stairShaft.x, y: EAST_CORE.stairShaft.y, w: EAST_CORE.stairShaft.w, h: EAST_CORE.stairShaft.h },
  /** South of reception → west spine (no dead zone after exiting south door) */
  { x: 268, y: 250, w: 204, h: 118 },
  /** West spine reception → south hall */
  { x: 268, y: 250, w: 52, h: 334 },
  /** East shaft + PT west door alcove (not inside PT room fill) */
  { x: 700, y: 262, w: 82, h: 110 },
  { x: 708, y: 424, w: 56, h: 146 },
];

function floor2HallRects(): HallRect[] {
  const { hallNorthTop, hallNorthBottom, hallSouthTop, hallSouthBottom } = RESIDENTIAL_WING;
  return [
    { x: 268, y: hallNorthTop, w: 644, h: hallNorthBottom - hallNorthTop },
    { x: 268, y: hallSouthTop, w: 644, h: hallSouthBottom - hallSouthTop },
    { x: WEST_CORE.stairShaft.x, y: WEST_CORE.stairShaft.y, w: WEST_CORE.stairShaft.w, h: WEST_CORE.stairShaft.h },
    { x: EAST_CORE.stairShaft.x, y: EAST_CORE.stairShaft.y, w: EAST_CORE.stairShaft.w, h: EAST_CORE.stairShaft.h },
    { x: 782, y: 286, w: 34, h: 220 },
    { x: 298, y: 286, w: 34, h: 220 },
  ];
}

function floor3HallRects(): HallRect[] {
  const { hallMidTop, hallMidBottom, hallSouthLoop, startX } = FLOOR3_WING;
  return [
    { x: 268, y: 252, w: 428, h: 28 },
    { x: 268, y: hallMidTop, w: 428, h: hallMidBottom - hallMidTop },
    { x: 268, y: 280, w: 36, h: 98 },
    { x: 660, y: 280, w: 36, h: 98 },
    { x: 308, y: hallSouthLoop, w: 348, h: 28 },
    { x: WEST_CORE.stairShaft.x, y: WEST_CORE.stairShaft.y, w: WEST_CORE.stairShaft.w, h: WEST_CORE.stairShaft.h },
    { x: EAST_CORE.stairShaft.x, y: EAST_CORE.stairShaft.y, w: EAST_CORE.stairShaft.w, h: EAST_CORE.stairShaft.h },
    { x: startX - 30, y: hallMidTop, w: 30, h: hallSouthLoop - hallMidTop + 40 },
    { x: 660, y: hallMidTop, w: 40, h: hallSouthLoop - hallMidTop + 40 },
  ];
}

const HALL_BY_FLOOR: Record<number, HallRect[]> = {
  1: FLOOR1_HALLS,
  2: floor2HallRects(),
  3: floor3HallRects(),
  4: [
    { x: 200, y: 180, w: 800, h: 440 },
  ],
};

const FLOOR1_ROOM_INTERIORS: HallRect[] = [
  { x: 268, y: 568, w: 100, h: 118 },
  { x: 388, y: 568, w: 100, h: 118 },
  { x: 548, y: 448, w: 118, h: 118 },
  { x: 548, y: 578, w: 118, h: 108 },
];

/** Floor 1 public spaces — match PublicSpace rects in FloorMapLayouts. */
const FLOOR1_PUBLIC_INTERIORS: HallRect[] = [
  { x: 268, y: 108, w: 200, h: 142 },
  { x: 520, y: 108, w: 180, h: 142 },
  { x: 708, y: 108, w: 200, h: 142 },
  { x: 708, y: 288, w: 200, h: 108 },
  { x: 708, y: 428, w: 200, h: 252 },
];

function wingRoomInteriors(
  wing: typeof RESIDENTIAL_WING | typeof FLOOR3_WING,
  floor: 2 | 3,
): HallRect[] {
  const { roomW, step, startX, northY, northH, southY, southH } = wing;
  const northBase = floor === 2 ? 201 : 301;
  const southBase = floor === 2 ? 225 : 313;
  const rects: HallRect[] = [];

  for (const room of getRoomsForFloor(floor)) {
    const index = room.wing === 'north' ? room.number - northBase : room.number - southBase;
    rects.push({
      x: startX + index * step,
      y: room.wing === 'north' ? northY : southY,
      w: roomW,
      h: room.wing === 'north' ? northH : southH,
    });
  }
  return rects;
}

const ROOM_INTERIORS_BY_FLOOR: Record<number, HallRect[]> = {
  1: FLOOR1_ROOM_INTERIORS,
  2: wingRoomInteriors(RESIDENTIAL_WING, 2),
  3: wingRoomInteriors(FLOOR3_WING, 3),
};

function pointInRect(
  svgX: number,
  svgY: number,
  rect: HallRect,
  inset: number,
): boolean {
  return (
    svgX >= rect.x + inset &&
    svgX <= rect.x + rect.w - inset &&
    svgY >= rect.y + inset &&
    svgY <= rect.y + rect.h - inset
  );
}

function positionInRects(
  position: { x: number; y: number },
  rects: HallRect[],
  inset: number,
): boolean {
  const svgX = (position.x / 100) * VIEWBOX.w;
  const svgY = (position.y / 100) * VIEWBOX.h;
  return rects.some((rect) => pointInRect(svgX, svgY, rect, inset));
}

/** True when position is inside a resident room fill (private light blue or semi-private). */
export function isPositionInRoomInterior(
  position: { x: number; y: number },
  floor: number,
): boolean {
  const rects = ROOM_INTERIORS_BY_FLOOR[floor];
  if (!rects) return false;
  return positionInRects(position, rects, 6);
}

/** True when position is inside a public/clinical space on floor 1. */
export function isPositionInPublicInterior(
  position: { x: number; y: number },
  floor: number,
): boolean {
  if (floor !== 1) return false;
  // Corridor shafts overlap public-space bounding boxes — halls win.
  if (isPositionInHallway(position, floor)) return false;
  return positionInRects(position, FLOOR1_PUBLIC_INTERIORS, 6);
}

/** True when position is inside a beige corridor (not a room or public block). */
export function isPositionInHallway(
  position: { x: number; y: number },
  floor: number,
): boolean {
  const rects = HALL_BY_FLOOR[floor];
  if (!rects) return false;
  return positionInRects(position, rects, 4);
}

/** Direct diagonal OK only within the same room or same public space. */
export function sharesWalkableInterior(
  a: { x: number; y: number },
  b: { x: number; y: number },
  floor: number,
): boolean {
  if (isPositionInRoomInterior(a, floor) && isPositionInRoomInterior(b, floor)) {
    return true;
  }
  if (floor === 1 && isPositionInPublicInterior(a, floor) && isPositionInPublicInterior(b, floor)) {
    const svgAx = (a.x / 100) * VIEWBOX.w;
    const svgAy = (a.y / 100) * VIEWBOX.h;
    const svgBx = (b.x / 100) * VIEWBOX.w;
    const svgBy = (b.y / 100) * VIEWBOX.h;
    const rect = FLOOR1_PUBLIC_INTERIORS.find(
      (r) =>
        pointInRect(svgAx, svgAy, r, 6) &&
        pointInRect(svgBx, svgBy, r, 6),
    );
    return Boolean(rect);
  }
  return false;
}

export function randomHallwayPositionPct(floor: number): { x: number; y: number } {
  const rects = HALL_BY_FLOOR[floor] ?? HALL_BY_FLOOR[2];
  const r = rects[Math.floor(Math.random() * rects.length)];
  const svg = {
    x: r.x + 4 + Math.random() * Math.max(8, r.w - 8),
    y: r.y + 4 + Math.random() * Math.max(8, r.h - 8),
  };
  return svgToPct(svg.x, svg.y);
}
