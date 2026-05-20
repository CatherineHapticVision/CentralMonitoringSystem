import { X, MapPin, Clock, Briefcase, Phone, Mail, AlertTriangle, Bell, Activity, Timer, Users, CheckCircle2 } from 'lucide-react';
import { ProfilePhotoSlot } from './ProfilePhotoSlot';
import { useProfilePhotos } from '../context/ProfilePhotoContext';
import { RespondingStaffLinks } from './RespondingStaffLinks';

interface ActiveAlert {
  id: string;
  residentId: string;
  residentName: string;
  type: 'emergency' | 'wandering' | 'heartrate' | 'call';
  severity: 'critical' | 'high' | 'medium';
  time: string;
  acknowledgedAt?: string;
  responseTime?: string;
  respondingStaff?: string[];
  escalatedTo?: string;
}

interface StaffData {
  id: string;
  name: string;
  role: string;
  location: string;
  status: 'on-duty' | 'break' | 'off-duty';
  shiftStart: string;
  shiftEnd: string;
  assignedResidents: { id: string; name: string; status: 'normal' | 'alert' | 'warning' }[];
  contactNumber: string;
  email: string;
  lastActivity: string;
  activeAlerts: ActiveAlert[];
  emergencyEscalation: 'primary' | 'secondary' | 'none';
}

interface StaffProfileProps {
  staff: StaffData | null;
  onClose: () => void;
  onResidentClick: (residentId: string) => void;
  onStaffClick: (staffId: string) => void;
}

