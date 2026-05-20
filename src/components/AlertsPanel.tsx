import { AlertTriangle, Heart, MapPin, Phone, Activity, Clock, Users, Building2, Navigation } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

import type { FacilityAlert } from '../types/alerts';
import { countAlertsBySeverity } from '../types/alerts';
import { findMapPersonLocation } from '../data/mapLocation';
import {
  EMERGENCY_ESCALATION_SECONDS,
  isAssignedStaffAcknowledgedAlert,
  shouldShowEscalatedCallUi,
} from '../utils/emergencyCall';
import { supervisorIdForFloor } from '../utils/alertResponseMovement';
import { EscalatedSupervisorNotice } from './EscalatedSupervisorNotice';
import { RespondingStaffLinks } from './RespondingStaffLinks';

interface AlertsPanelProps {
  alerts: FacilityAlert[];
  currentFloor: number;
  onLocateOnMap: (personId: string, floor: number) => void;
  onResidentClick: (residentId: string) => void;
  onStaffClick: (staffId: string) => void;
  mapPeople: Array<{
    id: string;
    floor?: number;
    position?: { x: number; y: number };
    navFromId?: string;
    navToId?: string;
  }>;
  residents: Array<{ id: string; location: string }>;
  staff: Array<{ id: string; location: string }>;
}

