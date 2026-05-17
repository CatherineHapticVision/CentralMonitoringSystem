import { LegendPanel } from './LegendPanel';

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

import type { FacilityAlert } from '../types/alerts';
import { countAlertsBySeverity, residentHighestAlertSeverity } from '../types/alerts';

interface LeftSidebarProps {
  residents: Person[];
  staff: Person[];
  onResidentClick: (residentId: string) => void;
  onStaffClick: (staffId: string) => void;
  currentFloor: number;
  searchQuery?: string;
  alerts: FacilityAlert[];
}

export function LeftSidebar({ residents, staff, onResidentClick, onStaffClick, currentFloor, searchQuery = '', alerts }: LeftSidebarProps) {
  // Filter residents and staff based on search query (names and IDs only)
  const filteredResidents = searchQuery.trim() !== ''
    ? residents.filter(r =>
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : residents;

  const filteredStaff = searchQuery.trim() !== ''
    ? staff.filter(s =>
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : staff;

  const severityCounts = countAlertsBySeverity(alerts);
  const hasActiveAlerts =
    severityCounts.critical + severityCounts.high + severityCounts.medium > 0;

  const sortedResidents = [...filteredResidents].sort((a, b) => {
    const priority = (id: string) => {
      const sev = residentHighestAlertSeverity(id, alerts);
      if (sev === 'critical') return 0;
      if (sev === 'high') return 1;
      if (sev === 'medium') return 2;
      return 3;
    };
    const bySeverity = priority(a.id) - priority(b.id);
    if (bySeverity !== 0) return bySeverity;
    return parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10);
  });

  const getFloorLabel = (floor: number) => {
    if (floor === 4) return 'Outdoor Grounds';
    return `Floor ${floor}`;
  };

  return (
    <div className="w-64 bg-white border-r border-slate-300 flex flex-col h-full">
      <div className="px-2.5 py-1.5 border-b border-slate-300 bg-slate-50">
        <div className="flex items-center justify-between">
          <h1 className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">Grandview Care LTC</h1>
          <span className="text-[9px] font-mono text-slate-600 tabular-nums">
            {residents.length} residents
          </span>
        </div>
        <p className="text-[10px] text-slate-600 font-mono">{getFloorLabel(currentFloor)}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Alert Summary */}
        {hasActiveAlerts && (
          <div className="px-2.5 py-1.5 bg-slate-800 border-b border-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-white uppercase tracking-wide">Alerts</span>
              <div className="flex gap-1.5 text-[10px] text-white font-mono font-bold tabular-nums">
                {severityCounts.critical > 0 && (
                  <div className="px-1.5 py-0.5 bg-red-900 border border-red-950">
                    <span className="text-xs">{severityCounts.critical}</span> CRIT
                  </div>
                )}
                {severityCounts.high > 0 && (
                  <div className="px-1.5 py-0.5 bg-amber-800 border border-amber-900">
                    <span className="text-xs">{severityCounts.high}</span> HIGH
                  </div>
                )}
                {severityCounts.medium > 0 && (
                  <div className="px-1.5 py-0.5 bg-slate-600 border border-slate-700">
                    <span className="text-xs">{severityCounts.medium}</span> MED
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="px-2.5 py-0.5 bg-slate-100 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide">Residents</h2>
              <span className="text-[10px] font-mono text-slate-700 tabular-nums">
                {searchQuery.trim() ? `${filteredResidents.length} / ${residents.length}` : residents.length}
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {sortedResidents.map((resident) => {
              const alertSeverity = residentHighestAlertSeverity(resident.id, alerts);
              return (
              <button
                key={resident.id}
                onClick={() => onResidentClick(resident.id)}
                className={`w-full flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 ${
                  alertSeverity === 'critical'
                    ? 'px-2 py-1 bg-red-50 hover:bg-red-100 border-l-2 border-red-700'
                    : alertSeverity === 'high'
                    ? 'px-2 py-1 bg-amber-50 hover:bg-amber-100 border-l-2 border-amber-700'
                    : alertSeverity === 'medium'
                    ? 'px-2 py-1 bg-slate-50 hover:bg-slate-100 border-l-2 border-slate-500'
                    : 'px-2 py-0.5 hover:bg-slate-50'
                }`}
              >
                <ResidentStatusIndicator alertSeverity={alertSeverity} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1">
                    <span className={`font-mono text-slate-900 ${
                      alertSeverity ? 'text-[11px] font-bold' : 'text-[10px]'
                    }`}>
                      {resident.id} — {resident.name}
                    </span>
                    {alertSeverity === 'critical' && (
                      <span className="px-1 py-0.5 font-bold leading-none text-[8px] flex-shrink-0 bg-red-800 text-white">
                        CRIT
                      </span>
                    )}
                    {alertSeverity === 'high' && (
                      <span className="px-1 py-0.5 font-bold leading-none text-[8px] flex-shrink-0 bg-amber-700 text-white">
                        HIGH
                      </span>
                    )}
                    {alertSeverity === 'medium' && (
                      <span className="px-1 py-0.5 font-bold leading-none text-[8px] flex-shrink-0 bg-slate-600 text-white">
                        MED
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-[9px] font-mono tabular-nums ${
                    resident.isMoving ? 'text-blue-700 font-bold' : 'text-slate-500'
                  }`}>
                    {resident.lastSeen || '—'}
                  </span>
                </div>
              </button>
            );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200">
          <div className="px-2.5 py-0.5 bg-slate-100 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide">Staff on Duty</h2>
              <span className="text-[10px] font-mono text-slate-700 tabular-nums">{filteredStaff.length}</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredStaff.map((member) => (
              <button
                key={member.id}
                onClick={() => onStaffClick(member.id)}
                className={`w-full flex items-center gap-1.5 px-2 py-0.5 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 ${
                  member.respondingTo ? 'bg-amber-50 hover:bg-amber-100 border-l-2 border-amber-700' : 'bg-green-50 hover:bg-green-100'
                }`}
              >
                <StatusIndicator status={member.status} isStaff />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-slate-900">
                      {member.id} — {member.name}
                    </span>
                    {member.respondingTo && (
                      <span className="text-[8px] px-1 py-0.5 bg-amber-800 text-white font-bold flex-shrink-0">
                        RESP
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-[9px] font-mono tabular-nums ${
                    member.isMoving ? 'text-green-700 font-bold' : 'text-slate-500'
                  }`}>
                    {member.lastSeen || '—'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <LegendPanel />
    </div>
  );
}

function ResidentStatusIndicator({
  alertSeverity,
}: {
  alertSeverity: FacilityAlert['severity'] | null;
}) {
  const colors = {
    critical: 'bg-red-700 border-red-800',
    high: 'bg-amber-600 border-amber-700',
    medium: 'bg-slate-500 border-slate-600',
    normal: 'bg-blue-600 border-blue-700',
  };
  const colorKey = alertSeverity ?? 'normal';
  const enlarged = alertSeverity !== null;

  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${enlarged ? 'w-3 h-3' : 'w-2.5 h-2.5'}`}>
      <div className={`rounded-full border ${colors[colorKey]} ${enlarged ? 'w-3 h-3' : 'w-2.5 h-2.5'}`} />
    </div>
  );
}

function StatusIndicator({ status, isStaff = false }: { status: 'normal' | 'alert' | 'warning'; isStaff?: boolean }) {
  const colors = {
    normal: isStaff ? 'bg-green-600 border-green-700' : 'bg-blue-600 border-blue-700',
    warning: 'bg-amber-600 border-amber-700',
    alert: 'bg-red-700 border-red-800',
  };

  const isCritical = status === 'alert' || status === 'warning';

  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${isCritical ? 'w-3 h-3' : 'w-2.5 h-2.5'}`}>
      <div className={`rounded-full border ${colors[status]} ${isCritical ? 'w-3 h-3' : 'w-2.5 h-2.5'}`} />
    </div>
  );
}
