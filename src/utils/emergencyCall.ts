import type { FacilityAlert } from '../types/alerts';
import { formatRelativeTimeAgo } from './time';

export { formatRelativeTimeAgo };

export interface EmergencyCallAck {
  startTime: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

/** Demo: assigned staff responds this many ms after the call starts */
export const STAFF_ACK_DELAY_MS = 28_000;

/** Elapsed whole seconds since the emergency call began (survives dismiss / back) */
export function emergencyCallElapsedSeconds(startTime: Date): number {
  return Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000));
}

export function isAssignedStaffAcknowledged(
  ack: EmergencyCallAck,
  assignedStaffId?: string,
): boolean {
  if (!assignedStaffId || !ack.acknowledgedBy || !ack.acknowledgedAt) return false;
  if (ack.acknowledgedBy !== assignedStaffId) return false;
  return ack.acknowledgedAt.getTime() >= ack.startTime.getTime();
}

export function isAssignedStaffAcknowledgedAlert(alert: FacilityAlert): boolean {
  if (alert.type !== 'call' && alert.type !== 'emergency') {
    if (!alert.relatedStaffId || !alert.acknowledgedBy) return false;
    return alert.acknowledgedBy === alert.relatedStaffId;
  }
  if (!alert.relatedStaffId || !alert.acknowledgedBy) return false;
  if (alert.acknowledgedBy !== alert.relatedStaffId) return false;
  if (!alert.callStartTime) return false;
  return true;
}

