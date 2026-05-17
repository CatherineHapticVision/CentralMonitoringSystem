/** Infer likely gender from first name for portrait matching */

export type InferredGender = 'female' | 'male';

const FEMALE_NAMES = new Set(
  [
    'Margaret',
    'Dorothy',
    'Patricia',
    'Barbara',
    'Elizabeth',
    'Mary',
    'Helen',
    'Ruth',
    'Betty',
    'Anna',
    'Alice',
    'Florence',
    'Evelyn',
    'Grace',
    'Rose',
    'Jean',
    'Martha',
    'Eleanor',
    'Agnes',
    'Marie',
    'Edith',
    'Gertrude',
    'Clara',
    'Louise',
    'Mabel',
    'Gladys',
    'Hazel',
    'Esther',
    'Beatrice',
    'Emma',
    'Catherine',
    'Lillian',
    'Sarah',
    'Maria',
    'Jennifer',
    'Lisa',
    'Priya',
    'Emily',
    'Fatima',
    'Sophie',
    'Laura',
    'Patricia',
  ].map((n) => n.toLowerCase()),
);

const MALE_NAMES = new Set(
  [
    'Robert',
    'James',
    'Michael',
    'William',
    'Richard',
    'Charles',
    'Joseph',
    'Thomas',
    'John',
    'David',
    'George',
    'Frank',
    'Arthur',
    'Walter',
    'Harold',
    'Paul',
    'Edward',
    'Henry',
    'Donald',
    'Kenneth',
    'Albert',
    'Raymond',
    'Francis',
    'Jack',
    'Harry',
    'Norman',
    'Carl',
    'Louis',
    'Fred',
    'Howard',
    'Roy',
    'Ernest',
    'Ahmed',
    'Carlos',
    'Daniel',
    'Kevin',
  ].map((n) => n.toLowerCase()),
);

function normalizeFirstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0] ?? '';
  return part.replace(/^['"]|['"]$/g, '').toLowerCase();
}

export function inferGenderFromName(fullName: string): InferredGender | undefined {
  const first = normalizeFirstName(fullName);
  if (!first) return undefined;
  if (FEMALE_NAMES.has(first)) return 'female';
  if (MALE_NAMES.has(first)) return 'male';
  return undefined;
}

/** Stable gender when name is ambiguous — same id always gets same fallback */
export function inferGenderFromNameOrId(fullName: string, id: string): InferredGender {
  const fromName = inferGenderFromName(fullName);
  if (fromName) return fromName;
  const hash = id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return hash % 2 === 0 ? 'female' : 'male';
}
