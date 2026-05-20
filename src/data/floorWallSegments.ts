/**
 * Wall segments matching FloorMapLayouts brown stroke lines (#8a7a60).
 * Coordinates are SVG viewBox units (1200×800).
 */

import { FLOOR3_WING, RESIDENTIAL_WING, VIEWBOX } from '../components/floorPlanConstants';
import { getRoomsForFloor } from './roomInventory';

export type WallSegment = { x1: number; y1: number; x2: number; y2: number };

type DoorGap = { side: 'north' | 'south' | 'east' | 'west'; offset: number; size: number };

const DOOR_WIDTH = 34;

function seg(x1: number, y1: number, x2: number, y2: number): WallSegment {
  return { x1, y1, x2, y2 };
}

function wallsForRect(x: number, y: number, w: number, h: number, doors: DoorGap[] = []): WallSegment[] {
  const walls: WallSegment[] = [];

  const addSide = (
    side: DoorGap['side'],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    const sideGaps = doors.filter((d) => d.side === side);
    const horizontal = side === 'north' || side === 'south';
    let cursor = horizontal ? x1 : y1;
    const end = horizontal ? x2 : y2;

    for (const gap of sideGaps) {
      const gapStart = horizontal ? x + gap.offset : y + gap.offset;
      const gapEnd = gapStart + gap.size;
      if (cursor < gapStart) {
        walls.push(
          seg(
            horizontal ? cursor : x1,
            horizontal ? y1 : cursor,
            horizontal ? gapStart : x2,
            horizontal ? y2 : gapStart,
          ),
        );
      }
      cursor = gapEnd;
    }
    if (cursor < end) {
      walls.push(
        seg(
          horizontal ? cursor : x1,
          horizontal ? y1 : cursor,
          horizontal ? end : x2,
          horizontal ? y2 : end,
        ),
      );
    }
  };

  addSide('north', x, y, x + w, y);
  addSide('south', x, y + h, x + w, y + h);
  addSide('west', x, y, x, y + h);
  addSide('east', x + w, y, x + w, y + h);
  return walls;
}

function wallsForRoom(
  x: number,
  y: number,
  w: number,
  h: number,
  door: 'north' | 'south' | 'east' | 'west',
): WallSegment[] {
  const doorW = Math.min(DOOR_WIDTH, w - 10, h - 10);
  const doors: DoorGap[] =
    door === 'north' || door === 'south'
      ? [{ side: door, offset: (w - doorW) / 2, size: doorW }]
      : [{ side: door, offset: (h - doorW) / 2, size: doorW }];
  return wallsForRect(x, y, w, h, doors);
}

/** Close narrow gaps between adjacent room boxes (prevents diagonal shortcuts). */
function wallsForGapStrip(
  xLeft: number,
  xRight: number,
  yTop: number,
  yBottom: number,
): WallSegment[] {
  if (xRight <= xLeft + 0.5) return [];
  return [
    seg(xLeft, yTop, xRight, yTop),
    seg(xRight, yTop, xRight, yBottom),
    seg(xRight, yBottom, xLeft, yBottom),
    seg(xLeft, yBottom, xLeft, yTop),
  ];
}

function wallsBetweenRoomColumns(
  count: number,
  startX: number,
  step: number,
  roomW: number,
  y: number,
  h: number,
): WallSegment[] {
  const walls: WallSegment[] = [];
  for (let i = 0; i < count - 1; i++) {
    const xLeft = startX + i * step + roomW;
    const xRight = startX + (i + 1) * step;
    walls.push(...wallsForGapStrip(xLeft, xRight, y, y + h));
  }
  return walls;
}

function buildFloor1Walls(): WallSegment[] {
  const walls: WallSegment[] = [];

  walls.push(
    ...wallsForRect(268, 108, 200, 142, [
      { side: 'north', offset: 60, size: 80 },
      { side: 'south', offset: 68, size: 64 },
      { side: 'west', offset: 46, size: 48 },
    ]),
  );
  walls.push(...wallsForRect(520, 108, 180, 142, [{ side: 'south', offset: 68, size: 44 }]));
  walls.push(...wallsForRect(708, 108, 200, 142, [{ side: 'south', offset: 64, size: 72 }]));
  walls.push(
    ...wallsForRect(708, 288, 200, 108, [
      { side: 'west', offset: 36, size: 36 },
      { side: 'east', offset: 36, size: 36 },
    ]),
  );
  walls.push(
    ...wallsForRect(708, 428, 200, 252, [
      { side: 'west', offset: 108, size: 36 },
      { side: 'east', offset: 108, size: 36 },
    ]),
  );

  walls.push(...wallsForRoom(268, 568, 100, 118, 'north'));
  walls.push(...wallsForRoom(388, 568, 100, 118, 'north'));
  walls.push(...wallsForRoom(548, 448, 118, 118, 'north'));
  walls.push(...wallsForRoom(548, 578, 118, 108, 'west'));

  // Close gaps between public blocks (no diagonal shortcuts between rooms)
  walls.push(...wallsForGapStrip(468, 520, 108, 250));
  walls.push(...wallsForGapStrip(708, 908, 250, 288));
  // Physio west: corridor (728) only connects through door gap y=324–360
  walls.push(...wallsForGapStrip(708, 728, 288, 324));
  walls.push(...wallsForGapStrip(708, 728, 360, 396));
  // Reception east: block corner slip below the south wall line
  walls.push(seg(468, 250, 468, 362));

  return walls;
}

