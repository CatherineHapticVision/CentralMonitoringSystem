import { staffNameForId } from '../data/facilityData';

/** Display name for a staff ID; falls back to the id if unknown. */
export function staffDisplayName(id: string): string {
  return staffNameForId(id);
}

/** Single staff line: `RN02 — Jane Doe` (matches sidebar). */
export function formatStaffEntry(id: string, nameOverride?: string): string {
  const name = nameOverride ?? staffNameForId(id);
  if (name === id) return id;
  return `${id} — ${name}`;
}

/** Comma-separated staff entries for multi-responder alerts. */
export function formatStaffList(ids: string[]): string {
  return ids.map((id) => formatStaffEntry(id)).join(', ');
}
