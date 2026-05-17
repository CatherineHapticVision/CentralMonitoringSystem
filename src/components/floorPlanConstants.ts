/** Ontario LTC floor plate — shared SVG coordinates (viewBox 1200×800) */
export const BUILDING = {
  left: 240,
  top: 100,
  right: 960,
  bottom: 700,
  width: 720,
  height: 600,
} as const;

/** Vertical space between stair box and elevator box in a core (matches east core) */
export const CORE_STACK_GAP = 8;

const STAIR_BOX = { w: 48, h: 46 } as const;

function stairsAboveElev(elev: { x: number; y: number; w: number; h: number }) {
  return {
    x: elev.x,
    y: elev.y - CORE_STACK_GAP - STAIR_BOX.h,
    w: STAIR_BOX.w,
    h: STAIR_BOX.h,
  };
}

/** Shared vertical position — west and east stacks align on every floor */
const CORE_ELEV_Y = 474;
const CORE_ELEV_BOX = { w: 48, h: 50 } as const;

const WEST_ELEV = { x: 228, y: CORE_ELEV_Y, ...CORE_ELEV_BOX };
const WEST_STAIRS = stairsAboveElev(WEST_ELEV);
/** South end of west corridor shaft (ties to wings / floor 1 rooms) */
const WEST_SHAFT_BOTTOM = 698;

export const WEST_CORE = {
  elev: WEST_ELEV,
  stairs: WEST_STAIRS,
  stairShaft: {
    x: WEST_STAIRS.x,
    y: WEST_STAIRS.y,
    w: WEST_STAIRS.w,
    h: WEST_SHAFT_BOTTOM - WEST_STAIRS.y,
  },
} as const;

/** East vertical core — same Y as west; X from Floor 2 reference */
const EAST_ELEV = { x: 924, y: CORE_ELEV_Y, ...CORE_ELEV_BOX };
const EAST_STAIRS = stairsAboveElev(EAST_ELEV);
/** North corridor tie-in for east core (floor 2 clinical wing) */
const EAST_SHAFT_TOP = 246;
const EAST_SHAFT_BOTTOM = 530;

export const EAST_CORE = {
  elev: EAST_ELEV,
  stairs: EAST_STAIRS,
  stairShaft: {
    x: EAST_STAIRS.x,
    y: EAST_SHAFT_TOP,
    w: EAST_STAIRS.w,
    h: EAST_SHAFT_BOTTOM - EAST_SHAFT_TOP,
  },
} as const;

/** Outdoor / fallback — same end cores as indoor floors */
export const TRANSIT = {
  elevWest: WEST_CORE.elev,
  elevEast: EAST_CORE.elev,
  westStairs: WEST_CORE.stairs,
  eastStairs: EAST_CORE.stairs,
} as const;

/** Per-floor transit — both end cores, identical geometry on floors 1–3 */
export const FLOOR1_TRANSIT = {
  elevWest: WEST_CORE.elev,
  elevEast: EAST_CORE.elev,
  westStairs: WEST_CORE.stairs,
  eastStairs: EAST_CORE.stairs,
  westStairShaft: WEST_CORE.stairShaft,
  eastStairShaft: EAST_CORE.stairShaft,
} as const;

export const FLOOR2_TRANSIT = FLOOR1_TRANSIT;
export const FLOOR3_TRANSIT = FLOOR1_TRANSIT;

export const HALL_FILL = 'url(#woodFloor)';

export const VIEWBOX = { w: 1200, h: 800 } as const;

/** Map SVG coordinates to navigation % (matches FloorMap marker scale) */
export function svgToPct(svgX: number, svgY: number): { x: number; y: number } {
  return {
    x: (svgX / VIEWBOX.w) * 100,
    y: (svgY / VIEWBOX.h) * 100,
  };
}

/** Centre of transit element for navigation waypoints */
export function transitCenter(box: { x: number; y: number; w: number; h: number }): {
  x: number;
  y: number;
} {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** Floor 2 residential wing grid (must match FloorMapLayouts) — 15 rooms per wing */
export const RESIDENTIAL_WING = {
  roomW: 40,
  step: 43,
  startX: 268,
  northY: 108,
  northH: 128,
  southY: 580,
  southH: 112,
  /** North corridor band (y) */
  hallNorthTop: 252,
  hallNorthBottom: 286,
  /** South corridor band (y) — shifted with south rooms; 8px margin to building bottom */
  hallSouthTop: 506,
  hallSouthBottom: 540,
} as const;

const FLOOR3_NORTH_ROOMS = 12;
const FLOOR3_SOUTH_ROOMS = 13;
const FLOOR3_ROOM_W = 40;
const FLOOR3_ROOM_STEP = 43;

function floor3RoomSpan(count: number) {
  return (count - 1) * FLOOR3_ROOM_STEP + FLOOR3_ROOM_W;
}

/** Floor 3 memory care — 12 north + 13 south rooms */
export const FLOOR3_WING = {
  roomW: FLOOR3_ROOM_W,
  step: FLOOR3_ROOM_STEP,
  /** Centered in building envelope (matches widest south wing) */
  startX:
    BUILDING.left +
    (BUILDING.width - Math.max(floor3RoomSpan(FLOOR3_NORTH_ROOMS), floor3RoomSpan(FLOOR3_SOUTH_ROOMS))) /
      2,
  northY: 108,
  northH: 118,
  /** 8px margin to building bottom (matches north wing top margin) */
  southY: BUILDING.bottom - 108 - (108 - BUILDING.top),
  southH: 108,
  hallMidTop: 378,
  hallMidBottom: 418,
  /** South racetrack leg (y) */
  hallSouthLoop: 536,
} as const;
