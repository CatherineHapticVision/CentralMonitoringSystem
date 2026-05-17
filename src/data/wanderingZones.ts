import { VIEWBOX } from '../components/floorPlanConstants';
import { findMapPersonLocation } from './mapLocation';
import type { FacilityAlert, WanderingViolation } from '../types/alerts';
import { wanderingAlertSeverity } from '../types/alerts';

export type { WanderingViolation };

type SvgRect = { x: number; y: number; w: number; h: number };

/** Matches FloorMapLayouts Floor 2 clinical wing */
const FLOOR2_RESTRICTED_ROOMS: { type: WanderingViolation; rect: SvgRect }[] = [
  { type: 'staff', rect: { x: 628, y: 292, w: 96, h: 110 } },
  { type: 'clean', rect: { x: 836, y: 292, w: 52, h: 110 } },
  { type: 'soiled', rect: { x: 898, y: 292, w: 52, h: 110 } },
];

/** Dashed fence in OutdoorGroundsLayout — inside is monitored property */
const OUTDOOR_MONITORED_PERIMETER: SvgRect = { x: 40, y: 40, w: 1120, h: 720 };

function pctToSvg(xPct: number, yPct: number): { x: number; y: number } {
  return { x: (xPct / 100) * VIEWBOX.w, y: (yPct / 100) * VIEWBOX.h };
}

function pointInRect(sx: number, sy: number, r: SvgRect): boolean {
  return sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
}

function restrictedRoomAtSvgPoint(sx: number, sy: number, floor: number): WanderingViolation | null {
  if (floor !== 2) return null;
  for (const { type, rect } of FLOOR2_RESTRICTED_ROOMS) {
    if (pointInRect(sx, sy, rect)) return type;
  }
  return null;
}

export function isPositionInRestrictedRoom(floor: number, xPct: number, yPct: number): WanderingViolation | null {
  const { x, y } = pctToSvg(xPct, yPct);
  return restrictedRoomAtSvgPoint(x, y, floor);
}

export function isOutsideOutdoorPerimeter(floor: number, xPct: number, yPct: number): boolean {
  if (floor !== 4) return false;
  const { x, y } = pctToSvg(xPct, yPct);
  return !pointInRect(x, y, OUTDOOR_MONITORED_PERIMETER);
}

function violationFromLocation(location: string, floor: number): WanderingViolation | null {
  const loc = location.toLowerCase();
  if (/\bstaff\b/.test(loc) && !/staff visit/i.test(loc)) return 'staff';
  if (/\bclean\b/.test(loc)) return 'clean';
  if (/\bsoiled\b/.test(loc)) return 'soiled';
  if (floor === 4 && /outside|off property|beyond perimeter|unauthorized outdoor/i.test(loc)) {
    return 'outdoor_perimeter';
  }
  return null;
}

export function getWanderingViolation(input: {
  floor: number;
  position?: { x: number; y: number };
  location?: string;
}): WanderingViolation | null {
  if (input.location) {
    const fromLabel = violationFromLocation(input.location, input.floor);
    if (fromLabel) return fromLabel;
  }

  if (input.position) {
    const room = isPositionInRestrictedRoom(input.floor, input.position.x, input.position.y);
    if (room) return room;
    if (isOutsideOutdoorPerimeter(input.floor, input.position.x, input.position.y)) {
      return 'outdoor_perimeter';
    }
  }

  return null;
}

export function isWanderingViolation(input: {
  floor: number;
  position?: { x: number; y: number };
  location?: string;
}): boolean {
  return getWanderingViolation(input) !== null;
}

export function wanderingViolationMessage(violation: WanderingViolation): string {
  switch (violation) {
    case 'staff':
      return 'Resident entered Staff room without authorization.';
    case 'clean':
      return 'Resident entered Clean supply room without authorization.';
    case 'soiled':
      return 'Resident entered Soiled utility room without authorization.';
    case 'outdoor_perimeter':
      return 'Resident left monitored outdoor property perimeter.';
  }
}

