/** Walkable navigation — corridor graph for pathing; positions clamped against brown wall lines */

import {
  EAST_CORE,
  FLOOR3_WING,
  RESIDENTIAL_WING,
  svgToPct,
  transitCenter,
  WEST_CORE,
} from '../components/floorPlanConstants';
import {
  isPositionInHallway,
  isPositionInPublicInterior,
  isPositionInRoomInterior,
  MEMORY_CARE_STATION,
  sharesWalkableInterior,
} from './floorHallways';
import { VIEWBOX } from '../components/floorPlanConstants';
import { crossesPhysioNorthWall, stepTowardWithWalls } from '../utils/wallCollision';
import { roomNumberForResident } from './roomInventory';

/** Match alertResponseMovement — staff stops helping resident within this range */
export const STAFF_RESPONSE_ARRIVAL_PCT = 2.8;

/** Near a doorway — use linear steps and hold move target to avoid threshold fighting. */
const DOOR_ZONE_PCT = 5.5;
const DOOR_COMMIT_PCT = 6.5;

export interface Position {
  x: number;
  y: number;
}

export interface Waypoint {
  id: string;
  x: number;
  y: number;
  transit?: 'elevator' | 'stairs' | 'exit';
}

interface FloorGraph {
  waypoints: Waypoint[];
  edges: Map<string, Set<string>>;
}

export interface NavState {
  navFromId: string;
  navToId: string;
  /** Progress along edge navFrom → navTo (0–1) */
  navProgress: number;
}

const TRANSIT_CORE_IDS = ['elev1', 'elev2', 'stairs_w', 'stairs_e'] as const;
const OUTDOOR_EXIT_IDS = ['entrance', 'west_exit', 'east_exit', 'exit_s'] as const;

/** Progress per simulation tick while riding elevator / stairs (0–100 scale) */
export const TRANSIT_PROGRESS_PER_TICK = 4;

/** Map-% step per 50ms sim tick (marker movement on floor plan). */
export const MAP_MOVE_STEP = {
  staffWander: 0.022,
  staffRespond: 0.032,
  residentFloor2: 0.022,
  residentFloor3: 0.02,
  residentFloor4: 0.018,
  navAlongEdge: 0.04,
  navAlongEdgeRespond: 0.045,
  navInterpolate: 0.04,
} as const;

function coreWaypoints(): Waypoint[] {
  const we = transitCenter(WEST_CORE.elev);
  const ee = transitCenter(EAST_CORE.elev);
  const ws = transitCenter(WEST_CORE.stairs);
  const es = transitCenter(EAST_CORE.stairs);
  return [
    { id: 'elev1', ...svgToPct(we.x, we.y), transit: 'elevator' },
    { id: 'elev2', ...svgToPct(ee.x, ee.y), transit: 'elevator' },
    { id: 'stairs_w', ...svgToPct(ws.x, ws.y), transit: 'stairs' },
    { id: 'stairs_e', ...svgToPct(es.x, es.y), transit: 'stairs' },
  ];
}

/** Floor 1 corridor spine — centers of hallway rects in Floor1Layout (SVG 1200×800). */
const F1_EW_Y = 388;
const F1_SOUTH_Y = 530;
const F1_NORTH_Y = 250;
const F1_WEST_X = 292;
const F1_MID_X = 474;
const F1_EAST_X = 806;
/** West of nurse/physio block — avoids east shaft through clinical rooms */
const F1_NURSE_WEST_X = 668;
/** East shaft (narrow rect x=728–776) — PT/rec only, not nurse response */
const F1_EAST_SHAFT_X = 728;

const FLOOR1_WAYPOINTS: Waypoint[] = [
  ...coreWaypoints(),
  { id: 'exit_s', ...svgToPct(F1_MID_X, 720), transit: 'exit' },
  { id: 'hall_w', ...svgToPct(F1_WEST_X, F1_EW_Y) },
  { id: 'hall_w_n', ...svgToPct(F1_WEST_X, F1_NORTH_Y) },
  { id: 'hall_n_e', ...svgToPct(F1_NURSE_WEST_X, F1_NORTH_Y) },
  { id: 'hall_mid', ...svgToPct(F1_MID_X, F1_EW_Y) },
  { id: 'hall_e', ...svgToPct(F1_EAST_X, F1_EW_Y) },
  { id: 'hall_e_vert', ...svgToPct(F1_EAST_SHAFT_X, F1_EW_Y) },
  { id: 'hall_en', ...svgToPct(F1_EAST_SHAFT_X, 262) },
  { id: 'hall_ev_mid', ...svgToPct(F1_EAST_SHAFT_X, 312) },
  { id: 'hall_w_s', ...svgToPct(F1_WEST_X, F1_SOUTH_Y) },
  { id: 'hall_sw', ...svgToPct(318, F1_SOUTH_Y) },
  { id: 'hall_s_mid', ...svgToPct(438, F1_SOUTH_Y) },
  { id: 'hall_s', ...svgToPct(620, F1_SOUTH_Y) },
  { id: 'hall_es', ...svgToPct(736, F1_SOUTH_Y) },
  ...publicSpaceWaypointPair('reception', 368, 179, 368, 250),
  { id: 'dining', ...svgToPct(610, 179) },
  ...publicSpaceWaypointPair('nurse', 808, 179, 808, 250),
  ...publicSpaceWaypointPair('pt', 808, 342, 708, 342),
  { id: 'pt_hall', ...svgToPct(728, 342) },
  ...publicSpaceWaypointPair('rec', 808, 554, 728, 554),
  ...roomWaypointPair('room101', 318, 627, 568),
  ...roomWaypointPair('room102', 438, 627, 568),
  ...roomWaypointPair('room103', 607, 507, 448),
  ...roomWaypointPair('room104', 607, 632, 632),
];

/** Public/clinical space with interior + doorway (matches PublicSpace in FloorMapLayouts). */
function publicSpaceWaypointPair(
  prefix: string,
  centerX: number,
  centerY: number,
  doorX: number,
  doorY: number,
): Waypoint[] {
  return [
    { id: `${prefix}_in`, ...svgToPct(centerX, centerY) },
    { id: `${prefix}_door`, ...svgToPct(doorX, doorY) },
  ];
}

function roomWaypointPair(
  prefix: string,
  centerX: number,
  centerY: number,
  doorY: number,
): Waypoint[] {
  const doorX = prefix === 'room104' ? 548 : centerX;
  const doorPos =
    prefix === 'room104' ? svgToPct(doorX, centerY) : svgToPct(centerX, doorY);
  return [
    { id: `${prefix}_in`, ...svgToPct(centerX, centerY) },
    { id: `${prefix}_door`, ...doorPos },
  ];
}

function roomEdges(prefix: string, hallId: string): [string, string][] {
  return [
    [hallId, `${prefix}_door`],
    [`${prefix}_door`, `${prefix}_in`],
    [`${prefix}_in`, `${prefix}_door`],
  ];
}

