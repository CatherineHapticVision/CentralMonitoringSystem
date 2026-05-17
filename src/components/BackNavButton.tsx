import { Undo2 } from 'lucide-react';

interface BackNavButtonProps {
  onClick: () => void;
  className?: string;
}

export function BackNavButton({ onClick, className = '' }: BackNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 border border-transparent hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${className}`}
    >
      <Undo2 className="w-4 h-4 shrink-0" strokeWidth={2.25} aria-hidden />
      <span>Back</span>
    </button>
  );
}
