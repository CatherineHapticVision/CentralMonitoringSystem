import {
  nearestWaypointIdForPosition,
} from './mapNavigation';
import { getRoomsForFloor } from './roomInventory';
import { getWanderingViolation, isOutsideOutdoorPerimeter } from './wanderingZones';

type Position = { x: number; y: number };

const PUBLIC_LABELS: Record<string, string> = {
  reception: 'Reception',
  dining: 'Dining hall',
  nurse: 'Nurse station',
  nurse_st: 'Nurse station',
  rec: 'Recreation area',
  pt: 'Physiotherapy',
  med: 'Medication room',
  lounge: 'Lounge',
  safe: 'Safe wandering area',
  gazebo: 'Gazebo',
  garden_n: 'North garden',
  garden_s: 'South garden',
  entrance: 'Main entrance',
  elev1: 'West elevator',
  elev2: 'East elevator',
  stairs_w: 'West stairs',
  stairs_e: 'East stairs',
  beyond_w: 'Outside perimeter (west)',
  beyond_e: 'Outside perimeter (east)',
  beyond_n: 'Outside perimeter (north)',
  beyond_s: 'Outside perimeter (south)',
};

function dist(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function roomLabelFromWaypointId(waypointId: string, floor: number): string | null {
  const directRoom = waypointId.match(/^room(\d+)(?:_(?:in|door))?$/);
  if (directRoom) return `Room ${directRoom[1]}`;

  const north = waypointId.match(/^rn_(\d+)_(?:in|door)$/);
  if (north && floor >= 1 && floor <= 3) {
    const col = parseInt(north[1], 10);
    const rooms = getRoomsForFloor(floor as 1 | 2 | 3).filter((r) => r.wing === 'north');
    if (rooms[col]) return `Room ${rooms[col].number}`;
  }

  const south = waypointId.match(/^rs_(\d+)_(?:in|door)$/);
  if (south && floor >= 1 && floor <= 3) {
    const col = parseInt(south[1], 10);
    const rooms = getRoomsForFloor(floor as 1 | 2 | 3).filter((r) => r.wing === 'south');
    if (rooms[col]) return `Room ${rooms[col].number}`;
  }

  return null;
}

export function labelForWaypointId(waypointId: string, floor: number): string | null {
  const room = roomLabelFromWaypointId(waypointId, floor);
  if (room) return room;

  if (PUBLIC_LABELS[waypointId]) return PUBLIC_LABELS[waypointId];

  if (waypointId.startsWith('hall_') || waypointId === 'hall_w' || waypointId === 'hall_e') {
    return 'Hallway';
  }
  if (waypointId.startsWith('path_') || waypointId.startsWith('bench_')) {
    return 'Walking path';
  }

  return null;
}

function floorSuffix(floor: number): string {
  if (floor === 4) return 'Outdoor grounds';
  return `Floor ${floor}`;
}

function restrictedAreaLabel(
  floor: number,
  position: Position,
): string | null {
  const violation = getWanderingViolation({ floor, position });
  switch (violation) {
    case 'staff':
      return 'Staff room';
    case 'clean':
      return 'Clean supply room';
    case 'soiled':
      return 'Soiled utility room';
    case 'outdoor_perimeter':
      return 'Outside monitored perimeter';
    default:
      if (floor === 4 && isOutsideOutdoorPerimeter(floor, position.x, position.y)) {
        return 'Outside monitored perimeter';
      }
      return null;
  }
}

export function resolveLiveMapLocation(input: {
  floor: number;
  position: { x: number; y: number };
  navFromId?: string;
  navToId?: string;
}): string {
  const { floor, position } = input;
  const suffix = floorSuffix(floor);

  const restricted = restrictedAreaLabel(floor, position);
  if (restricted) return `${restricted} (${suffix})`;

  for (const wpId of [input.navFromId, input.navToId]) {
    if (!wpId) continue;
    const label = labelForWaypointId(wpId, floor);
    if (label) return `${label} (${suffix})`;
  }

  const nearestId = nearestWaypointIdForPosition(position, floor);
  const nearestLabel = labelForWaypointId(nearestId, floor);
  if (nearestLabel) return `${nearestLabel} (${suffix})`;

  return `Hallway (${suffix})`;
}

export function findMapPersonLocation(
  personId: string,
  mapPeople: Array<{
    id: string;
    type?: 'resident' | 'staff';
    floor: number;
    position: { x: number; y: number };
    navFromId?: string;
    navToId?: string;
  }>,
): string | null {
  const onMap = mapPeople.find((p) => p.id === personId);
  if (!onMap) return null;
  return resolveLiveMapLocation(onMap);
}