const FLOOR1_EDGES: [string, string][] = [
  ['elev1', 'stairs_w'],
  ['stairs_w', 'hall_w'],
  ['hall_w', 'hall_mid'],
  ['hall_mid', 'hall_e'],
  ['elev2', 'stairs_e'],
  ['stairs_e', 'hall_e'],
  ['hall_e', 'hall_e_vert'],
  ['hall_e_vert', 'hall_ev_mid'],
  ['hall_ev_mid', 'hall_en'],
  ...roomEdges('reception', 'hall_w_n'),
  ['nurse_door', 'hall_n_e'],
  ['hall_n_e', 'hall_w_n'],
  ['hall_w_n', 'hall_w'],
  ['nurse_door', 'nurse_in'],
  ['nurse_in', 'nurse_door'],
  ['hall_ev_mid', 'pt_hall'],
  ['pt_hall', 'pt_door'],
  ['pt_door', 'pt_in'],
  ['pt_in', 'pt_door'],
  ['reception_door', 'hall_w_s'],
  ['hall_e_vert', 'hall_es'],
  ['hall_es', 'hall_s'],
  ['hall_w', 'hall_w_s'],
  ['hall_w_s', 'hall_sw'],
  ['hall_sw', 'hall_s_mid'],
  ['hall_s_mid', 'hall_s'],
  ...roomEdges('rec', 'hall_es'),
  ...roomEdges('room103', 'hall_s'),
  ...roomEdges('room104', 'hall_s'),
  ...roomEdges('room101', 'hall_sw'),
  ...roomEdges('room102', 'hall_s_mid'),
  ['hall_s', 'exit_s'],
];

function buildFloor2Waypoints(): Waypoint[] {
  const wps: Waypoint[] = [
    ...coreWaypoints(),
    { id: 'exit_s', x: 50, y: 92, transit: 'exit' },
    { id: 'hall_nw', x: 26, y: 34 },
    { id: 'hall_nc', x: 50, y: 34 },
    { id: 'hall_ne', x: 74, y: 34 },
    { id: 'hall_mid', x: 50, y: 49 },
    { id: 'hall_sw', x: 26, y: 62 },
    { id: 'hall_sc', x: 50, y: 62 },
    { id: 'hall_se', x: 74, y: 62 },
    { id: 'med', x: 35, y: 40 },
    { id: 'nurse_st', x: 50, y: 40 },
    { id: 'lounge', x: 72, y: 40 },
  ];

  const { startX, step, roomW, northY, northH, southY, southH, hallNorthBottom, hallSouthTop } =
    RESIDENTIAL_WING;

  for (let col = 0; col < 10; col++) {
    const cx = startX + col * step + roomW / 2;
    const northInY = northY + northH / 2;
    const northDoorY = northY + northH + (hallNorthBottom - (northY + northH)) / 2;
    const southInY = southY + southH / 2;
    const southDoorY = southY - (southY - hallSouthTop) / 2;
    wps.push(
      { id: `rn_${col}_in`, ...svgToPct(cx, northInY) },
      { id: `rn_${col}_door`, ...svgToPct(cx, northDoorY) },
      { id: `rs_${col}_in`, ...svgToPct(cx, southInY) },
      { id: `rs_${col}_door`, ...svgToPct(cx, southDoorY) },
    );
  }
  return wps;
}

function buildFloor2Edges(): [string, string][] {
  const edges: [string, string][] = [
    ['elev1', 'stairs_w'],
    ['stairs_w', 'hall_nw'],
    ['stairs_w', 'hall_sw'],
    ['elev2', 'stairs_e'],
    ['stairs_e', 'hall_ne'],
    ['stairs_e', 'hall_se'],
    ['hall_nw', 'hall_nc'],
    ['hall_nc', 'hall_ne'],
    ['hall_sw', 'hall_sc'],
    ['hall_sc', 'hall_se'],
    ['hall_nc', 'hall_mid'],
    ['hall_mid', 'hall_sc'],
    ['hall_nc', 'med'],
    ['hall_nc', 'nurse_st'],
    ['hall_ne', 'lounge'],
    ['hall_se', 'exit_s'],
  ];

  for (let col = 0; col < 10; col++) {
    const northHall = col < 3 ? 'hall_nw' : col < 7 ? 'hall_nc' : 'hall_ne';
    const southHall = col < 3 ? 'hall_sw' : col < 7 ? 'hall_sc' : 'hall_se';
    edges.push(
      ...roomEdges(`rn_${col}`, northHall),
      ...roomEdges(`rs_${col}`, southHall),
    );
    if (col > 0) {
      edges.push(
        [`rn_${col - 1}_door`, `rn_${col}_door`],
        [`rs_${col - 1}_door`, `rs_${col}_door`],
      );
    }
  }
  return edges;
}

function buildFloor3Waypoints(): Waypoint[] {
  const mem = MEMORY_CARE_STATION;
  const memDoorSvgX = mem.x + 64 + 18;
  const memDoorSvgY = mem.y + mem.h;
  const northHallY = 262;

  const wps: Waypoint[] = [
    ...coreWaypoints(),
    { id: 'exit_s', x: 50, y: 92, transit: 'exit' },
    { id: 'hall_nw', ...svgToPct(368, northHallY) },
    { id: 'hall_ne', ...svgToPct(752, northHallY) },
    { id: 'hall_main', x: 48, y: 49 },
    { id: 'hall_s', x: 48, y: 70 },
    { id: 'hall_w', x: 26, y: 49 },
    { id: 'hall_e', x: 70, y: 49 },
    /** South door of memory care — in corridor, not inside secured fill */
    { id: 'nurse_st', ...svgToPct(memDoorSvgX, memDoorSvgY + 14) },
    { id: 'safe', x: 49, y: 56 },
  ];

  const { startX, step, roomW, northY, northH, southY, southH, hallMidTop, hallSouthLoop } =
    FLOOR3_WING;

  for (let col = 0; col < 11; col++) {
    const cx = startX + col * step + roomW / 2;
    const northInY = northY + northH / 2;
    const northDoorY = northY + northH + (hallMidTop - (northY + northH)) / 2;
    const southInY = southY + southH / 2;
    const southDoorY = southY - (southY - hallSouthLoop) / 2;
    wps.push(
      { id: `rn_${col}_in`, ...svgToPct(cx, northInY) },
      { id: `rn_${col}_door`, ...svgToPct(cx, northDoorY) },
      { id: `rs_${col}_in`, ...svgToPct(cx, southInY) },
      { id: `rs_${col}_door`, ...svgToPct(cx, southDoorY) },
    );
  }
  return wps;
}

function buildFloor3Edges(): [string, string][] {
  const edges: [string, string][] = [
    ['elev1', 'stairs_w'],
    ['stairs_w', 'hall_w'],
    ['stairs_w', 'hall_nw'],
    ['hall_w', 'hall_main'],
    ['hall_nw', 'hall_w'],
    ['hall_main', 'hall_e'],
    ['elev2', 'stairs_e'],
    ['stairs_e', 'hall_e'],
    ['stairs_e', 'hall_ne'],
    ['hall_ne', 'hall_e'],
    ['hall_main', 'hall_s'],
    ['hall_main', 'nurse_st'],
    ['hall_main', 'safe'],
    ['hall_s', 'exit_s'],
  ];
  for (let col = 0; col < 11; col++) {
    const northHall = col < 4 ? 'hall_w' : col < 8 ? 'hall_main' : 'hall_e';
    edges.push(...roomEdges(`rn_${col}`, northHall), ...roomEdges(`rs_${col}`, 'hall_s'));
    if (col > 0) {
      edges.push(
        [`rn_${col - 1}_door`, `rn_${col}_door`],
        [`rs_${col - 1}_door`, `rs_${col}_door`],
      );
    }
  }
  return edges;
}

const GROUNDS_WAYPOINTS: Waypoint[] = [
  { id: 'entrance', x: 50, y: 92, transit: 'exit' },
  { id: 'west_exit', x: 17, y: 50, transit: 'exit' },
  { id: 'east_exit', x: 83, y: 50, transit: 'exit' },
  { id: 'gazebo', x: 50, y: 22 },
  { id: 'garden_n', x: 25, y: 25 },
  { id: 'garden_s', x: 75, y: 75 },
  { id: 'path_w', x: 15, y: 50 },
  { id: 'path_e', x: 85, y: 50 },
  { id: 'bench_n', x: 50, y: 38 },
  { id: 'bench_s', x: 50, y: 62 },
  /** Outside monitored perimeter (dashed fence) — triggers wandering alerts */
  { id: 'beyond_w', x: 2, y: 50 },
  { id: 'beyond_e', x: 98, y: 50 },
  { id: 'beyond_n', x: 50, y: 3 },
  { id: 'beyond_s', x: 50, y: 97 },
];

