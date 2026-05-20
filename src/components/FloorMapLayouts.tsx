// Ontario LTC floor plans — double-loaded corridors, central services, end elevators
import {
  BUILDING,
  EAST_CORE,
  HALL_FILL,
  RESIDENTIAL_WING,
  FLOOR3_WING,
  WEST_CORE,
} from './floorPlanConstants';
import { getRoomsForFloor, ROOM_TYPE_STYLES, type RoomType } from '../data/roomInventory';
import { IndoorTransitLayer } from './FloorMapTransit';

const STROKE = '#8a7a60';
const WALL_STROKE = 2;
const DOOR_WIDTH = 34;
const BUILDING_SHELL = { left: 220, top: 80, right: 980, bottom: 720 } as const;

type DoorSpec = { side: 'north' | 'south' | 'east' | 'west'; offset: number; size: number };

function clampDoorOnSide(door: DoorSpec, roomW: number, roomH: number): DoorSpec {
  const span = door.side === 'north' || door.side === 'south' ? roomW : roomH;
  const size = Math.min(door.size, span - 8);
  const offset = Math.max(4, Math.min(door.offset, span - size - 4));
  return { ...door, size, offset };
}

function renderWallWithGaps(
  x: number,
  y: number,
  w: number,
  h: number,
  doors: DoorSpec[],
  wall: (x1: number, y1: number, x2: number, y2: number) => React.ReactNode,
) {
  const gaps = doors.map((d) => clampDoorOnSide(d, w, h));
  const gapOn = (side: DoorSpec['side']) => gaps.filter((d) => d.side === side);

  const renderSide = (
    side: DoorSpec['side'],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    const sideGaps = gapOn(side);
    if (sideGaps.length === 0) {
      return wall(x1, y1, x2, y2);
    }
    const horizontal = side === 'north' || side === 'south';
    const segments: React.ReactNode[] = [];
    let cursor = horizontal ? x1 : y1;
    const end = horizontal ? x2 : y2;
    for (const gap of sideGaps) {
      const gapStart = horizontal ? x + gap.offset : y + gap.offset;
      const gapEnd = gapStart + gap.size;
      if (cursor < gapStart) {
        segments.push(
          wall(
            horizontal ? cursor : x1,
            horizontal ? y1 : cursor,
            horizontal ? gapStart : x2,
            horizontal ? y2 : gapStart,
          ),
        );
      }
      cursor = gapEnd;
    }
    if (cursor < end) {
      segments.push(
        wall(
          horizontal ? cursor : x1,
          horizontal ? y1 : cursor,
          horizontal ? end : x2,
          horizontal ? y2 : end,
        ),
      );
    }
    return <>{segments}</>;
  };

  return (
    <>
      {renderSide('north', x, y, x + w, y)}
      {renderSide('south', x, y + h, x + w, y + h)}
      {renderSide('west', x, y, x, y + h)}
      {renderSide('east', x + w, y, x + w, y + h)}
    </>
  );
}

interface RoomProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  door: 'north' | 'south' | 'east' | 'west';
  roomType?: RoomType;
}

function Room({ x, y, w, h, label, door, roomType = 'semi-private' }: RoomProps) {
  const typeStyle = ROOM_TYPE_STYLES[roomType];
  const doorW = Math.min(DOOR_WIDTH, w - 10);
  const doorLeft = x + (w - doorW) / 2;
  const doorRight = doorLeft + doorW;

  const wall = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE} strokeWidth={WALL_STROKE} strokeLinecap="square" />
  );

  return (
    <g className="resident-room">
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={typeStyle.fill}
        stroke="none"
      />
      {/* Walls with doorway gap — no corridor fill into the room */}
      {door === 'north' ? (
        <>
          {wall(x, y, doorLeft, y)}
          {wall(doorRight, y, x + w, y)}
        </>
      ) : (
        wall(x, y, x + w, y)
      )}
      {door === 'south' ? (
        <>
          {wall(x, y + h, doorLeft, y + h)}
          {wall(doorRight, y + h, x + w, y + h)}
        </>
      ) : (
        wall(x, y + h, x + w, y + h)
      )}
      {door === 'west' ? (
        <>
          {wall(x, y, x, doorLeft)}
          {wall(x, doorRight, x, y + h)}
        </>
      ) : (
        wall(x, y, x, y + h)
      )}
      {door === 'east' ? (
        <>
          {wall(x + w, y, x + w, doorLeft)}
          {wall(x + w, doorRight, x + w, y + h)}
        </>
      ) : (
        wall(x + w, y, x + w, y + h)
      )}
      <text x={x + w / 2} y={y + h / 2 - 2} textAnchor="middle" fontSize="8" fill="#5a4a38" fontWeight="600">
        {label}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 9} textAnchor="middle" fontSize="6" fill="#6a5a48" opacity="0.9">
        {typeStyle.shortLabel}
      </text>
    </g>
  );
}