function buildFloor2Walls(): WallSegment[] {
  const { roomW, step, startX, northY, northH, southY, southH } = RESIDENTIAL_WING;
  const walls: WallSegment[] = [];

  walls.push(
    ...wallsForRect(348, 292, 108, 110, [
      { side: 'north', offset: 41, size: 26 },
      { side: 'south', offset: 41, size: 26 },
    ]),
  );
  walls.push(
    ...wallsForRect(468, 292, 148, 110, [
      { side: 'north', offset: 60, size: 26 },
      { side: 'south', offset: 60, size: 26 },
    ]),
  );
  walls.push(
    ...wallsForRect(628, 292, 96, 110, [
      { side: 'north', offset: 35, size: 26 },
      { side: 'south', offset: 35, size: 26 },
    ]),
  );
  walls.push(...wallsForRect(836, 292, 52, 110, [{ side: 'north', offset: 13, size: 26 }]));
  walls.push(...wallsForRect(898, 292, 52, 110, [{ side: 'north', offset: 13, size: 26 }]));

  for (const room of getRoomsForFloor(2).filter((r) => r.wing === 'north')) {
    const i = room.number - 201;
    walls.push(...wallsForRoom(startX + i * step, northY, roomW, northH, 'south'));
  }
  for (const room of getRoomsForFloor(2).filter((r) => r.wing === 'south')) {
    const i = room.number - 225;
    walls.push(...wallsForRoom(startX + i * step, southY, roomW, southH, 'north'));
  }

  const northCount = getRoomsForFloor(2).filter((r) => r.wing === 'north').length;
  const southCount = getRoomsForFloor(2).filter((r) => r.wing === 'south').length;
  walls.push(...wallsBetweenRoomColumns(northCount, startX, step, roomW, northY, northH));
  walls.push(...wallsBetweenRoomColumns(southCount, startX, step, roomW, southY, southH));

  return walls;
}

function buildFloor3Walls(): WallSegment[] {
  const { roomW, step, startX, northY, northH, southY, southH } = FLOOR3_WING;
  const walls: WallSegment[] = [];

  walls.push(...wallsForRect(508, 272, 164, 78, [{ side: 'south', offset: 64, size: 36 }]));
  walls.push(...wallsForRect(348, 292, 108, 110, [{ side: 'south', offset: 41, size: 26 }]));
  walls.push(...wallsForRect(628, 292, 96, 110, [{ side: 'south', offset: 35, size: 26 }]));
  walls.push(...wallsForRect(836, 292, 52, 110, [{ side: 'north', offset: 13, size: 26 }]));
  walls.push(...wallsForRect(898, 292, 52, 110, [{ side: 'north', offset: 13, size: 26 }]));

  for (const room of getRoomsForFloor(3).filter((r) => r.wing === 'north')) {
    const i = room.number - 301;
    walls.push(...wallsForRoom(startX + i * step, northY, roomW, northH, 'south'));
  }
  for (const room of getRoomsForFloor(3).filter((r) => r.wing === 'south')) {
    const i = room.number - 313;
    walls.push(...wallsForRoom(startX + i * step, southY, roomW, southH, 'north'));
  }

  const northCount = getRoomsForFloor(3).filter((r) => r.wing === 'north').length;
  const southCount = getRoomsForFloor(3).filter((r) => r.wing === 'south').length;
  walls.push(...wallsBetweenRoomColumns(northCount, startX, step, roomW, northY, northH));
  walls.push(...wallsBetweenRoomColumns(southCount, startX, step, roomW, southY, southH));

  return walls;
}

const WALL_CACHE: Partial<Record<number, WallSegment[]>> = {};

export function invalidateWallCache(floor?: number): void {
  if (floor === undefined) {
    for (const key of Object.keys(WALL_CACHE)) {
      delete WALL_CACHE[Number(key)];
    }
    return;
  }
  delete WALL_CACHE[floor];
}

export function getWallSegmentsForFloor(floor: number): WallSegment[] {
  if (WALL_CACHE[floor]) {
    return WALL_CACHE[floor]!;
  }

  let segments: WallSegment[] = [];
  if (floor === 1) segments = buildFloor1Walls();
  else if (floor === 2) segments = buildFloor2Walls();
  else if (floor === 3) segments = buildFloor3Walls();
  else if (floor === 4) segments = [];

  WALL_CACHE[floor] = segments;
  return segments;
}

export const MAP_VIEWBOX = VIEWBOX;
