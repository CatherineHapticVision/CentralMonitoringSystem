import { formatStaffEntry } from '../utils/formatStaffLabel';

export interface RespondingStaffLinksProps {
  staffIds: string[];
  nameById?: Record<string, string>;
  onStaffClick: (staffId: string) => void;
  className?: string;
  /** White underlined links for red escalation banners */
  linkVariant?: 'default' | 'onDark';
}

export function RespondingStaffLinks({
  staffIds,
  nameById,
  onStaffClick,
  className = '',
  linkVariant = 'default',
}: RespondingStaffLinksProps) {
  if (staffIds.length === 0) return null;

  const linkClassName =
    linkVariant === 'onDark'
      ? 'font-bold text-white hover:text-white underline focus:outline-none focus:ring-1 focus:ring-inset focus:ring-white rounded-sm'
      : 'font-bold text-blue-800 hover:text-blue-900 hover:underline focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 rounded-sm';

  return (
    <span className={className}>
      {staffIds.map((id, index) => (
        <span key={id}>
          {index > 0 && <span className={linkVariant === 'onDark' ? 'text-white/80' : 'text-slate-600'}>, </span>}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStaffClick(id);
            }}
            className={linkClassName}
            aria-label={`Open profile for ${formatStaffEntry(id, nameById?.[id])}`}
          >
            {formatStaffEntry(id, nameById?.[id])}
          </button>
        </span>
      ))}
    </span>
  );
}
