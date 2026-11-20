import React from 'react';
import { ExternalLink, Trash2, Edit2, User, Clock, Copy } from 'lucide-react';
import { DailyFlagKey, DailyFlagState, PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { StatusIndicator } from './StatusIndicator';
import { InlineNoteInput } from './InlineNoteInput';
import { StarRating } from './StarRating';
import { PWAFlagsControl } from './PWAFlagsControl';
import { isAccessedToday, getCleanDomain, formatAccessDateTime, formatChromeProfileDisplay } from '../utils/pwaLogic';

interface DenseGridViewProps {
  items: PWAItem[];
  todayStr: string;
  onLaunch: (item: PWAItem) => void;
  onToggleStatus: (item: PWAItem) => void;
  onUpdateNote: (item: PWAItem, newNote: string) => void;
  onToggleFlag?: (item: PWAItem, flag: DailyFlagKey, state?: DailyFlagState | null) => void;
  onUpdateMoneyDate?: (item: PWAItem, moneyDate: string) => void;
  onTogglePin: (item: PWAItem) => void;
  onSetRating?: (item: PWAItem, rating: number) => void;
  onEdit: (item: PWAItem) => void;
  onClone?: (item: PWAItem) => void;
  onDelete: (id: string) => void;
}

export const DenseGridView: React.FC<DenseGridViewProps> = ({
  items,
  todayStr,
  onLaunch,
  onToggleStatus,
  onUpdateNote,
  onToggleFlag,
  onUpdateMoneyDate,
  onTogglePin,
  onSetRating,
  onEdit,
  onClone,
  onDelete,
}) => {
  if (items.length === 0) {
    return (
      <div key="densegrid-empty" className="py-16 text-center text-neutral-400">
        <p className="text-sm font-medium">Nenhuma PWA encontrada com os filtros atuais.</p>
        <p className="text-xs text-neutral-400 mt-1">Tente ajustar a busca ou adicionar uma nova PWA.</p>
      </div>
    );
  }

  const seenKeys = new Map<string, number>();

  return (
    <div key="densegrid-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
      {items.map((item, idx) => {
        const accessed = isAccessedToday(item.lastAccessedDate, todayStr);
        const domain = getCleanDomain(item.url);
        const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
        const accessLog = formatAccessDateTime(item.lastAccessedDate);
        const chromeProfile = formatChromeProfileDisplay(item);
        const baseKey = item.id || `idx_${idx}`;
        const keyCount = seenKeys.get(baseKey) || 0;
        seenKeys.set(baseKey, keyCount + 1);
        const renderKey = keyCount === 0 ? baseKey : `${baseKey}__rk_${keyCount}`;

        return (
          <div
            key={renderKey}
            className={`group relative flex flex-col justify-between p-2.5 rounded-lg border-2 bg-neutral-900/40 hover:bg-neutral-900/80 transition-all ${
              accessed
                ? 'border-emerald-500/80 hover:border-emerald-400 shadow-[0_0_14px_-5px_rgba(16,185,129,0.35)]'
                : 'border-rose-500/75 hover:border-rose-400 shadow-[0_0_14px_-5px_rgba(244,63,94,0.32)]'
            }`}
          >
            {/* Header: Icon, Name, Pin/Rating, Status */}
            <div>
              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="cursor-pointer shrink-0 transition-transform active:scale-95"
                    onClick={() => onLaunch(item)}
                    title={`Abrir ${item.name} (marca como acessado hoje)`}
                  >
                    <PWAIcon icon={item.icon} name={item.name} url={item.url} size="md" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      onClick={() => onLaunch(item)}
                      className="font-semibold text-xs text-neutral-200 group-hover:text-emerald-400 truncate cursor-pointer transition-colors"
                      title={item.name}
                    >
                      {item.name}
                    </h3>
                    <p
                      className="text-[10px] text-neutral-400 truncate flex items-center gap-1"
                      title={item.url}
                    >
                      <span className="truncate">{domain}</span>
                      {item.isPossibleDuplicate && (
                        <span
                          className="px-1 py-0.2 rounded bg-amber-950/80 border border-amber-800/80 text-amber-300 text-[8px] font-medium shrink-0"
                          title={item.possibleDuplicateReason || 'Possível duplicata'}
                        >
                          ⚠️
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <StatusIndicator
                    lastAccessedDate={item.lastAccessedDate}
                    todayStr={todayStr}
                    onToggle={() => onToggleStatus(item)}
                    compact={true}
                    showText={false}
                  />
                </div>
              </div>

              {/* 1 to 5 Stars Rating Bar + Chrome Profile Badge */}
              <div className="flex items-center justify-between gap-1 text-[10px] text-neutral-400 mb-1.5 font-mono">
                <div className="flex items-center gap-1 min-w-0">
                  <StarRating
                    rating={currentRating}
                    onChange={(newRating) => (onSetRating ? onSetRating(item, newRating) : onTogglePin(item))}
                    size="xs"
                    compact={true}
                    className="shrink-0"
                  />
                  {chromeProfile && (
                    <span
                      title={chromeProfile.tooltip}
                      aria-label={chromeProfile.tooltip}
                      data-testid={`chrome-profile-badge-${item.id}`}
                      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-sky-950/90 border border-sky-700/70 text-sky-300 text-[9px] font-sans font-semibold min-w-0 max-w-[76px] leading-none whitespace-nowrap"
                    >
                      <User className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                      <span className="truncate">{chromeProfile.badgeText}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStatus(item);
                  }}
                  className={`cursor-pointer hover:opacity-80 transition-opacity font-mono text-[10px] ${
                    accessed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'
                  }`}
                  title="Clique para alternar status"
                >
                  {accessed ? '✓ Acessado' : '● Pendente'}
                </button>
              </div>

              {/* Access log: Date & Time */}
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-1.5 notranslate" translate="no">
                <span className="text-neutral-500 text-[9px]">Acesso:</span>
                {accessLog.hasRecord ? (
                  <span className="inline-flex items-center gap-1 text-neutral-300" title={`Registro de acesso: ${accessLog.fullStr}`}>
                    <Clock className="w-2.5 h-2.5 text-emerald-400" />
                    <span>{accessLog.dateStr}</span>
                    {accessLog.timeStr && (
                      <span className="text-emerald-400 font-semibold">{accessLog.timeStr}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-neutral-500 italic text-[9px]">— Sem registro</span>
                )}
              </div>

              {/* Note field */}
              <div className="mb-2">
                <InlineNoteInput
                  initialValue={item.notes}
                  onSave={(newNote) => onUpdateNote(item, newNote)}
                  placeholder="Nota..."
                  className="bg-neutral-950/40"
                  compact={false}
                />
              </div>

              {onToggleFlag && (
                <div className="mb-1.5 pt-2 border-t border-white/[0.06]">
                  <PWAFlagsControl
                    item={item}
                    todayStr={todayStr}
                    onToggleFlag={onToggleFlag}
                    onUpdateMoneyDate={onUpdateMoneyDate}
                    compact={true}
                  />
                </div>
              )}
            </div>

            {/* Bottom Actions: Editar, Excluir, Abrir */}
            <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 mt-1 gap-1">
              <div className="flex items-center gap-1">
                {onClone && (
                  <button
                    type="button"
                    onClick={() => onClone(item)}
                    title={`Clonar ${item.name} para outro Perfil`}
                    aria-label={`Clonar ${item.name} para outro Perfil`}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-neutral-400 hover:text-sky-300 hover:bg-sky-950/40 text-[10px] font-medium transition-colors cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Clonar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  title={`Editar ${item.name}`}
                  aria-label={`Editar ${item.name}`}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 text-[10px] font-medium transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  title={`Excluir ${item.name}`}
                  aria-label={`Excluir ${item.name}`}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 text-[10px] font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Excluir</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onLaunch(item)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-[11px] font-medium transition-colors cursor-pointer shrink-0"
              >
                <ExternalLink className="w-2.5 h-2.5 text-emerald-400" />
                <span>Abrir</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