/** Public / clinical space — walled with doorway gaps (no corridor fill into the room) */
function PublicSpace({
  x,
  y,
  w,
  h,
  label,
  doors,
  fill = '#fff8f0',
  labelFontWeight = 600,
  labelFontSize = 10,
  subtitle,
  subtitleFontSize = 7,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  doors: DoorSpec[];
  fill?: string;
  labelFontWeight?: number | string;
  labelFontSize?: number;
  subtitle?: string;
  subtitleFontSize?: number;
}) {
  const wall = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE} strokeWidth={WALL_STROKE} strokeLinecap="square" />
  );

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke="none" />
      {renderWallWithGaps(x, y, w, h, doors, wall)}
      <text
        x={x + w / 2}
        y={y + h / 2 + (subtitle ? -2 : 3)}
        textAnchor="middle"
        fontSize={labelFontSize}
        fill="#6a5a48"
        fontWeight={labelFontWeight}
      >
        {label}
      </text>
      {subtitle && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 12}
          textAnchor="middle"
          fontSize={subtitleFontSize}
          fill="#8b5a5a"
          fontWeight="600"
          opacity={0.9}
        >
          {subtitle}
        </text>
      )}
    </g>
  );
}

/** Enclosed program area with dashed outline and wall-thickness door gaps */
function ProgramArea({
  x,
  y,
  w,
  h,
  label,
  fill,
  doors,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  fill: string;
  doors?: DoorSpec[];
}) {
  const wall = (x1: number, y1: number, x2: number, y2: number) => (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={STROKE}
      strokeWidth={WALL_STROKE}
      strokeLinecap="square"
      strokeDasharray="4,2"
    />
  );

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke="none" />
      {renderWallWithGaps(x, y, w, h, doors ?? [], wall)}
      <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" fontSize="9" fill="#6a5a48" fontWeight="600">
        {label}
      </text>
    </g>
  );
}

/** North facade entrance aligned with reception */
function MainBuildingEntrance({ receptionX, receptionW }: { receptionX: number; receptionW: number }) {
  const doorW = 80;
  const doorLeft = receptionX + (receptionW - doorW) / 2;
  const doorRight = doorLeft + doorW;
  const { left, top, right } = BUILDING_SHELL;

  return (
    <g className="main-entrance" pointerEvents="none">
      <rect x={doorLeft} y={top - 2} width={doorW} height={6} fill="#f5f0e8" />
      <line x1={left} y1={top} x2={doorLeft} y2={top} stroke="#b8a990" strokeWidth="3" />
      <line x1={doorRight} y1={top} x2={right} y2={top} stroke="#b8a990" strokeWidth="3" />
      <line x1={doorLeft} y1={top} x2={doorLeft} y2={top + 28} stroke={STROKE} strokeWidth={WALL_STROKE} />
      <line x1={doorRight} y1={top} x2={doorRight} y2={top + 28} stroke={STROKE} strokeWidth={WALL_STROKE} />
      <text x={(doorLeft + doorRight) / 2} y={top + 18} textAnchor="middle" fontSize="7" fill="#5a4a38" fontWeight="700">
        MAIN ENTRANCE
      </text>
    </g>
  );
}

