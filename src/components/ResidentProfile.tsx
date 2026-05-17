import { X, MapPin, Heart, Footprints, Navigation, Languages, AlertTriangle, Clock, Phone, Activity, Droplets, Thermometer, Users, Bell, CheckCircle2 } from 'lucide-react';
import type { ProfileAlert } from '../types/alerts';
import { ProfilePhotoSlot } from './ProfilePhotoSlot';
import { useProfilePhotos } from '../context/ProfilePhotoContext';
import { staffNameForId } from '../data/facilityData';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  isPrimary: boolean;
}

interface ResidentData {
  id: string;
  name: string;
  location: string;
  heartRate: number;
  baselineHeartRate: number;
  oxygenSaturation: number;
  temperature: number;
  baselineTemp: number;
  steps: number;
  distance: number;
  language: string;
  assignedStaff: StaffMember[];
  alertStatus: 'normal' | 'alert' | 'warning';
  wanderingRisk: 'low' | 'medium' | 'high';
  emergencyCallActive: boolean;
  lastMovement: string;
  lastVitalsCheck: string;
  lastStaffVisit: string;
  lastStaffVisitBy: string;
  activeAlerts?: ProfileAlert[];
}

interface ResidentProfileProps {
  resident: ResidentData | null;
  onClose: () => void;
  onStaffClick: (staffId: string) => void;
}

