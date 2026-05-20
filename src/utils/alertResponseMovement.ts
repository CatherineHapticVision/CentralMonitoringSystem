import { primaryRespondingStaffIdForResident } from '../data/generateProfiles';
import { responseTargetWaypointForPosition, type Position } from '../data/mapNavigation';
import type { ActiveEmergencyCall, FacilityAlert } from '../types/alerts';
import {
  emergencyCallElapsedSeconds,
  isAssignedStaffAcknowledged,
  shouldShowEscalatedCallUi,
} from './emergencyCall';

export interface StaffResponseAssignment {
  residentId: string;
  targetFloor: number;
  targetWaypointId: string;
  targetPosition: Position;
}

type StaffPerson = {
  id: string;
  name: string;
  location: string;
  status: 'normal' | 'alert' | 'warning';
};

type ResidentPerson = {
  id: string;
  name: string;
  location: string;
  status: 'normal' | 'alert' | 'warning';
};

type MapPersonForResponse = {
  id: string;
  type?: 'resident' | 'staff';
  floor: number;
  position: Position;
};

const ARRIVAL_DISTANCE_PCT = 2.8;

function parseFloor(location: string): number {
  if (location.includes('Grounds')) return 4;
  const match = location.match(/Floor (\d)/);
  return match ? parseInt(match[1], 10) : 2;
}

function staffOnAlertFloor(staffId: string, staff: StaffPerson[], floor: number): boolean {
  const member = staff.find((s) => s.id === staffId);
  return member ? parseFloor(member.location) === floor : false;
}

export function supervisorIdForFloor(
  staff: Array<{ id: string; location: string }>,
  floor: number,
): string {
  const supervisors = staff.filter((s) => s.id.startsWith('SV'));
  const onFloor = supervisors.find((s) => parseFloor(s.location) === floor);
  return onFloor?.id ?? supervisors[0]?.id ?? 'SV01';
}

function alertPriority(alert: FacilityAlert): number {
  if (alert.type === 'call' || alert.type === 'emergency') return 0;
  if (alert.type === 'wandering' && alert.wanderingViolation === 'outdoor_perimeter') return 1;
  if (alert.type === 'heartrate' && alert.severity === 'high') return 2;
  if (alert.type === 'wandering') return 3;
  return 4;
}

function responderStaffIdForAlert(
  alert: FacilityAlert,
  emergencyCalls: ActiveEmergencyCall[],
  staff: StaffPerson[],
  residents: ResidentPerson[],
): string | null {
  if (alert.type === 'call' || alert.type === 'emergency') {
    const call = emergencyCalls.find((c) => c.residentId === alert.personId);
    const elapsed = call?.startTime
      ? emergencyCallElapsedSeconds(call.startTime)
      : alert.callStartTime
        ? emergencyCallElapsedSeconds(alert.callStartTime)
        : 0;
    const escalated =
      alert.callStatus === 'escalated' ||
      shouldShowEscalatedCallUi(alert, false, elapsed);

    if (escalated) {
      return supervisorIdForFloor(staff, alert.floor);
    }

    if (call && isAssignedStaffAcknowledged(call, call.staffId)) {
      return null;
    }
    if (alert.relatedStaffId) return alert.relatedStaffId;
    const resident = residents.find((r) => r.id === alert.personId);
    if (resident) {
      return primaryRespondingStaffIdForResident(resident, staff, alert.floor);
    }
    return null;
  }

  const listed = alert.respondingStaff?.[0];
  if (listed && staffOnAlertFloor(listed, staff, alert.floor)) {
    return listed;
  }

  const resident = residents.find((r) => r.id === alert.personId);
  if (!resident) return null;
  return primaryRespondingStaffIdForResident(resident, staff, alert.floor);
}

export function hasArrivedAtResponseTarget(
  person: MapPersonForResponse,
  assignment: StaffResponseAssignment,
): boolean {
  if (person.floor !== assignment.targetFloor) return false;
  return (
    Math.hypot(
      person.position.x - assignment.targetPosition.x,
      person.position.y - assignment.targetPosition.y,
    ) < ARRIVAL_DISTANCE_PCT
  );
}

/** Active call alerts for routing (includes calls not yet merged into React alert state). */
function effectiveAlertsForResponse(
  alerts: FacilityAlert[],
  emergencyCalls: ActiveEmergencyCall[],
): FacilityAlert[] {
  const next = [...alerts];
  for (const call of emergencyCalls) {
    if (next.some((a) => (a.type === 'call' || a.type === 'emergency') && a.personId === call.residentId)) {
      continue;
    }
    next.push({
      id: `C-${call.residentId}`,
      type: 'call',
      personId: call.residentId,
      personName: call.residentName,
      message: 'Emergency call from resident. Staff notified.',
      time: 'Just now',
      severity: 'critical',
      floor: 1,
      callStatus: call.status === 'escalated' ? 'escalated' : 'ringing',
      callStartTime: call.startTime,
      relatedStaffId: call.staffId,
      relatedStaffName: call.staffName,
    });
  }
  return next;
}

/** Map staff id → route toward resident for each active alert. */
export function buildStaffResponseAssignments(
  alerts: FacilityAlert[],
  emergencyCalls: ActiveEmergencyCall[],
  mapPeople: MapPersonForResponse[],
  staff: StaffPerson[],
  residents: ResidentPerson[],
): Map<string, StaffResponseAssignment> {
  const sorted = effectiveAlertsForResponse(alerts, emergencyCalls).sort(
    (a, b) => alertPriority(a) - alertPriority(b),
  );
  const assignments = new Map<string, StaffResponseAssignment>();

  for (const alert of sorted) {
    const staffId = responderStaffIdForAlert(alert, emergencyCalls, staff, residents);
    if (!staffId || assignments.has(staffId)) continue;

    const residentOnMap = mapPeople.find(
      (p) => p.id === alert.personId && p.type === 'resident',
    );
    if (!residentOnMap) continue;

    const targetFloor = residentOnMap.floor;
    const targetWaypointId = responseTargetWaypointForPosition(
      residentOnMap.position,
      targetFloor,
    );

    assignments.set(staffId, {
      residentId: alert.personId,
      targetFloor,
      targetWaypointId,
      targetPosition: { ...residentOnMap.position },
    });
  }

  return assignments;
}