const GROUNDS_EDGES: [string, string][] = [
  ['entrance', 'bench_s'],
  ['bench_s', 'path_w'],
  ['bench_s', 'path_e'],
  ['path_w', 'west_exit'],
  ['path_e', 'east_exit'],
  ['path_w', 'garden_n'],
  ['path_e', 'garden_s'],
  ['gazebo', 'garden_n'],
  ['gazebo', 'bench_n'],
  ['bench_n', 'path_w'],
  ['bench_n', 'path_e'],
  ['garden_s', 'bench_s'],
  ['path_w', 'beyond_w'],
  ['path_e', 'beyond_e'],
  ['gazebo', 'beyond_n'],
  ['entrance', 'beyond_s'],
];

function buildGraph(waypoints: Waypoint[], edgePairs: [string, string][]): FloorGraph {
  const edges = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!edges.has(a)) edges.set(a, new Set());
    if (!edges.has(b)) edges.set(b, new Set());
    edges.get(a)!.add(b);
    edges.get(b)!.add(a);
  };
  for (const [a, b] of edgePairs) addEdge(a, b);
  return { waypoints, edges };
}

const GRAPHS: Record<number, FloorGraph> = {
  1: buildGraph(FLOOR1_WAYPOINTS, FLOOR1_EDGES),
  2: buildGraph(buildFloor2Waypoints(), buildFloor2Edges()),
  3: buildGraph(buildFloor3Waypoints(), buildFloor3Edges()),
  4: buildGraph(GROUNDS_WAYPOINTS, GROUNDS_EDGES),
};

function dist(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getGraph(floor: number): FloorGraph {
  return GRAPHS[floor] ?? GRAPHS[2];
}

/** For live location labels on alerts and profiles */
export function getNavigationGraph(floor: number): FloorGraph {
  return getGraph(floor);
}

export function nearestWaypointIdForPosition(position: Position, floor: number): string {
  return nearestWaypointId(position, floor);
}

function waypointById(graph: FloorGraph, id: string): Waypoint | undefined {
  return graph.waypoints.find((w) => w.id === id);
}

function lerpPos(a: Position, b: Position, t: number): Position {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function nearestWaypointId(position: Position, floor: number): string {
  const graph = getGraph(floor);
  let bestId = graph.waypoints[0].id;
  let bestD = Infinity;
  for (const wp of graph.waypoints) {
    const d = dist(position, wp);
    if (d < bestD) {
      bestD = d;
      bestId = wp.id;
    }
  }
  return bestId;
}

function doorWaypoints(graph: FloorGraph): Waypoint[] {
  return graph.waypoints.filter((w) => w.id.endsWith('_door'));
}

function distToDoorSegment(
  position: Position,
  doorPos: Position,
  inPos: Position,
): number {
  const span = dist(doorPos, inPos);
  if (span < 1) return dist(position, doorPos);
  const along =
    ((position.x - doorPos.x) * (inPos.x - doorPos.x) +
      (position.y - doorPos.y) * (inPos.y - doorPos.y)) /
    (span * span);
  if (along < -0.15 || along > 1.15) {
    return Math.min(dist(position, doorPos), dist(position, inPos));
  }
  const proj = {
    x: doorPos.x + along * (inPos.x - doorPos.x),
    y: doorPos.y + along * (inPos.y - doorPos.y),
  };
  return dist(position, proj);
}

function doorPairEngaged(
  position: Position,
  doorPos: Position,
  inPos: Position,
): boolean {
  return (
    dist(position, doorPos) < DOOR_COMMIT_PCT + 2 ||
    dist(position, inPos) < DOOR_ZONE_PCT ||
    distToDoorSegment(position, doorPos, inPos) < DOOR_ZONE_PCT
  );
}

/** Only the matching door↔room threshold — not every doorway on the floor. */
function shouldPassDoorUnimpeded(
  position: Position,
  goal: Position,
  floor: number,
): boolean {
  if (floor === 1 && crossesPhysioNorthWall(position, goal)) {
    return false;
  }

  const graph = getGraph(floor);
  for (const door of doorWaypoints(graph)) {
    const doorPos = { x: door.x, y: door.y };
    const interior = waypointById(graph, door.id.replace('_door', '_in'));
    if (!interior) continue;
    const inPos = { x: interior.x, y: interior.y };

    const posEngaged = doorPairEngaged(position, doorPos, inPos);
    const goalEngaged = doorPairEngaged(goal, doorPos, inPos);
    if (!posEngaged || !goalEngaged) continue;

    const goalInside = dist(goal, inPos) + 1 < dist(goal, doorPos);
    const goalOutside = dist(goal, doorPos) + 1 < dist(goal, inPos);
    const fromInside = dist(position, inPos) + 0.5 < dist(position, doorPos);

    if ((fromInside && goalOutside) || (!fromInside && goalInside)) {
      return true;
    }
  }
  return false;
}

function isEnteringTargetRoom(
  position: Position,
  targetWaypointId: string,
  floor: number,
): boolean {
  const goalRoom = roomPrefixFromWaypointId(targetWaypointId);
  if (!goalRoom) return false;
  const graph = getGraph(floor);
  const doorWp = waypointById(graph, roomDoorWaypointId(goalRoom));
  const inWp = waypointById(graph, roomInteriorWaypointId(goalRoom));
  if (!doorWp || !inWp) return false;
  const doorPos = { x: doorWp.x, y: doorWp.y };
  const inPos = { x: inWp.x, y: inWp.y };
  return doorPairEngaged(position, doorPos, inPos);
}

/** Wall-clamped step, or linear only through the matching door gap. */
function staffMovementStep(
  position: Position,
  goal: Position,
  maxStepPct: number,
  floor: number,
): Position {
  if (
    shouldPassDoorUnimpeded(position, goal, floor) &&
    !(floor === 1 && crossesPhysioNorthWall(position, goal))
  ) {
    return stepTowardLinear(position, goal, maxStepPct);
  }
  return stepTowardWithWalls(position, goal, maxStepPct, floor);
}

/** Block hall diagonals that cut through blocked clinical facades. */
function hallShortcutBlocked(position: Position, goal: Position, floor: number): boolean {
  if (floor === 1 && crossesPhysioNorthWall(position, goal)) return true;
  return segmentCrossesPublicBlock(position, goal, floor);
}

/** True when a straight hall step would cross a clinical block (must use doors). */
function segmentCrossesPublicBlock(
  from: Position,
  to: Position,
  floor: number,
): boolean {
  if (!isPositionInHallway(from, floor) && !isPositionInHallway(to, floor)) {
    return false;
  }
  const samples = 12;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const p = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
    if (isPositionInPublicInterior(p, floor)) return true;
  }
  return false;
}

function staffStoppedAtWall(from: Position, to: Position): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) < 0.0005;
}

/** F2/F3: wall-clamped steps in halls; freeze when a brown wall blocks movement. */
function residentPositionStep(
  position: Position,
  desired: Position,
  maxStepPct: number,
  floor: number,
): { position: Position; blocked: boolean } {
  if (floor !== 2 && floor !== 3) {
    return { position: stepTowardLinear(position, desired, maxStepPct), blocked: false };
  }
  const next = staffMovementStep(position, desired, maxStepPct, floor);
  return { position: next, blocked: staffStoppedAtWall(position, next) };
}

function isRoomInterior(id: string): boolean {
  return id.endsWith('_in');
}

