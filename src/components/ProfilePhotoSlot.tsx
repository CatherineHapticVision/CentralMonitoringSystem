import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { getInitials } from '../data/profilePhotos';

export type ProfilePhotoVariant = 'profile' | 'compact';

interface ProfilePhotoSlotProps {
  personId: string;
  name: string;
  photoUrl?: string;
  variant?: ProfilePhotoVariant;
  /** Header on dark background (resident/staff profile) */
  onDark?: boolean;
  onPhotoSelected: (dataUrl: string) => void;
}

const SIZES = {
  profile: {
    box: 'w-16 h-16',
    initials: 'text-sm',
    barHeight: 18,
    bar: 'h-[18px] text-[9px] gap-1 px-1',
    camera: 'w-2.5 h-2.5',
  },
  compact: {
    box: 'w-10 h-10',
    initials: 'text-[10px]',
    barHeight: 14,
    bar: 'h-[14px] text-[8px] gap-0.5 px-0.5',
    camera: 'w-2 h-2',
  },
} as const;

export function ProfilePhotoSlot({
  personId,
  name,
  photoUrl,
  variant = 'profile',
  onDark = false,
  onPhotoSelected,
}: ProfilePhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const sizes = SIZES[variant];
  const initials = getInitials(name);

  useEffect(() => {
    if (!photoUrl) {
      setImageLoaded(false);
      return;
    }
    setImageLoaded(false);
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(false);
    img.src = photoUrl;
    if (img.complete && img.naturalWidth > 0) {
      setImageLoaded(true);
    }
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [photoUrl]);

  const showImage = Boolean(photoUrl) && imageLoaded;

  const handleFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onPhotoSelected(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const borderClass = onDark ? 'border-white/30' : 'border-slate-300';
  const emptyBg = onDark ? 'bg-white/10' : 'bg-slate-100';
  const initialsClass = onDark ? 'text-white/90' : 'text-slate-500';

  const barClass = onDark
    ? 'bg-black/65 hover:bg-black/80 border-t border-white/10'
    : 'bg-slate-800/90 hover:bg-slate-900 border-t border-slate-600/40';

  return (
    <div className={`relative flex-shrink-0 ${sizes.box}`}>
      <div
        className={`relative ${sizes.box} overflow-hidden border-2 ${borderClass} ${
          showImage ? 'bg-slate-200 border-solid' : `${emptyBg} border-dashed`
        }`}
      >
        <div
          className="absolute inset-x-0 top-0 overflow-hidden"
          style={{ bottom: sizes.barHeight }}
        >
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${
                showImage ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(false)}
            />
          )}
          {!showImage && (
            <div className={`flex h-full w-full items-center justify-center ${initialsClass}`}>
              <span className={`${sizes.initials} select-none font-semibold leading-none`}>
                {initials}
              </span>
            </div>
          )}
        </div>

        <label
          className={`absolute inset-x-0 bottom-0 flex cursor-pointer items-center justify-center ${sizes.bar} ${barClass} text-white transition-colors`}
        >
          <input
            id={`photo-upload-${personId}`}
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={showImage ? `Change photo for ${name}` : `Add photo for ${name}`}
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Camera className={`${sizes.camera} shrink-0 opacity-90`} aria-hidden strokeWidth={2} />
          <span className="whitespace-nowrap font-semibold leading-none tracking-tight">
            {showImage ? 'Change' : 'Add'}
          </span>
        </label>
      </div>
    </div>
  );
}
