import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { DailyFlagKey, FlagFilterKey, PWAFlags, PWAItem } from '../types/pwa';
import {
  isPWAFlagActive,
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
  activeChipClass: string;
  inactiveChipClass: string;
  checkboxActiveClass: string;
  filterActiveClass: string;
}> = [
  {
    key: 'com',
    label: 'COM',
    badgeColorClass: 'text-sky-300',
    activeChipClass:
      'bg-sky-500/22 border-sky-400 text-sky-100 shadow-[0_0_10px_-3px_rgba(56,189,248,0.5)]',
    inactiveChipClass:
      'bg-neutral-900/95 border-neutral-600/85 text-neutral-100 hover:border-sky-400/70 hover:bg-neutral-800/90',
    checkboxActiveClass:
      'bg-sky-400 border-sky-300 text-neutral-950 shadow-[0_0_8px_-1px_rgba(56,189,248,0.65)]',
    filterActiveClass:
      'bg-sky-500/18 border-sky-400/75 text-sky-200 shadow-[0_0_12px_-4px_rgba(56,189,248,0.5)]',
  },
  {
    key: 'rb',
    label: 'RB',
    badgeColorClass: 'text-amber-300',
    activeChipClass:
      'bg-amber-500/22 border-amber-400 text-amber-100 shadow-[0_0_10px_-3px_rgba(251,191,36,0.5)]',
    inactiveChipClass:
      'bg-neutral-900/95 border-neutral-600/85 text-neutral-100 hover:border-amber-400/70 hover:bg-neutral-800/90',
    checkboxActiveClass:
      'bg-amber-400 border-amber-300 text-neutral-950 shadow-[0_0_8px_-1px_rgba(251,191,36,0.65)]',
    filterActiveClass:
      'bg-amber-500/18 border-amber-400/75 text-amber-200 shadow-[0_0_12px_-4px_rgba(245,158,11,0.5)]',
  },
  {
    key: 'bon',
    label: 'BON',
    badgeColorClass: 'text-violet-300',
    activeChipClass:
      'bg-violet-500/22 border-violet-400 text-violet-100 shadow-[0_0_10px_-3px_rgba(167,139,250,0.5)]',
    inactiveChipClass:
      'bg-neutral-900/95 border-neutral-600/85 text-neutral-100 hover:border-violet-400/70 hover:bg-neutral-800/90',
    checkboxActiveClass:
      'bg-violet-400 border-violet-300 text-neutral-950 shadow-[0_0_8px_-1px_rgba(167,139,250,0.65)]',
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
  onToggleFlag: (item: PWAItem, flag: DailyFlagKey) => void;
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
          : `flex items-center justify-between flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* Left: Prominent Green $ Icon + Persistent DD/MM Input */}
      <div className="inline-flex items-center gap-1.5 shrink-0">
        <span
          className="inline-flex items-center justify-center shrink-0"
          title="Data de Dia/Mês (não reseta à meia-noite)"
        >
          <MoneySymbolIcon className={compact ? 'w-[17px] h-[17px]' : 'w-[20px] h-[20px]'} />
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
            compact ? 'w-[48px] h-[22px] text-[10px]' : 'w-[54px] h-[24px] text-[11px]'
          } font-mono font-bold text-center rounded-md border px-1 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
            hasDateValue
              ? 'bg-emerald-950/45 border-emerald-400/75 text-emerald-300 shadow-[0_0_8px_-3px_rgba(16,185,129,0.4)]'
              : 'bg-neutral-950/90 border-neutral-600/85 text-neutral-100 placeholder:text-neutral-500 hover:border-emerald-400/60'
          }`}
        />
      </div>

      {/* Right: Highlighted Daily Checkboxes (COM, RB, BON — auto-reset at midnight) */}
      <div
        className={
          isStacked
            ? 'grid grid-cols-3 gap-1 w-full'
            : `inline-flex items-center ${compact ? 'gap-1' : 'gap-1.5'} flex-wrap`
        }
      >
        {DAILY_FLAG_META.map(
          ({
            key,
            label,
            badgeColorClass,
            activeChipClass,
            inactiveChipClass,
            checkboxActiveClass,
          }) => {
            const checked = isPWAFlagActive({ flags: effectiveFlags }, key, todayStr);
            return (
              <button
                key={key}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`Marcar ${label} em ${item.name}`}
                data-testid={`pwa-flag-${key}-${item.id}`}
                title={`${label}: ${
                  checked ? 'Marcado hoje' : 'Desmarcado'
                } (reseta diariamente à meia-noite)`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFlag(item, key);
                }}
                className={`group/flag inline-flex items-center ${
                  isStacked
                    ? 'justify-between gap-1 px-1.5 py-0.5 text-[10px] w-full'
                    : compact
                    ? 'gap-1 px-1.5 py-0.5 text-[10px]'
                    : 'gap-1.5 px-1.5 py-0.5 text-[11px]'
                } rounded-md border font-bold tracking-wide transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 ${
                  checked ? activeChipClass : inactiveChipClass
                }`}
              >
                <span className={checked ? '' : badgeColorClass}>{label}</span>
                <span
                  className={`${
                    compact ? 'w-[13px] h-[13px]' : 'w-[14px] h-[14px]'
                  } rounded-[3px] border flex items-center justify-center shrink-0 transition-all duration-150 ${
                    checked
                      ? checkboxActiveClass
                      : 'border-neutral-400/85 bg-neutral-950 group-hover/flag:border-white text-transparent'
                  }`}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                </span>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
};