function isRoomDoor(id: string): boolean {
  return id.endsWith('_door');
}

function isHallWaypointId(id: string): boolean {
  return (
    id.startsWith('hall_') ||
    (TRANSIT_CORE_IDS as readonly string[]).includes(id as (typeof TRANSIT_CORE_IDS)[number]) ||
    (OUTDOOR_EXIT_IDS as readonly string[]).includes(id as (typeof OUTDOOR_EXIT_IDS)[number])
  );
}

/** Straight segment only for doorway ↔ room interior; corridors use Manhattan steps. */
function usesStraightCorridorSegment(fromId: string, toId: string): boolean {
  if (isRoomInterior(fromId) && isRoomDoor(toId)) return true;
  if (isRoomDoor(fromId) && isRoomInterior(toId)) return true;
  return false;
}

function roomPrefixFromWaypointId(id: string): string | null {
  if (isRoomInterior(id)) return id.slice(0, -3);
  if (isRoomDoor(id)) return id.slice(0, -5);
  return null;
}

function roomDoorWaypointId(prefix: string): string {
  return `${prefix}_door`;
}

function roomInteriorWaypointId(prefix: string): string {
  return `${prefix}_in`;
}

/** Goal waypoint for staff responding to a resident (enter room interior when applicable). */
export function responseTargetWaypointForPosition(position: Position, floor: number): string {
  const graph = getGraph(floor);
  const nearest = nearestWaypointId(position, floor);
  if (!isRoomDoor(nearest)) return nearest;

  const prefix = roomPrefixFromWaypointId(nearest);
  if (!prefix) return nearest;

  const interiorId = roomInteriorWaypointId(prefix);
  const doorWp = waypointById(graph, nearest);
  const inWp = waypointById(graph, interiorId);
  if (doorWp && inWp && dist(position, inWp) <= dist(position, doorWp) + 0.5) {
    return interiorId;
  }
  return nearest;
}

/** Next graph goal when responding — enforces door → hall → door → room. */
function resolveResponseGoalWaypoint(fromId: string, finalGoalId: string): string {
  const fromRoom = roomPrefixFromWaypointId(fromId);
  const goalRoom = roomPrefixFromWaypointId(finalGoalId);

  if (isRoomInterior(fromId) && fromRoom) {
    const doorId = roomDoorWaypointId(fromRoom);
    if (
      goalRoom === fromRoom &&
      (isRoomInterior(finalGoalId) || isRoomDoor(finalGoalId))
    ) {
      return finalGoalId;
    }
    return doorId;
  }

  if (isRoomInterior(finalGoalId) && goalRoom) {
    const doorId = roomDoorWaypointId(goalRoom);
    if (fromId === doorId || fromId === finalGoalId) return finalGoalId;
    return doorId;
  }

  return finalGoalId;
}

function responseStepTargetForStaff(
  position: Position,
  finalGoalWaypointId: string,
  floor: number,
): Position {
  const graph = getGraph(floor);
  const fromId = nearestWaypointId(position, floor);
  const stepId = resolveResponseGoalWaypoint(fromId, finalGoalWaypointId);
  const wp = waypointById(graph, stepId);
  return wp ? { x: wp.x, y: wp.y } : position;
}

function staffResponseGoal(
  position: Position,
  targetPosition: Position,
  targetWaypointId: string,
  floor: number,
): Position {
  if (dist(position, targetPosition) < STAFF_RESPONSE_ARRIVAL_PCT) {
    return targetPosition;
  }
  if (isPositionInRoomInterior(position, floor)) {
    return targetPosition;
  }

  const graph = getGraph(floor);
  const goalRoom = roomPrefixFromWaypointId(targetWaypointId);
  if (goalRoom) {
    const doorWp = waypointById(graph, roomDoorWaypointId(goalRoom));
    if (doorWp && dist(position, doorWp) < DOOR_COMMIT_PCT) {
      return targetPosition;
    }
  }

  if (isEnteringTargetRoom(position, targetWaypointId, floor)) {
    return targetPosition;
  }

  if (isPositionInHallway(position, floor)) {
    const fromId = nearestWaypointId(position, floor);
    const stepId = resolveResponseGoalWaypoint(fromId, targetWaypointId);
    if (!isRoomDoor(stepId) && !isRoomInterior(stepId)) {
      return targetPosition;
    }
    const wp = waypointById(graph, stepId);
    if (wp && isRoomDoor(stepId) && dist(position, wp) < DOOR_COMMIT_PCT) {
      return targetPosition;
    }
    return wp ? { x: wp.x, y: wp.y } : responseStepTargetForStaff(position, targetWaypointId, floor);
  }
  return responseStepTargetForStaff(position, targetWaypointId, floor);
}

function hasReachedResident(position: Position, targetPosition: Position): boolean {
  return dist(position, targetPosition) < STAFF_RESPONSE_ARRIVAL_PCT;
}

