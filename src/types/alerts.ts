import { findMapPersonLocation } from '../data/mapLocation';
import { emergencyCallAlertMessage } from '../utils/emergencyCall';
import { formatRelativeTimeAgo } from '../utils/time';

export type WanderingViolation = 'staff' | 'clean' | 'soiled' | 'outdoor_perimeter';

export interface FacilityAlert {
  id: string;
  type: 'emergency' | 'wandering' | 'heartrate' | 'call';
  personId: string;
  personName: string;
  message: string;
  time: string;
  severity: 'critical' | 'high' | 'medium';
  floor: number;
  /** Live map-derived area label, e.g. "Hallway (Floor 2)" */
  location?: string;
  callStatus?: 'ringing' | 'connected' | 'escalated';
  callStartTime?: Date;
  /** Wandering subtype — drives marker colour with severity */
  wanderingViolation?: WanderingViolation;
  /** Assigned responder for emergency / call alerts */
  relatedStaffId?: string;
  relatedStaffName?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  respondingStaff?: string[];
}

export interface ProfileAlert {
  id: string;
  type: FacilityAlert['type'];
  severity: FacilityAlert['severity'];
  message: string;
  time: string;
  callStatus?: FacilityAlert['callStatus'];
  relatedStaffId?: string;
  relatedStaffName?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  respondingStaff?: string[];
}

export function toProfileAlert(alert: FacilityAlert): ProfileAlert {
  return {
    id: alert.id,
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    time: alert.time,
    callStatus: alert.callStatus,
    relatedStaffId: alert.relatedStaffId,
    relatedStaffName: alert.relatedStaffName,
    acknowledgedAt: alert.acknowledgedAt,
    acknowledgedBy: alert.acknowledgedBy,
    respondingStaff: alert.respondingStaff,
  };
}

export function alertsForResident(residentId: string, alerts: FacilityAlert[]): ProfileAlert[] {
  return alerts.filter((a) => a.personId === residentId).map(toProfileAlert);
}

/**
 * Marker colour tier for one alert (aligned with legend + alert panel).
 * Red: emergency / call only (critical).
 * Amber: high heartrate, all wandering (medium).
 */
export function alertMarkerLevel(alert: FacilityAlert): 'red' | 'amber' | null {
  switch (alert.type) {
    case 'call':
    case 'emergency':
      return 'red';
    case 'heartrate':
    case 'wandering':
      return 'amber';
    default:
      return null;
  }
}

/** All wandering violations (perimeter + secured zones) are medium severity. */
export function wanderingAlertSeverity(_violation: WanderingViolation): FacilityAlert['severity'] {
  return 'medium';
}

/** High: resting HR sustained below 50 or above 120 BPM. */
export function heartrateAlertSeverity(heartRate: number): 'high' | null {
  if (heartRate < 50 || heartRate > 120) return 'high';
  return null;
}

export interface AlertSeverityCounts {
  critical: number;
  high: number;
  medium: number;
}

export function countAlertsBySeverity(alerts: FacilityAlert[]): AlertSeverityCounts {
  return {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
  };
}

/** Total active alerts (critical + high + medium) — matches sidebar summaries */
export function totalAlertCount(alerts: FacilityAlert[]): number {
  const counts = countAlertsBySeverity(alerts);
  return counts.critical + counts.high + counts.medium;
}

/** Highest severity among active alerts for one resident (for sidebar badges). */
export function residentHighestAlertSeverity(
  residentId: string,
  alerts: FacilityAlert[],
): FacilityAlert['severity'] | null {
  const severities = alerts
    .filter((a) => a.personId === residentId)
    .map((a) => a.severity);
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return null;
}

/** Map marker status from active facility alerts only (keeps feed and map in sync) */
export function residentMarkerStatus(
  residentId: string,
  alerts: FacilityAlert[],
): 'normal' | 'alert' | 'warning' {
  const levels = alerts
    .filter((a) => a.personId === residentId)
    .map(alertMarkerLevel)
    .filter((l): l is 'red' | 'amber' => l !== null);

  if (levels.includes('red')) return 'alert';
  if (levels.includes('amber')) return 'warning';
  return 'normal';
}

export interface ActiveEmergencyCall {
  residentId: string;
  residentName: string;
  residentLocation: string;
  staffId: string;
  staffName: string;
  status: 'ringing' | 'connected' | 'escalated';
  startTime: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/** Ensure every active emergency call has a matching call alert in the feed */
export function syncEmergencyCallAlerts(
  alerts: FacilityAlert[],
  emergencyCalls: ActiveEmergencyCall[],
  mapPeople: Array<{
    id: string;
    floor: number;
    position: { x: number; y: number };
    navFromId?: string;
    navToId?: string;
  }>,
): FacilityAlert[] {
  const active = emergencyCalls.filter(
    (c) => c.status === 'ringing' || c.status === 'connected' || c.status === 'escalated',
  );

  // Keep call alerts in the feed after the popup is dismissed; only sync live calls
  let next = [...alerts];

  for (const call of active) {
    const onMap = mapPeople.find((p) => p.id === call.residentId);
    const alertId = `C-${call.residentId}`;
    const idx = next.findIndex((a) => a.type === 'call' && a.personId === call.residentId);

    const location =
      (onMap && findMapPersonLocation(call.residentId, [onMap])) ?? call.residentLocation;

    const callAlert: FacilityAlert = {
      id: alertId,
      type: 'call',
      personId: call.residentId,
      personName: call.residentName,
      message: emergencyCallAlertMessage(
        call.status === 'escalated'
          ? 'escalated'
          : call.status === 'connected'
            ? 'connected'
            : 'ringing',
      ),
      time: 'Just now',
      severity: 'critical',
      floor: onMap?.floor ?? 1,
      location,
      callStatus:
        call.status === 'escalated'
          ? 'escalated'
          : call.status === 'connected'
            ? 'connected'
            : 'ringing',
      callStartTime: call.startTime,
      relatedStaffId: call.staffId,
      relatedStaffName: call.staffName,
    };

    if (
      call.acknowledgedAt &&
      call.acknowledgedBy &&
      call.acknowledgedAt.getTime() >= call.startTime.getTime()
    ) {
      callAlert.acknowledgedAt = formatRelativeTimeAgo(call.acknowledgedAt);
      callAlert.acknowledgedBy = call.acknowledgedBy;
      callAlert.respondingStaff = [call.acknowledgedBy];
    }

    if (idx >= 0) {
      const merged: FacilityAlert = { ...next[idx], ...callAlert, id: next[idx].id };
      if (!callAlert.acknowledgedAt) {
        delete merged.acknowledgedAt;
        delete merged.acknowledgedBy;
      }
      next[idx] = merged;
    } else {
      next.push(callAlert);
    }
  }

  return next;
}

export function alertsForStaff(staffId: string, alerts: FacilityAlert[]): ProfileAlert[] {
  return alerts
    .filter(
      (a) =>
        a.acknowledgedBy === staffId ||
        a.respondingStaff?.includes(staffId) ||
        a.personId === staffId,
    )
    .map(toProfileAlert);
}