export function ResidentProfile({ resident, onClose, onStaffClick }: ResidentProfileProps) {
  const { getPhotoUrl, setPhotoUrl } = useProfilePhotos();
  const photoUrl = resident ? getPhotoUrl(resident.id, 'resident') : undefined;

  if (!resident) {
    return (
      <div className="w-full flex flex-col h-full min-h-0 bg-white items-center justify-center p-6 text-slate-500">
        <p className="text-sm font-medium">Loading profile…</p>
      </div>
    );
  }

  const activeAlerts = resident.activeAlerts ?? [];

  const heartRateStatus = resident.heartRate < 50 || resident.heartRate > 100 ? 'alert' : 'normal';
  const heartRateColor = heartRateStatus === 'alert' ? 'text-red-800' : 'text-emerald-700';
  const heartRateBg = heartRateStatus === 'alert' ? 'bg-white' : 'bg-emerald-50';

  const oxygenStatus = resident.oxygenSaturation < 92 ? 'alert' : resident.oxygenSaturation < 95 ? 'warning' : 'normal';
  const tempStatus = Math.abs(resident.temperature - resident.baselineTemp) > 0.8 ? 'alert' : 'normal';

  const wanderingColors = {
    low: { text: 'text-emerald-800', bg: 'bg-white', border: 'border-emerald-700' },
    medium: { text: 'text-amber-800', bg: 'bg-white', border: 'border-amber-700' },
    high: { text: 'text-red-800', bg: 'bg-white', border: 'border-red-800' },
  };

  const primaryStaff = resident.assignedStaff.filter(s => s.isPrimary);
  const otherStaff = resident.assignedStaff.filter(s => !s.isPrimary);

  return (
    <div className="w-full flex flex-col h-full min-h-0 bg-white">
      {/* Header */}
      <div className={`px-3 py-3 border-b ${
        resident.alertStatus === 'alert'
          ? 'bg-red-800 border-red-900'
          : resident.alertStatus === 'warning'
          ? 'bg-amber-800 border-amber-900'
          : 'bg-slate-700 border-slate-800'
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <ProfilePhotoSlot
              personId={resident.id}
              name={resident.name}
              photoUrl={photoUrl}
              onDark
              onPhotoSelected={(url) => setPhotoUrl(resident.id, url)}
            />
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-white truncate leading-tight">{resident.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono font-bold text-white tracking-tight tabular-nums text-sm">
                  {resident.id}
                </span>
                <StatusBadge status={resident.alertStatus} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 transition-colors focus:outline-none focus:ring-1 focus:ring-white flex-shrink-0"
            aria-label="Close resident profile"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Current Location */}
        <div className="px-3 py-2 border-b border-slate-300 bg-white">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Location</span>
          </div>
          <p className="text-sm text-slate-900 font-semibold">{resident.location}</p>
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-600 tabular-nums">{resident.lastMovement}</span>
          </div>
        </div>

        {/* Health Metrics */}
        <div className="px-3 py-2 border-b border-slate-300 bg-slate-50">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[10px] font-bold text-slate-700 flex items-center gap-1 uppercase tracking-wide">
              <Activity className="w-3 h-3" />
              Vitals
            </h3>
            <div className="flex items-center gap-1 text-[9px] text-slate-500">
              <Clock className="w-2.5 h-2.5" />
              <span className="font-mono font-semibold">{resident.lastVitalsCheck}</span>
            </div>
          </div>

          {/* Heart Rate */}
          <div className={`p-1.5 border-l-4 mb-1.5 ${
            heartRateStatus === 'alert'
              ? 'bg-white border-red-800'
              : 'bg-white border-slate-300'
          }`}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1">
                <Heart className={`w-3.5 h-3.5 ${heartRateColor}`} />
                <span className="text-[10px] font-bold text-slate-700 uppercase">HR</span>
              </div>
              {heartRateStatus === 'alert' && (
                <span className="text-[9px] px-1 py-0.5 bg-red-800 text-white font-bold">
                  CRIT
                </span>
              )}
            </div>
            <div>
              <div className={`text-lg font-bold ${heartRateColor}`}>
                {resident.heartRate} <span className="text-[10px] font-normal">BPM</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Baseline: {resident.baselineHeartRate} BPM
              </p>
              {heartRateStatus === 'alert' && (
                <p className="text-[10px] font-bold text-red-800 mt-0.5">
                  {resident.heartRate < 50 ? 'Bradycardia' : 'Tachycardia'}
                </p>
              )}
            </div>
          </div>

          {/* Oxygen & Temperature */}
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <div className={`p-1.5 border-l-4 ${
              oxygenStatus === 'alert'
                ? 'bg-white border-red-800'
                : oxygenStatus === 'warning'
                ? 'bg-white border-amber-700'
                : 'bg-white border-slate-300'
            }`}>
              <div className="flex items-center gap-0.5 mb-0.5">
                <Droplets className={`w-3 h-3 ${
                  oxygenStatus === 'alert' ? 'text-red-800' : oxygenStatus === 'warning' ? 'text-amber-700' : 'text-slate-600'
                }`} />
                <span className="text-[9px] text-slate-600 font-bold uppercase">SpO₂</span>
              </div>
              <div className={`text-base font-bold ${
                oxygenStatus === 'alert' ? 'text-red-800' : oxygenStatus === 'warning' ? 'text-amber-700' : 'text-slate-900'
              }`}>
                {resident.oxygenSaturation}%
              </div>
            </div>

            <div className={`p-1.5 border-l-4 ${
              tempStatus === 'alert'
                ? 'bg-white border-red-800'
                : 'bg-white border-slate-300'
            }`}>
              <div className="flex items-center gap-0.5 mb-0.5">
                <Thermometer className={`w-3 h-3 ${tempStatus === 'alert' ? 'text-red-800' : 'text-slate-600'}`} />
                <span className="text-[9px] text-slate-600 font-bold uppercase">Temp</span>
              </div>
              <div className={`text-base font-bold ${tempStatus === 'alert' ? 'text-red-800' : 'text-slate-900'}`}>
                {resident.temperature}°C
              </div>
            </div>
          </div>

          {/* Activity Metrics */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-1.5 bg-white border border-slate-300">
              <div className="flex items-center gap-0.5 mb-0.5">
                <Footprints className="w-3 h-3 text-slate-600" />
                <span className="text-[9px] text-slate-600 font-bold uppercase">Steps</span>
              </div>
              <div className="text-base font-bold text-slate-900">{resident.steps.toLocaleString()}</div>
              <p className="text-[9px] text-slate-500">Today</p>
            </div>

            <div className="p-1.5 bg-white border border-slate-300">
              <div className="flex items-center gap-0.5 mb-0.5">
                <Navigation className="w-3 h-3 text-slate-600" />
                <span className="text-[9px] text-slate-600 font-bold uppercase">Distance</span>
              </div>
              <div className="text-base font-bold text-slate-900">{resident.distance}</div>
              <p className="text-[9px] text-slate-500">km today</p>
            </div>
          </div>
        </div>

        {/* Active alerts from facility feed */}
        {activeAlerts.length > 0 && (
          <div className="px-3 py-2 border-b border-slate-300 bg-red-50">
            <div className="flex items-center gap-1.5 mb-2">
              <Bell className="w-3.5 h-3.5 text-red-800" />
              <h3 className="text-[10px] font-bold text-red-900 uppercase tracking-wide">
                Active Alerts ({activeAlerts.length})
              </h3>
            </div>
            <div className="space-y-1.5">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2 border-l-4 bg-white ${
                    alert.severity === 'critical'
                      ? 'border-red-800'
                      : alert.severity === 'high'
                        ? 'border-amber-700'
                        : 'border-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                    <span
                      className={`text-[9px] px-1 py-0.5 font-bold uppercase ${
                        alert.severity === 'critical'
                          ? 'bg-red-800 text-white'
                          : alert.severity === 'high'
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-600 text-white'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase">{alert.type}</span>
                    {alert.callStatus && (
                      <span className="text-[9px] px-1 py-0.5 font-bold bg-amber-700 text-white uppercase">
                        {alert.callStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-800 leading-snug font-medium">{alert.message}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{alert.time}</p>
                  {((alert.type === 'call' || alert.type === 'emergency') && alert.relatedStaffId) ||
                  (alert.respondingStaff && alert.respondingStaff.length > 0) ? (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-600">
                      {alert.acknowledgedAt ? (
                        <CheckCircle2 className="w-3 h-3 text-green-700 shrink-0" />
                      ) : (
                        <Users className="w-3 h-3 text-blue-700 shrink-0" />
                      )}
                      <span>
                        {(alert.type === 'call' || alert.type === 'emergency') && alert.relatedStaffId
                          ? `Responding: ${alert.relatedStaffId}${
                              alert.acknowledgedAt ? ` — responded ${alert.acknowledgedAt}` : ' — not yet responded'
                            }`
                          : `Responding: ${alert.respondingStaff!.join(', ')}`}
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alert Status */}
        <div className="px-3 py-2 border-b border-slate-300 bg-slate-50">
          <h3 className="text-[10px] font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Alert Status</h3>

          {/* Wandering Risk */}
          <div className={`p-1.5 border-l-4 mb-1.5 ${wanderingColors[resident.wanderingRisk].bg} ${wanderingColors[resident.wanderingRisk].border}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <AlertTriangle className={`w-3.5 h-3.5 ${wanderingColors[resident.wanderingRisk].text}`} />
                <span className="text-[10px] font-bold text-slate-800 uppercase">Wandering Risk</span>
              </div>
              <span className={`text-[9px] px-1 py-0.5 font-bold ${wanderingColors[resident.wanderingRisk].text}`}>
                {resident.wanderingRisk.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Emergency Call */}
          <div className={`p-1.5 border-l-4 ${
            resident.emergencyCallActive
              ? 'bg-white border-red-800'
              : 'bg-white border-slate-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Phone className={`w-3.5 h-3.5 ${
                  resident.emergencyCallActive ? 'text-red-800' : 'text-slate-500'
                }`} />
                <span className="text-[10px] font-bold text-slate-800 uppercase">Emergency Call</span>
              </div>
              <span className={`text-[9px] px-1 py-0.5 font-bold ${
                resident.emergencyCallActive
                  ? 'bg-red-800 text-white'
                  : 'text-slate-600'
              }`}>
                {resident.emergencyCallActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          </div>
        </div>

        {/* Language Preference */}
        <div className="px-3 py-2 border-b border-slate-300 bg-white">
          <div className="flex items-center gap-1.5 mb-1">
            <Languages className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Language</span>
          </div>
          <p className="text-sm font-semibold text-slate-900">{resident.language}</p>
        </div>

        {/* Last Staff Visit */}
        <div className="px-3 py-2 border-b border-slate-300 bg-white">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Last Visit</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-900 truncate min-w-0">
              <span className="font-mono font-bold tabular-nums">{resident.lastStaffVisitBy}</span>
              <span className="text-slate-400 mx-1">—</span>
              <span className="font-semibold">{staffNameForId(resident.lastStaffVisitBy)}</span>
            </p>
            <span className="text-xs text-slate-600 font-mono tabular-nums shrink-0">{resident.lastStaffVisit}</span>
          </div>
        </div>

        {/* Assigned Staff */}
        <div className="px-3 py-2 bg-white">
          <h3 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide">Care Team</h3>

          {/* Primary Care */}
          {primaryStaff.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold text-slate-600 uppercase mb-1">Primary</p>
              <div className="space-y-1">
                {primaryStaff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => onStaffClick(staff.id)}
                    className="w-full flex items-center gap-2 p-2 bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-700 transition-colors text-left"
                  >
                    <div className="w-7 h-7 bg-blue-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                      {staff.id.slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-900 truncate">
                        <span className="font-mono font-bold tabular-nums">{staff.id}</span>
                        <span className="text-slate-400 mx-1">—</span>
                        <span className="font-semibold">{staff.name}</span>
                      </p>
                      <p className="text-xs text-slate-600">{staff.role}</p>
                    </div>
                    <svg className="w-3 h-3 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Secondary Care */}
          {otherStaff.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase mb-1">Support Team</p>
              <div className="space-y-1">
                {otherStaff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => onStaffClick(staff.id)}
                    className="w-full flex items-center gap-2 p-2 bg-white hover:bg-slate-50 border-l-4 border-slate-400 transition-colors text-left"
                  >
                    <div className="w-7 h-7 bg-slate-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                      {staff.id.slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-900 truncate">
                        <span className="font-mono font-bold tabular-nums">{staff.id}</span>
                        <span className="text-slate-400 mx-1">—</span>
                        <span className="font-semibold">{staff.name}</span>
                      </p>
                      <p className="text-xs text-slate-600">{staff.role}</p>
                    </div>
                    <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'normal' | 'alert' | 'warning' }) {
  const styles = {
    normal: { bg: 'bg-green-900', text: 'text-white', label: 'OK', size: 'text-[10px] px-1.5 py-0.5', border: 'border-green-950' },
    warning: { bg: 'bg-amber-900', text: 'text-white', label: 'HIGH', size: 'text-xs px-2 py-0.5', border: 'border-amber-950' },
    alert: { bg: 'bg-red-900', text: 'text-white', label: 'CRIT', size: 'text-xs px-2 py-0.5', border: 'border-red-950' },
  };

  const style = styles[status];

  return (
    <span className={`font-bold uppercase tracking-wide border ${style.size} ${style.bg} ${style.text} ${style.border}`}>
      {style.label}
    </span>
  );
}
