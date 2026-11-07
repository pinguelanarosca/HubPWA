import React from 'react';
import { ExternalLink, Trash2, Edit2, User, Clock } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { StatusIndicator } from './StatusIndicator';
import { InlineNoteInput } from './InlineNoteInput';
import { StarRating } from './StarRating';
import { getCleanDomain, formatAccessDateTime } from '../utils/pwaLogic';

interface CompactTableViewProps {
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

export const CompactTableView: React.FC<CompactTableViewProps> = ({
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
    <div className="w-full overflow-x-auto border border-neutral-800 rounded-lg bg-neutral-950/60 shadow-xs">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 font-medium select-none text-[11px]">
            <th className="py-2 px-3 w-28 text-left">Classificação</th>
            <th className="py-2 px-3 w-32">Status Hoje</th>
            <th className="py-2 px-3 w-44">Log de Acesso (Data/Hora)</th>
            <th className="py-2 px-3 min-w-[200px]">PWA & Domínio</th>
            <th className="py-2 px-3 min-w-[240px]">Anotações (Clique para editar)</th>
            <th className="py-2 px-3 w-20 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/80">
          {items.map((item) => {
            const domain = getCleanDomain(item.url);
            const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
            const accessLog = formatAccessDateTime(item.lastAccessedDate);

            return (
              <tr
                key={item.id}
                className="group hover:bg-neutral-900/50 transition-colors h-9"
              >
                {/* 1 to 5 Star Rating */}
                <td className="py-1 px-3 whitespace-nowrap">
                  <StarRating
                    rating={currentRating}
                    onChange={(newRating) => (onSetRating ? onSetRating(item, newRating) : onTogglePin(item))}
                    size="sm"
                  />
                </td>

                {/* Status Indicator (Verde / Vermelho - Clicável para Alternar Status) */}
                <td
                  className="py-1 px-3 whitespace-nowrap"
                  title="Status Hoje: clique para alternar"
                >
                  <StatusIndicator
                    lastAccessedDate={item.lastAccessedDate}
                    todayStr={todayStr}
                    onToggle={() => onToggleStatus(item)}
                    compact={false}
                    showText={true}
                  />
                </td>

                {/* Log de Acesso: Data e Hora entre Indicador e Nome da PWA */}
                <td className="py-1 px-3 whitespace-nowrap notranslate" translate="no">
                  {accessLog.hasRecord ? (
                    <div
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-neutral-300 bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-800/80"
                      title={`Último acesso: ${accessLog.fullStr} (${item.accessCount || 1} acessos)`}
                    >
                      <span className="text-neutral-400 font-medium">{accessLog.dateStr}</span>
                      {accessLog.timeStr && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold font-mono text-[10px]">
                          <Clock className="w-2.5 h-2.5 text-emerald-400/90" />
                          <span>{accessLog.timeStr}</span>
                        </span>
                      )}
                      {(item.accessCount || 0) > 1 && (
                        <span className="text-[9px] text-neutral-500 font-mono">
                          {item.accessCount}x
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-neutral-500 italic pl-1">
                      — Sem registro
                    </span>
                  )}
                </td>

                {/* PWA Icon + Name + Link (Clicável para Abrir PWA) */}
                <td
                  className="py-1 px-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onLaunch(item)}
                  title={`Abrir ${item.name}`}
                >
                  <div className="flex items-center gap-2 max-w-xs">
                    <PWAIcon icon={item.icon} name={item.name} size="sm" />
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-neutral-200 group-hover:text-emerald-400 truncate block">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 truncate flex items-center gap-1.5">
                        <span className="truncate">{domain}</span>
                        {item.profileDirectory && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800/80 text-blue-300 text-[9px] font-semibold font-mono shrink-0">
                            <User className="w-2.5 h-2.5 text-blue-400" />
                            <span>{item.profileDirectory}</span>
                          </span>
                        )}
                        {item.isPossibleDuplicate && (
                          <span
                            className="px-1 py-0.5 rounded bg-amber-950/80 border border-amber-800/80 text-amber-300 text-[8px] font-medium shrink-0"
                            title={item.possibleDuplicateReason || 'Possível duplicata para revisão'}
                          >
                            ⚠️ Duplicata?
                          </span>
                        )}
                        {item.aliases && item.aliases.length > 0 && (
                          <span className="px-1 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 text-[8px] font-mono shrink-0">
                            {item.aliases.join(', ')}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Compact Inline Editable Notes Field */}
                <td className="py-1 px-3">
                  <InlineNoteInput
                    initialValue={item.notes}
                    onSave={(newNote) => onUpdateNote(item, newNote)}
                    placeholder="Adicionar nota rápida..."
                  />
                </td>

                {/* Ações: Editar e Excluir */}
                <td className="py-1 px-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      title={`Editar ${item.name}`}
                      aria-label={`Editar ${item.name}`}
                      className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      title={`Excluir ${item.name}`}
                      aria-label={`Excluir ${item.name}`}
                      className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