export function AlertsPanel({
  alerts,
  currentFloor,
  onLocateOnMap,
  onResidentClick,
  onStaffClick,
  mapPeople,
  residents,
  staff,
}: AlertsPanelProps) {
  const [filterFloor, setFilterFloor] = useState<number | null>(null);

  const displayAlerts = filterFloor !== null ? alerts.filter((a) => a.floor === filterFloor) : alerts;
  const severityCounts = countAlertsBySeverity(displayAlerts);

  const getAlertIcon = (type: FacilityAlert['type']) => {
    switch (type) {
      case 'emergency':
        return <AlertTriangle className="w-4 h-4" />;
      case 'wandering':
        return <MapPin className="w-4 h-4" />;
      case 'heartrate':
        return <Heart className="w-4 h-4" />;
      case 'call':
        return <Phone className="w-4 h-4" />;
    }
  };

  const getSeverityStyles = (severity: FacilityAlert['severity'], callStatus?: string) => {
    if (callStatus === 'escalated' || callStatus === 'ringing') {
      return 'bg-red-50 border-red-800 border';
    }
    if (callStatus === 'connected') {
      return 'bg-white border-green-800 border';
    }

    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-800 border';
      case 'high':
        return 'bg-amber-50 border-amber-800 border';
      case 'medium':
        return 'bg-white border-slate-400 border';
    }
  };

  const getFloorLabel = (floor: number) => {
    if (floor === 4) return 'Grounds';
    return `Floor ${floor}`;
  };

  const sortedAlerts = [...displayAlerts].sort((a, b) => {
    const aSeverity = a.severity === 'critical' ? 0 : a.severity === 'high' ? 1 : 2;
    const bSeverity = b.severity === 'critical' ? 0 : b.severity === 'high' ? 1 : 2;
    if (aSeverity !== bSeverity) return aSeverity - bSeverity;

    const aOnDifferentFloor = a.floor !== currentFloor ? 0 : 1;
    const bOnDifferentFloor = b.floor !== currentFloor ? 0 : 1;
    if (aOnDifferentFloor !== bOnDifferentFloor) return aOnDifferentFloor - bOnDifferentFloor;

    return 0;
  });

  return (
    <div className="w-full flex flex-col h-full min-h-0 bg-white">
      <div className="px-2.5 py-1.5 border-b border-slate-300 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-700" />
            <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">Alert Feed</h2>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-700">
            <Building2 className="w-2.5 h-2.5" />
            <span className="font-mono font-bold">{getFloorLabel(currentFloor)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-200">
          {sortedAlerts.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Activity className="w-10 h-10 text-green-700 mx-auto mb-3" />
              <p className="text-sm font-bold">No Active Alerts</p>
              <p className="text-xs mt-1">All Systems Normal</p>
            </div>
          ) : (
            sortedAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                currentFloor={currentFloor}
                onLocateOnMap={onLocateOnMap}
                onResidentClick={onResidentClick}
                onStaffClick={onStaffClick}
                getSeverityStyles={getSeverityStyles}
                getAlertIcon={getAlertIcon}
                getFloorLabel={getFloorLabel}
                mapPeople={mapPeople}
                residents={residents}
                staff={staff}
              />
            ))
          )}
        </div>
      </div>

      <div className="px-2.5 py-2 border-t border-slate-300 bg-slate-50">
        <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
          <div className="bg-red-50 px-2 py-1.5 border border-red-800">
            <div className="text-xl font-bold text-red-900 tabular-nums">{severityCounts.critical}</div>
            <div className="text-[9px] text-slate-800 uppercase font-bold tracking-wide">Critical</div>
          </div>
          <div className="bg-amber-50 px-2 py-1.5 border border-amber-800">
            <div className="text-xl font-bold text-amber-900 tabular-nums">{severityCounts.high}</div>
            <div className="text-[9px] text-slate-800 uppercase font-bold tracking-wide">High</div>
          </div>
          <div className="bg-slate-50 px-2 py-1.5 border border-slate-500">
            <div className="text-xl font-bold text-slate-800 tabular-nums">{severityCounts.medium}</div>
            <div className="text-[9px] text-slate-800 uppercase font-bold tracking-wide">Medium</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-slate-600 font-bold uppercase tracking-wide">By Floor:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterFloor(null)}
              className={`px-1.5 py-0.5 font-mono font-bold border transition-colors text-[9px] ${
                filterFloor === null
                  ? 'bg-blue-700 text-white border-blue-900'
                  : 'bg-slate-200 text-slate-900 border-slate-400 hover:bg-slate-300'
              }`}
              aria-label="Show all alerts"
            >
              ALL
            </button>
            {[1, 2, 3].map(floor => {
              const count = alerts.filter(a => a.floor === floor).length;
              if (count === 0) return null;
              const hasCritical = alerts.some(a => a.floor === floor && a.severity === 'critical');
              return (
                <button
                  key={floor}
                  type="button"
                  onClick={() => setFilterFloor(floor)}
                  className={`px-1.5 py-0.5 font-mono font-bold border transition-colors text-[9px] ${
                    filterFloor === floor
                      ? 'bg-blue-700 text-white border-blue-900'
                      : hasCritical
                      ? 'bg-red-700 text-white border-red-900 hover:bg-red-800'
                      : 'bg-slate-200 text-slate-900 border-slate-400 hover:bg-slate-300'
                  }`}
                  aria-label={`Filter ${count} alert${count !== 1 ? 's' : ''} on floor ${floor}`}
                >
                  F{floor}:{count}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

type AlertTagVariant =
  | 'floor'
  | 'critical'
  | 'high'
  | 'medium'
  | 'wandering'
  | 'call'
  | 'call-active'
  | 'escalated';

const ALERT_TAG_STYLES: Record<AlertTagVariant, string> = {
  floor: 'bg-blue-700 text-white border-blue-900',
  critical: 'bg-red-800 text-white border-red-900',
  high: 'bg-amber-800 text-white border-amber-900',
  medium: 'bg-slate-600 text-white border-slate-700',
  wandering: 'bg-amber-900 text-white border-amber-950',
  call: 'bg-red-800 text-white border-red-900',
  'call-active': 'bg-green-700 text-white border-green-900',
  escalated: 'bg-red-900 text-white border-red-950',
};

function AlertTag({
  variant,
  icon,
  children,
}: {
  variant: AlertTagVariant;
  icon?: ReactElement;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 h-5 text-[9px] font-bold uppercase tracking-wide border leading-none shrink-0 ${ALERT_TAG_STYLES[variant]}`}
    >
      {icon}
      {children}
    </span>
  );
}

function buildAlertTags(
  alert: FacilityAlert,
  liveFloor: number,
  getFloorLabel: (floor: number) => string,
): Array<{ key: string; variant: AlertTagVariant; label: string; icon?: ReactElement }> {
  const tags: Array<{ key: string; variant: AlertTagVariant; label: string; icon?: ReactElement }> = [
    {
      key: 'floor',
      variant: 'floor',
      label: getFloorLabel(liveFloor),
      icon: <Building2 className="w-2.5 h-2.5" aria-hidden />,
    },
  ];

  if (alert.callStatus) {
    const label =
      alert.callStatus === 'connected'
        ? 'ACTIVE'
        : alert.callStatus === 'escalated'
          ? 'ESC'
          : 'CALL';
    const variant: AlertTagVariant =
      alert.callStatus === 'connected'
        ? 'call-active'
        : alert.callStatus === 'escalated'
          ? 'escalated'
          : 'call';
    tags.push({ key: 'call', variant, label });
  } else if (alert.severity === 'critical') {
    tags.push({ key: 'severity', variant: 'critical', label: 'CRITICAL' });
  } else if (alert.severity === 'high') {
    tags.push({ key: 'severity', variant: 'high', label: 'HIGH' });
  } else if (alert.severity === 'medium') {
    tags.push({ key: 'severity', variant: 'medium', label: 'MEDIUM' });
  }

  if (alert.type === 'wandering') {
    tags.push({ key: 'wandering', variant: 'wandering', label: 'WANDERING' });
  }

  return tags;
}

function AlertCard({
  alert,
  currentFloor: _currentFloor,
  onLocateOnMap,
  onResidentClick,
  onStaffClick,
  getSeverityStyles,
  getAlertIcon,
  getFloorLabel,
  mapPeople,
  residents: _residents,
  staff,
}: {
  alert: FacilityAlert;
  currentFloor: number;
  onLocateOnMap: (personId: string, floor: number) => void;
  onResidentClick: (residentId: string) => void;
  onStaffClick: (staffId: string) => void;
  getSeverityStyles: (severity: FacilityAlert['severity'], callStatus?: string) => string;
  getAlertIcon: (type: FacilityAlert['type']) => ReactElement;
  getFloorLabel: (floor: number) => string;
  mapPeople: Array<{
    id: string;
    floor?: number;
    position?: { x: number; y: number };
    navFromId?: string;
    navToId?: string;
  }>;
  residents: Array<{ id: string; location: string }>;
  staff: Array<{ id: string; location: string }>;
}) {
  const onMap = mapPeople.find((p) => p.id === alert.personId && p.position);
  const liveLocation =
    (onMap &&
      findMapPersonLocation(alert.personId, mapPeople as Array<{
        id: string;
        floor: number;
        position: { x: number; y: number };
        navFromId?: string;
        navToId?: string;
      }>)) ??
    alert.location;
  const liveFloor = onMap?.floor ?? alert.floor;

  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (!alert.callStartTime) return;

    const tick = () => {
      setCallDuration(Math.floor((Date.now() - alert.callStartTime!.getTime()) / 1000));
    };
    tick();
    const interval = setInterval(tick, 250);

    return () => clearInterval(interval);
  }, [alert.callStartTime]);

  const minutes = Math.floor(callDuration / 60);
  const seconds = callDuration % 60;

  const getIconColor = () => {
    if (alert.callStatus === 'escalated' || alert.callStatus === 'ringing') return 'text-red-800';
    if (alert.callStatus === 'connected') return 'text-green-700';
    if (alert.severity === 'critical') return 'text-red-800';
    if (alert.severity === 'high') return 'text-amber-700';
    return 'text-slate-600';
  };

  const isEmergencyAlert = alert.type === 'call' || alert.type === 'emergency';
  const staffResponded = isEmergencyAlert && isAssignedStaffAcknowledgedAlert(alert);
  const showEscalated = shouldShowEscalatedCallUi(alert, staffResponded, callDuration);
  const escalatedSupervisorId = showEscalated ? supervisorIdForFloor(staff, alert.floor) : null;
  const alertTags = buildAlertTags(alert, liveFloor, getFloorLabel);

  return (
    <div
      className={`border-l-4 px-3 py-2.5 ${getSeverityStyles(alert.severity, alert.callStatus)}`}
    >
      <div className="mb-2 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onResidentClick(alert.personId)}
            className="text-left hover:underline focus:outline-none focus:ring-1 focus:ring-blue-700 rounded-sm min-w-0 flex-1"
            aria-label={`Open profile for ${alert.personName}`}
          >
            <span className="font-bold text-slate-900 text-xs block leading-tight truncate">
              {alert.personName}
            </span>
            <span className="font-mono font-semibold text-slate-600 text-[10px]">{alert.personId}</span>
          </button>
          <button
            type="button"
            onClick={() => onLocateOnMap(alert.personId, liveFloor)}
            className="inline-flex items-center justify-center gap-1 h-8 min-w-[3.25rem] px-2.5 bg-blue-700 hover:bg-blue-800 transition-colors border border-blue-900 text-[9px] font-bold text-white uppercase tracking-wide shrink-0 self-start"
            aria-label={`Go to ${getFloorLabel(liveFloor)} and highlight ${alert.personName} on map`}
          >
            <Navigation className="w-3 h-3 shrink-0" aria-hidden />
            GO
          </button>
        </div>
        <div className="flex flex-wrap gap-1" role="list" aria-label="Alert tags">
          {alertTags.map((tag) => (
            <AlertTag key={tag.key} variant={tag.variant} icon={tag.icon}>
              {tag.label}
            </AlertTag>
          ))}
        </div>
      </div>
      <div className="flex items-start gap-2.5">
        <div className={`flex-shrink-0 mt-0.5 ${getIconColor()}`}>
          {getAlertIcon(alert.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`mb-1.5 leading-snug font-medium text-xs ${
              showEscalated ? 'text-red-900 font-bold' : 'text-slate-800'
            }`}
          >
            {showEscalated && escalatedSupervisorId ? (
              <EscalatedSupervisorNotice
                supervisorId={escalatedSupervisorId}
                onStaffClick={onStaffClick}
                variant="message"
              />
            ) : (
              alert.message
            )}
          </p>

          {liveLocation && (
            <div
              className="mb-1.5 flex items-start gap-1.5 bg-white/80 border border-slate-300 px-2 py-1.5"
              aria-live="polite"
            >
              <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-800 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wide block">
                  Live location
                </span>
                <span className="text-[11px] font-semibold text-slate-900 leading-snug">{liveLocation}</span>
              </div>
            </div>
          )}

          {(isEmergencyAlert && alert.relatedStaffId) || (alert.respondingStaff && alert.respondingStaff.length > 0) ? (
            <div className="mb-1.5 border-l-2 border-blue-700 bg-blue-50 p-1.5">
              <div className="flex items-start gap-1 text-[10px]">
                <Users className="text-blue-700 w-3 h-3 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <span className="font-bold uppercase block text-slate-700">Assigned</span>
                  {isEmergencyAlert && alert.relatedStaffId ? (
                    <>
                      <RespondingStaffLinks
                        staffIds={[alert.relatedStaffId]}
                        nameById={
                          alert.relatedStaffName
                            ? { [alert.relatedStaffId]: alert.relatedStaffName }
                            : undefined
                        }
                        onStaffClick={onStaffClick}
                        className="text-slate-900"
                      />
                      {!showEscalated && (
                        <span className="text-slate-600 block mt-0.5">
                          {staffResponded
                            ? `Responded${alert.acknowledgedAt ? ` (${alert.acknowledgedAt})` : ''}. Escalation paused.`
                            : 'Not yet responded.'}
                          {!staffResponded && alert.callStatus === 'ringing' && (
                            <> Escalates after {EMERGENCY_ESCALATION_SECONDS} seconds without response.</>
                          )}
                        </span>
                      )}
                    </>
                  ) : (
                    <RespondingStaffLinks
                      staffIds={alert.respondingStaff!}
                      onStaffClick={onStaffClick}
                      className="text-slate-900"
                    />
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500 font-mono">{alert.time}</span>
            {alert.callStartTime && (
              <div className="flex items-center gap-1 font-mono font-bold text-slate-900">
                <Clock className="w-3 h-3" />
                <span>
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
          {showEscalated && (
            <div className="mt-2 px-3 py-2 bg-red-800 text-white text-xs font-bold uppercase tracking-wide text-center border-t border-red-900">
              ESCALATED - SUPERVISOR NOTIFIED
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
