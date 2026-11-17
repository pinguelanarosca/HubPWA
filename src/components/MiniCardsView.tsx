import React from 'react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { DAILY_FLAG_META, MoneySymbolIcon } from './PWAFlagsControl';
import { getPWAFlagState, isAccessedToday } from '../utils/pwaLogic';
import { Folder } from 'lucide-react';

interface MiniCardsViewProps {
  items: PWAItem[];
  todayStr: string;
  selectedIds?: Set<string>;
  onLaunch: (item: PWAItem) => void;
  groupByGroup?: boolean;
}

export const MiniCardsView: React.FC<MiniCardsViewProps> = ({
  items,
  todayStr,
  selectedIds = new Set<string>(),
  onLaunch,
  groupByGroup = false,
}) => {
  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-neutral-400">
        <p className="text-sm font-medium text-neutral-300">Nenhuma PWA encontrada com os filtros atuais.</p>
        <p className="text-xs text-neutral-500 mt-1">Tente ajustar a busca, alterar a categoria ou cadastrar novas PWAs.</p>
      </div>
    );
  }

  const renderMiniCard = (item: PWAItem) => {
    const isAccessed = isAccessedToday(item.lastAccessedDate, todayStr);
    const isSelected = selectedIds.has(item.id);
    const moneyDate = item.flags?.moneyDate?.trim() || '';

    return (
      <div
        key={item.id}
        data-testid={`mini-card-${item.id}`}
        className={`group relative overflow-hidden rounded-xl bg-[#14151a] hover:bg-[#181920] transition-all flex items-stretch min-h-[78px] ${
          isAccessed
            ? 'border-2 border-emerald-500/80 hover:border-emerald-400 shadow-[0_0_16px_-6px_rgba(16,185,129,0.42)]'
            : 'border-2 border-rose-500/75 hover:border-rose-400 shadow-[0_0_16px_-6px_rgba(244,63,94,0.38)]'
        } ${isSelected ? 'ring-2 ring-emerald-400 bg-[#1a1c24]' : ''}`}
      >
        {/* Left: Full-height prominent Icon occupying top to bottom */}
        <button
          type="button"
          onClick={() => onLaunch(item)}
          className="w-[76px] sm:w-[82px] self-stretch shrink-0 p-1.5 bg-neutral-950/75 hover:bg-neutral-900/95 border-r border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-emerald-400"
          title={`Abrir ${item.name}`}
          aria-label={`Abrir ${item.name}`}
        >
          <PWAIcon
            icon={item.icon}
            name={item.name}
            url={item.url}
            size="fill"
            className="w-full h-full rounded-lg border-0 bg-transparent p-0.5 transition-transform duration-150 group-hover:scale-[1.03] active:scale-95"
          />
        </button>

        {/* Right: Name + optional read-only $ date on top, read-only COM/RB/BON status dots below */}
        <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-2">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h3
              onClick={() => onLaunch(item)}
              className="font-bold text-sm text-white hover:text-emerald-400 cursor-pointer truncate transition-colors leading-tight"
              title={`Abrir ${item.name}`}
            >
              {item.name}
            </h3>

            {moneyDate && (
              <span
                data-testid={`mini-card-money-date-${item.id}`}
                title="Data registrada ($)"
                className="inline-flex items-center gap-1 shrink-0 text-[11px] font-mono font-bold text-emerald-300"
              >
                <MoneySymbolIcon className="w-3.5 h-3.5" />
                <span>{moneyDate}</span>
              </span>
            )}
          </div>

          {/* Read-only daily status dots: Acronym followed by corresponding colored dot */}
          <div
            className="flex items-center gap-3 flex-wrap"
            aria-label={`Estado das marcações de ${item.name}`}
          >
            {DAILY_FLAG_META.map(({ key, label }) => {
              const flagState = getPWAFlagState(item, key, todayStr);
              const isCheck = flagState === 'check';
              const isX = flagState === 'x';

              const textTone = isCheck
                ? 'text-emerald-300'
                : isX
                ? 'text-rose-300'
                : 'text-neutral-500';

              const dotTone = isCheck
                ? 'bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]'
                : isX
                ? 'bg-rose-500 shadow-[0_0_7px_rgba(244,63,94,0.8)]'
                : 'bg-neutral-700 border border-neutral-600';

              const statusTitle = isCheck
                ? `${label}: Verde (✓)`
                : isX
                ? `${label}: Vermelho (✕)`
                : `${label}: Sem marcação hoje`;

              return (
                <span
                  key={key}
                  data-testid={`mini-card-flag-${key}-${item.id}`}
                  data-state={flagState ?? 'none'}
                  title={statusTitle}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide select-none ${textTone}`}
                >
                  <span>{label}</span>
                  <span
                    aria-hidden="true"
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotTone}`}
                  />
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (groupByGroup) {
    const groupsMap = new Map<string, PWAItem[]>();
    items.forEach((item) => {
      const g = item.group || item.category || 'Geral';
      if (!groupsMap.has(g)) {
        groupsMap.set(g, []);
      }
      groupsMap.get(g)!.push(item);
    });

    const sortedGroupNames = Array.from(groupsMap.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return (
      <div className="space-y-6">
        {sortedGroupNames.map((grpName) => {
          const groupItems = groupsMap.get(grpName) || [];
          return (
            <section key={grpName} className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs font-bold text-neutral-200 tracking-wider uppercase">
                    {grpName}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] font-mono text-neutral-400">
                    {groupItems.length}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {groupItems.map(renderMiniCard)}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {items.map(renderMiniCard)}
    </div>
  );
};
