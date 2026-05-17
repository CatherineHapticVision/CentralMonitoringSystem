import { Activity, Wifi, Database, Clock, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SystemStatusProps {
  lastUpdate: Date;
  connectionStatus: 'connected' | 'syncing' | 'error';
}

export function SystemStatus({ lastUpdate, connectionStatus }: SystemStatusProps) {
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
      if (seconds < 60) {
        setTimeSinceUpdate(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setTimeSinceUpdate(`${minutes}m ago`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  const statusConfig = {
    connected: {
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      label: 'Connected',
      pulse: true,
    },
    syncing: {
      icon: Database,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      label: 'Syncing',
      pulse: true,
    },
    error: {
      icon: Wifi,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      label: 'Connection Error',
      pulse: false,
    },
  };

  const config = statusConfig[connectionStatus];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center gap-1.5 text-xs shrink-0">
      {/* Connection Status — fixed width so Connected/Syncing/Error do not shift the top bar */}
      <div
        className={`flex items-center justify-center gap-1 px-2 py-1 border min-w-[8.75rem] ${config.bg} ${config.border}`}
      >
        <StatusIcon className={`w-3 h-3 shrink-0 ${config.color}`} />
        <span className={`${config.color} font-bold text-[10px] uppercase whitespace-nowrap`}>
          {config.label}
        </span>
      </div>

      {/* Last Update */}
      <div className="flex items-center justify-center gap-1 text-slate-800 bg-white px-2 py-1 border border-slate-400 min-w-[4.75rem]">
        <Clock className="w-3 h-3 shrink-0" />
        <span className="text-[10px] font-mono font-bold tabular-nums whitespace-nowrap min-w-[2.75rem] text-center">
          {timeSinceUpdate || '—'}
        </span>
      </div>
    </div>
  );
}
