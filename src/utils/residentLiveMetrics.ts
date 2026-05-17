import type { ResidentProfileData } from './resolveProfile';

export interface ResidentLiveMetrics {
  steps: number;
  distance: number;
  heartRate: number;
  oxygenSaturation: number;
  temperature: number;
}

interface MapPosition {
  x: number;
  y: number;
}

interface MapPersonForMetrics {
  id: string;
  type: 'resident' | 'staff';
  position: MapPosition;
  isMoving: boolean;
  status: 'normal' | 'alert' | 'warning';
}

/** Map % → approximate metres walked (facility ~80 m across) */
const METRES_PER_MAP_UNIT = 0.85;
const STEPS_PER_METRE = 1.15;
const MIN_DELTA_MAP_UNITS = 1e-9;

function idHash(id: string): number {
  return id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

export function initResidentLiveMetrics(
  residentsData: ResidentProfileData[],
): Record<string, ResidentLiveMetrics> {
  const out: Record<string, ResidentLiveMetrics> = {};
  for (const r of residentsData) {
    out[r.id] = {
      steps: r.steps,
      distance: r.distance,
      heartRate: r.heartRate,
      oxygenSaturation: r.oxygenSaturation,
      temperature: r.temperature,
    };
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function fluctuateVitals(
  metrics: ResidentLiveMetrics,
  residentId: string,
  profile: ResidentProfileData,
  alertStatus: 'normal' | 'alert' | 'warning',
): ResidentLiveMetrics {
  const t = Date.now() / 1000;
  const seed = idHash(residentId);
  const wave = Math.sin(t * 0.9 + seed * 0.17);
  const wave2 = Math.sin(t * 0.55 + seed * 0.31);

  let hrTarget = profile.baselineHeartRate + wave * 2.5 + (Math.random() - 0.5) * 2;
  let spo2Target = profile.oxygenSaturation + wave2 * 0.8 + (Math.random() - 0.5) * 1.2;
  let tempTarget = profile.baselineTemp + wave * 0.06 + (Math.random() - 0.5) * 0.06;

  if (alertStatus === 'warning') {
    hrTarget = profile.heartRate + wave * 2 + (Math.random() - 0.5) * 1.5;
    spo2Target = profile.oxygenSaturation + wave2 * 0.6 + (Math.random() - 0.5);
    tempTarget = profile.temperature + wave * 0.05 + (Math.random() - 0.5) * 0.05;
  } else if (alertStatus === 'alert') {
    hrTarget = profile.heartRate + wave * 1.5 + (Math.random() - 0.5);
    spo2Target = profile.oxygenSaturation + wave2 * 0.5 + (Math.random() - 0.5) * 0.8;
    tempTarget = profile.temperature + wave * 0.04 + (Math.random() - 0.5) * 0.04;
  }

  const heartRate = Math.round(
    metrics.heartRate + (hrTarget - metrics.heartRate) * 0.35,
  );
  const oxygenSaturation = Math.round(
    metrics.oxygenSaturation + (spo2Target - metrics.oxygenSaturation) * 0.3,
  );
  const temperature =
    Math.round(
      (metrics.temperature + (tempTarget - metrics.temperature) * 0.25) * 10,
    ) / 10;

  const hrMin = alertStatus === 'alert' ? 45 : 58;
  const hrMax = alertStatus === 'normal' ? 102 : 135;

  return {
    ...metrics,
    heartRate: clamp(heartRate, hrMin, hrMax),
    oxygenSaturation: clamp(oxygenSaturation, alertStatus === 'alert' ? 88 : 90, 100),
    temperature: clamp(temperature, 35.8, alertStatus === 'alert' ? 38.8 : 37.8),
  };
}

function applyMovementDelta(
  metrics: ResidentLiveMetrics,
  prev: MapPosition | undefined,
  next: MapPosition,
  stepRemainder: Record<string, number>,
  residentId: string,
): ResidentLiveMetrics {
  const from = prev ?? next;
  const delta = Math.hypot(next.x - from.x, next.y - from.y);
  if (delta <= MIN_DELTA_MAP_UNITS) return metrics;

  const metres = delta * METRES_PER_MAP_UNIT;
  const stepAcc = (stepRemainder[residentId] ?? 0) + metres * STEPS_PER_METRE;
  const stepAdd = Math.floor(stepAcc);
  stepRemainder[residentId] = stepAcc - stepAdd;

  const steps = metrics.steps + (stepAdd > 0 ? stepAdd : 1);
  const distance = Math.round((metrics.distance + metres / 1000) * 1000) / 1000;

  return { ...metrics, steps, distance };
}

export function applyResidentDisplayMovement(
  current: Record<string, ResidentLiveMetrics>,
  prevDisplay: Record<string, MapPosition>,
  nextDisplay: Record<string, MapPosition>,
  residentsData: ResidentProfileData[],
  stepRemainder: Record<string, number>,
): Record<string, ResidentLiveMetrics> {
  const profilesById = new Map(residentsData.map((r) => [r.id, r]));
  const next: Record<string, ResidentLiveMetrics> = { ...current };

  for (const [residentId, position] of Object.entries(nextDisplay)) {
    const profile = profilesById.get(residentId);
    if (!profile) continue;

    const base = next[residentId] ?? {
      steps: profile.steps,
      distance: profile.distance,
      heartRate: profile.heartRate,
      oxygenSaturation: profile.oxygenSaturation,
      temperature: profile.temperature,
    };

    next[residentId] = applyMovementDelta(
      base,
      prevDisplay[residentId],
      position,
      stepRemainder,
      residentId,
    );
  }

  return next;
}

export function fluctuateAllResidentVitals(
  current: Record<string, ResidentLiveMetrics>,
  residentsData: ResidentProfileData[],
  alertStatusFor: (residentId: string) => 'normal' | 'alert' | 'warning',
): Record<string, ResidentLiveMetrics> {
  const profilesById = new Map(residentsData.map((r) => [r.id, r]));
  const next: Record<string, ResidentLiveMetrics> = { ...current };

  for (const profile of residentsData) {
    const base = next[profile.id] ?? {
      steps: profile.steps,
      distance: profile.distance,
      heartRate: profile.heartRate,
      oxygenSaturation: profile.oxygenSaturation,
      temperature: profile.temperature,
    };

    next[profile.id] = fluctuateVitals(
      base,
      profile.id,
      profile,
      alertStatusFor(profile.id),
    );
  }

  return next;
}

export function deriveResidentAlertStatus(
  residentId: string,
  mapPeople: MapPersonForMetrics[],
  alerts: { personId: string; severity: string }[],
): 'normal' | 'alert' | 'warning' {
  const live = alerts.filter((a) => a.personId === residentId);
  if (live.some((a) => a.severity === 'critical')) return 'alert';
  if (live.some((a) => a.severity === 'high')) return 'warning';
  const onMap = mapPeople.find((p) => p.id === residentId);
  return onMap?.status ?? 'normal';
}

export function updateResidentLiveMetrics(
  current: Record<string, ResidentLiveMetrics>,
  prevPeople: MapPersonForMetrics[],
  nextPeople: MapPersonForMetrics[],
  residentsData: ResidentProfileData[],
  stepRemainder: Record<string, number>,
  alertStatusFor: (residentId: string) => 'normal' | 'alert' | 'warning',
): Record<string, ResidentLiveMetrics> {
  const profilesById = new Map(residentsData.map((r) => [r.id, r]));
  const prevPos = new Map(prevPeople.map((p) => [p.id, p.position]));
  const next: Record<string, ResidentLiveMetrics> = { ...current };

  for (const person of nextPeople) {
    if (person.type !== 'resident') continue;

    const profile = profilesById.get(person.id);
    if (!profile) continue;

    const base = next[person.id] ?? {
      steps: profile.steps,
      distance: profile.distance,
      heartRate: profile.heartRate,
      oxygenSaturation: profile.oxygenSaturation,
      temperature: profile.temperature,
    };

    const prev = prevPos.get(person.id);
    const withMovement = applyMovementDelta(
      base,
      prev,
      person.position,
      stepRemainder,
      person.id,
    );

    const status = alertStatusFor(person.id);

    next[person.id] = fluctuateVitals(withMovement, person.id, profile, status);
  }

  return next;
}

export function applyLiveMetricsToProfile(
  profile: ResidentProfileData,
  live?: ResidentLiveMetrics,
): ResidentProfileData {
  if (!live) return profile;
  return {
    ...profile,
    steps: live.steps,
    distance: live.distance,
    heartRate: live.heartRate,
    oxygenSaturation: live.oxygenSaturation,
    temperature: live.temperature,
  };
}
