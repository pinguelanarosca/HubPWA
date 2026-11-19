import React, { useMemo } from 'react';
import { Trash2, Edit2, User, Clock, Folder, Copy, History } from 'lucide-react';
import { DailyFlagKey, DailyFlagState, PWAFolder, PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { StatusIndicator } from './StatusIndicator';
import { InlineNoteInput } from './InlineNoteInput';
import { StarRating } from './StarRating';
import { PWAFlagsControl } from './PWAFlagsControl';
import { getCleanDomain, formatAccessDateTime, formatChromeProfileDisplay, isAccessedToday } from '../utils/pwaLogic';

interface CompactTableViewProps {
  items: PWAItem[];
  todayStr: string;
  folders?: PWAFolder[];
  onLaunch: (item: PWAItem) => void;
  onToggleStatus: (item: PWAItem) => void;
  onUpdateNote: (item: PWAItem, newNote: string) => void;
  onToggleFlag?: (item: PWAItem, flag: DailyFlagKey, state?: DailyFlagState | null) => void;
  onUpdateMoneyDate?: (item: PWAItem, moneyDate: string) => void;
  onTogglePin: (item: PWAItem) => void;
  onSetRating?: (item: PWAItem, rating: number) => void;
  onEdit: (item: PWAItem) => void;
  onClone?: (item: PWAItem) => void;
  onViewHistory?: (item: PWAItem) => void;
  onDelete: (id: string) => void;
}

export const CompactTableView: React.FC<CompactTableViewProps> = ({
  items,
  todayStr,
  folders = [],
  onLaunch,
  onToggleStatus,
  onUpdateNote,
  onToggleFlag,
  onUpdateMoneyDate,
  onTogglePin,
  onSetRating,
  onEdit,
  onClone,
  onViewHistory,
  onDelete,
}) => {
  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

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
            <th className="py-2 px-2.5 w-40 text-left">Classificação / Perfil</th>
            <th className="py-2 px-2.5 w-28">Status Hoje</th>
            <th className="py-2 px-2.5 w-36">Log de Acesso</th>
            <th className="py-2 px-2.5 min-w-[170px]">PWA & Domínio</th>
            <th className="py-2 px-2.5 min-w-[155px]">Anotações (Clique para editar)</th>
            {onToggleFlag && <th className="py-2 px-2.5 min-w-[310px]">Data ($) / Marcações</th>}
            <th className="py-2 px-2.5 w-24 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/80">
          {items.map((item) => {
            const domain = getCleanDomain(item.url);
            const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
            const accessLog = formatAccessDateTime(item.lastAccessedDate);
            const assignedFolder = item.folderId ? folderMap.get(item.folderId) : null;
            const chromeProfile = formatChromeProfileDisplay(item);
            const accessed = isAccessedToday(item.lastAccessedDate, todayStr);

            return (
              <tr
                key={item.id}
                className={`group hover:bg-neutral-900/50 transition-colors h-9 border-l-[3px] ${
                  accessed ? 'border-l-emerald-500' : 'border-l-rose-500'
                }`}
              >
                {/* 1 to 5 Star Rating + Chrome Profile */}
                <td className="py-1 px-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <StarRating
                      rating={currentRating}
                      onChange={(newRating) => (onSetRating ? onSetRating(item, newRating) : onTogglePin(item))}
                      size="sm"
                    />
                    {chromeProfile && (
                      <span
                        title={chromeProfile.tooltip}
                        aria-label={chromeProfile.tooltip}
                        data-testid={`chrome-profile-badge-${item.id}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/85 border border-sky-700/70 text-sky-300 text-[10px] font-mono font-semibold shrink-0 leading-none"
                      >
                        <User className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                        <span>{chromeProfile.badgeText}</span>
                      </span>
                    )}
                  </div>
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

                {/* Log de Acesso: Data e Hora entre Indicador e Nome da PWA (clicável para histórico completo) */}
                <td className="py-1 px-3 whitespace-nowrap notranslate" translate="no">
                  <button
                    type="button"
                    data-testid={`table-history-btn-${item.id}`}
                    onClick={() => onViewHistory && onViewHistory(item)}
                    disabled={!onViewHistory}
                    className={`inline-flex items-center gap-1.5 font-mono text-[11px] rounded px-2 py-0.5 transition-colors ${
                      accessLog.hasRecord
                        ? 'text-neutral-300 bg-neutral-900/80 border border-neutral-800/80 hover:border-emerald-600/60 hover:text-emerald-200'
                        : 'text-neutral-500 hover:text-neutral-300'
                    } ${onViewHistory ? 'cursor-pointer' : ''}`}
                    title={
                      accessLog.hasRecord
                        ? `Último acesso: ${accessLog.fullStr} — Clique para ver histórico completo`
                        : 'Ver histórico completo de acesso (dia e hora)'
                    }
                  >
                    {accessLog.hasRecord ? (
                      <>
                        <span className="text-neutral-400 font-medium">{accessLog.dateStr}</span>
                        {accessLog.timeStr && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold font-mono text-[10px]">
                            <Clock className="w-2.5 h-2.5 text-emerald-400/90" />
                            <span>{accessLog.timeStr}</span>
                          </span>
                        )}
                        {(item.accessHistory?.length || item.accessCount || 0) > 1 && (
                          <span className="text-[9px] text-neutral-500 font-mono">
                            {item.accessHistory?.length || item.accessCount}x
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <History className="w-3 h-3 text-neutral-500" />
                        <span className="italic text-[10px]">Ver histórico</span>
                      </>
                    )}
                  </button>
                </td>

                {/* PWA Icon + Name + Link (Clicável para Abrir PWA) */}
                <td
                  className="py-1 px-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onLaunch(item)}
                  title={`Abrir ${item.name}`}
                >
                  <div className="flex items-center gap-2 max-w-xs">
                    <PWAIcon icon={item.icon} name={item.name} url={item.url} size="sm" />
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-neutral-200 group-hover:text-emerald-400 truncate block">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 truncate flex items-center gap-1.5">
                        <span className="truncate">{domain}</span>
                        {assignedFolder && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-emerald-300 text-[9px] font-medium shrink-0">
                            <Folder className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{assignedFolder.name}</span>
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

                {/* Reorganized Date ($) & Daily Checkboxes */}
                {onToggleFlag && (
                  <td className="py-1 px-3 whitespace-nowrap">
                    <PWAFlagsControl
                      item={item}
                      todayStr={todayStr}
                      onToggleFlag={onToggleFlag}
                      onUpdateMoneyDate={onUpdateMoneyDate}
                      compact={true}
                    />
                  </td>
                )}

                {/* Ações: Clonar, Editar e Excluir */}
                <td className="py-1 px-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {onClone && (
                      <button
                        type="button"
                        onClick={() => onClone(item)}
                        title={`Clonar ${item.name} para outro Perfil`}
                        aria-label={`Clonar ${item.name} para outro Perfil`}
                        className="p-1 rounded text-neutral-400 hover:text-sky-300 hover:bg-sky-950/40 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
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
