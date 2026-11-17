import React from 'react';
import { DailyFlagKey, DailyFlagState, PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { PWAFlagsControl } from './PWAFlagsControl';
import { isAccessedToday } from '../utils/pwaLogic';
import { Folder } from 'lucide-react';

interface MiniCardsViewProps {
  items: PWAItem[];
  todayStr: string;
  selectedIds?: Set<string>;
  onLaunch: (item: PWAItem) => void;
  onToggleFlag: (item: PWAItem, flag: DailyFlagKey, state?: DailyFlagState | null) => void;
  onUpdateMoneyDate?: (item: PWAItem, moneyDate: string) => void;
  groupByGroup?: boolean;
}

export const MiniCardsView: React.FC<MiniCardsViewProps> = ({
  items,
  todayStr,
  selectedIds = new Set<string>(),
  onLaunch,
  onToggleFlag,
  onUpdateMoneyDate,
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

    return (
      <div
        key={item.id}
        data-testid={`mini-card-${item.id}`}
        className={`group relative overflow-hidden rounded-xl bg-[#14151a] hover:bg-[#181920] transition-all flex items-stretch min-h-[96px] ${
          isAccessed
            ? 'border-2 border-emerald-500/80 hover:border-emerald-400 shadow-[0_0_16px_-6px_rgba(16,185,129,0.42)]'
            : 'border-2 border-rose-500/75 hover:border-rose-400 shadow-[0_0_16px_-6px_rgba(244,63,94,0.38)]'
        } ${isSelected ? 'ring-2 ring-emerald-400 bg-[#1a1c24]' : ''}`}
      >
        {/* Left: Full-height prominent Icon occupying top to bottom */}
        <button
          type="button"
          onClick={() => onLaunch(item)}
          className="w-[88px] sm:w-[94px] self-stretch shrink-0 p-2 bg-neutral-950/75 hover:bg-neutral-900/95 border-r border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-emerald-400"
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

        {/* Right: Name on top + $ Date and COM, RB, BON beside icon */}
        <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-between gap-2">
          <h3
            onClick={() => onLaunch(item)}
            className="font-bold text-sm text-white hover:text-emerald-400 cursor-pointer truncate transition-colors leading-tight"
            title={`Abrir ${item.name}`}
          >
            {item.name}
          </h3>

          <PWAFlagsControl
            item={item}
            todayStr={todayStr}
            onToggleFlag={onToggleFlag}
            onUpdateMoneyDate={onUpdateMoneyDate}
            compact={true}
            layout="stacked"
          />
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
