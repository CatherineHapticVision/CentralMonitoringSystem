export interface MapPosition {
  x: number;
  y: number;
}

/** Max map-% per animation frame — keep in sync with FloorMap marker smoothing */
export const MAX_DISPLAY_STEP = { resident: 0.055, staff: 0.1 } as const;

export function smoothToward(current: MapPosition, target: MapPosition, maxStep: number): MapPosition {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const d = Math.hypot(dx, dy);
  if (d <= maxStep) return target;
  return { x: current.x + (dx / d) * maxStep, y: current.y + (dy / d) * maxStep };
}
