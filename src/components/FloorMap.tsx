import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { Floor1Layout, Floor2Layout, Floor3Layout, OutdoorGroundsLayout } from './FloorMapLayouts';
import { useProfilePhotos } from '../context/ProfilePhotoContext';
import { useLoadedMarkerPhotos } from '../hooks/useLoadedMarkerPhotos';
import type { FacilityAlert } from '../types/alerts';
import { residentMarkerStatus } from '../types/alerts';
import { MAX_DISPLAY_STEP, smoothToward, type MapPosition } from '../utils/mapDisplayMotion';

type Position = MapPosition;

interface MapPerson {
  id: string;
  name: string;
  position: Position;
  status: 'normal' | 'alert' | 'warning';
  type: 'resident' | 'staff';
  isMoving: boolean;
  floor: number;
  navFromId?: string;
  navToId?: string;
  navProgress?: number;
  inTransit?: {
    fromFloor: number;
    toFloor: number;
    method: 'elevator' | 'stairs';
    progress: number;
  };
  emergencyCall?: {
    status: 'ringing' | 'connected';
    startTime: Date;
  };
}

interface FloorMapProps {
  floor: number;
  people: MapPerson[];
  alerts: FacilityAlert[];
  onPersonClick: (personId: string) => void;
  searchQuery?: string;
  locatePersonId?: string | null;
}

