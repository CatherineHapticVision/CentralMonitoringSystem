import type { ResidentProfileData, StaffProfileData } from '../utils/resolveProfile';
import { preferredLanguageForName } from '../utils/preferredLanguage';

interface Person {
  id: string;
  name: string;
  status: 'normal' | 'alert' | 'warning';
  location: string;
  lastSeen?: string;
  respondingTo?: string;
}

function parseFloor(location: string): number {
  if (location.includes('Grounds')) return 4;
  const match = location.match(/Floor (\d)/);
  return match ? parseInt(match[1], 10) : 2;
}

function staffRoleFromId(id: string): string {
  if (id.startsWith('RN')) return 'Registered Nurse';
  if (id.startsWith('RP')) return 'Registered Practical Nurse';
  if (id.startsWith('PS')) return 'Personal Support Worker';
  if (id.startsWith('SV')) return 'Supervisor';
  if (id.startsWith('PT')) return 'Physical Therapist';
  if (id.startsWith('OT')) return 'Occupational Therapist';
  return 'Care Staff';
}

function staffDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return parts[parts.length - 1].includes('.') ? name : `${parts[0]} ${parts[parts.length - 1]}`;
}

function deterministicVitals(index: number, status: Person['status']) {
  const baselineHeartRate = 64 + (index % 10);
  let heartRate = baselineHeartRate + (index % 5) - 2;
  if (status === 'warning') heartRate = baselineHeartRate + 38 + (index % 8);
  if (status === 'alert') heartRate = baselineHeartRate + 48 + (index % 6);

  const baselineTemp = 36.5 + (index % 4) * 0.1;
  let temperature = baselineTemp + 0.1;
  if (status === 'warning') temperature = baselineTemp + 0.7;
  if (status === 'alert') temperature = baselineTemp + 1.0;

  let oxygenSaturation = 95 + (index % 4);
  if (status === 'warning') oxygenSaturation = 93 + (index % 2);
  if (status === 'alert') oxygenSaturation = 91 + (index % 2);

  return {
    heartRate,
    baselineHeartRate,
    oxygenSaturation,
    temperature: Math.round(temperature * 10) / 10,
    baselineTemp,
    steps: 600 + (index % 45) * 95,
    distance: Math.round((0.3 + (index % 22) * 0.12) * 10) / 10,
  };
}

function wanderingRiskFor(person: Person): 'low' | 'medium' | 'high' {
  const floor = parseFloor(person.location);
  if (person.status === 'alert') return 'high';
  if (person.status === 'warning') return 'medium';
  if (floor === 3) return 'medium';
  if (floor === 4) return 'low';
  return 'low';
}

function assignedStaffForResident(
  person: Person,
  staff: Person[],
): ResidentProfileData['assignedStaff'] {
  const floor = parseFloor(person.location);
  const nurses = staff.filter((s) => s.id.startsWith('RN') || s.id.startsWith('RP'));
  const aides = staff.filter((s) => s.id.startsWith('PS'));

  const floorNurses = nurses.filter((s) => parseFloor(s.location) === floor);
  const floorAides = aides.filter((s) => parseFloor(s.location) === floor);
  const primary = floorNurses[0] ?? nurses[0];
  const secondary = floorAides[0] ?? floorNurses[1] ?? nurses[1];

  const result: ResidentProfileData['assignedStaff'] = [];
  if (primary) {
    result.push({
      id: primary.id,
      name: staffDisplayName(primary.name),
      role: staffRoleFromId(primary.id),
      isPrimary: true,
    });
  }
  if (secondary && secondary.id !== primary?.id) {
    result.push({
      id: secondary.id,
      name: staffDisplayName(secondary.name),
      role: staffRoleFromId(secondary.id),
      isPrimary: false,
    });
  }
  return result;
}

function lastSeenLabel(lastSeen?: string): string {
  if (!lastSeen) return '5 minutes ago';
  if (lastSeen === 'now') return 'Just now';
  return `${lastSeen} ago`;
}

