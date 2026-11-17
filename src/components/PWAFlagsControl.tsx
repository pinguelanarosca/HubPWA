import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { DailyFlagKey, DailyFlagState, FlagFilterKey, PWAFlags, PWAItem } from '../types/pwa';
import {
  getPWAFlagState,
  normalizeDayMonthOnBlur,
  sanitizeDayMonthTyping,
} from '../utils/pwaLogic';

export const MoneySymbolIcon: React.FC<{ className?: string }> = ({
  className = 'w-[19px] h-[19px]',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} text-emerald-400 drop-shadow-[0_0_6px_rgba(34,197,94,0.48)]`}
    aria-hidden="true"
  >
    {/* Vivid green medallion */}
    <circle
      cx="12"
      cy="12"
      r="10"
      fill="#10B981"
      fillOpacity="0.24"
      stroke="#34D399"
      strokeWidth="1.75"
    />
    {/* Crisp bright dollar sign */}
    <path
      d="M12 5.6V18.4M15.1 8.6C15.1 7.25 13.75 6.4 12 6.4C10.25 6.4 8.9 7.3 8.9 8.75C8.9 10.25 10.45 10.8 12 11.25C13.55 11.7 15.2 12.25 15.2 14.0C15.2 15.5 13.75 16.5 12 16.5C10.15 16.5 8.8 15.55 8.8 14.15"
      stroke="#4ADE80"
      strokeWidth="2.15"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const DAILY_FLAG_META: Array<{
  key: DailyFlagKey;
  label: string;
  badgeColorClass: string;
  filterActiveClass: string;
}> = [
  {
    key: 'com',
    label: 'COM',
    badgeColorClass: 'text-sky-300',
    filterActiveClass:
      'bg-sky-500/18 border-sky-400/75 text-sky-200 shadow-[0_0_12px_-4px_rgba(56,189,248,0.5)]',
  },
  {
    key: 'rb',
    label: 'RB',
    badgeColorClass: 'text-amber-300',
    filterActiveClass:
      'bg-amber-500/18 border-amber-400/75 text-amber-200 shadow-[0_0_12px_-4px_rgba(245,158,11,0.5)]',
  },
  {
    key: 'bon',
    label: 'BON',
    badgeColorClass: 'text-violet-300',
    filterActiveClass:
      'bg-violet-500/18 border-violet-400/75 text-violet-200 shadow-[0_0_12px_-4px_rgba(167,139,250,0.5)]',
  },
];

export const FILTER_FLAG_META: Array<{
  key: FlagFilterKey;
  label: string;
  filterActiveClass: string;
  badgeColorClass: string;
}> = [
  {
    key: 'moneyDate',
    label: '$ Data',
    filterActiveClass:
      'bg-emerald-500/18 border-emerald-400/75 text-emerald-200 shadow-[0_0_12px_-4px_rgba(16,185,129,0.5)]',
    badgeColorClass: 'text-emerald-400',
  },
  ...DAILY_FLAG_META.map((m) => ({
    key: m.key as FlagFilterKey,
    label: m.label,
    filterActiveClass: m.filterActiveClass,
    badgeColorClass: m.badgeColorClass,
  })),
];

interface PWAFlagsControlProps {
  item: PWAItem;
  todayStr: string;
  flags?: PWAFlags;
  onToggleFlag: (item: PWAItem, flag: DailyFlagKey, state?: DailyFlagState | null) => void;
  onUpdateMoneyDate?: (item: PWAItem, moneyDate: string) => void;
  compact?: boolean;
  layout?: 'row' | 'stacked';
}

export const PWAFlagsControl: React.FC<PWAFlagsControlProps> = ({
  item,
  todayStr,
  flags,
  onToggleFlag,
  onUpdateMoneyDate,
  compact = false,
  layout = 'row',
}) => {
  const effectiveFlags = flags ?? item.flags ?? {};
  const persistedDate = effectiveFlags.moneyDate || '';
  const [draftDate, setDraftDate] = useState(persistedDate);

  useEffect(() => {
    setDraftDate(persistedDate);
  }, [persistedDate, item.id]);

  const commitDate = (rawVal: string) => {
    const normalized = normalizeDayMonthOnBlur(rawVal);
    setDraftDate(normalized);
    if (onUpdateMoneyDate && normalized !== persistedDate) {
      onUpdateMoneyDate(item, normalized);
    }
  };

  const hasDateValue = draftDate.trim().length > 0;
  const isStacked = layout === 'stacked';

  return (
    <div
      className={
        isStacked
          ? 'flex flex-col gap-1.5 w-full'
          : 'flex items-center justify-between flex-wrap gap-1'
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* Left: Prominent Green $ Icon + Persistent DD/MM Input */}
      <div className="inline-flex items-center gap-1 shrink-0">
        <span
          className="inline-flex items-center justify-center shrink-0"
          title="Data de Dia/Mês (não reseta à meia-noite)"
        >
          <MoneySymbolIcon className={compact ? 'w-[16px] h-[16px]' : 'w-[17px] h-[17px]'} />
        </span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={draftDate}
          placeholder="DD/MM"
          aria-label={`Data dia e mês de ${item.name}`}
          data-testid={`pwa-money-date-${item.id}`}
          title="Dia e mês (DD/MM) — permanente, não reseta à meia-noite"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const next = sanitizeDayMonthTyping(e.target.value);
            setDraftDate(next);
            if (onUpdateMoneyDate && (next === '' || /^\d{2}\/\d{2}$/.test(next))) {
              onUpdateMoneyDate(item, next);
            }
          }}
          onBlur={(e) => commitDate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitDate((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setDraftDate(persistedDate);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`${
            compact ? 'w-[42px] h-[22px] text-[10px]' : 'w-[43px] h-[22px] text-[10px]'
          } font-mono font-bold text-center rounded-md border px-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
            hasDateValue
              ? 'bg-emerald-950/45 border-emerald-400/75 text-emerald-300 shadow-[0_0_8px_-3px_rgba(16,185,129,0.4)]'
              : 'bg-neutral-950/90 border-neutral-600/85 text-neutral-100 placeholder:text-neutral-500 hover:border-emerald-400/60'
          }`}
        />
      </div>

      {/* Right: Optional Daily Check (Green ✓) or X (Red ✕) Markers for COM, RB, BON */}
      <div
        className={
          isStacked
            ? 'grid grid-cols-3 gap-1 w-full'
            : 'inline-flex items-center gap-1 flex-wrap'
        }
      >
        {DAILY_FLAG_META.map(({ key, label, badgeColorClass }) => {
          const flagState = getPWAFlagState({ flags: effectiveFlags }, key, todayStr);
          const isCheck = flagState === 'check';
          const isX = flagState === 'x';

          const chipContainerTone = isCheck
            ? 'bg-emerald-950/40 border-emerald-500/75 shadow-[0_0_10px_-4px_rgba(16,185,129,0.55)]'
            : isX
            ? 'bg-rose-950/40 border-rose-500/75 shadow-[0_0_10px_-4px_rgba(244,63,94,0.55)]'
            : 'bg-neutral-900/95 border-neutral-600/80';

          const checkBtnClass = isCheck
            ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.55)]'
            : isX
            ? 'text-emerald-400/30 hover:text-emerald-300 hover:bg-emerald-500/15'
            : 'text-emerald-400/75 hover:text-emerald-300 hover:bg-emerald-500/20';

          const xBtnClass = isX
            ? 'bg-rose-500/25 text-rose-300 ring-1 ring-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.55)]'
            : isCheck
            ? 'text-rose-400/30 hover:text-rose-300 hover:bg-rose-500/15'
            : 'text-rose-400/75 hover:text-rose-300 hover:bg-rose-500/20';

          return (
            <div
              key={key}
              data-testid={`pwa-flag-${key}-${item.id}`}
              data-state={flagState ?? 'none'}
              title={`${label}: ${
                isCheck ? 'Check verde (✓)' : isX ? 'X vermelho (✕)' : 'Opcional (sem marcação)'
              } — reseta diariamente à meia-noite`}
              className={`inline-flex items-center rounded-md border font-bold tracking-wide transition-all duration-150 select-none ${
                isStacked
                  ? 'flex-col justify-center gap-0.5 px-1 py-1 w-full'
                  : 'gap-0.5 px-1 py-0.5'
              } ${chipContainerTone}`}
            >
              <span
                className={`${
                  isStacked
                    ? 'text-[9.5px] leading-none'
                    : 'text-[9.5px] leading-none mr-0.5'
                } ${isCheck ? 'text-emerald-200' : isX ? 'text-rose-200' : badgeColorClass}`}
              >
                {label}
              </span>

              <div className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  aria-pressed={isCheck}
                  aria-label={`Marcar check verde em ${label} de ${item.name}`}
                  data-testid={`pwa-flag-${key}-check-${item.id}`}
                  title={
                    isCheck
                      ? `Remover check verde de ${label}`
                      : `Marcar check verde (✓) em ${label}`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(item, key, 'check');
                  }}
                  className={`${
                    isStacked
                      ? 'w-[20px] h-[17px]'
                      : 'w-[15px] h-[15px]'
                  } rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 ${checkBtnClass}`}
                >
                  <Check className={isStacked ? 'w-3 h-3 stroke-[3]' : 'w-2.5 h-2.5 stroke-[3]'} />
                </button>

                <button
                  type="button"
                  aria-pressed={isX}
                  aria-label={`Marcar X vermelho em ${label} de ${item.name}`}
                  data-testid={`pwa-flag-${key}-x-${item.id}`}
                  title={
                    isX
                      ? `Remover X vermelho de ${label}`
                      : `Marcar X vermelho (✕) em ${label}`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(item, key, 'x');
                  }}
                  className={`${
                    isStacked
                      ? 'w-[20px] h-[17px]'
                      : 'w-[15px] h-[15px]'
                  } rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 ${xBtnClass}`}
                >
                  <X className={isStacked ? 'w-3 h-3 stroke-[3]' : 'w-2.5 h-2.5 stroke-[3]'} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