export function describeWanderingContext(
  alert: FacilityAlert,
  mapPeople: Array<{
    id: string;
    floor?: number;
    position?: { x: number; y: number };
    navFromId?: string;
    navToId?: string;
  }>,
  _residents: Array<{ id: string; location: string }>,
): string {
  const onMap = mapPeople.find((p) => p.id === alert.personId);
  const violationMsg = alert.wanderingViolation
    ? wanderingViolationMessage(alert.wanderingViolation)
    : onMap?.position
      ? (() => {
          const v = getWanderingViolation({
            floor: onMap.floor ?? alert.floor,
            position: onMap.position,
          });
          return v ? wanderingViolationMessage(v) : null;
        })()
      : null;

  if (alert.location) {
    return violationMsg ? `${alert.location} — ${violationMsg}` : alert.location;
  }
  if (violationMsg) return violationMsg;
  return 'Restricted area — staff, clean, soiled rooms, or off outdoor perimeter only.';
}

type MapResidentForWandering = {
  id: string;
  floor?: number;
  position?: { x: number; y: number };
  isMoving?: boolean;
  type?: 'resident' | 'staff';
};

/** Wandering alerts only while a resident is moving through a restricted zone (live map). */
export function activeWanderingViolation(
  person: MapResidentForWandering,
): WanderingViolation | null {
  if (person.type === 'staff' || !person.isMoving || !person.position || person.floor == null) {
    return null;
  }
  return getWanderingViolation({
    floor: person.floor,
    position: person.position,
  });
}

export function shouldShowWanderingAlert(
  alert: FacilityAlert,
  mapPeople: MapResidentForWandering[],
  _residents: Array<{ id: string; location: string }>,
): boolean {
  if (alert.type !== 'wandering') return true;

  const onMap = mapPeople.find((p) => p.id === alert.personId);
  return activeWanderingViolation(onMap ?? { id: alert.personId }) !== null;
}

export function filterWanderingAlerts(
  alerts: FacilityAlert[],
  mapPeople: Parameters<typeof shouldShowWanderingAlert>[1],
  residents: Parameters<typeof shouldShowWanderingAlert>[2],
): FacilityAlert[] {
  return alerts.filter((a) => shouldShowWanderingAlert(a, mapPeople, residents));
}

export function wanderingAlertIdForResident(residentId: string): string {
  return `W-${residentId}`;
}

type MapResident = {
  id: string;
  name: string;
  floor: number;
  position: { x: number; y: number };
  isMoving: boolean;
  type: 'resident' | 'staff';
  navFromId?: string;
  navToId?: string;
};

/** Add/remove wandering alerts in the feed based on live map positions */
export function reconcileWanderingAlerts(
  alerts: FacilityAlert[],
  mapPeople: MapResident[],
  residents: Array<{ id: string; name: string; location: string }>,
): FacilityAlert[] {
  let next = filterWanderingAlerts(alerts, mapPeople, residents);

  for (const person of mapPeople) {
    if (person.type !== 'resident') continue;

    const violation = activeWanderingViolation(person);

    const alertId = wanderingAlertIdForResident(person.id);
    const existingIdx = next.findIndex(
      (a) => a.type === 'wandering' && a.personId === person.id,
    );

    if (violation) {
      const resident = residents.find((r) => r.id === person.id);
      const personName = resident?.name ?? person.name;
      const message = wanderingViolationMessage(violation);
      const severity = wanderingAlertSeverity(violation);

      const location = findMapPersonLocation(person.id, mapPeople) ?? undefined;

      if (existingIdx >= 0) {
        const existing = next[existingIdx];
        next[existingIdx] = {
          ...existing,
          message,
          severity,
          wanderingViolation: violation,
          floor: person.floor,
          personName,
          location,
        };
      } else {
        next.push({
          id: alertId,
          type: 'wandering',
          personId: person.id,
          personName,
          message,
          time: 'Just now',
          severity,
          wanderingViolation: violation,
          floor: person.floor,
          location,
        });
      }
    } else if (existingIdx >= 0) {
      next = next.filter((_, i) => i !== existingIdx);
    }
  }

  return next;
}
