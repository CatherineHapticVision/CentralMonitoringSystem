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

/** Seconds without assigned-staff response before supervisor escalation */
export const EMERGENCY_ESCALATION_SECONDS = 15;

/** Show countdown warning this many seconds before auto-escalation */
export const EMERGENCY_ESCALATION_WARNING_SECONDS = 10;

export const ESCALATED_CALL_MESSAGE =
  'ESCALATED: Emergency call unanswered. Supervisor notified.';

export function emergencyCallAlertMessage(
  status: 'ringing' | 'connected' | 'escalated',
): string {
  switch (status) {
    case 'escalated':
      return ESCALATED_CALL_MESSAGE;
    case 'connected':
      return 'Emergency call active.';
    default:
      return 'Emergency call from resident. Staff notified.';
  }
}

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
  if (!alert.relatedStaffId || !alert.acknowledgedBy) return false;
  if (alert.acknowledgedBy !== alert.relatedStaffId) return false;
  if (alert.type === 'call' || alert.type === 'emergency') {
    return Boolean(alert.acknowledgedAt);
  }
  return true;
}

/** True when the call should show escalated UI (at 15s or after state sync). */
export function shouldShowEscalatedCallUi(
  alert: FacilityAlert,
  staffResponded: boolean,
  elapsedSeconds?: number,
): boolean {
  if (alert.type !== 'call' && alert.type !== 'emergency') return false;
  if (staffResponded) return false;
  if (alert.callStatus === 'escalated') return true;
  if (alert.callStatus !== 'ringing' || !alert.callStartTime) return false;
  const elapsed =
    elapsedSeconds ?? emergencyCallElapsedSeconds(alert.callStartTime);
  return elapsed >= EMERGENCY_ESCALATION_SECONDS;
}

