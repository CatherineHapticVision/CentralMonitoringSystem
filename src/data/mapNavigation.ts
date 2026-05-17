/** Walkable navigation — movement only along corridor graph edges (no wall clipping) */

import {
  EAST_CORE,
  FLOOR3_WING,
  RESIDENTIAL_WING,
  svgToPct,
  transitCenter,
  WEST_CORE,
} from '../components/floorPlanConstants';

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

const FLOOR1_WAYPOINTS: Waypoint[] = [
  ...coreWaypoints(),
  { id: 'exit_s', x: 50, y: 92, transit: 'exit' },
  { id: 'hall_w', x: 28, y: 49 },
  { id: 'hall_mid', x: 50, y: 49 },
  { id: 'hall_e', x: 74, y: 49 },
  { id: 'hall_v', x: 50, y: 38 },
  { id: 'hall_s', x: 50, y: 62 },
  { id: 'reception', x: 31, y: 21 },
  { id: 'dining', ...svgToPct(610, 179) },
  { id: 'nurse', x: 67, y: 21 },
  { id: 'rec', x: 74, y: 68 },
  { id: 'pt', x: 74, y: 38 },
  ...roomWaypointPair('room101', 318, 627, 568),
  ...roomWaypointPair('room102', 438, 627, 568),
  ...roomWaypointPair('room103', 607, 507, 448),
  ...roomWaypointPair('room104', 607, 632, 632),
];

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
  ['hall_mid', 'hall_v'],
  ['hall_v', 'reception'],
  ['hall_v', 'dining'],
  ['hall_v', 'nurse'],
  ['hall_mid', 'hall_s'],
  ...roomEdges('room103', 'hall_s'),
  ...roomEdges('room104', 'hall_s'),
  ...roomEdges('room101', 'hall_w'),
  ...roomEdges('room102', 'hall_w'),
  ['hall_e', 'pt'],
  ['hall_e', 'rec'],
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
  const wps: Waypoint[] = [
    ...coreWaypoints(),
    { id: 'exit_s', x: 50, y: 92, transit: 'exit' },
    { id: 'hall_n', x: 48, y: 34 },
    { id: 'hall_main', x: 48, y: 49 },
    { id: 'hall_s', x: 48, y: 70 },
    { id: 'hall_w', x: 26, y: 49 },
    { id: 'hall_e', x: 70, y: 49 },
    { id: 'nurse_st', x: 49, y: 36 },
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
    ['hall_w', 'hall_main'],
    ['hall_main', 'hall_e'],
    ['elev2', 'stairs_e'],
    ['stairs_e', 'hall_e'],
    ['hall_main', 'hall_n'],
    ['hall_main', 'hall_s'],
    ['hall_n', 'nurse_st'],
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

function isRoomInterior(id: string): boolean {
  return id.endsWith('_in');
}

function isRoomDoor(id: string): boolean {
  return id.endsWith('_door');
}

function pickNeighbor(graph: FloorGraph, fromId: string, excludeId?: string): string {
  const neighbors = graph.edges.get(fromId);
  if (!neighbors || neighbors.size === 0) return fromId;
  const options = Array.from(neighbors).filter((id) => id !== excludeId);
  const pool = options.length > 0 ? options : Array.from(neighbors);

  if (isRoomDoor(fromId)) {
    const interior = fromId.replace('_door', '_in');
    if (pool.includes(interior) && Math.random() < 0.62) return interior;
  }
  if (isRoomInterior(fromId)) {
    const door = fromId.replace('_in', '_door');
    if (pool.includes(door) && Math.random() < 0.58) return door;
  }
  if (!isRoomDoor(fromId) && !isRoomInterior(fromId)) {
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

function positionOnEdge(graph: FloorGraph, fromId: string, toId: string, progress: number): Position {
  const from = waypointById(graph, fromId)!;
  const to = waypointById(graph, toId)!;
  return lerpPos(from, to, Math.max(0, Math.min(1, progress)));
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

export function getSpawnNavigationState(floor: number, index: number): NavState & { position: Position } {
  const graph = getGraph(floor);
  let wpId: string | undefined;

  if (floor === 1) {
    const rooms = ['room101_in', 'room102_in', 'room103_in', 'room104_in'];
    wpId = rooms[index % 4];
  } else if (floor === 4) {
    const outdoor = ['garden_n', 'gazebo', 'garden_s', 'path_w', 'path_e', 'bench_n'];
    wpId = outdoor[index % outdoor.length];
  } else {
    const roomIds = graph.waypoints.filter((w) => w.id.endsWith('_in'));
    wpId = roomIds[index % roomIds.length]?.id;
  }

  if (wpId) {
    const from = waypointById(graph, wpId)!;
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

  return createNavigationState(floor);
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
  return wp ? { x: wp.x, y: wp.y } : { x: 20.7, y: 48.9 };
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

export interface AdvanceOptions {
  /** Per-tick speed scale (1 = default elderly pacing at 50ms tick) */
  speedScale?: number;
}

/** Move one step along corridor graph — never through walls */
export function advancePersonPosition<T extends NavigablePerson>(
  person: T,
  options: AdvanceOptions = {},
): T {
  if (person.emergencyCall) return person;
  if (person.type === 'resident' && person.status === 'alert') return person;
  if (!person.isMoving) return person;

  const speedScale = options.speedScale ?? 1;
  const floor = person.floor;
  const graph = getGraph(floor);

  let navFromId = person.navFromId ?? nearestWaypointId(person.position, floor);
  let navToId = person.navToId ?? pickNeighbor(graph, navFromId);
  let navProgress = person.navProgress ?? 0;

  const fromWp = waypointById(graph, navFromId);
  const toWp = waypointById(graph, navToId);
  if (!fromWp || !toWp) {
    const fresh = createNavigationState(floor, person.position);
    return { ...person, ...fresh };
  }

  const edgeLen = Math.max(dist(fromWp, toWp), 0.5);

  // Elderly residents: ~2.5% of map per second; staff ~5%
  const speedPerTick =
    (person.type === 'staff'
      ? 0.025
      : person.floor === 3
        ? 0.02
        : person.floor === 4
          ? 0.018
          : 0.022) * speedScale;

  const moveChance =
    person.type === 'staff'
      ? 0.35
      : person.floor === 3
        ? 0.22
        : 0.18;

  if (Math.random() > moveChance) {
    return {
      ...person,
      navFromId,
      navToId,
      navProgress,
      position: positionOnEdge(graph, navFromId, navToId, navProgress),
    };
  }

  navProgress += speedPerTick / edgeLen;

  if (navProgress >= 1) {
    navFromId = navToId;
    const prev = person.navToId;
    navToId = pickNeighbor(graph, navFromId, prev);
    navProgress = 0;

    const atWp = waypointById(graph, navFromId)!;
    if (atWp.transit && Math.random() < transitUseChance(person, atWp.transit)) {
      const transit = tryStartFloorTransit(person, atWp.transit);
      if (transit) {
        const hold = getTransitHoldPosition(person.floor, person.id, transit.method);
        return {
          ...person,
          position: hold,
          navFromId,
          navToId,
          navProgress: 0,
          inTransit: { ...transit, progress: 0 },
        };
      }
    }
  }

  const position = positionOnEdge(graph, navFromId, navToId, navProgress);

  return {
    ...person,
    position,
    navFromId,
    navToId,
    navProgress,
  };
}
