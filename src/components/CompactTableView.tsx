import React from 'react';
import { ExternalLink, Star, Trash2, Edit2, User } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { StatusIndicator } from './StatusIndicator';
import { InlineNoteInput } from './InlineNoteInput';
import { getCleanDomain } from '../utils/pwaLogic';

interface CompactTableViewProps {
  items: PWAItem[];
  todayStr: string;
  onLaunch: (item: PWAItem) => void;
  onToggleStatus: (item: PWAItem) => void;
  onUpdateNote: (item: PWAItem, newNote: string) => void;
  onTogglePin: (item: PWAItem) => void;
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
            <th className="py-2 px-3 w-10 text-center">Fixar</th>
            <th className="py-2 px-3 w-36">Status Hoje</th>
            <th className="py-2 px-3 min-w-[220px]">PWA & Domínio</th>
            <th className="py-2 px-3 min-w-[280px]">Anotações (Clique para editar)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900/80">
          {items.map((item) => {
            const domain = getCleanDomain(item.url);

            return (
              <tr
                key={item.id}
                className="group hover:bg-neutral-900/50 transition-colors h-9"
              >
                {/* Pin Button */}
                <td className="py-1 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => onTogglePin(item)}
                    title={item.pinned ? 'Desafixar PWA' : 'Fixar no topo'}
                    aria-label={item.pinned ? 'Desafixar PWA' : 'Fixar no topo'}
                    className={`p-1 rounded cursor-pointer transition-colors ${
                      item.pinned
                        ? 'text-amber-400 hover:text-amber-300'
                        : 'text-neutral-400 hover:text-neutral-300 opacity-20 group-hover:opacity-100'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${item.pinned ? 'fill-amber-400' : ''}`}
                    />
                  </button>
                </td>

                {/* Status Indicator (Verde / Vermelho - Clicável para Abrir PWA) */}
                <td
                  className="py-1 px-3 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onLaunch(item)}
                  title={`Abrir ${item.name} e marcar como acessado hoje`}
                >
                  <StatusIndicator
                    lastAccessedDate={item.lastAccessedDate}
                    todayStr={todayStr}
                    onToggle={() => onLaunch(item)}
                    compact={false}
                    showText={true}
                  />
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
