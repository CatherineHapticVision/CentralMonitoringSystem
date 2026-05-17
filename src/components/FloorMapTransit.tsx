import {
  EAST_CORE,
  FLOOR1_TRANSIT,
  HALL_FILL,
  TRANSIT,
  WEST_CORE,
} from './floorPlanConstants';

function StairsBlock({
  box,
  labelY,
}: {
  box: { x: number; y: number; w: number; h: number };
  labelY?: number;
}) {
  return (
    <>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill={HALL_FILL}
        stroke="#d8cfc0"
        strokeWidth="1.5"
        rx="3"
      />
      <text
        x={box.x + box.w / 2}
        y={labelY ?? box.y + box.h / 2 + 4}
        textAnchor="middle"
        fontSize="9"
        fill="#9a8a78"
        fontWeight="600"
      >
        STAIRS
      </text>
    </>
  );
}

function ElevatorBlock({
  box,
  label,
}: {
  box: { x: number; y: number; w: number; h: number };
  label: string;
}) {
  return (
    <>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill={HALL_FILL}
        stroke="#d8cfc0"
        strokeWidth="1.5"
        rx="3"
      />
      <text
        x={box.x + box.w / 2}
        y={box.y + box.h / 2 + 4}
        textAnchor="middle"
        fontSize="9"
        fill="#9a8a78"
        fontWeight="600"
      >
        {label}
      </text>
    </>
  );
}

/** Elevators & stairs — paired vertical cores at building ends (Ontario LTC pattern) */
export function IndoorTransitLayer({ floor }: { floor?: 1 | 2 | 3 } = {}) {
  const { elevWest, elevEast, westStairs, eastStairs } =
    floor === 1 || floor === 2 || floor === 3 ? FLOOR1_TRANSIT : TRANSIT;

  return (
    <g className="transit-shafts" pointerEvents="none">
      <ElevatorBlock box={elevWest} label="ELEV 1" />
      <ElevatorBlock box={elevEast} label="ELEV 2" />
      <StairsBlock box={westStairs} />
      <StairsBlock box={eastStairs} />
    </g>
  );
}

export { WEST_CORE, EAST_CORE };
