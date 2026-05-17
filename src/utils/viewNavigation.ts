export type NavEntry =
  | { view: 'alerts' }
  | { view: 'resident'; id: string }
  | { view: 'staff'; id: string }
  | { view: 'emergencyCall'; callId: string };

export type PanelNavEntry = Exclude<NavEntry, { view: 'emergencyCall' }>;

export const INITIAL_NAV: PanelNavEntry = { view: 'alerts' };

function entryKey(entry: NavEntry): string {
  if (entry.view === 'alerts') return 'alerts';
  if (entry.view === 'emergencyCall') return `emergencyCall:${entry.callId}`;
  return `${entry.view}:${entry.id}`;
}

export function navEntriesEqual(a: NavEntry, b: NavEntry): boolean {
  return entryKey(a) === entryKey(b);
}

export function panelEntryFromStack(stack: NavEntry[]): PanelNavEntry {
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i]!;
    if (entry.view === 'alerts') return entry;
    if (entry.view === 'resident') return entry;
    if (entry.view === 'staff') return entry;
  }
  return INITIAL_NAV;
}

export function selectionFromNav(entry: PanelNavEntry): {
  residentId: string | null;
  staffId: string | null;
} {
  if (entry.view === 'resident') return { residentId: entry.id, staffId: null };
  if (entry.view === 'staff') return { residentId: null, staffId: entry.id };
  return { residentId: null, staffId: null };
}

export function isEmergencyCallNavEntry(
  entry: NavEntry,
): entry is { view: 'emergencyCall'; callId: string } {
  return entry.view === 'emergencyCall';
}
