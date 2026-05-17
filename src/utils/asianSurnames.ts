/** Surnames common among East / South / Southeast Asian residents in Ontario LTC */

const ASIAN_SURNAMES = new Set(
  [
    'Ahmed',
    'Ali',
    'Chen',
    'Chow',
    'Hassan',
    'Ibrahim',
    'Kaur',
    'Khan',
    'Kim',
    'Kumar',
    'Lam',
    'Lee',
    'Li',
    'Nguyen',
    'Patel',
    'Sharma',
    'Singh',
    'Tran',
    'Verma',
    'Wang',
    'Zhang',
  ].map((s) => s.toLowerCase()),
);

export function hasAsianSurname(fullName: string): boolean {
  const parts = fullName.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.replace(/['']/g, "'") ?? '';
  return ASIAN_SURNAMES.has(last.toLowerCase());
}