function pickResponseNeighbor(
  graph: FloorGraph,
  fromId: string,
  excludeId: string | undefined,
  finalGoalId: string,
): string {
  const stepGoal = resolveResponseGoalWaypoint(fromId, finalGoalId);

  if (isRoomInterior(fromId) && isRoomDoor(stepGoal)) {
    const doorId = fromId.replace('_in', '_door');
    if (stepGoal === doorId && graph.edges.get(fromId)?.has(doorId)) return doorId;
  }

  if (isRoomDoor(fromId) && isRoomInterior(stepGoal)) {
    const inId = fromId.replace('_door', '_in');
    if (stepGoal === inId && graph.edges.get(fromId)?.has(inId)) return inId;
  }

  const nextHop = bfsNextHop(graph, fromId, stepGoal);
  if (nextHop) return nextHop;

  const neighbors = Array.from(graph.edges.get(fromId) ?? []).filter((id) => id !== excludeId);
  if (neighbors.length === 0) return fromId;

  const allowed = neighbors.filter(
    (id) => !isRoomInterior(id) || id === stepGoal,
  );
  const pool = allowed.length > 0 ? allowed : neighbors;
  const goal = waypointById(graph, stepGoal);
  if (!goal) return pool[0];

  let best = pool[0];
  let bestD = Infinity;
  for (const id of pool) {
    const wp = waypointById(graph, id);
    if (!wp) continue;
    const d = dist(wp, goal);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

/** Keep nav state on room graph when position is inside a room but nav was on a hallway node. */
function reanchorNavIfInsideRoom(
  graph: FloorGraph,
  navFromId: string,
  navToId: string,
  navProgress: number,
  position: Position,
  floor: number,
): { navFromId: string; navToId: string; navProgress: number } {
  if (!isPositionInRoomInterior(position, floor)) {
    const nearest = nearestWaypointId(position, floor);
    if (isRoomDoor(nearest)) {
      const inId = nearest.replace('_door', '_in');
      if (graph.edges.get(nearest)?.has(inId)) {
        return { navFromId: nearest, navToId: inId, navProgress: 0 };
      }
    }
    return { navFromId, navToId, navProgress };
  }

  const nearest = nearestWaypointId(position, floor);
  const nearRoom = roomPrefixFromWaypointId(nearest);
  if (!nearRoom) return { navFromId, navToId, navProgress };

  const navRoom = roomPrefixFromWaypointId(navFromId);
  if (navRoom === nearRoom) return { navFromId, navToId, navProgress };

  if (isRoomInterior(nearest)) {
    const doorId = roomDoorWaypointId(nearRoom);
    const neighbors = graph.edges.get(nearest);
    return {
      navFromId: nearest,
      navToId: neighbors?.has(doorId) ? doorId : nearest,
      navProgress: 0,
    };
  }

  if (isRoomDoor(nearest)) {
    return { navFromId: nearest, navToId, navProgress: 0 };
  }

  return { navFromId, navToId, navProgress };
}

function pickNeighbor(
  graph: FloorGraph,
  fromId: string,
  excludeId?: string,
  navToId?: string,
  navProgress = 0,
): string {
  const neighbors = graph.edges.get(fromId);
  if (!neighbors || neighbors.size === 0) return fromId;
  const options = Array.from(neighbors).filter((id) => id !== excludeId);
  const pool = options.length > 0 ? options : Array.from(neighbors);

  if (isRoomDoor(fromId)) {
    const interior = fromId.replace('_door', '_in');
    if (pool.includes(interior)) return interior;
  }
  if (isRoomInterior(fromId)) {
    const door = fromId.replace('_in', '_door');
    if (navToId === door && navProgress < 0.88 && pool.includes(door)) {
      return door;
    }
    if (pool.includes(door) && Math.random() < 0.3) return door;
  }
  if (!isRoomDoor(fromId) && !isRoomInterior(fromId)) {
    const corridor = pool.filter(isHallWaypointId);
    if (corridor.length > 0) {
      return corridor[Math.floor(Math.random() * corridor.length)];
    }
    const doors = pool.filter(isRoomDoor);
    if (doors.length > 0 && Math.random() < 0.14) {
      return doors[Math.floor(Math.random() * doors.length)];
    }
    const transitNeighbors = pool.filter((id) =>
      (TRANSIT_CORE_IDS as readonly string[]).includes(id),
    );
    if (transitNeighbors.length > 0 && Math.random() < 0.2) {
      return transitNeighbors[Math.floor(Math.random() * transitNeighbors.length)];
    }
    const exitNeighbors = pool.filter((id) =>
      (OUTDOOR_EXIT_IDS as readonly string[]).includes(id),
    );
    if (exitNeighbors.length > 0 && Math.random() < 0.1) {
      return exitNeighbors[Math.floor(Math.random() * exitNeighbors.length)];
    }
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function edgePathLength(graph: FloorGraph, fromId: string, toId: string): number {
  const from = waypointById(graph, fromId)!;
  const to = waypointById(graph, toId)!;
  if (usesStraightCorridorSegment(fromId, toId)) return dist(from, to);
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx < 0.2 || dy < 0.2) return dist(from, to);
  return dx + dy;
}

function positionOnEdge(graph: FloorGraph, fromId: string, toId: string, progress: number): Position {
  const from = waypointById(graph, fromId)!;
  const to = waypointById(graph, toId)!;
  const t = Math.max(0, Math.min(1, progress));

  if (usesStraightCorridorSegment(fromId, toId)) {
    return lerpPos(from, to, t);
  }

  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx < 0.2 || dy < 0.2) {
    return lerpPos(from, to, t);
  }

  const via = { x: to.x, y: from.y };
  const leg1 = dist(from, via);
  const leg2 = dist(via, to);
  const total = leg1 + leg2;
  if (total < 0.01) return lerpPos(from, to, t);

  const walked = t * total;
  if (walked <= leg1) {
    return lerpPos(from, via, walked / leg1);
  }
  return lerpPos(via, to, (walked - leg1) / leg2);
}

/** Attach corridor navigation state so movement stays on graph edges */
export function createNavigationState(
  floor: number,
  nearPosition?: Position,
  preferredWaypointId?: string,
): NavState & { position: Position } {
  const graph = getGraph(floor);
  const fromId =
    preferredWaypointId && waypointById(graph, preferredWaypointId)
      ? preferredWaypointId
      : nearestWaypointId(nearPosition ?? { x: 50, y: 50 }, floor);
  const toId = pickNeighbor(graph, fromId);
  return {
    navFromId: fromId,
    navToId: toId,
    navProgress: 0,
    position: positionOnEdge(graph, fromId, toId, 0),
  };
}

export function snapToWalkable(position: Position, floor: number): Position {
  const id = nearestWaypointId(position, floor);
  const wp = waypointById(getGraph(floor), id)!;
  return { x: wp.x, y: wp.y };
}

export function getSpawnPosition(floor: number, index: number): Position {
  return getSpawnNavigationState(floor, index).position;
}

const FLOOR2_HALL_SPAWN_WAYPOINTS = [
  'hall_nw',
  'hall_nc',
  'hall_ne',
  'hall_mid',
  'hall_sw',
  'hall_sc',
  'hall_se',
  'med',
  'nurse_st',
  'lounge',
] as const;

const FLOOR3_HALL_SPAWN_WAYPOINTS = [
  'hall_nw',
  'hall_ne',
  'hall_main',
  'hall_s',
  'hall_w',
  'hall_e',
  'safe',
] as const;

const HALL_SPAWN_LABELS: Record<string, string> = {
  med: 'Medication Room',
  nurse_st: 'Nurse Station',
  lounge: 'Lounge',
  safe: 'Safe Wandering Area',
};

/** ~40% of F2/F3 residents start in corridors or common areas, not in a room. */
export function residentSpawnsInHallway(floor: number, index: number): boolean {
  if (floor !== 2 && floor !== 3) return false;
  return (index * 11 + floor * 3) % 10 < 4;
}

export function getResidentSpawnWaypointId(floor: number, index: number): string {
  if (floor === 1) {
    const rooms = ['room101_in', 'room102_in', 'room103_in', 'room104_in'];
    return rooms[index % 4];
  }
  if (floor === 4) {
    const outdoor = ['garden_n', 'gazebo', 'garden_s', 'path_w', 'path_e', 'bench_n'];
    return outdoor[index % outdoor.length];
  }
  if (residentSpawnsInHallway(floor, index)) {
    const pool = floor === 2 ? FLOOR2_HALL_SPAWN_WAYPOINTS : FLOOR3_HALL_SPAWN_WAYPOINTS;
    return pool[index % pool.length];
  }
  const graph = getGraph(floor);
  const roomIds = graph.waypoints.filter((w) => w.id.endsWith('_in'));
  return roomIds[index % roomIds.length]?.id ?? (floor === 2 ? 'hall_mid' : 'hall_main');
}

export function residentSpawnLocationLabel(floor: number, indexOnFloor: number): string {
  if (floor === 4) return 'Outdoor Grounds';
  if (residentSpawnsInHallway(floor, indexOnFloor)) {
    const wpId = getResidentSpawnWaypointId(floor, indexOnFloor);
    return HALL_SPAWN_LABELS[wpId] ?? 'Hallway';
  }
  const room = roomNumberForResident(floor, indexOnFloor);
  return room ? `Room ${room}` : `Floor ${floor}`;
}

export function getSpawnNavigationState(floor: number, index: number): NavState & { position: Position } {
  const graph = getGraph(floor);
  const wpId = getResidentSpawnWaypointId(floor, index);
  const from = waypointById(graph, wpId);
  if (!from) return createNavigationState(floor);

  if (wpId.endsWith('_in')) {
    const doorId = wpId.replace('_in', '_door');
    const hallNeighbor = graph.edges.get(wpId)?.has(doorId)
      ? doorId
      : pickNeighbor(graph, wpId);
    return {
      navFromId: wpId,
      navToId: hallNeighbor,
      navProgress: 0.35,
      position: positionOnEdge(graph, wpId, hallNeighbor, 0.35),
    };
  }

  const toId = pickNeighbor(graph, wpId);
  return {
    navFromId: wpId,
    navToId: toId,
    navProgress: 0,
    position: { x: from.x, y: from.y },
  };
}

export function enrichWithNavigation<T extends { floor: number; position: Position }>(
  person: T,
): T & NavState {
  const nav = createNavigationState(person.floor, person.position);
  return { ...person, ...nav };
}

export interface NavigablePerson {
  id: string;
  type: 'resident' | 'staff';
  floor: number;
  position: Position;
  status: 'normal' | 'alert' | 'warning';
  isMoving: boolean;
  navFromId?: string;
  navToId?: string;
  navProgress?: number;
  /** Staff free movement: current hallway wander goal (map %) */
  moveTarget?: Position;
  emergencyCall?: unknown;
  inTransit?: {
    fromFloor: number;
    toFloor: number;
    method: 'elevator' | 'stairs';
    progress: number;
  };
}

export function getElevatorWaypointId(personId: string): 'elev1' | 'elev2' {
  return personId.charCodeAt(personId.length - 1) % 2 === 0 ? 'elev1' : 'elev2';
}

export function getStairWaypointId(personId: string): 'stairs_w' | 'stairs_e' {
  return personId.charCodeAt(personId.length - 1) % 2 === 0 ? 'stairs_w' : 'stairs_e';
}

/** Small ring offset so multiple people at the same elevator/stairs do not stack. */
function transitSlotOffset(personId: string): Position {
  let h = 0;
  for (let i = 0; i < personId.length; i++) {
    h = (h * 31 + personId.charCodeAt(i)) | 0;
  }
  const slot = Math.abs(h) % 6;
  const angle = (slot / 6) * Math.PI * 2;
  const r = 1.15;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

export function getTransitHoldPosition(
  floor: number,
  personId: string,
  method: 'elevator' | 'stairs' = 'elevator',
): Position {
  const graph = getGraph(floor);
  if (floor === 4) {
    const entrance = waypointById(graph, 'entrance');
    if (entrance) return { x: entrance.x, y: entrance.y };
  }
  const wpId = method === 'stairs' ? getStairWaypointId(personId) : getElevatorWaypointId(personId);
  const wp = waypointById(graph, wpId);
  const base = wp ? { x: wp.x, y: wp.y } : { x: 20.7, y: 48.9 };
  const off = transitSlotOffset(personId);
  return { x: base.x + off.x, y: base.y + off.y };
}

/** North facade of memory care — markers snap here to avoid display vs wall fight. */
export function isNearMemoryCareNorthWall(position: Position, floor: number): boolean {
  if (floor !== 3) return false;
  const mem = MEMORY_CARE_STATION;
  const svgX = (position.x / 100) * VIEWBOX.w;
  const svgY = (position.y / 100) * VIEWBOX.h;
  return (
    svgX >= mem.x - 12 &&
    svgX <= mem.x + mem.w + 12 &&
    svgY >= mem.y - 14 &&
    svgY <= mem.y + 12
  );
}

function memoryCareNorthRepelPosition(position: Position): Position {
  const mem = MEMORY_CARE_STATION;
  const svgX = (position.x / 100) * VIEWBOX.w;
  const centerX = mem.x + mem.w / 2;
  const targetSvgX = svgX < centerX ? mem.x - 28 : mem.x + mem.w + 28;
  return svgToPct(targetSvgX, mem.y - 12);
}

/** True when position is at a room/public doorway (display should not ease through jambs). */
export function isNearMapDoor(position: Position, floor: number): boolean {
  const graph = getGraph(floor);
  for (const door of doorWaypoints(graph)) {
    const doorPos = { x: door.x, y: door.y };
    const interior = waypointById(graph, door.id.replace('_door', '_in'));
    if (!interior) continue;
    const inPos = { x: interior.x, y: interior.y };
    if (doorPairEngaged(position, doorPos, inPos)) return true;
  }
  return false;
}

export function tryStartFloorTransit(
  person: NavigablePerson,
  transit: 'elevator' | 'stairs' | 'exit',
): { fromFloor: number; toFloor: number; method: 'elevator' | 'stairs' } | null {
  const floor = person.floor;
  let candidates: number[] = [];
  let method: 'elevator' | 'stairs';

  if (transit === 'exit') {
    if (floor === 4) {
      candidates = [1];
      method = 'elevator';
    } else if (floor === 1) {
      candidates = [4];
      method = 'elevator';
    } else {
      return null;
    }
  } else if (transit === 'elevator') {
    candidates = [1, 2, 3, 4].filter((f) => f !== floor);
    method = 'elevator';
  } else {
    if (floor === 4) return null;
    if (floor === 1) candidates = [2];
    else if (floor === 3) candidates = [2];
    else if (floor === 2) candidates = [1, 3];
    else return null;
    method = 'stairs';
  }

  if (candidates.length === 0) return null;
  const toFloor = candidates[Math.floor(Math.random() * candidates.length)];
  return { fromFloor: floor, toFloor, method };
}

export function createArrivalState(
  floor: number,
  method: 'elevator' | 'stairs',
  personId: string,
): NavState & { position: Position } {
  if (floor === 4) {
    return createNavigationState(4, undefined, 'entrance');
  }
  if (method === 'elevator') {
    return createNavigationState(floor, undefined, getElevatorWaypointId(personId));
  }
  return createNavigationState(floor, undefined, getStairWaypointId(personId));
}

export type FloorTransitState = {
  fromFloor: number;
  toFloor: number;
  method: 'elevator' | 'stairs';
  progress: number;
};

/** Position marker when viewing a person on a floor (including mid-transit on elevator/stairs) */
export function getPersonDisplayForFloor<
  T extends NavigablePerson & { floor: number; inTransit?: FloorTransitState },
>(person: T, viewFloor: number): T {
  if (!person.inTransit) return person;
  const { fromFloor, toFloor, method } = person.inTransit;
  if (viewFloor !== fromFloor && viewFloor !== toFloor) return person;
  return {
    ...person,
    position: getTransitHoldPosition(viewFloor, person.id, method),
  };
}

function transitUseChance(person: NavigablePerson, transitType: 'elevator' | 'stairs' | 'exit'): number {
  const isStaff = person.type === 'staff';
  if (transitType === 'elevator' || transitType === 'stairs') {
    return isStaff ? 0.22 : 0.1;
  }
  return isStaff ? 0.14 : 0.07;
}

export interface ResponseTarget {
  residentId: string;
  targetFloor: number;
  targetWaypointId: string;
  targetPosition: Position;
}

export interface AdvanceOptions {
  /** Per-tick speed scale (1 = default elderly pacing at 50ms tick) */
  speedScale?: number;
  /** When set, staff walk the corridor graph toward this resident */
  responseTarget?: ResponseTarget;
}

function bfsNextHop(graph: FloorGraph, fromId: string, goalId: string): string | null {
  if (fromId === goalId) return null;
  const queue: string[] = [fromId];
  const visited = new Set<string>([fromId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const neighbor of graph.edges.get(id) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, id);
      if (neighbor === goalId) {
        let step = goalId;
        while (parent.get(step) !== fromId && parent.has(step)) {
          step = parent.get(step)!;
        }
        return step;
      }
      queue.push(neighbor);
    }
  }
  return null;
}

function pickNeighborTowardGoal(
  graph: FloorGraph,
  fromId: string,
  excludeId: string | undefined,
  goalId: string,
): string {
  const nextHop = bfsNextHop(graph, fromId, goalId);
  if (nextHop) return nextHop;

  const neighbors = Array.from(graph.edges.get(fromId) ?? []).filter((id) => id !== excludeId);
  if (neighbors.length === 0) return fromId;

  const goal = waypointById(graph, goalId);
  if (!goal) return neighbors[0];

  let best = neighbors[0];
  let bestD = Infinity;
  for (const id of neighbors) {
    const wp = waypointById(graph, id);
    if (!wp) continue;
    const d = dist(wp, goal);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

export function tryStartFloorTransitTo(
  person: NavigablePerson,
  toFloor: number,
): { fromFloor: number; toFloor: number; method: 'elevator' | 'stairs' } | null {
  const floor = person.floor;
  if (floor === toFloor) return null;

  if (floor === 4 || toFloor === 4) {
    return { fromFloor: floor, toFloor, method: 'elevator' };
  }

  const diff = Math.abs(toFloor - floor);
  if (diff === 1) {
    return { fromFloor: floor, toFloor, method: 'stairs' };
  }

  return { fromFloor: floor, toFloor, method: 'elevator' };
}

function residentMovementFrozen(person: NavigablePerson): boolean {
  return (
    person.type === 'resident' &&
    (person.status === 'alert' || person.status === 'warning')
  );
}

function stepTowardLinear(from: Position, to: Position, maxStepPct: number): Position {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d <= maxStepPct) return to;
  return { x: from.x + (dx / d) * maxStepPct, y: from.y + (dy / d) * maxStepPct };
}

function randomHallwayWaypointPosition(floor: number): Position {
  const graph = getGraph(floor);
  const pool = graph.waypoints.filter(
    (w) =>
      w.id.startsWith('hall_') ||
      w.id.startsWith('elev') ||
      w.id.startsWith('stairs_') ||
      w.transit,
  );
  const wp = pool[Math.floor(Math.random() * pool.length)] ?? graph.waypoints[0];
  return { x: wp.x, y: wp.y };
}

function progressOnEdge(
  graph: FloorGraph,
  fromId: string,
  toId: string,
  position: Position,
): number {
  const a = waypointById(graph, fromId);
  const b = waypointById(graph, toId);
  if (!a || !b) return 0;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return 0;
  const t = ((position.x - a.x) * dx + (position.y - a.y) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

/** Straight diagonal in halls/rooms; stop at walls; graph only outside walkable areas. */
function staffStepWithWalls(
  position: Position,
  goal: Position,
  maxStepPct: number,
  floor: number,
): Position {
  if (shouldPassDoorUnimpeded(position, goal, floor)) {
    return stepTowardLinear(position, goal, maxStepPct);
  }

  const inHall = isPositionInHallway(position, floor);
  const inRoom = isPositionInRoomInterior(position, floor);
  const inPublic = isPositionInPublicInterior(position, floor);

  if (inPublic && !sharesWalkableInterior(position, goal, floor)) {
    const leavingSpace =
      !isPositionInPublicInterior(goal, floor) && !isPositionInHallway(goal, floor);
    if (leavingSpace) {
      const graph = getGraph(floor);
      const fromId = nearestWaypointId(position, floor);
      const doorId = fromId.endsWith('_in') ? fromId.replace('_in', '_door') : null;
      if (doorId && graph.edges.get(fromId)?.has(doorId)) {
        const doorWp = waypointById(graph, doorId);
        if (doorWp) {
          goal = { x: doorWp.x, y: doorWp.y };
        }
      }
    }
  }

  if ((inHall || inRoom || inPublic) && !hallShortcutBlocked(position, goal, floor)) {
    return staffMovementStep(position, goal, maxStepPct, floor);
  }

  if (!inHall && !inRoom) {
    const graph = getGraph(floor);
    const fromId = nearestWaypointId(position, floor);
    const goalId = nearestWaypointId(goal, floor);

    if (fromId !== goalId) {
      const hop =
        bfsNextHop(graph, fromId, goalId) ??
        pickNeighborTowardGoal(graph, fromId, undefined, goalId);
      const hopWp = waypointById(graph, hop);
      if (hopWp) {
        goal = { x: hopWp.x, y: hopWp.y };
      }
    }
  }

  return staffMovementStep(position, goal, maxStepPct, floor);
}

/** Staff: diagonal steps in beige halls; blocked by brown wall lines (door gaps open). */
function advanceStaffPosition<T extends NavigablePerson>(
  person: T,
  options: AdvanceOptions = {},
): T {
  const responseTarget = options.responseTarget;
  const responding = Boolean(responseTarget);
  const speedScale = options.speedScale ?? 1;
  const floor = person.floor;
  const wanderSpeed = MAP_MOVE_STEP.staffWander * speedScale;
  const respondSpeed = MAP_MOVE_STEP.staffRespond * speedScale;

  if (!responding) {
    if (person.isMoving !== false) {
      person = { ...person, isMoving: true };
    }
  } else if (!person.isMoving && !responseTarget) {
    return person;
  }

  if (!responding && person.isMoving === false) {
    if (Math.random() < 0.1) {
      return {
        ...person,
        isMoving: true,
        moveTarget: randomHallwayWaypointPosition(floor),
      };
    }
    return person;
  }

  if (responding && responseTarget) {
    const { targetFloor, targetPosition, targetWaypointId } = responseTarget;

    if (floor !== targetFloor) {
      const transitPos = getTransitHoldPosition(floor, person.id, 'elevator');
      const nextPos = staffStepWithWalls(person.position, transitPos, respondSpeed, floor);

      if (dist(nextPos, transitPos) < 2.2) {
        const directed = tryStartFloorTransitTo(person, targetFloor);
        if (directed) {
          return {
            ...person,
            position: nextPos,
            moveTarget: undefined,
            isMoving: true,
            inTransit: { ...directed, progress: 0 },
          };
        }
      }

      return { ...person, position: nextPos, moveTarget: transitPos, isMoving: true };
    }

    if (hasReachedResident(person.position, targetPosition)) {
      return {
        ...person,
        moveTarget: undefined,
        isMoving: false,
      };
    }

    let goal = staffResponseGoal(
      person.position,
      targetPosition,
      targetWaypointId,
      floor,
    );
    if (
      person.moveTarget &&
      shouldPassDoorUnimpeded(person.position, person.moveTarget, floor) &&
      dist(person.position, person.moveTarget) < DOOR_COMMIT_PCT + 3
    ) {
      goal = person.moveTarget;
    }
    const nextPos = staffStepWithWalls(person.position, goal, respondSpeed, floor);

    if (hasReachedResident(nextPos, targetPosition)) {
      return {
        ...person,
        position: nextPos,
        moveTarget: undefined,
        isMoving: false,
      };
    }

    if (staffStoppedAtWall(person.position, nextPos)) {
      const moveTarget = isNearMemoryCareNorthWall(person.position, floor)
        ? memoryCareNorthRepelPosition(person.position)
        : goal;
      return {
        ...person,
        position: nextPos,
        moveTarget,
        isMoving: false,
      };
    }

    return {
      ...person,
      position: nextPos,
      moveTarget: goal,
      isMoving: true,
    };
  }

  let moveTarget = person.moveTarget;
  if (!moveTarget || dist(person.position, moveTarget) < 1.2) {
    moveTarget = randomHallwayWaypointPosition(floor);
  }
  if (
    person.moveTarget &&
    shouldPassDoorUnimpeded(person.position, person.moveTarget, floor) &&
    dist(person.position, person.moveTarget) < DOOR_COMMIT_PCT + 3
  ) {
    moveTarget = person.moveTarget;
  }

  let nextPos = staffStepWithWalls(person.position, moveTarget, wanderSpeed, floor);

  if (staffStoppedAtWall(person.position, nextPos)) {
    const moveTarget = isNearMemoryCareNorthWall(person.position, floor)
      ? memoryCareNorthRepelPosition(person.position)
      : randomHallwayWaypointPosition(floor);
    return {
      ...person,
      position: nextPos,
      moveTarget,
      isMoving: false,
    };
  }

  if (dist(nextPos, person.position) < 0.0008) {
    moveTarget = randomHallwayWaypointPosition(floor);
    nextPos = staffStepWithWalls(person.position, moveTarget, wanderSpeed, floor);
    if (staffStoppedAtWall(person.position, nextPos)) {
      const away = isNearMemoryCareNorthWall(person.position, floor)
        ? memoryCareNorthRepelPosition(person.position)
        : randomHallwayWaypointPosition(floor);
      return {
        ...person,
        position: nextPos,
        moveTarget: away,
        isMoving: false,
      };
    }
  }

  return {
    ...person,
    position: nextPos,
    moveTarget,
    isMoving: true,
  };
}

/** Residents: corridor graph with wall clamp. Staff (not in transit): free diagonal in halls. */
export function advancePersonPosition<T extends NavigablePerson>(
  person: T,
  options: AdvanceOptions = {},
): T {
  if (person.emergencyCall) return person;
  if (residentMovementFrozen(person)) return person;

  if (person.type === 'staff' && !person.inTransit) {
    return advanceStaffPosition(person, options);
  }

  const responseTarget = person.type === 'staff' ? options.responseTarget : undefined;
  const responding = Boolean(responseTarget);

  if (person.type === 'resident' && !residentMovementFrozen(person)) {
    person = { ...person, isMoving: true };
  }

  if (!person.isMoving && !responding) return person;

  const speedScale = (options.speedScale ?? 1) * (responding ? 1.65 : 1);
  const floor = person.floor;
  const graph = getGraph(floor);

  let navFromId = person.navFromId ?? nearestWaypointId(person.position, floor);
  let navToId = person.navToId ?? pickNeighbor(graph, navFromId, undefined, undefined, 0);
  let navProgress = person.navProgress ?? 0;

  const fromWp = waypointById(graph, navFromId);
  const toWp = waypointById(graph, navToId);
  if (!fromWp || !toWp) {
    const fresh = createNavigationState(floor, person.position);
    return { ...person, ...fresh, isMoving: true };
  }

  if (responding && responseTarget) {
    const { targetFloor, targetWaypointId, targetPosition } = responseTarget;

    const reanchored = reanchorNavIfInsideRoom(
      graph,
      navFromId,
      navToId,
      navProgress,
      person.position,
      floor,
    );
    navFromId = reanchored.navFromId;
    navToId = reanchored.navToId;
    navProgress = reanchored.navProgress;

    let fromWpNow = waypointById(graph, navFromId);
    let toWpNow = waypointById(graph, navToId);
    if (!fromWpNow || !toWpNow) {
      const fresh = createNavigationState(floor, person.position);
      return { ...person, ...fresh, isMoving: true };
    }

    if (floor !== targetFloor) {
      const atWp = fromWpNow;
      if (atWp.transit) {
        const directed = tryStartFloorTransitTo(person, targetFloor);
        if (directed) {
          const hold = getTransitHoldPosition(person.floor, person.id, directed.method);
          return {
            ...person,
            position: hold,
            navFromId,
            navToId,
            navProgress: 0,
            isMoving: true,
            inTransit: { ...directed, progress: 0 },
          };
        }
      }
      navProgress += MAP_MOVE_STEP.navAlongEdge / Math.max(edgePathLength(graph, navFromId, navToId), 0.5);
      if (navProgress >= 1) {
        navFromId = navToId;
        navToId = pickResponseNeighbor(graph, navFromId, person.navFromId, targetWaypointId);
        navProgress = 0;
        fromWpNow = waypointById(graph, navFromId)!;
        toWpNow = waypointById(graph, navToId)!;
        const transitWp = fromWpNow;
        if (transitWp?.transit && Math.random() < 0.55) {
          const directed = tryStartFloorTransitTo(person, targetFloor);
          if (directed) {
            return {
              ...person,
              position: getTransitHoldPosition(person.floor, person.id, directed.method),
              navFromId,
              navToId,
              navProgress: 0,
              isMoving: true,
              inTransit: { ...directed, progress: 0 },
            };
          }
        }
      }
      const desired = positionOnEdge(graph, navFromId, navToId, navProgress);
      return {
        ...person,
        position: stepTowardLinear(person.position, desired, MAP_MOVE_STEP.navInterpolate * speedScale),
        navFromId,
        navToId,
        navProgress,
        isMoving: true,
      };
    }

    const arrived =
      Math.hypot(person.position.x - targetPosition.x, person.position.y - targetPosition.y) <
      1.2;
    if (!arrived) {
      const edgeLen = Math.max(edgePathLength(graph, navFromId, navToId), 0.5);
      const speedPerTick = MAP_MOVE_STEP.navAlongEdgeRespond * speedScale;
      navProgress += speedPerTick / edgeLen;

      if (navProgress >= 1) {
        navFromId = navToId;
        const prev = person.navToId;
        navToId = pickResponseNeighbor(graph, navFromId, prev, targetWaypointId);
        navProgress = 0;
        fromWpNow = waypointById(graph, navFromId)!;
        toWpNow = waypointById(graph, navToId)!;
      }

      const desired = positionOnEdge(graph, navFromId, navToId, navProgress);
      return {
        ...person,
        position: stepTowardLinear(person.position, desired, MAP_MOVE_STEP.navInterpolate * speedScale),
        navFromId,
        navToId,
        navProgress,
        isMoving: true,
      };
    }

    return {
      ...person,
      position: { ...targetPosition },
      isMoving: true,
    };
  }

  const edgeLen = Math.max(edgePathLength(graph, navFromId, navToId), 0.5);

  const hallStep =
    person.floor === 3
      ? MAP_MOVE_STEP.residentFloor3
      : person.floor === 4
        ? MAP_MOVE_STEP.residentFloor4
        : MAP_MOVE_STEP.residentFloor2;
  const speedPerTick = hallStep * speedScale;

  const moveChance = person.floor === 3 ? 0.22 : 0.18;

  const hold = positionOnEdge(graph, navFromId, navToId, navProgress);

  const pauseStep = residentPositionStep(
    person.position,
    hold,
    speedPerTick * 0.35,
    floor,
  );

  if (Math.random() > moveChance) {
    return {
      ...person,
      navFromId,
      navToId,
      navProgress,
      position: pauseStep.position,
    };
  }

  let nextProgress = navProgress + speedPerTick / edgeLen;
  let nextFromId = navFromId;
  let nextToId = navToId;

  if (nextProgress >= 1) {
    nextFromId = navToId;
    const prev = person.navToId;
    nextToId = pickNeighbor(graph, navFromId, prev, navToId, navProgress);
    nextProgress = 0;

    const atWp = waypointById(graph, nextFromId)!;
    if (atWp.transit && Math.random() < transitUseChance(person, atWp.transit)) {
      const transit = tryStartFloorTransit(person, atWp.transit);
      if (transit) {
        const holdPos = getTransitHoldPosition(person.floor, person.id, transit.method);
        return {
          ...person,
          position: holdPos,
          navFromId: nextFromId,
          navToId: nextToId,
          navProgress: 0,
          inTransit: { ...transit, progress: 0 },
        };
      }
    }
  }

  const desired = positionOnEdge(graph, nextFromId, nextToId, nextProgress);
  const step = residentPositionStep(person.position, desired, speedPerTick, floor);

  if (step.blocked) {
    const prev = person.navToId;
    let nextToId = pickNeighbor(graph, navFromId, prev, navToId, navProgress);
    if (isNearMemoryCareNorthWall(person.position, floor)) {
      const svgX = (person.position.x / 100) * VIEWBOX.w;
      const centerX = MEMORY_CARE_STATION.x + MEMORY_CARE_STATION.w / 2;
      nextToId = svgX < centerX ? 'hall_nw' : 'hall_ne';
    }
    return {
      ...person,
      position: step.position,
      navFromId,
      navToId: nextToId,
      navProgress: 0,
    };
  }

  return {
    ...person,
    position: step.position,
    navFromId: nextFromId,
    navToId: nextToId,
    navProgress: nextProgress,
  };
}