/** Floor 1 — Public level: lobby, dining, 4 resident rooms (admission / respite) */
export function Floor1Layout() {
  return (
    <>
      <g className="hallways">
        {/* East–west spine (west + east segments; elevators connect at alcoves only) */}
        <rect x={268} y={362} width={412} height={52} fill={HALL_FILL} stroke="none" />
        <rect x={680} y={362} width={252} height={52} fill={HALL_FILL} stroke="none" />
        {/* West + east vertical cores — aligned with floors 2–3 */}
        <rect
          x={WEST_CORE.stairShaft.x}
          y={WEST_CORE.stairShaft.y}
          width={WEST_CORE.stairShaft.w}
          height={WEST_CORE.stairShaft.h}
          fill={HALL_FILL}
          stroke="none"
        />
        <rect
          x={EAST_CORE.stairShaft.x}
          y={EAST_CORE.stairShaft.y}
          width={EAST_CORE.stairShaft.w}
          height={EAST_CORE.stairShaft.h}
          fill={HALL_FILL}
          stroke="none"
        />
        <rect x={268} y={250} width={204} height={118} fill={HALL_FILL} stroke="none" />
        <rect x={268} y={250} width={52} height={334} fill={HALL_FILL} stroke="none" />
        <rect x={700} y={262} width={82} height={110} fill={HALL_FILL} stroke="none" />
        <rect x={708} y={424} width={56} height={146} fill={HALL_FILL} stroke="none" />
      </g>

      <g className="public-areas">
        <PublicSpace
          x={268}
          y={108}
          w={200}
          h={142}
          label="Reception"
          doors={[
            { side: 'north', offset: 60, size: 80 },
            { side: 'south', offset: 68, size: 64 },
            { side: 'west', offset: 46, size: 48 },
          ]}
        />
        <PublicSpace
          x={520}
          y={108}
          w={180}
          h={142}
          label="Dining Hall"
          doors={[{ side: 'south', offset: 68, size: 44 }]}
        />
        <PublicSpace
          x={708}
          y={108}
          w={200}
          h={142}
          label="Nurse Station"
          doors={[{ side: 'south', offset: 64, size: 72 }]}
        />
        <PublicSpace
          x={708}
          y={288}
          w={200}
          h={108}
          label="Physiotherapy"
          doors={[
            { side: 'west', offset: 36, size: 36 },
            { side: 'east', offset: 36, size: 36 },
          ]}
        />
        <PublicSpace
          x={708}
          y={428}
          w={200}
          h={252}
          label="Recreation"
          doors={[
            { side: 'west', offset: 108, size: 36 },
            { side: 'east', offset: 108, size: 36 },
          ]}
        />
      </g>

      <MainBuildingEntrance receptionX={268} receptionW={200} />

      <g className="resident-rooms">
        <Room
          x={268}
          y={568}
          w={100}
          h={118}
          label="101"
          door="north"
          roomType="private"
        />
        <Room
          x={388}
          y={568}
          w={100}
          h={118}
          label="102"
          door="north"
          roomType="private"
        />
        <Room
          x={548}
          y={448}
          w={118}
          h={118}
          label="103"
          door="north"
          roomType="private"
        />
        <Room
          x={548}
          y={578}
          w={118}
          h={108}
          label="104"
          door="west"
          roomType="private"
        />
      </g>

      <IndoorTransitLayer floor={1} />
    </>
  );
}

