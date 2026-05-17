import { findMapPersonLocation } from '../data/mapLocation';
import type { FacilityAlert, ProfileAlert } from '../types/alerts';
import { preferredLanguageForName } from './preferredLanguage';
import { applyLiveMetricsToProfile, type ResidentLiveMetrics } from './residentLiveMetrics';
import { alertsForResident } from '../types/alerts';

interface Person {
  id: string;
  name: string;
  status: 'normal' | 'alert' | 'warning';
  location: string;
  lastSeen?: string;
}

interface MapPerson {
  id: string;
  name: string;
  type: 'resident' | 'staff';
  floor: number;
  position: { x: number; y: number };
  navFromId?: string;
  navToId?: string;
  status: 'normal' | 'alert' | 'warning';
  emergencyCall?: { status: string };
}

export interface ResidentProfileData {
  id: string;
  name: string;
  location: string;
  heartRate: number;
  baselineHeartRate: number;
  oxygenSaturation: number;
  temperature: number;
  baselineTemp: number;
  steps: number;
  distance: number;
  language: string;
  assignedStaff: { id: string; name: string; role: string; isPrimary: boolean }[];
  alertStatus: 'normal' | 'alert' | 'warning';
  wanderingRisk: 'low' | 'medium' | 'high';
  emergencyCallActive: boolean;
  lastMovement: string;
  lastVitalsCheck: string;
  lastStaffVisit: string;
  lastStaffVisitBy: string;
  activeAlerts: ProfileAlert[];
}

interface StaffActiveAlert {
  id: string;
  residentId: string;
  residentName: string;
  type: 'emergency' | 'wandering' | 'heartrate' | 'call';
  severity: 'critical' | 'high' | 'medium';
  time: string;
  acknowledgedAt?: string;
  responseTime?: string;
  respondingStaff?: string[];
  escalatedTo?: string;
}

