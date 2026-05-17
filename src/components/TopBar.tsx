import { Search, Bell, Clock, Building2, Trees, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { SystemStatus } from './SystemStatus';

interface TopBarProps {
  currentFloor: number;
  onFloorChange: (floor: number) => void;
  alertCount: number;
  lastUpdate: Date;
  connectionStatus: 'connected' | 'syncing' | 'error';
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const FLOOR_OPTIONS: Array<{
  id: number;
  label: string;
  shortLabel?: string;
  icon: typeof Building2;
}> = [
  { id: 1, label: 'Floor 1', icon: Building2 },
  { id: 2, label: 'Floor 2', icon: Building2 },
  { id: 3, label: 'Floor 3', icon: Building2 },
  { id: 4, label: 'Outdoor Grounds', shortLabel: 'Grounds', icon: Trees },
];

export function TopBar({
  currentFloor,
  onFloorChange,
  alertCount,
  lastUpdate,
  connectionStatus,
  searchQuery,
  onSearchChange,
}: TopBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-11 bg-slate-100 border-b border-slate-400 flex items-center px-4 gap-4">
      <div
        className="flex items-center gap-1.5 bg-white px-3 py-1 border border-slate-400 shrink-0"
        title="Protected Health Information"
      >
        <Shield className="w-3 h-3 text-slate-600 shrink-0" aria-hidden />
        <p className="text-[10px] text-slate-700 whitespace-nowrap">
          <span className="font-semibold">PHI</span> — Protected Health Information
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-200 border border-slate-400">
          <Building2 className="w-3.5 h-3.5 text-slate-700" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Location:</span>
        </div>
        <div className="flex border border-slate-400 bg-white" role="tablist" aria-label="Floor selection">
          {FLOOR_OPTIONS.map((floor) => {
            const Icon = floor.icon;
            const isActive = currentFloor === floor.id;
            return (
              <button
                key={floor.id}
                onClick={() => onFloorChange(floor.id)}
                role="tab"
                aria-selected={isActive}
                aria-label={floor.label}
                className={`px-3 py-1 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 border-r border-slate-300 last:border-r-0 ${
                  isActive
                    ? 'bg-blue-800 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3 h-3 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                  <span className="uppercase tracking-wide tabular-nums">
                    {floor.shortLabel || floor.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="search"
            placeholder="Search residents or staff by name or ID"
            aria-label="Search residents or staff by name or ID"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-white border border-slate-400 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <div
          className={`flex items-center justify-center gap-2 px-3 py-1.5 border min-w-[6.25rem] ${
            alertCount > 0
              ? 'bg-red-800 text-white border-red-900'
              : 'bg-green-800 text-white border-green-900'
          }`}
          role="status"
          aria-live="polite"
        >
          <Bell className="w-4 h-4 shrink-0" />
          <span className="text-sm font-bold tracking-wide tabular-nums whitespace-nowrap">
            {alertCount > 0 ? `${alertCount} ALERTS` : 'OK'}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-800 bg-white px-2.5 py-1 border border-slate-400 min-w-[5.75rem]">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <time className="font-mono font-bold tabular-nums whitespace-nowrap">
            {currentTime.toLocaleTimeString('en-CA', { hour12: false })}
          </time>
        </div>

        <SystemStatus lastUpdate={lastUpdate} connectionStatus={connectionStatus} />
      </div>
    </div>
  );
}
