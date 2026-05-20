import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { resolveResidentProfile, resolveStaffProfile } from './utils/resolveProfile';
import { isResidentId, isStaffId } from './utils/personIds';
import { LeftSidebar } from './components/LeftSidebar';
import { TopBar } from './components/TopBar';
import { FloorMap } from './components/FloorMap';
import { AlertsPanel } from './components/AlertsPanel';
import { ResidentProfile } from './components/ResidentProfile';
import { StaffProfile } from './components/StaffProfile';
import { EmergencyCallModal } from './components/EmergencyCallModal';
import { RightPanelShell } from './components/RightPanelShell';
import { generateResidents, generateStaff, generateMapPeople } from './data/facilityData';
import {
  advancePersonPosition,
  createArrivalState,
  getPersonDisplayForFloor,
  getTransitHoldPosition,
  TRANSIT_PROGRESS_PER_TICK,
} from './data/mapNavigation';
import { buildStaffResponseAssignments } from './utils/alertResponseMovement';

const MAP_POSITION_TICK_MS = 50;
import {
  generateAllResidentProfilesWithStaff,
  generateAllStaffProfiles,
} from './data/generateProfiles';

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

interface MapPerson {
  id: string;
  name: string;
  position: { x: number; y: number };
  status: 'normal' | 'alert' | 'warning';
  type: 'resident' | 'staff';
  isMoving: boolean;
  floor: number;
  navFromId?: string;
  navToId?: string;
  navProgress?: number;
  moveTarget?: { x: number; y: number };
  inTransit?: {
    fromFloor: number;
    toFloor: number;
    method: 'elevator' | 'stairs';
    progress: number; // 0-100
  };
  emergencyCall?: {
    status: 'ringing' | 'connected';
    startTime: Date;
  };
}

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

import type { FacilityAlert } from './types/alerts';
import { residentMarkerStatus, syncEmergencyCallAlerts, totalAlertCount } from './types/alerts';
import {
  EMERGENCY_ESCALATION_SECONDS,
  ESCALATED_CALL_MESSAGE,
  isAssignedStaffAcknowledged,
} from './utils/emergencyCall';
import { findMapPersonLocation } from './data/mapLocation';
import { reconcileWanderingAlerts } from './data/wanderingZones';
import { MAX_DISPLAY_STEP, smoothToward } from './utils/mapDisplayMotion';
import {
  applyResidentDisplayMovement,
  deriveResidentAlertStatus,
  fluctuateAllResidentVitals,
  initResidentLiveMetrics,
} from './utils/residentLiveMetrics';
import { hasArrivedAtResponseTarget } from './utils/alertResponseMovement';
import {
  INITIAL_NAV,
  isEmergencyCallNavEntry,
  navEntriesEqual,
  panelEntryFromStack,
  selectionFromNav,
  type NavEntry,
  type PanelNavEntry,
} from './utils/viewNavigation';

const MAP_LOCATE_DURATION_MS = 5000;