/** Floor 2 — Main residential: double-loaded corridors (10 rooms per wing shown) */
export function Floor2Layout() {
  const { roomW, step, northY, northH, southY, southH } = RESIDENTIAL_WING;

  return (
    <>
      <g className="hallways">
        <rect x={268} y={252} width={644} height={34} fill={HALL_FILL} stroke="none" />
        <rect x={268} y={506} width={644} height={34} fill={HALL_FILL} stroke="none" />
        <rect
          x={WEST_CORE.stairShaft.x}
          y={WEST_CORE.stairShaft.y}
          width={WEST_CORE.stairShaft.w}
          height={WEST_CORE.stairShaft.h}
          fill={HALL_FILL}
          stroke="none"
        />
        <rect
          x={EAST_CORE.stairShaft.x}
          y={EAST_CORE.stairShaft.y}
          width={EAST_CORE.stairShaft.w}
          height={EAST_CORE.stairShaft.h}
          fill={HALL_FILL}
          stroke="none"
        />
        <rect x={782} y={286} width={34} height={220} fill={HALL_FILL} stroke="none" />
        <rect x={298} y={286} width={34} height={220} fill={HALL_FILL} stroke="none" />
      </g>

      <g className="clinical-center">
        <PublicSpace
          x={348}
          y={292}
          w={108}
          h={110}
          label="Med Room"
          doors={[
            { side: 'north', offset: 41, size: 26 },
            { side: 'south', offset: 41, size: 26 },
          ]}
        />
        <PublicSpace
          x={468}
          y={292}
          w={148}
          h={110}
          label="Nurse Station"
          doors={[
            { side: 'north', offset: 60, size: 26 },
            { side: 'south', offset: 60, size: 26 },
          ]}
        />
        <PublicSpace
          x={628}
          y={292}
          w={96}
          h={110}
          label="Staff"
          fill="#f8f8f0"
          labelFontWeight="bold"
          labelFontSize={9}
          doors={[
            { side: 'north', offset: 35, size: 26 },
            { side: 'south', offset: 35, size: 26 },
          ]}
        />
        <PublicSpace
          x={836}
          y={292}
          w={52}
          h={110}
          label="Clean"
          fill="#f0f0e8"
          labelFontWeight="bold"
          labelFontSize={9}
          doors={[{ side: 'north', offset: 13, size: 26 }]}
        />
        <PublicSpace
          x={898}
          y={292}
          w={52}
          h={110}
          label="Soiled"
          fill="#f0f0e8"
          labelFontWeight="bold"
          labelFontSize={9}
          doors={[{ side: 'north', offset: 13, size: 26 }]}
        />
      </g>

      <g className="north-wing">
        {getRoomsForFloor(2)
          .filter((r) => r.wing === 'north')
          .map((room, i) => (
            <Room
              key={room.number}
              x={268 + i * step}
              y={northY}
              w={roomW}
              h={northH}
              label={String(room.number)}
              door="south"
              roomType={room.type}
            />
          ))}
      </g>

      <g className="south-wing">
        {getRoomsForFloor(2)
          .filter((r) => r.wing === 'south')
          .map((room, i) => (
            <Room
              key={room.number}
              x={268 + i * step}
              y={southY}
              w={roomW}
              h={southH}
              label={String(room.number)}
              door="north"
              roomType={room.type}
            />
          ))}
      </g>

      <IndoorTransitLayer floor={2} />
    </>
  );
}

/** Floor 3 — Memory care: racetrack corridor, rooms inside building envelope */
export function Floor3Layout() {
  const { roomW, step, startX, northY, northH, southY, southH } = FLOOR3_WING;

  return (
    <>
      <g className="hallways">
        <rect x={268} y={252} width={428} height={28} fill={HALL_FILL} stroke="none" />
        <rect x={268} y={378} width={428} height={40} fill={HALL_FILL} stroke="none" />
        <rect x={268} y={280} width={36} height={98} fill={HALL_FILL} stroke="none" />
        <rect x={660} y={280} width={36} height={98} fill={HALL_FILL} stroke="none" />
        <rect x={308} y={536} width={348} height={28} fill={HALL_FILL} stroke="none" />
        <rect
          x={WEST_CORE.stairShaft.x}
          y={WEST_CORE.stairShaft.y}
          width={WEST_CORE.stairShaft.w}
          height={WEST_CORE.stairShaft.h}
          fill={HALL_FILL}
          stroke="none"
        />
        <rect
          x={EAST_CORE.stairShaft.x}
          y={EAST_CORE.stairShaft.y}
          width={EAST_CORE.stairShaft.w}
          height={EAST_CORE.stairShaft.h}
          fill={HALL_FILL}
          stroke="none"
        />
      </g>

      <g className="memory-care-station">
        <PublicSpace
          x={508}
          y={272}
          w={164}
          h={78}
          label="Memory Care Station"
          subtitle="SECURED UNIT"
          doors={[{ side: 'south', offset: 64, size: 36 }]}
        />
      </g>

      <g className="safe-wandering">
        <ProgramArea
          x={428}
          y={428}
          w={148}
          h={96}
          fill="#f5f8f0"
          label="Safe Wandering Area"
          doors={[
            { side: 'north', offset: 56, size: 36 },
            { side: 'south', offset: 56, size: 36 },
          ]}
        />
      </g>

      <g className="west-wing">
        {getRoomsForFloor(3)
          .filter((r) => r.wing === 'north')
          .map((room, i) => (
            <Room
              key={room.number}
              x={startX + i * step}
              y={northY}
              w={roomW}
              h={northH}
              label={String(room.number)}
              door="south"
              roomType={room.type}
            />
          ))}
        {getRoomsForFloor(3)
          .filter((r) => r.wing === 'south')
          .map((room, i) => (
            <Room
              key={room.number}
              x={startX + i * step}
              y={southY}
              w={roomW}
              h={southH}
              label={String(room.number)}
              door="north"
              roomType={room.type}
            />
          ))}
      </g>

      <IndoorTransitLayer floor={3} />
    </>
  );
}

