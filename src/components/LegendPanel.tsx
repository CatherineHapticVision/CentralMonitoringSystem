export function LegendPanel() {
  return (
    <div className="px-2.5 py-2 border-t border-slate-300 bg-slate-50">
      <div className="text-[10px] text-slate-700">
        <div className="font-bold uppercase mb-1 text-slate-900 tracking-wide text-xs">Legend</div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-blue-700 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white opacity-90" />
            </div>
            <span className="font-mono text-slate-700">Resident</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-600 border border-green-700 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white opacity-90" />
            </div>
            <span className="font-mono text-slate-700">Staff</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-600 border border-amber-700 ring-1 ring-amber-300" />
            <span className="font-mono text-slate-700">Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-700 border border-red-800 ring-1 ring-red-300" />
            <span className="font-mono text-slate-700">Critical</span>
          </div>
        </div>
      </div>
    </div>
  );
}
