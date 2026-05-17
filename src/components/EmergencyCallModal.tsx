import { Phone, Clock, AlertTriangle, MapPin, X, CheckCircle2, Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  emergencyCallElapsedSeconds,
  formatRelativeTimeAgo,
  isAssignedStaffAcknowledged,
} from '../utils/emergencyCall';

interface EmergencyCall {
  id: string;
  residentId: string;
  residentName: string;
  residentLocation: string;
  staffId: string;
  staffName: string;
  startTime: Date;
  status: 'ringing' | 'connected' | 'unanswered' | 'escalated';
  escalationTime?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  dismissed?: boolean;
}

interface EmergencyCallModalProps {
  calls: EmergencyCall[];
  onDismiss: (callId: string) => void;
  onEndCall: (callId: string) => void;
  onEscalate: (callId: string) => void;
  onResidentClick: (residentId: string) => void;
  onStaffClick: (staffId: string) => void;
}

export function EmergencyCallModal({
  calls,
  onDismiss,
  onEndCall,
  onEscalate,
  onResidentClick,
  onStaffClick,
}: EmergencyCallModalProps) {
  const activeCalls = calls.filter(
    (c) => !c.dismissed && (c.status === 'ringing' || c.status === 'connected'),
  );

  if (activeCalls.length === 0) return null;

  return (
    <div className="fixed top-14 right-4 z-50 space-y-3" role="alert" aria-live="assertive">
      {activeCalls.map((call) => (
        <EmergencyCallCard
          key={call.id}
          call={call}
          onDismiss={onDismiss}
          onEndCall={onEndCall}
          onEscalate={onEscalate}
          onResidentClick={onResidentClick}
          onStaffClick={onStaffClick}
        />
      ))}
    </div>
  );
}

function EmergencyCallCard({
  call,
  onDismiss,
  onEndCall,
  onEscalate,
  onResidentClick,
  onStaffClick,
}: {
  call: EmergencyCall;
  onDismiss: (callId: string) => void;
  onEndCall: (callId: string) => void;
  onEscalate: (callId: string) => void;
  onResidentClick: (residentId: string) => void;
  onStaffClick: (staffId: string) => void;
}) {
  const [duration, setDuration] = useState(() => emergencyCallElapsedSeconds(call.startTime));
  const [respondedLabel, setRespondedLabel] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const staffResponded = isAssignedStaffAcknowledged(call, call.staffId);

  useEffect(() => {
    setDuration(emergencyCallElapsedSeconds(call.startTime));

    const interval = setInterval(() => {
      const elapsed = emergencyCallElapsedSeconds(call.startTime);
      setDuration(elapsed);

      if (call.acknowledgedAt) {
        setRespondedLabel(formatRelativeTimeAgo(call.acknowledgedAt));
      }

      // Auto-escalate after 2 minutes only if assigned staff has not responded
      if (elapsed >= 120 && call.status === 'ringing' && !staffResponded) {
        onEscalate(call.id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [call.startTime, call.status, call.id, call.acknowledgedAt, onEscalate, staffResponded]);

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const showEscalationWarning = !staffResponded && call.status === 'ringing' && duration >= 90;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  return (
    <div
      className={`w-[400px] bg-white border-4 shadow-xl ${
        call.status === 'connected'
          ? 'border-green-800'
          : staffResponded
          ? 'border-green-700'
          : showEscalationWarning
          ? 'border-red-800'
          : 'border-amber-800'
      }`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      role="alertdialog"
      aria-labelledby="emergency-call-title"
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 border-b ${
          call.status === 'connected'
            ? 'bg-green-800 border-green-900'
            : staffResponded
            ? 'bg-green-800 border-green-900'
            : showEscalationWarning
            ? 'bg-red-800 border-red-900'
            : 'bg-amber-800 border-amber-900'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-1">
            <Phone className="w-5 h-5 text-white" />
            <div>
              <h3 id="emergency-call-title" className="text-base font-bold text-white uppercase tracking-wide">
                {call.status === 'connected' ? 'Call Active' : 'Emergency Call'}
              </h3>
            </div>
          </div>

          {/* Call Duration */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300">
            <Clock className="w-4 h-4 text-slate-700" />
            <span className="text-xl font-mono font-bold text-slate-900 tabular-nums">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>

          {/* Close Button */}
          <button
            onClick={() => onDismiss(call.id)}
            className="ml-2 p-1.5 hover:bg-white/20 transition-colors flex-shrink-0"
            aria-label="Dismiss emergency call popup"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Escalation Warning */}
        {showEscalationWarning && (
          <div className="mt-2.5 px-3 py-2 bg-red-900 border-t border-red-950 flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5 text-white" />
            <span className="text-sm font-bold text-white uppercase tracking-wide">
              {duration >= 120
                ? 'ESCALATED - SUPERVISOR NOTIFIED'
                : `AUTO-ESCALATE IN ${120 - duration}S`}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Resident Info */}
        <button
          type="button"
          onClick={() => onResidentClick(call.residentId)}
          className="w-full flex items-center gap-3 p-3 bg-red-50 border-l-4 border-red-800 text-left hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-inset cursor-pointer"
        >
          <div className="w-11 h-11 bg-red-800 flex items-center justify-center flex-shrink-0 font-bold text-white text-sm">
            {getInitials(call.residentName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-900 uppercase tracking-wide mb-0.5">Resident</p>
            <p className="text-lg font-bold text-slate-900 leading-tight">{call.residentName}</p>
            <p className="text-sm font-mono font-semibold text-slate-600 tabular-nums">{call.residentId}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-red-800" />
              <span className="text-sm font-semibold text-slate-800">{call.residentLocation}</span>
            </div>
          </div>
        </button>

        {/* Staff Info */}
        <button
          type="button"
          onClick={() => onStaffClick(call.staffId)}
          className="w-full flex items-center gap-3 p-3 bg-slate-50 border-l-4 border-slate-500 text-left hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-inset cursor-pointer"
        >
          <div className="w-11 h-11 bg-blue-800 flex items-center justify-center flex-shrink-0 font-bold text-white text-sm">
            {getInitials(call.staffName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-0.5">Assigned Staff</p>
            <p className="text-lg font-bold text-slate-900 leading-tight">{call.staffName}</p>
            <p className="text-sm font-mono font-semibold text-slate-600 tabular-nums">{call.staffId}</p>
          </div>
        </button>

        {staffResponded ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 border-l-4 border-green-700">
            <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-green-900 uppercase tracking-wide">Staff responded</p>
              <p className="text-sm font-semibold text-slate-900">
                {call.staffName} responded {respondedLabel || formatRelativeTimeAgo(call.acknowledgedAt!)}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">Escalation paused — assigned staff is responding</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border-l-4 border-amber-700">
            <Clock3 className="w-5 h-5 text-amber-800 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Awaiting response</p>
              <p className="text-sm font-semibold text-slate-900">
                {call.staffName} has not responded to this call yet
              </p>
              {call.status === 'ringing' && (
                <p className="text-[10px] text-slate-600 mt-0.5">Will escalate to supervisor after 2 minutes</p>
              )}
            </div>
          </div>
        )}

        {call.status === 'connected' && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onEndCall(call.id)}
              className="flex-1 px-5 py-3.5 bg-slate-700 hover:bg-slate-800 text-white transition-colors flex items-center justify-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-slate-600 border border-slate-800"
              aria-label="End emergency call"
            >
              <X className="w-5 h-5" />
              <span className="text-base font-bold uppercase tracking-wide">End Call</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