export default function App() {
  const [currentFloor, setCurrentFloor] = useState(1);
  const [mapLocateTarget, setMapLocateTarget] = useState<{ personId: string; expiresAt: number } | null>(
    null,
  );
  const [navStack, setNavStack] = useState<NavEntry[]>([INITIAL_NAV]);
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const canGoBack = navStack.length > 1;

  const navigateTo = useCallback((entry: PanelNavEntry) => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      if (top && navEntriesEqual(top, entry)) return prev;
      return [...prev, entry];
    });
  }, []);

  const goBack = useCallback(() => {
    setNavStack((prev) => (prev.length <= 1 ? prev : prev.slice(0, -1)));
  }, []);

  useEffect(() => {
    const top = navStack[navStack.length - 1] ?? INITIAL_NAV;
    const panel = panelEntryFromStack(navStack);
    const { residentId, staffId } = selectionFromNav(panel);
    setSelectedResidentId(residentId);
    setSelectedStaffId(staffId);

    if (isEmergencyCallNavEntry(top)) {
      setEmergencyCalls((calls) =>
        calls.map((call) =>
          call.id === top.callId ? { ...call, dismissed: false } : call,
        ),
      );
    }
  }, [navStack]);

  // System monitoring
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'syncing' | 'error'>('connected');

  // Emergency call system
  const [emergencyCalls, setEmergencyCalls] = useState<EmergencyCall[]>([
    {
      id: 'EC001',
      residentId: 'R001',
      residentName: 'Margaret Chen',
      residentLocation: 'Room 101 (Floor 1)',
      staffId: 'RN01',
      staffName: 'Sarah Thompson',
      startTime: new Date(),
      status: 'ringing',
    },
  ]);

  const [{ residents, staff: seedStaff, initialMapPeople, residentsData, staffData }] = useState(() => {
    const generatedResidents = generateResidents();
    const generatedStaff = generateStaff();
    if (generatedResidents.length !== 124) {
      console.error(`Expected 124 residents, got ${generatedResidents.length}`);
    }
    const profiles = generateAllResidentProfilesWithStaff(generatedResidents, generatedStaff);
    if (profiles.length !== generatedResidents.length) {
      console.error(`Profile count mismatch: ${profiles.length} profiles for ${generatedResidents.length} residents`);
    }
    return {
      residents: generatedResidents,
      staff: generatedStaff,
      initialMapPeople: generateMapPeople(generatedResidents, generatedStaff),
      residentsData: profiles,
      staffData: generateAllStaffProfiles(generatedStaff, generatedResidents),
    };
  });

  const [staff, setStaff] = useState(seedStaff);


  const [alerts, setAlerts] = useState<FacilityAlert[]>([
    {
      id: 'A002',
      type: 'heartrate',
      personId: 'R003',
      personName: 'Dorothy Williams',
      message: 'High heart rate: 125 BPM (baseline: 74 BPM)',
      time: '8 minutes ago',
      severity: 'high',
      floor: 1,
      acknowledgedAt: '7m 12s ago',
      acknowledgedBy: 'RN02',
      respondingStaff: ['RN02'],
    },
    {
      id: 'A004',
      type: 'heartrate',
      personId: 'R014',
      personName: 'Thomas O\'Brien',
      message: 'Low heart rate: 48 BPM sustained below 50 (baseline: 64 BPM)',
      time: '5 minutes ago',
      severity: 'high',
      floor: 2,
      acknowledgedAt: '4m 22s ago',
      acknowledgedBy: 'RN03',
      respondingStaff: ['RN03'],
    },
  ]);

  const [mapPeople, setMapPeople] = useState<MapPerson[]>(initialMapPeople);
  const [liveMetrics, setLiveMetrics] = useState(() => initResidentLiveMetrics(residentsData));
  const stepRemainderRef = useRef<Record<string, number>>({});
  const smoothDisplayRef = useRef<Record<string, { x: number; y: number }>>({});

  const updatePositions = useCallback(() => {
    setMapPeople((prevPeople) => {
      const activeEmergencyCalls = emergencyCalls.filter(
        (c): c is typeof c & { status: 'ringing' | 'connected' | 'escalated' } =>
          c.status === 'ringing' || c.status === 'connected' || c.status === 'escalated',
      );
      const alertsForMovement = syncEmergencyCallAlerts(
        alerts,
        activeEmergencyCalls.map((c) => ({
          residentId: c.residentId,
          residentName: c.residentName,
          residentLocation: c.residentLocation,
          staffId: c.staffId,
          staffName: c.staffName,
          status: c.status,
          startTime: c.startTime,
          acknowledgedAt: c.acknowledgedAt,
          acknowledgedBy: c.acknowledgedBy,
        })),
        prevPeople,
      );
      const responseAssignments = buildStaffResponseAssignments(
        alertsForMovement,
        activeEmergencyCalls,
        prevPeople,
        staff,
        residents,
      );

      setStaff((prev) =>
        prev.map((member) => {
          const assignment = responseAssignments.get(member.id);
          const mapStaff = prevPeople.find((p) => p.id === member.id && p.type === 'staff');
          const atResident =
            Boolean(mapStaff && assignment && hasArrivedAtResponseTarget(mapStaff, assignment));
          return {
            ...member,
            respondingTo: assignment?.residentId,
            isMoving: Boolean(assignment && !atResident),
          };
        }),
      );

      const nextPeople = prevPeople.map((person) => {
        let mapPerson =
          person.type === 'resident'
            ? { ...person, status: residentMarkerStatus(person.id, alertsForMovement) }
            : person;

        const assignment = responseAssignments.get(mapPerson.id);
        const responseTarget = assignment
          ? {
              residentId: assignment.residentId,
              targetFloor: assignment.targetFloor,
              targetWaypointId: assignment.targetWaypointId,
              targetPosition: assignment.targetPosition,
            }
          : undefined;

        if (mapPerson.inTransit) {
          let inTransit = mapPerson.inTransit;
          if (mapPerson.type === 'staff' && assignment && inTransit.toFloor !== assignment.targetFloor) {
            inTransit = { ...inTransit, toFloor: assignment.targetFloor };
          }

          const { fromFloor, toFloor, method } = inTransit;
          const holdPos = getTransitHoldPosition(fromFloor, mapPerson.id, method);
          const newProgress = inTransit.progress + TRANSIT_PROGRESS_PER_TICK;

          if (newProgress >= 100) {
            const arrival = createArrivalState(toFloor, method, mapPerson.id);

            return {
              ...mapPerson,
              floor: toFloor,
              position: arrival.position,
              navFromId: arrival.navFromId,
              navToId: arrival.navToId,
              navProgress: arrival.navProgress,
              inTransit: undefined,
              isMoving: true,
            };
          }

          return {
            ...mapPerson,
            position: holdPos,
            inTransit: { ...inTransit, progress: newProgress },
            isMoving: true,
          };
        }

        if (mapPerson.emergencyCall) return mapPerson;
        if (
          mapPerson.type === 'resident' &&
          (mapPerson.status === 'alert' || mapPerson.status === 'warning')
        ) {
          return mapPerson;
        }

        if (mapPerson.type === 'staff' && assignment) {
          if (hasArrivedAtResponseTarget(mapPerson, assignment)) {
            return {
              ...mapPerson,
              isMoving: false,
              moveTarget: undefined,
            };
          }
          return advancePersonPosition(
            { ...mapPerson, isMoving: true },
            { responseTarget },
          );
        }

        return advancePersonPosition(mapPerson, { responseTarget });
      });

      setLiveMetrics((current) =>
        fluctuateAllResidentVitals(
          current,
          residentsData,
          (residentId) => deriveResidentAlertStatus(residentId, nextPeople, alerts),
        ),
      );

      return nextPeople;
    });
    setLastUpdate(new Date());
  }, [residentsData, alerts, emergencyCalls, staff, residents]);

  useEffect(() => {
    setAlerts((prev) => {
      const withWandering = reconcileWanderingAlerts(prev, mapPeople, residents, staff);
      const withCalls = syncEmergencyCallAlerts(
        withWandering,
        emergencyCalls.map((c) => ({
          residentId: c.residentId,
          residentName: c.residentName,
          residentLocation: c.residentLocation,
          staffId: c.staffId,
          staffName: c.staffName,
          status: c.status === 'unanswered' ? 'ringing' : c.status,
          startTime: c.startTime,
          acknowledgedAt: c.acknowledgedAt,
          acknowledgedBy: c.acknowledgedBy,
        })),
        mapPeople,
      );
      return withCalls.map((alert) => {
        const onMap = mapPeople.find((p) => p.id === alert.personId && p.type === 'resident');
        if (!onMap) return alert;
        const location = findMapPersonLocation(alert.personId, mapPeople) ?? alert.location;
        if (onMap.floor === alert.floor && location === alert.location) return alert;
        return { ...alert, floor: onMap.floor, location };
      });
    });
  }, [mapPeople, residents, emergencyCalls]);

  useEffect(() => {
    setEmergencyCalls((calls) => {
      let changed = false;
      const next = calls.map((call) => {
        const location = findMapPersonLocation(call.residentId, mapPeople);
        if (!location || location === call.residentLocation) return call;
        changed = true;
        return { ...call, residentLocation: location };
      });
      return changed ? next : calls;
    });
  }, [mapPeople]);

  // Keep all floor positions current even when viewing another floor
  useEffect(() => {
    const interval = setInterval(() => {
      updatePositions();
    }, MAP_POSITION_TICK_MS);
    return () => clearInterval(interval);
  }, [updatePositions]);

  // Steps & distance follow smoothed marker positions (every animation frame)
  useEffect(() => {
    let frameId = 0;
    const animate = () => {
      const prevDisplay = { ...smoothDisplayRef.current };
      const nextDisplay: Record<string, { x: number; y: number }> = {};

      for (const person of mapPeople) {
        if (person.type !== 'resident') continue;
        const target = person.position;
        const current = prevDisplay[person.id] ?? target;
        nextDisplay[person.id] = smoothToward(current, target, MAX_DISPLAY_STEP.resident);
      }

      smoothDisplayRef.current = nextDisplay;

      setLiveMetrics((current) =>
        applyResidentDisplayMovement(
          current,
          prevDisplay,
          nextDisplay,
          residentsData,
          stepRemainderRef.current,
        ),
      );

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [mapPeople, residentsData, alerts]);

  // Brief "syncing" pulse every 5s without blocking movement
  useEffect(() => {
    const pulse = setInterval(() => {
      setConnectionStatus('syncing');
      setTimeout(() => setConnectionStatus('connected'), 200);
    }, 5000);
    return () => clearInterval(pulse);
  }, []);

  const handleResidentClick = useCallback(
    (residentId: string) => {
      navigateTo({ view: 'resident', id: residentId });
    },
    [navigateTo],
  );

  const handleStaffClick = useCallback(
    (staffId: string) => {
      navigateTo({ view: 'staff', id: staffId });
    },
    [navigateTo],
  );

  const handleClosePanel = useCallback(() => {
    navigateTo({ view: 'alerts' });
  }, [navigateTo]);

  const handlePersonClick = (personId: string) => {
    const onMap = mapPeople.find((p) => p.id === personId);
    if (onMap?.type === 'staff' || isStaffId(personId)) {
      handleStaffClick(personId);
    } else if (onMap?.type === 'resident' || isResidentId(personId)) {
      handleResidentClick(personId);
    }
  };

  const handleLocateOnMap = useCallback((personId: string, floor: number) => {
    setCurrentFloor(floor);
    setMapLocateTarget({ personId, expiresAt: Date.now() + MAP_LOCATE_DURATION_MS });
  }, []);

  useEffect(() => {
    if (!mapLocateTarget) return;
    const remaining = mapLocateTarget.expiresAt - Date.now();
    const timeoutId = window.setTimeout(() => setMapLocateTarget(null), Math.max(0, remaining));
    return () => clearTimeout(timeoutId);
  }, [mapLocateTarget]);

  const selectedResident = useMemo(
    () =>
      selectedResidentId
        ? resolveResidentProfile(
            selectedResidentId,
            residentsData,
            residents,
            mapPeople,
            alerts,
            liveMetrics,
          )
        : null,
    [selectedResidentId, residentsData, residents, mapPeople, alerts, liveMetrics],
  );

  const selectedStaff = useMemo(
    () =>
      selectedStaffId
        ? resolveStaffProfile(selectedStaffId, staffData, staff, alerts, mapPeople)
        : null,
    [selectedStaffId, staffData, staff, alerts, mapPeople],
  );

  const handleDismissCall = useCallback((callId: string) => {
    setNavStack((prev) => {
      const panel = panelEntryFromStack(prev);
      return [...prev, { view: 'emergencyCall', callId }, panel];
    });
    setEmergencyCalls((calls) =>
      calls.map((call) => (call.id === callId ? { ...call, dismissed: true } : call)),
    );
  }, []);

  const handleEndCall = useCallback((callId: string) => {
    setEmergencyCalls((calls) => {
      const ended = calls.find((c) => c.id === callId);
      if (ended) {
        setMapPeople((people) =>
          people.map((person) =>
            person.id === ended.residentId && person.emergencyCall
              ? { ...person, emergencyCall: undefined }
              : person,
          ),
        );
      }
      return calls.filter((call) => call.id !== callId);
    });
  }, []);

  const handleEscalate = useCallback((callId: string) => {
    setEmergencyCalls((calls) => {
      const target = calls.find((c) => c.id === callId);
      if (
        !target ||
        target.status !== 'ringing' ||
        isAssignedStaffAcknowledged(target, target.staffId)
      ) {
        return calls;
      }

      setAlerts((alerts) =>
        alerts.map((alert) => {
          if (alert.type !== 'call' || alert.personId !== target.residentId) return alert;
          if (
            alert.relatedStaffId &&
            alert.acknowledgedBy === alert.relatedStaffId &&
            alert.acknowledgedAt
          ) {
            return alert;
          }
          return {
            ...alert,
            callStatus: 'escalated' as const,
            severity: 'critical' as const,
            message: ESCALATED_CALL_MESSAGE,
          };
        }),
      );

      return calls.map((call) =>
        call.id === callId
          ? { ...call, status: 'escalated' as const, escalationTime: new Date() }
          : call,
      );
    });
  }, []);

  // Escalate each ringing call exactly EMERGENCY_ESCALATION_SECONDS after startTime
  const escalationTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = escalationTimersRef.current;
    const ringingIds = new Set<string>();

    for (const call of emergencyCalls) {
      if (call.status !== 'ringing' || isAssignedStaffAcknowledged(call, call.staffId)) {
        continue;
      }
      ringingIds.add(call.id);

      if (timers.has(call.id)) continue;

      const delayMs = Math.max(
        0,
        EMERGENCY_ESCALATION_SECONDS * 1000 - (Date.now() - call.startTime.getTime()),
      );
      const timerId = window.setTimeout(() => {
        timers.delete(call.id);
        handleEscalate(call.id);
      }, delayMs);
      timers.set(call.id, timerId);
    }

    for (const [callId, timerId] of timers) {
      if (!ringingIds.has(callId)) {
        clearTimeout(timerId);
        timers.delete(callId);
      }
    }
  }, [emergencyCalls, handleEscalate]);

  useEffect(() => () => escalationTimersRef.current.forEach(clearTimeout), []);

  return (
    <div className="size-full flex flex-col bg-slate-300" lang="en">
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Emergency Call Modals */}
      <EmergencyCallModal
        calls={emergencyCalls}
        onDismiss={handleDismissCall}
        onEndCall={handleEndCall}
        onEscalate={handleEscalate}
        onResidentClick={handleResidentClick}
        onStaffClick={handleStaffClick}
      />

      <TopBar
        currentFloor={currentFloor}
        onFloorChange={setCurrentFloor}
        alertCount={totalAlertCount(alerts)}
        lastUpdate={lastUpdate}
        connectionStatus={connectionStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar
          residents={residents}
          staff={staff}
          onResidentClick={handleResidentClick}
          onStaffClick={handleStaffClick}
          currentFloor={currentFloor}
          searchQuery={searchQuery}
          alerts={alerts}
        />

        <main id="main-content" className="flex-1 p-3 relative" role="main" aria-label="Floor map view">
          <FloorMap
            floor={currentFloor}
            alerts={alerts}
            locatePersonId={mapLocateTarget?.personId ?? null}
            people={mapPeople
              .filter(
                (person) =>
                  person.floor === currentFloor ||
                  (person.inTransit &&
                    (person.inTransit.fromFloor === currentFloor ||
                      person.inTransit.toFloor === currentFloor)),
              )
              .map((person) => getPersonDisplayForFloor(person, currentFloor))}
            onPersonClick={handlePersonClick}
            searchQuery={searchQuery}
          />
        </main>

        <RightPanelShell canGoBack={canGoBack} onBack={goBack}>
          {selectedResidentId ? (
            <ResidentProfile
              resident={selectedResident}
              onClose={handleClosePanel}
              onStaffClick={handleStaffClick}
            />
          ) : selectedStaffId ? (
            <StaffProfile
              staff={selectedStaff}
              onClose={handleClosePanel}
              onResidentClick={handleResidentClick}
              onStaffClick={handleStaffClick}
            />
          ) : (
            <AlertsPanel
              alerts={alerts}
              currentFloor={currentFloor}
              onLocateOnMap={handleLocateOnMap}
              onResidentClick={handleResidentClick}
              onStaffClick={handleStaffClick}
              mapPeople={mapPeople}
              residents={residents}
              staff={staff}
            />
          )}
        </RightPanelShell>
      </div>
    </div>
  );
}