export interface StaffProfileData {
  id: string;
  name: string;
  role: string;
  location: string;
  status: 'on-duty' | 'break' | 'off-duty';
  shiftStart: string;
  shiftEnd: string;
  assignedResidents: { id: string; name: string; status: 'normal' | 'alert' | 'warning' }[];
  contactNumber: string;
  email: string;
  lastActivity: string;
  activeAlerts: StaffActiveAlert[];
  emergencyEscalation: 'primary' | 'secondary' | 'none';
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

function deterministicVitals(index: number) {
  const baselineHeartRate = 68 + (index % 8);
  const heartRate =
    index % 17 === 0 ? baselineHeartRate + 42 : baselineHeartRate + (index % 5) - 2;
  const baselineTemp = 36.6 + (index % 3) * 0.1;
  const temperature = baselineTemp + (index % 7 === 0 ? 0.9 : 0.1);
  return {
    heartRate,
    baselineHeartRate,
    oxygenSaturation: 94 + (index % 5),
    temperature: Math.round(temperature * 10) / 10,
    baselineTemp,
    steps: 800 + (index % 40) * 120,
    distance: Math.round((0.4 + (index % 20) * 0.15) * 10) / 10,
  };
}

function mergeResidentAlerts(
  residentId: string,
  liveAlerts: ProfileAlert[],
  seeded: ProfileAlert[] = [],
): ProfileAlert[] {
  const byId = new Map<string, ProfileAlert>();
  for (const a of [...seeded, ...liveAlerts]) byId.set(a.id, a);
  return Array.from(byId.values());
}

export function resolveResidentProfile(
  residentId: string,
  residentsData: ResidentProfileData[],
  residents: Person[],
  mapPeople: MapPerson[],
  facilityAlerts: FacilityAlert[] = [],
  liveMetrics?: Record<string, ResidentLiveMetrics>,
): ResidentProfileData | null {
  const mapPerson = mapPeople.find((p) => p.id === residentId && p.type === 'resident');
  const person = residents.find((r) => r.id === residentId);
  if (!person && !mapPerson) return null;

  const liveAlerts = alertsForResident(residentId, facilityAlerts);
  const alertStatus = mapPerson?.status ?? person?.status ?? 'normal';
  const emergencyCallActive = !!mapPerson?.emergencyCall;
  const index = parseInt(residentId.replace(/\D/g, ''), 10) || 1;
  const displayName = person?.name ?? mapPerson?.name ?? residentId;
  const location =
    (mapPerson && findMapPersonLocation(residentId, mapPeople)) ??
    person?.location ??
    `Floor ${mapPerson?.floor ?? 1}`;

  const existing = residentsData.find((r) => r.id === residentId);
  if (existing) {
    const activeAlerts = mergeResidentAlerts(residentId, liveAlerts, existing.activeAlerts);
    const derivedStatus =
      activeAlerts.some((a) => a.severity === 'critical') || emergencyCallActive
        ? 'alert'
        : activeAlerts.some((a) => a.severity === 'high')
          ? 'warning'
          : alertStatus;

    return applyLiveMetricsToProfile(
      {
        ...existing,
        name: displayName,
        location,
        alertStatus: derivedStatus,
        emergencyCallActive,
        wanderingRisk:
          derivedStatus === 'alert' ? 'high' : derivedStatus === 'warning' ? 'medium' : existing.wanderingRisk,
        activeAlerts,
        lastMovement: person?.lastSeen ? `${person.lastSeen} ago` : existing.lastMovement,
      },
      liveMetrics?.[residentId],
    );
  }

  const vitals = deterministicVitals(index);
  const wanderingRisk: 'low' | 'medium' | 'high' =
    alertStatus === 'alert' ? 'high' : alertStatus === 'warning' ? 'medium' : 'low';

  return applyLiveMetricsToProfile(
    {
      id: residentId,
      name: displayName,
      location,
      ...vitals,
      language: preferredLanguageForName(displayName),
      assignedStaff: [
        {
          id: index % 2 === 0 ? 'RN01' : 'RN03',
          name: index % 2 === 0 ? 'Sarah Thompson' : 'Maria Santos',
          role: 'Primary Nurse',
          isPrimary: true,
        },
      ],
      alertStatus,
      wanderingRisk,
      emergencyCallActive,
      activeAlerts: liveAlerts,
      lastMovement: person?.lastSeen ? `${person.lastSeen} ago` : '5 minutes ago',
      lastVitalsCheck: person?.lastSeen ?? '25 min ago',
      lastStaffVisit: '1.5 hr ago',
      lastStaffVisitBy: 'RN01',
    },
    liveMetrics?.[residentId],
  );
}

function facilityAlertToStaffActive(alert: FacilityAlert): StaffActiveAlert {
  return {
    id: alert.id,
    residentId: alert.personId,
    residentName: alert.personName,
    type: alert.type,
    severity: alert.severity,
    time: alert.time,
    acknowledgedAt: alert.acknowledgedAt,
    respondingStaff: alert.respondingStaff,
  };
}

function mergeStaffActiveAlerts(seeded: StaffActiveAlert[], live: FacilityAlert[]): StaffActiveAlert[] {
  const byId = new Map<string, StaffActiveAlert>();
  for (const a of seeded) byId.set(a.id, a);
  for (const a of live) byId.set(a.id, facilityAlertToStaffActive(a));
  return Array.from(byId.values());
}

export function resolveStaffProfile(
  staffId: string,
  staffData: StaffProfileData[],
  staff: Person[],
  facilityAlerts: FacilityAlert[] = [],
  mapPeople: MapPerson[] = [],
): StaffProfileData | null {
  const person = staff.find((s) => s.id === staffId);
  const mapPerson = mapPeople.find((p) => p.id === staffId && p.type === 'staff');
  if (!person && !mapPerson) return null;

  const displayName = person?.name ?? mapPerson?.name ?? staffId;
  const location =
    (mapPerson && findMapPersonLocation(staffId, mapPeople)) ??
    person?.location ??
    (mapPerson?.floor === 4 ? 'Outdoor Grounds' : `Floor ${mapPerson?.floor ?? 1}`);

  const liveForStaff = facilityAlerts.filter(
    (a) => a.acknowledgedBy === staffId || a.respondingStaff?.includes(staffId),
  );

  const existing = staffData.find((s) => s.id === staffId);
  if (existing) {
    return {
      ...existing,
      name: displayName,
      location,
      lastActivity: person?.lastSeen ? `${person.lastSeen} ago` : existing.lastActivity,
      activeAlerts: mergeStaffActiveAlerts(existing.activeAlerts, liveForStaff),
    };
  }

  const index = parseInt(staffId.replace(/\D/g, ''), 10) || 1;
  const slug = displayName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8);
  const escalation: StaffProfileData['emergencyEscalation'] =
    staffId.startsWith('RN') || staffId.startsWith('RP')
      ? 'primary'
      : staffId.startsWith('SV')
        ? 'primary'
        : staffId.startsWith('PT') || staffId.startsWith('OT')
          ? 'none'
          : 'secondary';

  return {
    id: staffId,
    name: displayName,
    role: staffRoleFromId(staffId),
    location,
    status: 'on-duty',
    shiftStart: '07:00',
    shiftEnd: '19:00',
    assignedResidents: [],
    contactNumber: `+1 (416) 555-${String(1000 + index).padStart(4, '0').slice(-4)}`,
    email: `${slug || staffId.toLowerCase()}@maplewood.ca`,
    lastActivity: person?.lastSeen ? `${person.lastSeen} ago` : 'Just now',
    activeAlerts: liveForStaff.map(facilityAlertToStaffActive),
    emergencyEscalation: escalation,
  };
}
