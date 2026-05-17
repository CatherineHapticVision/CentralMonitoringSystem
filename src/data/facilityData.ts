// Grandview Care Long-Term Care Facility - 124 Residents
// Ontario, Canada

import { enrichWithNavigation, createNavigationState, getSpawnNavigationState } from './mapNavigation';
import { roomNumberForResident } from './roomInventory';

interface Person {
  id: string;
  name: string;
  status: 'normal' | 'alert' | 'warning';
  location: string;
  isMoving?: boolean;
  lastSeen?: string;
  respondingTo?: string;
  destination?: string;
}

interface MapPerson {
  id: string;
  name: string;
  position: { x: number; y: number };
  status: 'normal' | 'alert' | 'warning';
  type: 'resident' | 'staff';
  isMoving: boolean;
  floor: number;
  navFromId?: string;
  navToId?: string;
  navProgress?: number;
  inTransit?: {
    fromFloor: number;
    toFloor: number;
    method: 'elevator' | 'stairs';
    progress: number;
  };
  emergencyCall?: {
    status: 'ringing' | 'connected';
    startTime: Date;
  };
}

const FIRST_NAMES = [
  'Margaret', 'Robert', 'Dorothy', 'James', 'Patricia', 'Michael', 'Barbara', 'William',
  'Elizabeth', 'Richard', 'Mary', 'Charles', 'Helen', 'Joseph', 'Ruth', 'Thomas',
  'Betty', 'John', 'Anna', 'David', 'Alice', 'George', 'Florence', 'Frank',
  'Evelyn', 'Arthur', 'Grace', 'Walter', 'Rose', 'Harold', 'Jean', 'Paul',
  'Emma', 'Edward', 'Catherine', 'Henry', 'Lillian', 'Donald', 'Martha', 'Kenneth',
  'Eleanor', 'Albert', 'Agnes', 'Raymond', 'Marie', 'Francis', 'Edith', 'Jack',
  'Gertrude', 'Harry', 'Clara', 'Norman', 'Louise', 'Carl', 'Mabel', 'Louis',
  'Gladys', 'Fred', 'Hazel', 'Howard', 'Esther', 'Roy', 'Beatrice', 'Ernest',
];

const LAST_NAMES = [
  'Smith', 'Chen', 'Singh', 'Nguyen', 'Patel', 'Martin', 'Tremblay', 'Brown',
  'Wilson', 'Garcia', 'Ibrahim', 'Li', 'Rossi', 'MacDonald', 'Roy', 'Taylor',
  'Moore', 'Kim', 'Lopez', 'Lee', 'Thompson', 'White', 'Kumar', 'Sanchez',
  'Clark', 'Ahmed', 'Lewis', 'Robinson', 'Wang', 'Young', 'Gagnon', 'King',
  'Wright', 'Scott', 'Lavoie', 'Zhang', 'Hill', 'Flores', 'Green', 'Leblanc',
  'Nelson', 'Malik', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Côté', 'Roberts',
  'Hernandez', 'Phillips', 'Evans', 'Bouchard', 'Diaz', 'Ali', 'Cruz', 'Edwards',
  'Collins', 'Kaur', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Desrosiers',
  'O\'Brien', 'Walsh', 'Cohen', 'Richardson', 'Johnson', 'Williams', 'Anderson',
  'Bennett', 'Brooks', 'Burke', 'Carter', 'Chow', 'Cooper', 'Davies', 'Dubois',
  'Foster', 'Fraser', 'Gibson', 'Graham', 'Grant', 'Hassan', 'Hayes', 'Hughes',
  'Jackson', 'James', 'Jenkins', 'Khan', 'Lam', 'Lawson', 'Marshall', 'Mason',
  'McCarthy', 'Meyer', 'Mills', 'Morgan', 'Murray', 'Olsen', 'Palmer', 'Parker',
  'Powell', 'Price', 'Reed', 'Reid', 'Russell', 'Sharma', 'Silva', 'Sullivan',
  'Turner', 'Vargas', 'Verma', 'Ward', 'Webb', 'Wood', 'Zimmerman', 'Fournier',
];

export function generateResidentName(index: number): string {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  // Spread last names across residents (old formula gave Smith to indices 0–63)
  const lastName = LAST_NAMES[(index * 17 + 11) % LAST_NAMES.length];
  return `${firstName} ${lastName}`;
}

/** Demo overrides — keep in sync with generateResidents */
const DEMO_RESIDENT_NAME_BY_ID: Record<string, string> = {
  R001: 'Margaret Chen',
  R002: 'Robert Johnson',
  R003: 'Dorothy Williams',
  R006: 'Michael Brown',
  R011: 'Emma Richardson',
  R014: "Thomas O'Brien",
};