export function generateAllResidentProfilesWithStaff(
  residents: Person[],
  staff: Person[],
): ResidentProfileData[] {
  return residents.map((person) => {
    const index = parseInt(person.id.replace(/\D/g, ''), 10) || 1;
    const vitals = deterministicVitals(index, person.status);
    const assignedStaff = assignedStaffForResident(person, staff);
    const primaryStaffId = assignedStaff[0]?.id ?? 'RN01';

    return {
      id: person.id,
      name: person.name,
      location: person.location,
      ...vitals,
      language: preferredLanguageForName(person.name),
      assignedStaff,
      alertStatus: person.status,
      wanderingRisk: wanderingRiskFor(person),
      emergencyCallActive: person.id === 'R001',
      lastMovement: lastSeenLabel(person.lastSeen),
      lastVitalsCheck: person.lastSeen ?? `${8 + (index % 40)} min ago`,
      lastStaffVisit: `${1 + (index % 5)}.${index % 10} hr ago`,
      lastStaffVisitBy: primaryStaffId,
      activeAlerts: [],
    };
  });
}

function shiftForStaff(id: string): { shiftStart: string; shiftEnd: string } {
  if (id === 'RN02') return { shiftStart: '19:00', shiftEnd: '07:00' };
  if (id.startsWith('PT') || id.startsWith('OT')) return { shiftStart: '09:00', shiftEnd: '17:00' };
  return { shiftStart: '07:00', shiftEnd: '19:00' };
}

function emailForStaff(person: Person): string {
  const parts = person.name.toLowerCase().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1]?.replace(/[^a-z]/g, '') ?? 'staff';
  const first = parts[0]?.[0] ?? 's';
  return `${first}${last}@maplewood.ca`;
}

const DEMO_STAFF_ALERTS: Partial<Record<string, StaffProfileData['activeAlerts']>> = {
  RP02: [
    {
      id: 'A002',
      residentId: 'R003',
      residentName: 'Dorothy Williams',
      type: 'heartrate',
      severity: 'high',
      time: '8 minutes ago',
      acknowledgedAt: '7m 12s ago',
      responseTime: '3m 45s',
      respondingStaff: ['RP02'],
    },
  ],
  RN01: [
    {
      id: 'A003',
      residentId: 'R001',
      residentName: 'Margaret Chen',
      type: 'call',
      severity: 'critical',
      time: 'Just now',
      responseTime: 'Ringing',
      respondingStaff: ['RN01'],
    },
  ],
  RN04: [
    {
      id: 'A004',
      residentId: 'R014',
      residentName: 'Thomas O\'Brien',
      type: 'heartrate',
      severity: 'critical',
      time: '5 minutes ago',
      acknowledgedAt: '4m 22s ago',
      responseTime: 'Monitoring',
      respondingStaff: ['RN04'],
    },
  ],
};

export function generateAllStaffProfiles(
  staff: Person[],
  residents: Person[],
): StaffProfileData[] {
  return staff.map((person, staffIdx) => {
    const staffFloor = parseFloor(person.location);
    const index = parseInt(person.id.replace(/\D/g, ''), 10) || staffIdx;

    let assignedResidents = residents
      .filter((r) => {
        const residentFloor = parseFloor(r.location);
        if (person.id.startsWith('RN') || person.id.startsWith('RP')) {
          return residentFloor === staffFloor || residentFloor === staffFloor;
        }
        if (person.id.startsWith('PS')) {
          return residentFloor === staffFloor && parseInt(r.id.slice(1), 10) % 3 === staffIdx % 3;
        }
        return parseInt(r.id.slice(1), 10) % staff.length === staffIdx;
      })
      .slice(0, 14)
      .map((r) => ({ id: r.id, name: r.name, status: r.status }));

    if (person.respondingTo) {
      const target = residents.find((r) => r.id === person.respondingTo);
      if (target && !assignedResidents.some((a) => a.id === target.id)) {
        assignedResidents = [
          { id: target.id, name: target.name, status: target.status },
          ...assignedResidents,
        ].slice(0, 14);
      }
    }

    const { shiftStart, shiftEnd } = shiftForStaff(person.id);
    const escalation: StaffProfileData['emergencyEscalation'] =
      person.id.startsWith('RN') || person.id.startsWith('RP')
        ? 'primary'
        : person.id.startsWith('SV')
          ? 'primary'
          : person.id.startsWith('PT') || person.id.startsWith('OT')
            ? 'none'
            : 'secondary';

    return {
      id: person.id,
      name: person.name,
      role: staffRoleFromId(person.id),
      location: person.location,
      status: 'on-duty' as const,
      shiftStart,
      shiftEnd,
      assignedResidents,
      contactNumber: `+1 (416) 555-${String(1000 + index).padStart(4, '0').slice(-4)}`,
      email: emailForStaff(person),
      lastActivity: lastSeenLabel(person.lastSeen),
      activeAlerts: DEMO_STAFF_ALERTS[person.id] ?? [],
      emergencyEscalation: escalation,
    };
  });
}
