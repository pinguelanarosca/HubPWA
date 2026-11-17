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
  layout?: 'row' | 'stacked' | 'grid2x2';
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
  const isGrid2x2 = layout === 'grid2x2';

  if (isGrid2x2) {
    return (
      <div className="grid grid-cols-2 gap-1 w-full" onClick={(e) => e.stopPropagation()}>
        {/* Cell 1: Money Date */}
        <div className="inline-flex items-center justify-between gap-1 px-1.5 py-0.5 rounded border border-emerald-500/80 bg-emerald-950/45 text-[9.5px]">
          <span className="flex items-center gap-0.5 text-emerald-300 font-bold shrink-0">
            <MoneySymbolIcon className="w-[13px] h-[13px]" />
            <span>$</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={draftDate}
            placeholder="DD/MM"
            aria-label={`Data dia e mês de ${item.name}`}
            data-testid={`pwa-money-date-${item.id}`}
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
            className="w-[42px] h-[15px] font-mono font-bold text-center rounded bg-neutral-950/90 border border-emerald-400/75 text-emerald-300 text-[9px] focus:outline-none"
          />
        </div>

        {/* Cells 2, 3, 4: COM, RB, BON */}
        {DAILY_FLAG_META.map(({ key, label }) => {
          const rawState = getPWAFlagState({ flags: effectiveFlags }, key, todayStr);
          const flagState: DailyFlagState = rawState === 'x' ? 'x' : 'check';
          const isCheck = flagState === 'check';
          const trackTone = isCheck
            ? 'bg-emerald-950/70 border-emerald-500/80'
            : 'bg-rose-950/70 border-rose-500/80';

          return (
            <div
              key={key}
              data-testid={`pwa-flag-${key}-${item.id}`}
              data-state={flagState}
              className={`inline-flex items-center justify-between gap-1 px-1.5 py-0.5 rounded border font-bold tracking-wide select-none ${trackTone} text-[9.5px]`}
            >
              <span className={`leading-none ${isCheck ? 'text-emerald-200' : 'text-rose-200'}`}>
                {label}
              </span>

              <div className="relative inline-flex items-center w-[32px] h-[15px] bg-neutral-900 rounded-full border border-neutral-700 p-0.5 cursor-pointer shadow-inner shrink-0">
                <div className="absolute inset-0 flex items-center justify-between px-0.5 pointer-events-none text-[8px] font-bold">
                  <span className="text-rose-400 opacity-90">✕</span>
                  <span className="text-emerald-400 opacity-90">✓</span>
                </div>
                <div
                  className={`absolute top-0.5 bottom-0.5 w-[14px] rounded-full transition-all duration-200 flex items-center justify-center shadow-md ${
                    isCheck ? 'translate-x-[16px] bg-emerald-500 text-neutral-950' : 'translate-x-0 bg-rose-500 text-white'
                  }`}
                >
                  {isCheck ? (
                    <Check className="w-2 h-2 stroke-[3.5]" />
                  ) : (
                    <X className="w-2 h-2 stroke-[3.5]" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(item, key, 'x');
                  }}
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer z-10 bg-transparent border-0 focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(item, key, 'check');
                  }}
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer z-10 bg-transparent border-0 focus-visible:outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const isCompactRow = compact && !isStacked;

  return (
    <div
      className={
        isStacked
          ? 'flex flex-col gap-1.5 w-full'
          : 'flex items-center gap-1 shrink-0 max-w-full overflow-hidden'
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* Left: Prominent Green $ Icon + Persistent DD/MM Input */}
      <div className="inline-flex items-center gap-0.5 shrink-0">
        <span
          className="inline-flex items-center justify-center shrink-0"
          title="Data de Dia/Mês (não reseta à meia-noite)"
        >
          <MoneySymbolIcon className={isCompactRow ? 'w-[14px] h-[14px]' : 'w-[16px] h-[16px]'} />
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
            isCompactRow ? 'w-[38px] h-[20px] text-[9px]' : compact ? 'w-[42px] h-[22px] text-[10px]' : 'w-[43px] h-[22px] text-[10px]'
          } font-mono font-bold text-center rounded border px-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
            hasDateValue
              ? 'bg-emerald-950/45 border-emerald-400/75 text-emerald-300 shadow-[0_0_8px_-3px_rgba(16,185,129,0.4)]'
              : 'bg-neutral-950/90 border-neutral-600/85 text-neutral-100 placeholder:text-neutral-500 hover:border-emerald-400/60'
          }`}
        />
      </div>

      {/* Right: Compact Sliding Toggle Switch (Interruptor Deslizante) for COM, RB, BON */}
      <div
        className={
          isStacked
            ? 'flex flex-wrap items-center gap-1.5 w-full'
            : 'inline-flex items-center gap-1 shrink-0'
        }
      >
        {DAILY_FLAG_META.map(({ key, label, badgeColorClass }) => {
          const rawState = getPWAFlagState({ flags: effectiveFlags }, key, todayStr);
          // Non-null requirement: always either 'check' (green) or 'x' (red). Default to 'check' if un-set.
          const flagState: DailyFlagState = rawState === 'x' ? 'x' : 'check';
          const isCheck = flagState === 'check';
          const isX = flagState === 'x';

          const trackTone = isCheck
            ? 'bg-emerald-950/70 border-emerald-500/80 shadow-[0_0_10px_-4px_rgba(16,185,129,0.5)]'
            : 'bg-rose-950/70 border-rose-500/80 shadow-[0_0_10px_-4px_rgba(244,63,94,0.5)]';

          return (
            <div
              key={key}
              data-testid={`pwa-flag-${key}-${item.id}`}
              data-state={flagState}
              title={`${label}: ${
                isCheck ? 'Check verde (✓) à direita' : 'X vermelho (✕) à esquerda'
              } — reseta diariamente à meia-noite`}
              className={`inline-flex items-center ${isCompactRow ? 'gap-0.5 px-1 py-0.5 text-[9px]' : 'gap-1.5 px-1.5 py-0.5 text-[10px]'} rounded border font-bold tracking-wide select-none transition-all duration-150 shrink-0 whitespace-nowrap ${
                isStacked ? 'justify-between w-full' : ''
              } ${trackTone}`}
            >
              <span className={`leading-none shrink-0 ${isCheck ? 'text-emerald-200' : 'text-rose-200'}`}>
                {label}
              </span>

              {/* Compact sliding switch container */}
              <div
                className={`relative inline-flex items-center ${isCompactRow ? 'w-[32px] h-[15px]' : 'w-[40px] h-[17px]'} bg-neutral-900 rounded-full border border-neutral-700 p-0.5 cursor-pointer shadow-inner shrink-0`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Background ✕ (left) and ✓ (right) */}
                <div className={`absolute inset-0 flex items-center justify-between px-0.5 pointer-events-none ${isCompactRow ? 'text-[8px]' : 'text-[9px]'} font-bold`}>
                  <span className="text-rose-400 opacity-90">✕</span>
                  <span className="text-emerald-400 opacity-90">✓</span>
                </div>

                {/* Sliding thumb */}
                <div
                  className={`absolute top-0.5 bottom-0.5 ${isCompactRow ? 'w-[14px]' : 'w-[16px]'} rounded-full transition-all duration-200 flex items-center justify-center shadow-md ${
                    isCheck
                      ? isCompactRow ? 'translate-x-[16px] bg-emerald-500 text-neutral-950' : 'translate-x-[20px] bg-emerald-500 text-neutral-950'
                      : 'translate-x-0 bg-rose-500 text-white'
                  }`}
                >
                  {isCheck ? (
                    <Check className={isCompactRow ? 'w-2 h-2 stroke-[3.5]' : 'w-2.5 h-2.5 stroke-[3.5]'} />
                  ) : (
                    <X className={isCompactRow ? 'w-2 h-2 stroke-[3.5]' : 'w-2.5 h-2.5 stroke-[3.5]'} />
                  )}
                </div>

                {/* Left side click target (X red) */}
                <button
                  type="button"
                  aria-label={`Marcar X vermelho (✕) em ${label} de ${item.name}`}
                  data-testid={`pwa-flag-${key}-x-${item.id}`}
                  title={`Marcar X vermelho (✕) à esquerda`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(item, key, 'x');
                  }}
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer z-10 bg-transparent border-0 focus-visible:outline-none"
                />

                {/* Right side click target (Check green) */}
                <button
                  type="button"
                  aria-label={`Marcar check verde (✓) em ${label} de ${item.name}`}
                  data-testid={`pwa-flag-${key}-check-${item.id}`}
                  title={`Marcar check verde (✓) à direita`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFlag(item, key, 'check');
                  }}
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer z-10 bg-transparent border-0 focus-visible:outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