export function OutdoorGroundsLayout() {
  return (
    <>
      <rect x="0" y="0" width="1200" height="800" fill="#c8dac0" opacity="0.9" />

      <rect
        x={BUILDING.left - 20}
        y={BUILDING.top - 20}
        width={BUILDING.width + 40}
        height={BUILDING.height + 40}
        fill="#e8e4dc"
        stroke="#9a9080"
        strokeWidth="4"
        opacity="0.6"
      />
      <text x="600" y="400" textAnchor="middle" fontSize="48" fill="#9a9080" opacity="0.2" fontWeight="600">
        BUILDING
      </text>

      <g className="entrances">
        <rect x="560" y="718" width="80" height="20" fill="#7a9070" stroke="#5a6850" strokeWidth="2" />
        <text x="600" y="733" textAnchor="middle" fontSize="10" fill="#f5f0e8" fontWeight="600">
          ENTRANCE
        </text>
        <rect x="978" y="380" width="20" height="80" fill="#7a9070" stroke="#5a6850" strokeWidth="2" />
        <rect x="202" y="380" width="20" height="80" fill="#7a9070" stroke="#5a6850" strokeWidth="2" />
      </g>

      <g className="perimeter-fence">
        <rect
          x="40"
          y="40"
          width="1120"
          height="720"
          fill="none"
          stroke="#8a7a60"
          strokeWidth="3"
          strokeDasharray="8,4"
          opacity="0.8"
        />
      </g>

      <g className="gardens">
        <ellipse cx="300" cy="200" rx="110" ry="70" fill="#a8c99a" opacity="0.7" />
        <text x="300" y="175" textAnchor="middle" fontSize="11" fill="#5a6850" fontWeight="600">
          Therapy Garden
        </text>
        <ellipse cx="900" cy="600" rx="120" ry="80" fill="#a8c99a" opacity="0.7" />
        <text x="900" y="570" textAnchor="middle" fontSize="11" fill="#5a6850" fontWeight="600">
          Garden
        </text>
        <ellipse cx="1050" cy="400" rx="90" ry="120" fill="#a8c99a" opacity="0.6" />
        <ellipse cx="150" cy="400" rx="90" ry="120" fill="#a8c99a" opacity="0.6" />
      </g>

      <circle cx="600" cy="180" r="35" fill="#e8dcc8" stroke="#9a9080" strokeWidth="2" opacity="0.8" />
      <text x="600" y="185" textAnchor="middle" fontSize="9" fill="#6a5a48" fontWeight="600">
        Gazebo
      </text>

      <g className="outdoor-label">
        <text x="600" y="30" textAnchor="middle" fontSize="13" fill="#5a6850" fontWeight="600">
          OUTDOOR GROUNDS
        </text>
        <text x={600} y={58} textAnchor="middle" fontSize="9" fill="#7a8070" opacity="0.8">
          Monitored Outdoor Property
        </text>
      </g>
    </>
  );
}
