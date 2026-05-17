import { Shield } from 'lucide-react';

export function PrivacyNotice() {
  return (
    <div className="fixed bottom-2 left-[17rem] bg-slate-100 border border-slate-400 p-2 max-w-xs z-10">
      <div className="flex items-center gap-1.5">
        <Shield className="w-3 h-3 text-slate-600 flex-shrink-0" />
        <p className="text-[10px] text-slate-700">
          <span className="font-semibold">PHI</span> - Protected Health Information
        </p>
      </div>
    </div>
  );
}
