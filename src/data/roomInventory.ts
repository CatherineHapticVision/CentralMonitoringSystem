/** Licensed beds and room types — must total 124 beds across the facility */

export type RoomType = 'private' | 'semi-private';

export interface FacilityRoom {
  number: number;
  floor: 1 | 2 | 3;
  wing: 'north' | 'south' | 'west' | 'standalone';
  type: RoomType;
  beds: 1 | 2;
}

const PRIVATE_FILL = '#eef3fa';
const SEMI_FILL = '#faf6ef';

export const ROOM_TYPE_STYLES = {
  private: {
    fill: PRIVATE_FILL,
    badge: 'P',
    shortLabel: 'Private',
    bedLabel: '1 bed',
  },
  'semi-private': {
    fill: SEMI_FILL,
    badge: '2×',
    shortLabel: 'Semi',
    bedLabel: '2 beds',
  },
} as const;

/** Floor 1 — 4 private rooms (admission / respite), 4 beds */
const FLOOR1_ROOMS: FacilityRoom[] = [
  { number: 101, floor: 1, wing: 'standalone', type: 'private', beds: 1 },
  { number: 102, floor: 1, wing: 'standalone', type: 'private', beds: 1 },
  { number: 103, floor: 1, wing: 'standalone', type: 'private', beds: 1 },
  { number: 104, floor: 1, wing: 'standalone', type: 'private', beds: 1 },
];

/** Floor 2 — 30 semi-private rooms, 60 beds */
function floor2Rooms(): FacilityRoom[] {
  const rooms: FacilityRoom[] = [];
  for (let n = 201; n <= 215; n++) {
    rooms.push({ number: n, floor: 2, wing: 'north', type: 'semi-private', beds: 2 });
  }
  for (let n = 225; n <= 239; n++) {
    rooms.push({ number: n, floor: 2, wing: 'south', type: 'semi-private', beds: 2 });
  }
  return rooms;
}

/** Floor 3 — 25 semi-private rooms, 50 beds */
function floor3Rooms(): FacilityRoom[] {
  const rooms: FacilityRoom[] = [];
  for (let n = 301; n <= 312; n++) {
    rooms.push({ number: n, floor: 3, wing: 'north', type: 'semi-private', beds: 2 });
  }
  for (let n = 313; n <= 325; n++) {
    rooms.push({ number: n, floor: 3, wing: 'south', type: 'semi-private', beds: 2 });
  }
  return rooms;
}

export const FACILITY_ROOMS: FacilityRoom[] = [
  ...FLOOR1_ROOMS,
  ...floor2Rooms(),
  ...floor3Rooms(),
];

export const LICENSED_BEDS = 124;
export const INDOOR_BEDS = FACILITY_ROOMS.reduce((sum, r) => sum + r.beds, 0);
export const OUTDOOR_RESIDENT_CAPACITY = LICENSED_BEDS - INDOOR_BEDS;

export function getRoomsForFloor(floor: 1 | 2 | 3): FacilityRoom[] {
  return FACILITY_ROOMS.filter((r) => r.floor === floor);
}

export function getFloorBedSummary(floor: 1 | 2 | 3): {
  rooms: number;
  beds: number;
  privateRooms: number;
  semiPrivateRooms: number;
} {
  const rooms = getRoomsForFloor(floor);
  return {
    rooms: rooms.length,
    beds: rooms.reduce((s, r) => s + r.beds, 0),
    privateRooms: rooms.filter((r) => r.type === 'private').length,
    semiPrivateRooms: rooms.filter((r) => r.type === 'semi-private').length,
  };
}

/** Assign room number for resident index on a floor (0-based within floor cohort) */
export function roomNumberForResident(floor: number, indexOnFloor: number): string | null {
  if (floor === 4) return null;
  const rooms = getRoomsForFloor(floor as 1 | 2 | 3);
  if (rooms.length === 0) return null;
  return String(rooms[indexOnFloor % rooms.length].number);
}