export function residentNameForId(id: string): string {
  if (DEMO_RESIDENT_NAME_BY_ID[id]) return DEMO_RESIDENT_NAME_BY_ID[id];
  const index = Number.parseInt(id.replace(/^R/i, ''), 10) - 1;
  if (index < 0 || Number.isNaN(index)) return generateResidentName(0);
  return generateResidentName(index);
}

export function residentLastNameForId(id: string): string {
  const parts = residentNameForId(id).trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

const STAFF_NAME_BY_ID: Record<string, string> = Object.fromEntries(
  generateStaff().map((member) => [member.id, member.name]),
);

export function staffNameForId(id: string): string {
  return STAFF_NAME_BY_ID[id] ?? id;
}

function generateFloorLocation(floor: number, indexOnFloor: number): string {
  if (floor === 4) return 'Outdoor Grounds';
  const room = roomNumberForResident(floor, indexOnFloor);
  if (room) return `Room ${room}`;
  return `Floor ${floor}`;
}

function generateMapPosition(floor: number, index: number): { x: number; y: number } {
  // Distribute residents across the floor map avoiding overcrowding
  const positions = [
    // Room positions
    { x: 28, y: 25 }, { x: 38, y: 25 }, { x: 51, y: 25 }, { x: 77, y: 25 },
    { x: 28, y: 38 }, { x: 45, y: 38 }, { x: 62, y: 38 }, { x: 77, y: 38 },
    { x: 25, y: 65 }, { x: 38, y: 65 }, { x: 51, y: 65 }, { x: 64, y: 65 },
    { x: 25, y: 82 }, { x: 38, y: 82 }, { x: 51, y: 82 }, { x: 64, y: 82 },
    // Hallway and common area positions
    { x: 35, y: 50 }, { x: 50, y: 50 }, { x: 65, y: 50 },
    { x: 52, y: 28 }, { x: 65, y: 68 }, { x: 45, y: 75 },
  ];
  return positions[index % positions.length];
}

export function generateResidents(): Person[] {
  const residents: Person[] = [];
  const totalResidents = 124;

  // Floor distribution: Floor 1: 4, Floor 2: 60, Floor 3: 50, Grounds: 10
  const floorDistribution = [
    { floor: 1, count: 4, startId: 0 },
    { floor: 2, count: 60, startId: 4 },
    { floor: 3, count: 50, startId: 64 },
    { floor: 4, count: 10, startId: 114 },
  ];

  let residentIndex = 0;

  for (const { floor, count, startId } of floorDistribution) {
    for (let i = 0; i < count; i++) {
      const id = `R${String(residentIndex + 1).padStart(3, '0')}`;
      const name = generateResidentName(residentIndex);
      const location = `${generateFloorLocation(floor, i)} (Floor ${floor === 4 ? 'Grounds' : floor})`;

      // Most residents are normal and stationary
      const statusRoll = Math.random();
      const status = statusRoll < 0.02 ? 'alert' : statusRoll < 0.05 ? 'warning' : 'normal';

      // Elderly movement rates — most residents wander slowly along hallways
      let movementProbability = 0.38;
      if (floor === 3) {
        movementProbability = 0.52; // Memory care — more wandering
      } else if (floor === 4) {
        movementProbability = 0.45; // Outdoor grounds
      } else if (floor === 1) {
        movementProbability = 0.42;
      }
      const isMoving = Math.random() < movementProbability;

      const lastSeenOptions = ['2m', '5m', '8m', '12m', '18m', '25m', '34m', '45m', '1.2h', '1.8h'];
      const lastSeen = lastSeenOptions[Math.floor(Math.random() * lastSeenOptions.length)];

      residents.push({ id, name, status, location, isMoving, lastSeen });
      residentIndex++;
    }
  }

  // Add a few critical alerts
  residents[5].status = 'normal';
  residents[5].location = 'Hallway (Floor 2)';
  residents[5].lastSeen = '2m';
  residents[5].isMoving = true;

  residents[2].status = 'warning';
  residents[2].location = 'Dining Hall (Floor 1)';
  residents[2].lastSeen = '1m';
  residents[2].isMoving = false;

  residents[34].status = 'warning';
  residents[34].location = 'Hallway (Floor 2)';
  residents[34].lastSeen = '1m';
  residents[34].isMoving = false;

  residents[87].status = 'alert';
  residents[87].location = 'Room 304 (Floor 3)';
  residents[87].lastSeen = '3m';
  residents[87].isMoving = false;

  // R001 — active emergency call (pinned on map at Room 101)
  residents[0].name = 'Margaret Chen';
  residents[0].status = 'alert';
  residents[0].location = 'Room 101 (Floor 1)';
  residents[0].isMoving = false;
  residents[0].lastSeen = 'now';

  // Demo residents — names aligned with alerts and profiles
  residents[1].name = 'Robert Johnson';
  residents[2].name = 'Dorothy Williams';
  residents[5].name = 'Michael Brown';
  residents[10].name = 'Emma Richardson';
  residents[13].name = 'Thomas O\'Brien';

  // Critical statuses are pinned in place on the map
  for (const resident of residents) {
    if (resident.status !== 'normal') {
      resident.isMoving = false;
    }
  }

  return residents;
}

export function generateStaff(): Person[] {
  return [
    // RNs (Registered Nurses)
    { id: 'RN01', name: 'Sarah Thompson', status: 'normal', location: 'Nurse Station (Floor 1)', isMoving: false, lastSeen: '2m' },
    { id: 'RN02', name: 'David Park', status: 'normal', location: 'Nurse Station (Floor 3)', isMoving: false, lastSeen: '5m' },
    { id: 'RN03', name: 'Maria Santos', status: 'normal', location: 'Medication Room (Floor 2)', isMoving: false, lastSeen: '3m' },
    { id: 'RN04', name: 'James Chen', status: 'normal', location: 'Room 307 (Floor 3)', isMoving: true, lastSeen: '1m' },

    // RPNs (Registered Practical Nurses)
    { id: 'RP01', name: 'Jennifer Lee', status: 'normal', location: 'Hallway (Floor 2)', isMoving: true, lastSeen: 'now' },
    { id: 'RP02', name: 'Ahmed Hassan', status: 'normal', location: 'Recreation Area (Floor 1)', isMoving: true, lastSeen: '4m' },
    { id: 'RP03', name: 'Lisa Wong', status: 'normal', location: 'Room 212 (Floor 2)', isMoving: false, lastSeen: '8m' },
    { id: 'RP04', name: 'Michael O\'Brien', status: 'normal', location: 'Safe Wandering Area (Floor 3)', isMoving: true, lastSeen: '2m' },
    { id: 'RP05', name: 'Priya Sharma', status: 'normal', location: 'Hallway (Floor 2)', isMoving: true, lastSeen: '1m' },

    // PSWs (Personal Support Workers)
    { id: 'PS01', name: 'Emily Johnson', status: 'normal', location: 'Room 205 (Floor 2)', isMoving: false, lastSeen: '6m' },
    { id: 'PS02', name: 'Carlos Rodriguez', status: 'normal', location: 'Room 301 (Floor 3)', isMoving: false, lastSeen: '4m' },
    { id: 'PS03', name: 'Fatima Khan', status: 'normal', location: 'Room 208 (Floor 2)', isMoving: false, lastSeen: '7m' },
    { id: 'PS04', name: 'Robert Taylor', status: 'normal', location: 'Dining Hall (Floor 1)', isMoving: true, lastSeen: '2m' },
    { id: 'PS05', name: 'Sophie Martin', status: 'normal', location: 'Room 211 (Floor 2)', isMoving: false, lastSeen: '5m' },
    { id: 'PS06', name: 'Daniel Kim', status: 'normal', location: 'Room 305 (Floor 3)', isMoving: false, lastSeen: '9m' },
    { id: 'PS07', name: 'Grace Anderson', status: 'normal', location: 'Hallway (Floor 2)', isMoving: true, lastSeen: '1m' },
    { id: 'PS08', name: 'Thomas Wilson', status: 'normal', location: 'Recreation Area (Floor 1)', isMoving: false, lastSeen: '12m' },

    // Supervisors
    { id: 'SV01', name: 'Catherine Brown', status: 'normal', location: 'Office (Floor 1)', isMoving: false, lastSeen: '15m' },
    { id: 'SV02', name: 'Richard Evans', status: 'normal', location: 'Nurse Station (Floor 2)', isMoving: false, lastSeen: '8m' },

    // Other roles
    { id: 'PT01', name: 'Laura Chen', status: 'normal', location: 'In Transit: F2 → F1 (Elevator)', isMoving: true, lastSeen: 'now' },
    { id: 'OT01', name: 'Kevin Patel', status: 'normal', location: 'Room 306 (Floor 3)', isMoving: false, lastSeen: '10m' },
  ];
}

export function generateMapPeople(
  residentsSource?: Person[],
  staffSource?: Person[],
): MapPerson[] {
  const mapPeople: MapPerson[] = [];
  const residents = residentsSource ?? generateResidents();
  const staffList = staffSource ?? generateStaff();

  // Floor distribution
  const floorCounts = [
    { floor: 1, count: 4, startIndex: 0 },
    { floor: 2, count: 60, startIndex: 4 },
    { floor: 3, count: 50, startIndex: 64 },
    { floor: 4, count: 10, startIndex: 114 },
  ];

  for (const { floor, count, startIndex } of floorCounts) {
    for (let i = 0; i < count; i++) {
      const residentIndex = startIndex + i;
      const resident = residents[residentIndex];
      const spawn = getSpawnNavigationState(floor, i);
      mapPeople.push({
        id: resident.id,
        name: resident.name,
        position: spawn.position,
        navFromId: spawn.navFromId,
        navToId: spawn.navToId,
        navProgress: spawn.navProgress,
        status: resident.status,
        type: 'resident',
        isMoving: resident.isMoving || false,
        floor,
      });
    }
  }

  // R115 — outdoor demo: starts outside monitored perimeter (wandering alert on sync)
  const outdoorResident = mapPeople.find((p) => p.id === 'R115');
  if (outdoorResident) {
    outdoorResident.position = { x: 2, y: 50 };
    outdoorResident.floor = 4;
    outdoorResident.isMoving = true;
    outdoorResident.status = 'normal';
    const pinned = createNavigationState(4, { x: 2, y: 50 }, 'beyond_w');
    outdoorResident.navFromId = pinned.navFromId;
    outdoorResident.navToId = pinned.navToId;
    outdoorResident.navProgress = 0;
  }

  // Add emergency call for R001 — pinned in place (Room 101)
  const emergencyResident = mapPeople.find((p) => p.id === 'R001');
  if (emergencyResident) {
    emergencyResident.emergencyCall = {
      status: 'ringing',
      startTime: new Date(),
    };
    emergencyResident.isMoving = false;
    emergencyResident.status = 'alert';
    const pinned = createNavigationState(1, { x: 27, y: 78 }, 'room101_in');
    emergencyResident.position = pinned.position;
    emergencyResident.navFromId = 'room101_in';
    emergencyResident.navToId = 'room101_in';
    emergencyResident.navProgress = 0;
  }

  // Add staff positions
  const staffPositions = [
    { id: 'RN01', floor: 1, position: { x: 77, y: 25 } },
    { id: 'RN02', floor: 3, position: { x: 60, y: 28 } },
    { id: 'RN03', floor: 2, position: { x: 77, y: 32 } },
    { id: 'RN04', floor: 3, position: { x: 72, y: 72 } },
    { id: 'RP01', floor: 2, position: { x: 40, y: 52 } },
    { id: 'RP02', floor: 1, position: { x: 65, y: 68 } },
    { id: 'RP03', floor: 2, position: { x: 62, y: 82 } },
    { id: 'RP04', floor: 3, position: { x: 33, y: 72 } },
    { id: 'RP05', floor: 2, position: { x: 45, y: 50 } },
    { id: 'PS01', floor: 2, position: { x: 45, y: 28 } },
    { id: 'PS02', floor: 3, position: { x: 32, y: 25 } },
    { id: 'PS03', floor: 2, position: { x: 28, y: 82 } },
    { id: 'PS04', floor: 1, position: { x: 52, y: 28 } },
    { id: 'PS05', floor: 2, position: { x: 55, y: 72 } },
    { id: 'PS06', floor: 3, position: { x: 52, y: 65 } },
    { id: 'PS07', floor: 2, position: { x: 50, y: 50 } },
    { id: 'PS08', floor: 1, position: { x: 70, y: 75 } },
    { id: 'SV01', floor: 1, position: { x: 30, y: 25 } },
    { id: 'SV02', floor: 2, position: { x: 77, y: 25 } },
    { id: 'PT01', floor: 2, position: { x: 35, y: 40 } },
    { id: 'OT01', floor: 3, position: { x: 62, y: 65 } },
  ];

  for (const staffPos of staffPositions) {
    const staffMember = staffList.find(s => s.id === staffPos.id);
    if (staffMember) {
      mapPeople.push(
        enrichWithNavigation({
          id: staffPos.id,
          name: staffMember.name,
          position: staffPos.position,
          status: staffMember.status,
          type: 'staff' as const,
          isMoving: staffMember.isMoving ?? true,
          floor: staffPos.floor,
        }),
      );
    }
  }

  return mapPeople;
}
