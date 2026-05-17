import { useEffect, useMemo, useState } from 'react';
import type { PersonKind } from '../data/profilePhotos';

/** Module-level cache survives position ticks and floor changes */
const loadCache = new Map<string, boolean>();

function cacheKey(personId: string, url: string): string {
  return `${personId}\0${url}`;
}

function buildPhotoSignature(
  people: { id: string; type: PersonKind }[],
  getPhotoUrl: (id: string, kind: PersonKind) => string | undefined,
): string {
  return people
    .map((p) => {
      const url = getPhotoUrl(p.id, p.type);
      return url ? `${p.id}\0${url}` : '';
    })
    .filter(Boolean)
    .sort()
    .join('\n');
}

/** Preload marker photos; only return true when the image actually loads */
export function useLoadedMarkerPhotos(
  people: { id: string; type: PersonKind }[],
  getPhotoUrl: (id: string, kind: PersonKind) => string | undefined,
): Record<string, boolean> {
  const [version, setVersion] = useState(0);

  const photoSignature = useMemo(
    () => buildPhotoSignature(people, getPhotoUrl),
    [people, getPhotoUrl],
  );

  useEffect(() => {
    let cancelled = false;

    for (const line of photoSignature.split('\n')) {
      if (!line) continue;
      const sep = line.indexOf('\0');
      if (sep < 0) continue;
      const personId = line.slice(0, sep);
      const url = line.slice(sep + 1);
      const key = cacheKey(personId, url);
      if (loadCache.has(key)) continue;

      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        loadCache.set(key, true);
        setVersion((v) => v + 1);
      };
      img.onerror = () => {
        if (cancelled) return;
        loadCache.set(key, false);
        setVersion((v) => v + 1);
      };
      img.src = url;
    }

    return () => {
      cancelled = true;
    };
  }, [photoSignature]);

  return useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const person of people) {
      const url = getPhotoUrl(person.id, person.type);
      if (!url) continue;
      const key = cacheKey(person.id, url);
      if (loadCache.has(key)) {
        out[person.id] = loadCache.get(key)!;
      }
    }
    return out;
  }, [people, getPhotoUrl, photoSignature, version]);
}
