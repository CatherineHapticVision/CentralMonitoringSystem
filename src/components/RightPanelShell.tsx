import type { ReactNode } from 'react';
import { BackNavButton } from './BackNavButton';

interface RightPanelShellProps {
  canGoBack: boolean;
  onBack: () => void;
  children: ReactNode;
}

/** Right rail — alerts list or person profile */
export function RightPanelShell({ canGoBack, onBack, children }: RightPanelShellProps) {
  return (
    <aside className="w-80 flex flex-col h-full shrink-0 border-l border-slate-400 bg-white">
      {canGoBack && (
        <div className="flex shrink-0 items-center border-b border-slate-300 bg-slate-50 px-2 py-1.5">
          <BackNavButton onClick={onBack} />
        </div>
      )}
      <div className="min-h-0 flex-1 flex flex-col overflow-hidden">{children}</div>
    </aside>
  );
}
