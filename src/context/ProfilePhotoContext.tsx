import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getDefaultPhotoUrl, residentHasPortrait, type PersonKind } from '../data/profilePhotos';

const STORAGE_KEY = 'grandview-profile-photo-overrides';

type PhotoOverrides = Record<string, string>;

function loadOverrides(): PhotoOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PhotoOverrides;
  } catch {
    return {};
  }
}

function saveOverrides(overrides: PhotoOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* quota or private browsing */
  }
}

interface ProfilePhotoContextValue {
  getPhotoUrl: (id: string, kind: PersonKind) => string | undefined;
  setPhotoUrl: (id: string, dataUrl: string) => void;
  removePhotoUrl: (id: string) => void;
}

const ProfilePhotoContext = createContext<ProfilePhotoContextValue | null>(null);

export function ProfilePhotoProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<PhotoOverrides>(loadOverrides);

  const getPhotoUrl = useCallback(
    (id: string, kind: PersonKind) => {
      if (kind === 'resident' && !residentHasPortrait(id)) return undefined;
      const override = overrides[id]?.trim();
      if (override) return override;
      return getDefaultPhotoUrl(id, kind);
    },
    [overrides],
  );

  const setPhotoUrl = useCallback((id: string, dataUrl: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: dataUrl };
      saveOverrides(next);
      return next;
    });
  }, []);

  const removePhotoUrl = useCallback((id: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      saveOverrides(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ getPhotoUrl, setPhotoUrl, removePhotoUrl }),
    [getPhotoUrl, setPhotoUrl, removePhotoUrl],
  );

  return (
    <ProfilePhotoContext.Provider value={value}>{children}</ProfilePhotoContext.Provider>
  );
}

export function useProfilePhotos(): ProfilePhotoContextValue {
  const ctx = useContext(ProfilePhotoContext);
  if (!ctx) {
    throw new Error('useProfilePhotos must be used within ProfilePhotoProvider');
  }
  return ctx;
}