/** Draw order: normal residents under alert/warning and staff so critical markers stay visible */
function markerDrawOrder(
  person: MapPerson,
  alerts: FacilityAlert[],
  searchQuery: string,
): number {
  const matchesSearch =
    searchQuery.trim() !== '' &&
    (person.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      person.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (matchesSearch) return 5;
  if (person.emergencyCall) return 4;
  if (person.type === 'resident') {
    const status = residentMarkerStatus(person.id, alerts);
    if (status === 'alert') return 3;
    if (status === 'warning') return 2;
  }
  if (person.type === 'staff') return 1;
  return 0;
}

/** Ripple rings only for residents with active alerts (legend warning / critical) */
function getMarkerWaveSpec(
  person: MapPerson,
  displayStatus: 'normal' | 'alert' | 'warning',
): { stroke: string; layers: number; durationSec: number } | null {
  if (person.emergencyCall) {
    return { stroke: '#fca5a5', layers: 3, durationSec: 2 };
  }
  if (displayStatus === 'alert') {
    return { stroke: '#fca5a5', layers: 3, durationSec: 2 };
  }
  if (displayStatus === 'warning') {
    return { stroke: '#fcd34d', layers: 3, durationSec: 2.4 };
  }
  return null;
}

function MarkerWaves({
  stroke,
  layers,
  durationSec,
  personId,
}: {
  stroke: string;
  layers: number;
  durationSec: number;
  personId: string;
}) {
  const stagger = durationSec / layers;

  return (
    <g pointerEvents="none" aria-hidden>
      {Array.from({ length: layers }, (_, i) => (
        <circle
          key={`${personId}-wave-${i}`}
          r={10}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          className="map-marker-wave"
          style={{
            animationDuration: `${durationSec}s`,
            animationDelay: `${stagger * i}s`,
          }}
        />
      ))}
    </g>
  );
}

export function FloorMap({
  floor,
  people,
  alerts,
  onPersonClick,
  searchQuery = '',
  locatePersonId = null,
}: FloorMapProps) {
  const { getPhotoUrl } = useProfilePhotos();
  const loadedMarkerPhotos = useLoadedMarkerPhotos(people, getPhotoUrl);
  const [, setTick] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1200, height: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [smoothPositions, setSmoothPositions] = useState<Record<string, Position>>({});
  const smoothRef = useRef<Record<string, Position>>({});
  const peopleRef = useRef(people);
  peopleRef.current = people;
  const viewFloorRef = useRef<number | null>(null);

  function snapDisplayedPositions(list: MapPerson[]) {
    const next: Record<string, Position> = {};
    for (const person of list) {
      next[person.id] = { x: person.position.x, y: person.position.y };
    }
    smoothRef.current = next;
    setSmoothPositions(next);
  }

  // When switching floors, show everyone at their live position immediately
  useLayoutEffect(() => {
    if (viewFloorRef.current !== floor) {
      viewFloorRef.current = floor;
      snapDisplayedPositions(people);
    }
  }, [floor, people]);

  // One continuous rAF loop — do not restart when `people` updates every sim tick
  useEffect(() => {
    let frameId = 0;
    const animate = () => {
      const peopleOnFloor = peopleRef.current;
      const next: Record<string, Position> = { ...smoothRef.current };
      for (const person of peopleOnFloor) {
        const target = person.position;
        const current = next[person.id];
        if (current === undefined) {
          next[person.id] = target;
          continue;
        }

        const maxStep =
          person.type === 'staff' ? MAX_DISPLAY_STEP.staff : MAX_DISPLAY_STEP.resident;
        const dx = target.x - current.x;
        const dy = target.y - current.y;
        const d = Math.hypot(dx, dy);
        next[person.id] =
          person.type === 'staff' && d < 0.028
            ? target
            : smoothToward(current, target, maxStep);
      }
      smoothRef.current = next;
      setSmoothPositions({ ...next });
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [floor]);

  // Force re-render every second to update call timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newZoom = Math.min(prev + 0.1, 3); // Max 3x zoom, 10% increments
      const scale = 1 / newZoom;
      const newWidth = 1200 * scale;
      const newHeight = 800 * scale;
      const centerX = viewBox.x + viewBox.width / 2;
      const centerY = viewBox.y + viewBox.height / 2;
      setViewBox({
        x: centerX - newWidth / 2,
        y: centerY - newHeight / 2,
        width: newWidth,
        height: newHeight,
      });
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.1, 1.0); // Min 1.0x zoom (100%), 10% increments
      const scale = 1 / newZoom;
      const newWidth = 1200 * scale;
      const newHeight = 800 * scale;
      const centerX = viewBox.x + viewBox.width / 2;
      const centerY = viewBox.y + viewBox.height / 2;
      setViewBox({
        x: Math.max(0, Math.min(1200 - newWidth, centerX - newWidth / 2)),
        y: Math.max(0, Math.min(800 - newHeight, centerY - newHeight / 2)),
        width: newWidth,
        height: newHeight,
      });
      return newZoom;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setViewBox({ x: 0, y: 0, width: 1200, height: 800 });
  };

  const handleMarkerClick = (e: React.MouseEvent, personId: string) => {
    e.stopPropagation();
    e.preventDefault();
    onPersonClick(personId);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('.person-marker-hit, .person-marker')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    const deltaX = (panStart.x - e.clientX) * (viewBox.width / 1200);
    const deltaY = (panStart.y - e.clientY) * (viewBox.height / 800);

    setViewBox(prev => ({
      ...prev,
      x: Math.max(0, Math.min(1200 - prev.width, prev.x + deltaX)),
      y: Math.max(0, Math.min(800 - prev.height, prev.y + deltaY)),
    }));

    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  return (
    <div
      className="relative w-full h-full bg-slate-200 border-2 border-slate-400 overflow-hidden transition-opacity duration-300"
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Zoom Controls - Medical-grade RTLS style */}
      <div
        className="absolute top-3 right-3 z-30 flex flex-col gap-0.5 bg-white border border-slate-400 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleZoomIn}
          className="px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-300 group"
          aria-label="Zoom in"
          title="Zoom In"
        >
          <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-300 group"
          aria-label="Zoom out"
          title="Zoom Out"
        >
          <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <button
          onClick={handleResetZoom}
          className="px-3 py-2 hover:bg-blue-50 transition-colors border-b border-slate-300 group"
          aria-label="Reset zoom"
          title="Reset View"
        >
          <svg className="w-4 h-4 text-slate-600 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <div className="px-2.5 py-1.5 text-[10px] font-mono text-slate-700 text-center border-t border-slate-400 bg-slate-50 font-semibold">
          {Math.round(zoomLevel * 100)}%
        </div>
      </div>

      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="1" dy="1" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.2"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <pattern id="woodFloor" patternUnits="userSpaceOnUse" width="40" height="40">
            <rect width="40" height="40" fill="#f5f0e8"/>
            <rect y="20" width="40" height="1" fill="#efe8dc" opacity="0.35"/>
          </pattern>
          <pattern id="carpet" patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="20" height="20" fill="#f5f0e8"/>
          </pattern>
          <pattern id="grid" patternUnits="userSpaceOnUse" width="100" height="100">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#94a3b8" strokeWidth="0.5" opacity="0.15"/>
          </pattern>
        </defs>

        {/* Professional coordinate grid overlay */}
        <rect x="0" y="0" width="1200" height="800" fill="url(#grid)" pointerEvents="none" />

        {/* Render indoor building elements ONLY for floors 1-3 */}
        {floor !== 4 && (
          <>
            {/* Main building */}
            <rect x="220" y="80" width="760" height="640" fill="#f5f0e8" stroke="#b8a990" strokeWidth="3" filter="url(#shadow)" />
          </>
        )}

        {floor === 1 ? (
          <Floor1Layout />
        ) : floor === 2 ? (
          <Floor2Layout />
        ) : floor === 3 ? (
          <Floor3Layout />
        ) : floor === 4 ? (
          <OutdoorGroundsLayout />
        ) : null}

        {/* People markers - rendered as SVG so they move with map */}
        {[...people]
          .sort(
            (a, b) =>
              markerDrawOrder(a, alerts, searchQuery) - markerDrawOrder(b, alerts, searchQuery),
          )
          .map((person) => {
          const callDuration = person.emergencyCall
            ? Math.floor((Date.now() - person.emergencyCall.startTime.getTime()) / 1000)
            : 0;

          const displayPosition = smoothPositions[person.id] ?? person.position;
          const photoUrl = getPhotoUrl(person.id, person.type);
          const showPhotoOnMarker = Boolean(photoUrl) && loadedMarkerPhotos[person.id] === true;

          const svgX = (displayPosition.x / 100) * 1200;
          const svgY = (displayPosition.y / 100) * 800;
          const markerR = 6;
          const photoR = 8;

          const displayStatus =
            person.type === 'resident' ? residentMarkerStatus(person.id, alerts) : person.status;

          // Determine marker color
          let fillColor = '#2563eb'; // blue for residents
          let strokeColor = '#1e40af';
          const waveSpec = getMarkerWaveSpec(person, displayStatus);

          if (person.emergencyCall) {
            if (person.emergencyCall.status === 'connected') {
              fillColor = '#0d9488'; // teal
              strokeColor = '#0f766e';
            } else {
              fillColor = '#b91c1c'; // red
              strokeColor = '#7f1d1d';
            }
          } else if (displayStatus === 'alert') {
            fillColor = '#b91c1c'; // red
            strokeColor = '#7f1d1d';
          } else if (displayStatus === 'warning') {
            fillColor = '#d97706'; // amber
            strokeColor = '#92400e';
          } else if (person.type === 'staff') {
            fillColor = '#16a34a'; // green
            strokeColor = '#15803d';
          }

          const photoStrokeWidth =
            displayStatus === 'alert' ? 3 : displayStatus === 'warning' ? 2.5 : 1.5;

          // Check if person matches search query
          const matchesSearch = searchQuery.trim() !== '' && (
            person.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            person.name.toLowerCase().includes(searchQuery.toLowerCase())
          );

          return (
            <g
              key={person.id}
              className="person-marker"
              style={{ cursor: 'pointer' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => handleMarkerClick(e, person.id)}
            >
              {waveSpec && (
                <g transform={`translate(${svgX}, ${svgY})`} pointerEvents="none">
                  <MarkerWaves
                    stroke={waveSpec.stroke}
                    layers={waveSpec.layers}
                    durationSec={waveSpec.durationSec}
                    personId={person.id}
                  />
                </g>
              )}

              {/* Search highlight ring */}
              {matchesSearch && (
                <circle
                  cx={svgX}
                  cy={svgY}
                  r="10"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  opacity="0.8"
                  className="animate-pulse"
                />
              )}

              {showPhotoOnMarker ? (
                <g pointerEvents="none">
                  <defs>
                    <clipPath id={`avatar-clip-${person.id}`}>
                      <circle cx={svgX} cy={svgY} r={photoR} />
                    </clipPath>
                  </defs>
                  <circle
                    cx={svgX}
                    cy={svgY}
                    r={photoR + 1.5}
                    fill="white"
                    stroke={strokeColor}
                    strokeWidth={photoStrokeWidth}
                    filter="url(#shadow)"
                  />
                  <image
                    href={photoUrl}
                    x={svgX - photoR}
                    y={svgY - photoR}
                    width={photoR * 2}
                    height={photoR * 2}
                    clipPath={`url(#avatar-clip-${person.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </g>
              ) : (
                <>
                  <circle
                    cx={svgX}
                    cy={svgY}
                    r={markerR}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth="1"
                    filter="url(#shadow)"
                    pointerEvents="none"
                  />
                  <circle
                    cx={svgX}
                    cy={svgY}
                    r="2.5"
                    fill="white"
                    opacity="0.9"
                    pointerEvents="none"
                  />
                </>
              )}

              {/* Emergency call indicator */}
              {person.emergencyCall && (
                <g pointerEvents="none">
                  <circle
                    cx={svgX}
                    cy={svgY - 15}
                    r="8"
                    fill={person.emergencyCall.status === 'connected' ? '#0d9488' : '#dc2626'}
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <text
                    x={svgX}
                    y={svgY - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="white"
                    fontWeight="bold"
                  >
                    {person.emergencyCall.status === 'connected' ? '📞' : '🚨'}
                  </text>
                  <text
                    x={svgX}
                    y={svgY - 25}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#1f2937"
                    fontWeight="600"
                  >
                    {Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, '0')}
                  </text>
                </g>
              )}

              {/* Large hit target on top for reliable clicks */}
              <circle
                cx={svgX}
                cy={person.emergencyCall ? svgY - 5 : svgY}
                r={person.emergencyCall ? 18 : showPhotoOnMarker ? 16 : 14}
                fill="transparent"
                className="person-marker-hit"
                onClick={(e) => handleMarkerClick(e, person.id)}
                role="button"
                aria-label={`${person.name}, ${person.id}`}
              />

              {/* Hover tooltip */}
              <title>
                {person.name}
                {person.emergencyCall ? ` - ${person.emergencyCall.status === 'connected' ? 'On Call' : 'Emergency'}` : ''}
              </title>
            </g>
          );
        })}

        {locatePersonId && (() => {
          const located = people.find((person) => person.id === locatePersonId);
          if (!located) return null;

          const displayPosition = smoothPositions[located.id] ?? located.position;
          const svgX = (displayPosition.x / 100) * 1200;
          const svgY = (displayPosition.y / 100) * 800;
          // Tip at local y=14; place group so tip aims at top of marker
          const arrowTipOffset = 14;
          const arrowY = located.emergencyCall ? svgY - 48 : svgY - (arrowTipOffset + 10);

          return (
            <g key={`locate-${located.id}`} transform={`translate(${svgX}, ${arrowY})`} pointerEvents="none">
              <g className="map-locate-arrow" aria-hidden>
                <path d="M0 14 L-8 0 L8 0 Z" fill="#0f172a" stroke="#020617" strokeWidth="1.25" />
              </g>
            </g>
          );
        })()}
      </svg>

      {/* Floor indicator */}
      <div
        className="absolute bottom-3 right-3 z-30 bg-white px-3 py-1.5 border border-slate-400 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-bold text-slate-800 font-mono tracking-wider">
          {floor === 4 ? 'OUTDOOR GROUNDS' : `FLOOR ${floor}`}
        </span>
      </div>

      <style>{`
        @keyframes map-marker-wave {
          0% {
            transform: scale(0.55);
            opacity: 0.55;
          }
          70% {
            opacity: 0.12;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        .map-marker-wave {
          transform-box: fill-box;
          transform-origin: center;
          animation-name: map-marker-wave;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .map-marker-wave {
            animation: none;
            opacity: 0.35;
            transform: scale(1.15);
          }
        }
        @keyframes map-locate-bob {
          0%,
          100% {
            transform: translateY(0);
            opacity: 1;
          }
          50% {
            transform: translateY(10px);
            opacity: 0.55;
          }
        }
        .map-locate-arrow {
          animation: map-locate-bob 0.85s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .map-locate-arrow {
            animation: none;
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}