export function StaffProfile({ staff, onClose, onResidentClick, onStaffClick }: StaffProfileProps) {
  const { getPhotoUrl, setPhotoUrl } = useProfilePhotos();
  const photoUrl = staff ? getPhotoUrl(staff.id, 'staff') : undefined;

  if (!staff) {
    return (
      <div className="w-full flex flex-col h-full min-h-0 bg-white items-center justify-center p-6 text-slate-500">
        <p className="text-sm font-medium">Loading profile…</p>
      </div>
    );
  }

  const statusColors = {
    'on-duty': { bg: 'bg-green-800', text: 'text-white' },
    'break': { bg: 'bg-amber-700', text: 'text-white' },
    'off-duty': { bg: 'bg-slate-700', text: 'text-white' },
  };

  const escalationColors = {
    'primary': { text: 'text-blue-700', label: '1° Resp' },
    'secondary': { text: 'text-indigo-700', label: '2° Resp' },
    'none': { text: 'text-slate-600', label: 'None' },
  };

  const criticalAlerts = staff.activeAlerts.filter(a => a.severity === 'critical');
  const highAlerts = staff.activeAlerts.filter(a => a.severity === 'high');

  return (
    <div className="w-full flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className="px-3 py-3 border-b bg-blue-700 border-blue-900">
        {staff.activeAlerts.length > 0 && (
          <div className="mb-2.5 px-3 py-2 bg-red-800 border-b border-red-900 flex items-center justify-center gap-2">
            <Bell className="w-4 h-4 text-white" />
            <span className="text-sm font-bold text-white tracking-wide tabular-nums">
              {staff.activeAlerts.length} ACTIVE RESPONSE{staff.activeAlerts.length !== 1 ? 'S' : ''}
            </span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <ProfilePhotoSlot
              personId={staff.id}
              name={staff.name}
              photoUrl={photoUrl}
              onDark
              onPhotoSelected={(url) => setPhotoUrl(staff.id, url)}
            />
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-white truncate leading-tight">{staff.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm font-mono font-bold text-white tracking-tight tabular-nums">
                  {staff.id}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 font-bold ${statusColors[staff.status].bg} ${statusColors[staff.status].text}`}>
                  {staff.status === 'on-duty' ? 'ON' : staff.status === 'break' ? 'BRK' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium mt-0.5">{staff.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 transition-colors flex-shrink-0"
            aria-label="Close profile"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Active Emergency Responses */}
        {staff.activeAlerts.length > 0 && (
          <div className="px-3 py-2 border-b border-slate-300 bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-800" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Active Responses</h3>
            </div>
            <div className="space-y-2">
              {staff.activeAlerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => onResidentClick(alert.residentId)}
                  className={`w-full text-left bg-white border ${
                    alert.severity === 'critical'
                      ? 'p-3 border-l-4 border-red-800'
                      : alert.severity === 'high'
                      ? 'p-2.5 border-l-4 border-amber-800'
                      : 'p-2 border-l-4 border-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`font-mono font-bold text-slate-900 ${
                      alert.severity === 'critical' ? 'text-base' : 'text-xs'
                    }`}>
                      {alert.residentId}
                    </span>
                    <span className={`px-1.5 py-0.5 font-bold uppercase ${
                      alert.severity === 'critical'
                        ? 'text-xs bg-red-800 text-white'
                        : alert.severity === 'high'
                        ? 'text-[10px] bg-amber-700 text-white'
                        : 'text-[10px] bg-slate-600 text-white'
                    }`}>
                      {alert.severity === 'critical' ? 'CRIT' : alert.severity === 'high' ? 'HIGH' : 'MED'}
                    </span>
                  </div>
                  <p className={`text-slate-800 mb-1 font-medium ${
                    alert.severity === 'critical' ? 'text-sm' : 'text-xs'
                  }`}>
                    {alert.type === 'emergency' && 'Emergency'}
                    {alert.type === 'wandering' && 'Wandering Alert'}
                    {alert.type === 'heartrate' && 'Cardiac Monitor Alert'}
                    {alert.type === 'call' && 'Emergency Call'}
                  </p>

                  {alert.respondingStaff && alert.respondingStaff.length > 0 && (
                    <div className="mb-1 flex items-center gap-1 text-[10px] text-slate-600">
                      {alert.acknowledgedAt ? (
                        <CheckCircle2 className="w-3 h-3 text-green-700 shrink-0" />
                      ) : (
                        <Users className="w-3 h-3 text-blue-700 shrink-0" />
                      )}
                      <span className="text-slate-900">
                        <span className="text-slate-600 font-bold uppercase">Assigned: </span>
                        <RespondingStaffLinks
                          staffIds={alert.respondingStaff}
                          onStaffClick={onStaffClick}
                        />
                        {alert.acknowledgedAt &&
                        (alert.type === 'call' || alert.type === 'emergency')
                          ? ` — responded ${alert.acknowledgedAt}`
                          : ''}
                      </span>
                    </div>
                  )}

                  {alert.escalatedTo && (
                    <div className={`mb-1.5 bg-red-100 border-l-2 border-red-800 ${
                      alert.severity === 'critical' ? 'p-2' : 'p-1.5'
                    }`}>
                      <div className={`flex items-center gap-1.5 ${
                        alert.severity === 'critical' ? 'text-xs' : 'text-[10px]'
                      }`}>
                        <AlertTriangle className={`text-red-800 ${
                          alert.severity === 'critical' ? 'w-4 h-4' : 'w-3 h-3'
                        }`} />
                        <span className="font-bold text-red-800 uppercase tracking-wide">ESC TO:</span>
                        <span className="font-mono font-bold text-slate-900">{alert.escalatedTo}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-mono">{alert.time}</span>
                    {alert.responseTime && (
                      <div className="flex items-center gap-0.5 font-mono font-semibold text-slate-700">
                        <Timer className="w-3 h-3" />
                        <span>{alert.responseTime}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Location */}
        <div className="px-3 py-2 border-b border-slate-300 bg-white">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Location</span>
          </div>
          <p className="text-sm font-semibold text-slate-900">{staff.location}</p>
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-600 tabular-nums">{staff.lastActivity}</span>
          </div>
        </div>

        {/* Shift Information & Emergency Escalation */}
        <div className="px-3 py-2 border-b border-slate-300 bg-white">
          <div className="flex items-center gap-1.5 mb-2">
            <Briefcase className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Shift Info</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Start:</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">{staff.shiftStart}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">End:</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">{staff.shiftEnd}</span>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Escalation:</span>
                <span className={`text-xs font-semibold ${escalationColors[staff.emergencyEscalation].text}`}>
                  {escalationColors[staff.emergencyEscalation].label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="px-3 py-2 border-b border-slate-300 bg-white">
          <h3 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Contact</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3 text-slate-600" />
              <span className="text-xs font-mono text-slate-900">{staff.contactNumber}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-3 h-3 text-slate-600" />
              <span className="text-xs text-slate-900">{staff.email}</span>
            </div>
          </div>
        </div>

        {/* Assigned Residents */}
        <div className="px-3 py-2 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Assigned ({staff.assignedResidents.length})
            </h3>
            {staff.assignedResidents.some(r => r.status !== 'normal') && (
              <span className="text-[10px] px-1 py-0.5 bg-red-800 text-white font-bold">
                {staff.assignedResidents.filter(r => r.status !== 'normal').length}
              </span>
            )}
          </div>
          <div className="space-y-1">
            {staff.assignedResidents.map((resident) => (
              <button
                key={resident.id}
                onClick={() => onResidentClick(resident.id)}
                className={`w-full flex items-center gap-2 p-2 border-l-4 text-left ${
                  resident.status === 'alert'
                    ? 'bg-red-50 border-red-800'
                    : resident.status === 'warning'
                    ? 'bg-amber-50 border-amber-700'
                    : 'bg-white border-slate-400'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-7 h-7 flex items-center justify-center text-xs font-bold ${
                    resident.status === 'alert'
                      ? 'bg-red-800 text-white'
                      : resident.status === 'warning'
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-700 text-white'
                  }`}>
                    {resident.id.slice(-2)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-xs text-slate-900 truncate min-w-0">
                      <span className="font-mono font-bold tabular-nums">{resident.id}</span>
                      <span className="text-slate-400 mx-1">—</span>
                      <span className="font-semibold">{resident.name}</span>
                    </p>
                    {resident.status !== 'normal' && (
                      <span className={`text-[10px] px-1 py-0.5 font-bold shrink-0 ${
                        resident.status === 'alert' ? 'bg-red-800 text-white' : 'bg-amber-700 text-white'
                      }`}>
                        {resident.status === 'alert' ? 'CRIT' : 'HIGH'}
                      </span>
                    )}
                  </div>
                </div>
                <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
