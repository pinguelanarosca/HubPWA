import React from 'react';
import { ExternalLink, Star, Trash2, Edit2, User, Clock } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { StatusIndicator } from './StatusIndicator';
import { InlineNoteInput } from './InlineNoteInput';
import { StarRating } from './StarRating';
import { getCleanDomain, formatAccessDateTime } from '../utils/pwaLogic';

interface CardsViewProps {
  items: PWAItem[];
  todayStr: string;
  onLaunch: (item: PWAItem) => void;
  onToggleStatus: (item: PWAItem) => void;
  onUpdateNote: (item: PWAItem, newNote: string) => void;
  onTogglePin: (item: PWAItem) => void;
  onSetRating?: (item: PWAItem, rating: number) => void;
  onEdit: (item: PWAItem) => void;
  onDelete: (id: string) => void;
}

export const CardsView: React.FC<CardsViewProps> = ({
  items,
  todayStr,
  onLaunch,
  onToggleStatus,
  onUpdateNote,
  onTogglePin,
  onSetRating,
  onEdit,
  onDelete,
}) => {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-neutral-400">
        <p className="text-sm font-medium">Nenhuma PWA encontrada com os filtros atuais.</p>
        <p className="text-xs text-neutral-400 mt-1">Tente ajustar a busca ou adicionar uma nova PWA.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item) => {
        const domain = getCleanDomain(item.url);
        const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
        const accessLog = formatAccessDateTime(item.lastAccessedDate);

        return (
          <div
            key={item.id}
            className="group relative p-3 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/70 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Card top row: Large 56x56 icon on left, info and status on right */}
              <div className="flex items-start gap-3 mb-2.5">
                {/* 56x56 Icon Protagonist (Clickable to Launch) */}
                <div
                  className="cursor-pointer shrink-0 transition-transform active:scale-95"
                  onClick={() => onLaunch(item)}
                  title={`Abrir ${item.name} (marca como acessado hoje)`}
                >
                  <PWAIcon icon={item.icon} name={item.name} size="xl" className="rounded-xl shadow-xs" />
                </div>

                {/* Right Info Column */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3
                          onClick={() => onLaunch(item)}
                          className="font-semibold text-xs text-neutral-100 group-hover:text-emerald-400 truncate cursor-pointer transition-colors"
                          title={item.name}
                        >
                          {item.name}
                        </h3>
                        {currentRating > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 text-[10px] font-semibold font-mono"
                            title={`${currentRating} de 5 estrelas`}
                          >
                            <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                            <span>{currentRating}</span>
                          </span>
                        )}
                      </div>
                      <p
                        onClick={() => onLaunch(item)}
                        className="text-[10px] text-neutral-400 hover:text-neutral-200 truncate mt-0.5 cursor-pointer transition-colors"
                        title={`Abrir ${item.url}`}
                      >
                        {domain}
                      </p>
                    </div>

                    {/* Status Indicator & Access Log (Date & Time) */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <StatusIndicator
                        lastAccessedDate={item.lastAccessedDate}
                        todayStr={todayStr}
                        onToggle={() => onToggleStatus(item)}
                        compact={false}
                        showText={true}
                      />
                      <div className="text-[10px] font-mono text-neutral-400 notranslate" translate="no">
                        {accessLog.hasRecord ? (
                          <span className="inline-flex items-center gap-1 text-neutral-300" title={`Último acesso: ${accessLog.fullStr}`}>
                            <Clock className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{accessLog.dateStr}</span>
                            {accessLog.timeStr && (
                              <span className="text-emerald-400 font-semibold">{accessLog.timeStr}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-neutral-500 italic">— Sem registro</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges: Chrome Profile, Aliases, and Possible Duplicate */}
                  <div className="flex items-center gap-1 flex-wrap mt-1.5">
                    {item.profileDirectory && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold font-mono shrink-0 ${
                          item.profileDirectory.toLowerCase().includes('5')
                            ? 'bg-emerald-950/80 border border-emerald-700/80 text-emerald-300'
                            : 'bg-blue-950/80 border border-blue-800/80 text-blue-300'
                        }`}
                      >
                        <User className="w-2.5 h-2.5" />
                        <span>{item.profileDirectory}</span>
                      </span>
                    )}
                    {item.isPossibleDuplicate && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-amber-300 text-[9px] font-medium shrink-0"
                        title={item.possibleDuplicateReason || 'Possível duplicata sinalizada para revisão'}
                      >
                        ⚠️ Possível duplicata
                      </span>
                    )}
                    {item.aliases && item.aliases.length > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 text-[9px] font-mono shrink-0">
                        {item.aliases.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Note input */}
              <div className="mb-2">
                <InlineNoteInput
                  initialValue={item.notes}
                  onSave={(newNote) => onUpdateNote(item, newNote)}
                  placeholder="Adicionar nota ou observação..."
                  className="bg-neutral-950/60"
                  compact={false}
                />
              </div>
            </div>

            {/* Card footer: 1 to 5 star rating, Editar, Excluir, Abrir PWA */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {/* 1 to 5 Stars Classification */}
                <StarRating
                  rating={currentRating}
                  onChange={(newRating) => (onSetRating ? onSetRating(item, newRating) : onTogglePin(item))}
                  size="sm"
                />

                <div className="flex items-center gap-1 border-l border-neutral-800 pl-2">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    title={`Editar ${item.name}`}
                    aria-label={`Editar ${item.name}`}
                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    title={`Excluir ${item.name}`}
                    aria-label={`Excluir ${item.name}`}
                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onLaunch(item)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-medium transition-colors cursor-pointer shrink-0"
              >
                <ExternalLink className="w-3 h-3 text-emerald-400" />
                <span>Abrir PWA</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
