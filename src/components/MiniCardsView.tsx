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
  onToggleSelect?: (id: string) => void;
  onSelectCard?: (
    id: string,
    modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; fromCheckbox?: boolean }
  ) => void;
  onLaunch: (item: PWAItem) => void;
  groupByGroup?: boolean;
}

export const MiniCardsView: React.FC<MiniCardsViewProps> = React.memo(({
  items,
  todayStr,
  selectedIds = new Set<string>(),
  onToggleSelect,
  onSelectCard,
  onLaunch,
  groupByGroup = false,
}) => {
  if (items.length === 0) {
    return (
      <div key="minicards-empty" data-testid="minicards-empty-state" className="py-20 text-center text-neutral-400">
        <p className="text-sm font-medium text-neutral-300">Nenhuma PWA encontrada com os filtros atuais.</p>
        <p className="text-xs text-neutral-500 mt-1">Tente ajustar a busca, alterar a categoria ou cadastrar novas PWAs.</p>
      </div>
    );
  }

  const renderMiniCard = (item: PWAItem, renderKey: string) => {
    const isAccessed = isAccessedToday(item.lastAccessedDate, todayStr);
    const isSelected = selectedIds.has(item.id);
    const moneyDate = item.flags?.moneyDate?.trim() || '';

    return (
      <div
        key={renderKey}
        data-testid={`mini-card-${item.id}`}
        onMouseDown={(e) => {
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.preventDefault();
          }
        }}
        onClick={(e) => {
          if (onSelectCard) {
            onSelectCard(item.id, {
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
            });
          } else if (onToggleSelect) {
            onToggleSelect(item.id);
          }
        }}
        className={`group relative overflow-hidden rounded-xl bg-[#14151a] hover:bg-[#181920] transition-all flex items-stretch min-h-[78px] cursor-pointer select-none ${
          isAccessed
            ? 'border-[3px] border-emerald-400/90 hover:border-emerald-300 shadow-[0_0_18px_-4px_rgba(16,185,129,0.48),inset_0_0_24px_3px_rgba(16,185,129,0.32)]'
            : 'border-[3px] border-rose-500/90 hover:border-rose-400 shadow-[0_0_18px_-4px_rgba(244,63,94,0.45),inset_0_0_24px_3px_rgba(244,63,94,0.3)]'
        } ${isSelected ? 'outline-2 outline-offset-2 outline-sky-400 bg-[#1a2030]' : ''}`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 rounded-[9px] ${
            isAccessed
              ? 'bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(16,185,129,0.2)_100%)]'
              : 'bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(244,63,94,0.2)_100%)]'
          }`}
        />
        {/* Left: Full-height prominent Icon occupying top to bottom */}
        <button
          type="button"
          data-testid={`mini-launch-pwa-icon-${item.id}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onLaunch(item);
          }}
          className="relative z-10 w-[76px] sm:w-[82px] self-stretch shrink-0 p-1.5 bg-neutral-950/75 hover:bg-neutral-900/95 border-r border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-emerald-400"
          title={`Clique no ícone para abrir ${item.name}`}
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
        <div className="relative z-10 flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-2">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h3 className="min-w-0 leading-tight truncate">
              <button
                type="button"
                data-testid={`mini-launch-pwa-name-${item.id}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onLaunch(item);
                }}
                className="max-w-full font-bold text-sm text-white hover:text-emerald-400 cursor-pointer truncate transition-colors text-left align-top focus-visible:outline-none focus-visible:underline"
                title={`Abrir ${item.name}`}
              >
                {item.name}
              </button>
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

  const getRenderKey = (() => {
    const seen = new Map<string, number>();
    return (item: PWAItem, idx: number) => {
      const base = item.id || `idx_${idx}`;
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      return count === 0 ? base : `${base}__rk_${count}`;
    };
  })();

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
      <div key="minicards-grouped" className="space-y-6">
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
                {groupItems.map((it, idx) => renderMiniCard(it, getRenderKey(it, idx)))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div key="minicards-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {items.map((it, idx) => renderMiniCard(it, getRenderKey(it, idx)))}
    </div>
  );
});
