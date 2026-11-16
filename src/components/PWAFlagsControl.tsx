import React, { useId } from 'react';
import { Check } from 'lucide-react';
import { FlagFilterKey, PWAFlags, PWAItem } from '../types/pwa';

export const GoldBarIcon: React.FC<{ className?: string; active?: boolean }> = ({
  className = 'w-[19px] h-[14px]',
  active = true,
}) => {
  const uid = useId().replace(/:/g, '');
  const topGradId = `gold-top-${uid}`;
  const frontGradId = `gold-front-${uid}`;
  const sideGradId = `gold-side-${uid}`;

  return (
    <svg
      viewBox="0 0 28 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} transition-all duration-150 ${
        active
          ? 'opacity-100 drop-shadow-[0_1px_5px_rgba(251,191,36,0.42)]'
          : 'opacity-70 saturate-75 group-hover/flag:opacity-100 group-hover/flag:saturate-100'
      }`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={topGradId} x1="4" y1="3" x2="24" y2="11" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="48%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#EAB308" />
        </linearGradient>
        <linearGradient id={frontGradId} x1="2" y1="11" x2="22" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id={sideGradId} x1="21" y1="6" x2="26" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
      </defs>
      {/* Top bright metallic face */}
      <path
        d="M7.5 3.5H22.5L19.8 10.8H3.2L7.5 3.5Z"
        fill={`url(#${topGradId})`}
      />
      {/* Front beveled face */}
      <path
        d="M3.2 10.8H19.8L21.4 16.5H1.8L3.2 10.8Z"
        fill={`url(#${frontGradId})`}
      />
      {/* Right 3D angled side face */}
      <path
        d="M22.5 3.5L26 9.2L21.4 16.5L19.8 10.8L22.5 3.5Z"
        fill={`url(#${sideGradId})`}
      />
      {/* Subtle engraved top inner edge & metallic specular gleam */}
      <path
        d="M8.5 5.2H15.2L13.3 9.1H6.6L8.5 5.2Z"
        fill="#FFFFFF"
        fillOpacity="0.38"
      />
      <path
        d="M3.2 10.8H19.8L22.5 3.5"
        stroke="#FEF08A"
        strokeOpacity="0.7"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const TwoWayArrowsIcon: React.FC<{ className?: string }> = ({
  className = 'w-[17px] h-[17px]',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Top arrow going right */}
    <path
      d="M4.5 8H19.5M19.5 8L15.8 4.4M19.5 8L15.8 11.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Bottom arrow returning left */}
    <path
      d="M19.5 16H4.5M4.5 16L8.2 12.4M4.5 16L8.2 19.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MoneySymbolIcon: React.FC<{ className?: string }> = ({
  className = 'w-[17px] h-[17px]',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Subtle coin medallion */}
    <circle
      cx="12"
      cy="12"
      r="9.5"
      fill="currentColor"
      fillOpacity="0.12"
      stroke="currentColor"
      strokeOpacity="0.45"
      strokeWidth="1.4"
    />
    {/* Crisp dollar emblem */}
    <path
      d="M12 6.2V17.8M14.8 8.8C14.8 7.6 13.55 6.8 12 6.8C10.45 6.8 9.2 7.6 9.2 8.9C9.2 10.3 10.6 10.8 12 11.2C13.4 11.6 14.9 12.1 14.9 13.7C14.9 15.1 13.6 16 12 16C10.35 16 9.1 15.1 9.1 13.8"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FLAG_META: Array<{
  key: FlagFilterKey;
  label: string;
  filterActiveClass: string;
  iconColorClass: string;
  checkboxActiveClass: string;
  itemActiveClass: string;
}> = [
  {
    key: 'money',
    label: 'Dinheiro',
    filterActiveClass:
      'bg-emerald-500/15 border-emerald-400/60 text-emerald-200 shadow-[0_0_12px_-4px_rgba(16,185,129,0.45)]',
    iconColorClass: 'text-emerald-400',
    checkboxActiveClass:
      'bg-emerald-500 border-emerald-400 text-neutral-950 shadow-[0_0_8px_-1px_rgba(16,185,129,0.55)]',
    itemActiveClass: 'bg-emerald-500/[0.08]',
  },
  {
    key: 'transfer',
    label: 'Vai e Volta',
    filterActiveClass:
      'bg-sky-500/15 border-sky-400/60 text-sky-200 shadow-[0_0_12px_-4px_rgba(56,189,248,0.45)]',
    iconColorClass: 'text-sky-400',
    checkboxActiveClass:
      'bg-sky-400 border-sky-300 text-neutral-950 shadow-[0_0_8px_-1px_rgba(56,189,248,0.55)]',
    itemActiveClass: 'bg-sky-500/[0.08]',
  },
  {
    key: 'gold',
    label: 'Barra de Ouro',
    filterActiveClass:
      'bg-amber-500/15 border-amber-400/60 text-amber-200 shadow-[0_0_12px_-4px_rgba(245,158,11,0.45)]',
    iconColorClass: 'text-amber-400',
    checkboxActiveClass:
      'bg-amber-400 border-amber-300 text-neutral-950 shadow-[0_0_8px_-1px_rgba(251,191,36,0.55)]',
    itemActiveClass: 'bg-amber-500/[0.08]',
  },
];

export function renderFlagIcon(key: FlagFilterKey, className?: string, active = true) {
  if (key === 'money') return <MoneySymbolIcon className={className || 'w-[17px] h-[17px]'} />;
  if (key === 'transfer') return <TwoWayArrowsIcon className={className || 'w-[17px] h-[17px]'} />;
  return <GoldBarIcon className={className || 'w-[19px] h-[14px]'} active={active} />;
}

interface PWAFlagsControlProps {
  item: PWAItem;
  flags?: PWAFlags;
  onToggleFlag: (item: PWAItem, flag: FlagFilterKey) => void;
  compact?: boolean;
}

export const PWAFlagsControl: React.FC<PWAFlagsControlProps> = ({
  item,
  flags,
  onToggleFlag,
  compact = false,
}) => {
  const effectiveFlags = flags ?? item.flags ?? {};

  return (
    <div
      className={`inline-flex items-center ${compact ? 'gap-2.5' : 'gap-3.5'} flex-wrap`}
      onClick={(e) => e.stopPropagation()}
    >
      {FLAG_META.map(({ key, label, iconColorClass, checkboxActiveClass, itemActiveClass }) => {
        const checked = Boolean(effectiveFlags[key]);
        return (
          <button
            key={key}
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`Marcar ${label} em ${item.name}`}
            data-testid={`pwa-flag-${key}-${item.id}`}
            title={`${label}: ${checked ? 'Marcado (clique para desmarcar)' : 'Desmarcado (clique para marcar)'}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFlag(item, key);
            }}
            className={`group/flag inline-flex items-center gap-1.5 px-1.5 py-1 -mx-1 rounded-md transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 ${
              checked
                ? itemActiveClass
                : 'hover:bg-white/[0.05]'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center transition-all duration-150 ${
                checked
                  ? iconColorClass
                  : 'text-neutral-400/80 group-hover/flag:text-neutral-200'
              }`}
            >
              {renderFlagIcon(
                key,
                key === 'gold'
                  ? compact
                    ? 'w-[17px] h-[12px]'
                    : 'w-[19px] h-[14px]'
                  : compact
                  ? 'w-[15px] h-[15px]'
                  : 'w-[17px] h-[17px]',
                checked
              )}
            </span>
            <span
              className={`w-[15px] h-[15px] rounded-[4px] border flex items-center justify-center shrink-0 transition-all duration-150 ${
                checked
                  ? checkboxActiveClass
                  : 'border-neutral-600/85 bg-neutral-950/70 group-hover/flag:border-neutral-400 text-transparent'
              }`}
            >
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          </button>
        );
      })}
    </div>
  );
};
