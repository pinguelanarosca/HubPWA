import React from 'react';
import { Check, Clock } from 'lucide-react';
import { isAccessedToday } from '../utils/pwaLogic';

interface StatusIndicatorProps {
  lastAccessedDate: string | null;
  todayStr: string;
  onToggle?: () => void;
  compact?: boolean;
  showText?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  lastAccessedDate,
  todayStr,
  onToggle,
  compact = false,
  showText = true,
}) => {
  const accessed = isAccessedToday(lastAccessedDate, todayStr);

  const label = accessed ? 'Acessado hoje' : 'Pendente hoje';
  const ariaLabel = `${label} - Clique para alternar status`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      title={ariaLabel}
      aria-label={ariaLabel}
      className={`group relative inline-flex items-center gap-1.5 transition-colors cursor-pointer select-none rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
        compact ? 'p-0.5' : 'px-2 py-0.5'
      } ${
        accessed
          ? 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/50'
          : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/50'
      }`}
    >
      {/* Indicator indicator dot / glyph */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          accessed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
        }`}
        aria-hidden="true"
      />

      {showText && (
        <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
          {accessed ? (
            <span className="inline-flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Acessado</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-300/90">
              <Clock className="w-3 h-3 text-rose-400" />
              <span>Pendente</span>
            </span>
          )}
        </span>
      )}
    </button>
  );
};
