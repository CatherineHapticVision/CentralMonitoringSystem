export interface MapPosition {
  x: number;
  y: number;
}

/**
 * Max map-% per animation frame (~match sim step per 50ms tick).
 * Walls are enforced in simulation only; display eases smoothly toward sim position.
 */
export const MAX_DISPLAY_STEP = { resident: 0.011, staff: 0.011 } as const;

const DISPLAY_SNAP_PCT = 0.008;

export function smoothToward(current: MapPosition, target: MapPosition, maxStep: number): MapPosition {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const d = Math.hypot(dx, dy);
  if (d <= DISPLAY_SNAP_PCT || d <= maxStep) return target;
  return { x: current.x + (dx / d) * maxStep, y: current.y + (dy / d) * maxStep };
}
