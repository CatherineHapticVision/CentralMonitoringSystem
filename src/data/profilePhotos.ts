/** Curated portrait URLs — gender- and heritage-matched residents; unique facility-wide */

import { residentNameForId, staffNameForId } from './facilityData';
import { hasAsianSurname } from '../utils/asianSurnames';
import { inferGenderFromNameOrId, type InferredGender } from '../utils/nameGender';

export type PersonKind = 'resident' | 'staff';

/** Face crop tuned for profile thumbnails */
const u = (id: string) =>
  `https://images.unsplash.com/${id}?w=256&h=256&fit=crop&crop=faces&facepad=2`;

function dedupe(urls: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

/** Residents — senior women (50+), non-Asian surnames */
const RESIDENT_FEMALE_50_PLUS = dedupe([
  u('photo-1581579438743-1dc39cffda37'),
  u('photo-1598515214219-31f91a5a4032'),
  u('photo-1573497019940-1c28c88b4f0e'),
  u('photo-1556155092-490a38e496cb'),
  u('photo-1544717297-fa95b7ee6047'),
  u('photo-1487412720507-e7ab37603c6f'),
  u('photo-1580489944761-15a19d654956'),
  u('photo-1595152778127-9203cbaef4b8'),
  u('photo-1566616213894-2d4e1baee5d8'),
  u('photo-1498757581981-8ddb3c0b9b07'),
  u('photo-1534954553104-88cb75be7648'),
  u('photo-1446161543652-83eaa65fddab'),
  u('photo-1706272971886-20f2fadf577e'),
  u('photo-1719037108848-685e9e599827'),
  u('photo-1627622718888-1c8f96aadbbe'),
  u('photo-1647082286159-16a43c39eab1'),
]);

/** Residents — senior men (50+), non-Asian surnames */
const RESIDENT_MALE_50_PLUS = dedupe([
  u('photo-1771246918298-3795d3bb27a7'),
  u('photo-1644224010199-407a662c9228'),
  u('photo-1609225440274-438351646c93'),
  u('photo-1586198660860-7a763c39709b'),
  u('photo-1576765609862-ef933c942f88'),
  u('photo-1580894732930-65842c463621'),
  u('photo-1663429121861-e45bc6b5def8'),
  u('photo-1626668011687-8a114cf5a34c'),
  u('photo-1566616213895-9d04009f1c9d'),
  u('photo-1516575154878-93e19bb8b1f8'),
]);

/** Residents — senior Asian women (50+) */
const RESIDENT_ASIAN_FEMALE_50_PLUS = dedupe([
  u('photo-1755420482543-e54d4d063aca'),
  u('photo-1778174903051-0b15d54bb451'),
  u('photo-1761580525127-392880387ca4'),
  u('photo-1761580525175-cca1baaafbe1'),
  u('photo-1777214687499-f3c9eb6f5a17'),
  u('photo-1700553856089-1ea9261143a7'),
  u('photo-1496672254107-b07a26403885'),
  u('photo-1614367936673-51c6daef6af9'),
  u('photo-1615455243908-93e1fce6cdda'),
  u('photo-1773714331108-14b3eca2e279'),
]);

/** Residents — senior Asian men (50+) */
const RESIDENT_ASIAN_MALE_50_PLUS = dedupe([
  u('photo-1768478563694-b9b38533f2f4'),
  u('photo-1761519756975-c8560e7f0139'),
  u('photo-1761965946336-bf9aa98aea29'),
  u('photo-1776659216322-4d8e7ad83459'),
  u('photo-1542897841-82096b818fe6'),
  u('photo-1558919047-c9b36c16009e'),
  u('photo-1564890112980-007a84d5d700'),
  u('photo-1658870154737-07cf5f5c5753'),
  u('photo-1631400175304-8de55149500b'),
  u('photo-1488820098099-8d4a4723a490'),
]);

/** Staff-only — disjoint from all resident pools */
const STAFF_FEMALE_PHOTOS = dedupe([
  u('photo-1559839734-2b71ea197ec2'),
  u('photo-1612349317150-e413f6a5b16d'),
  u('photo-1651008376811-b90baee00c1b'),
  u('photo-1594824471967-542c27e6e04d'),
  u('photo-1576092768241-dacb02d20dd4'),
  u('photo-1573496359142-b8d87734a5a2'),
  u('photo-1607990287110-08d465e503f6'),
  u('photo-1534528741775-53994a69daeb'),
  u('photo-1438761681033-6461ffad8d80'),
  u('photo-1582750433449-648ed127bb54'),
  u('photo-1508214751196-bcfd4ca60f91'),
  u('photo-1517841905240-472988babdf9'),
]);

const STAFF_MALE_PHOTOS = dedupe([
  u('photo-1622253692010-333f2da6031d'),
  u('photo-1584982751601-97dcc096659c'),
  u('photo-1537368910025-70059c6e6d0c'),
  u('photo-1519494023792-5a5fb9e1f2b0'),
  u('photo-1560250097-0b93528c311a'),
  u('photo-1519085360753-af0119f7cbe7'),
  u('photo-1500648767791-00dcc994a43e'),
  u('photo-1472099645785-5658abf4ff4e'),
  u('photo-1507003211169-0a1dd7228f2d'),
  u('photo-1519345182560-3f2917c472ef'),
]);

/** Pinned residents — unmistakably senior; each URL once */
const RESIDENT_PHOTO_PIN_BY_ID: Record<string, string> = {
  R003: u('photo-1573497019940-1c28c88b4f0e'), // Dorothy Williams — senior woman
  R002: u('photo-1771246918298-3795d3bb27a7'), // Robert Johnson
  R004: u('photo-1663429121861-e45bc6b5def8'), // James Cook (F1)
  R014: u('photo-1644224010199-407a662c9228'), // Thomas O'Brien
  R027: u('photo-1719037108848-685e9e599827'), // Grace Meyer
  R045: u('photo-1581579438743-1dc39cffda37'), // Marie Mitchell (user: Maria Mitchell)
  R046: u('photo-1576765609862-ef933c942f88'), // Francis Cook
  R055: u('photo-1695556746253-ab635cedac50'), // Mabel Meyer
  R068: u('photo-1626668011687-8a114cf5a34c'), // James Cook (F2)
  R001: u('photo-1778174903051-0b15d54bb451'), // Margaret Chen — elderly Asian woman
};

const DEMO_RESIDENT_IDS = new Set(['R001', 'R002', 'R003', 'R006', 'R011', 'R014']);

/** Residents who should show initials only (no portrait) */
const RESIDENT_IDS_WITHOUT_PHOTO = new Set(['R115']); // Clara Mitchell

export function residentHasPortrait(id: string): boolean {
  return !RESIDENT_IDS_WITHOUT_PHOTO.has(id);
}

function idHash(id: string): number {
  return id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

export function hasDefaultPhoto(id: string, kind: PersonKind): boolean {
  if (kind === 'resident') {
    if (RESIDENT_IDS_WITHOUT_PHOTO.has(id)) return false;
    if (DEMO_RESIDENT_IDS.has(id)) return true;
    return idHash(id) % 5 < 2;
  }
  return idHash(id) % 4 !== 0;
}

function residentPool(name: string, gender: InferredGender): string[] {
  if (hasAsianSurname(name)) {
    return gender === 'female' ? RESIDENT_ASIAN_FEMALE_50_PLUS : RESIDENT_ASIAN_MALE_50_PLUS;
  }
  return gender === 'female' ? RESIDENT_FEMALE_50_PLUS : RESIDENT_MALE_50_PLUS;
}

const STAFF_ORDER = [
  'RN01',
  'RN02',
  'RN03',
  'RN04',
  'RP01',
  'RP02',
  'RP03',
  'RP04',
  'RP05',
  'PS01',
  'PS02',
  'PS03',
  'PS04',
  'PS05',
  'PS06',
  'PS07',
  'PS08',
  'SV01',
  'SV02',
  'PT01',
  'OT01',
] as const;

function takeUniqueFromPool(pool: string[], used: Set<string>, seed: number): string | undefined {
  if (pool.length === 0) return undefined;
  for (let i = 0; i < pool.length; i++) {
    const url = pool[(seed + i) % pool.length]!;
    if (!used.has(url)) {
      used.add(url);
      return url;
    }
  }
  return undefined;
}

function assertNoDuplicateUrls(maps: Map<string, string>[]): void {
  const seen = new Map<string, string>();
  for (const map of maps) {
    for (const [id, url] of map) {
      const prev = seen.get(url);
      if (prev) {
        throw new Error(`Duplicate photo URL: ${id} and ${prev} share ${url}`);
      }
      seen.set(url, id);
    }
  }
}

function buildResidentPhotoMap(used: Set<string>): Map<string, string> {
  const map = new Map<string, string>();

  for (const [id, url] of Object.entries(RESIDENT_PHOTO_PIN_BY_ID)) {
    if (used.has(url)) {
      throw new Error(`Pinned resident photo reused: ${id}`);
    }
    used.add(url);
    map.set(id, url);
  }

  for (let n = 1; n <= 124; n++) {
    const id = `R${String(n).padStart(3, '0')}`;
    if (!hasDefaultPhoto(id, 'resident')) continue;
    if (map.has(id)) continue;

    const name = residentNameForId(id);
    const gender = inferGenderFromNameOrId(name, id);
    const pool = residentPool(name, gender).filter((url) => !used.has(url));
    const url = takeUniqueFromPool(pool, used, idHash(id));
    if (url) map.set(id, url);
  }
  return map;
}

function buildStaffPhotoMap(used: Set<string>): Map<string, string> {
  const map = new Map<string, string>();

  for (const id of STAFF_ORDER) {
    if (!hasDefaultPhoto(id, 'staff')) continue;
    const name = staffNameForId(id);
    const gender = inferGenderFromNameOrId(name, id);
    const pool = (gender === 'female' ? STAFF_FEMALE_PHOTOS : STAFF_MALE_PHOTOS).filter(
      (url) => !used.has(url),
    );
    const url = takeUniqueFromPool(pool, used, idHash(id));
    if (url) map.set(id, url);
  }
  return map;
}

const GLOBAL_USED_URLS = new Set<string>();
const RESIDENT_PHOTO_BY_ID = buildResidentPhotoMap(GLOBAL_USED_URLS);
const STAFF_PHOTO_BY_ID = buildStaffPhotoMap(GLOBAL_USED_URLS);

assertNoDuplicateUrls([RESIDENT_PHOTO_BY_ID, STAFF_PHOTO_BY_ID]);

/** Default photo URL — each URL at most once facility-wide */
export function getDefaultPhotoUrl(id: string, kind: PersonKind): string | undefined {
  if (kind === 'resident') {
    return RESIDENT_PHOTO_BY_ID.get(id);
  }
  if (!hasDefaultPhoto(id, kind)) return undefined;
  return STAFF_PHOTO_BY_ID.get(id);
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
