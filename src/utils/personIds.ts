/** Resident IDs: R001–R124 */
export function isResidentId(id: string): boolean {
  return /^R\d{3}$/.test(id);
}

/** Staff IDs: RN01, RP01, PS01, SV01, PT01, OT01, etc. */
export function isStaffId(id: string): boolean {
  return /^(RN|RP|PS|SV|PT|OT)\d{2}$/.test(id);
}
