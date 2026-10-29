import React from 'react';
import { ExternalLink, Star, Trash2, Edit2 } from 'lucide-react';
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
            <th className="py-2 px-3 w-32">Status Hoje</th>
            <th className="py-2 px-3 w-64">PWA & Domínio</th>
            <th className="py-2 px-3 w-40">Categoria</th>
            <th className="py-2 px-3 min-w-[280px]">Anotações (Clique para editar)</th>
            <th className="py-2 px-3 w-28 text-right">Ação</th>
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

                {/* Status Indicator (Verde / Vermelho) */}
                <td className="py-1 px-3 whitespace-nowrap">
                  <StatusIndicator
                    lastAccessedDate={item.lastAccessedDate}
                    todayStr={todayStr}
                    onToggle={() => onToggleStatus(item)}
                    compact={false}
                    showText={true}
                  />
                </td>

                {/* PWA Icon + Name + Link */}
                <td className="py-1 px-3">
                  <div className="flex items-center gap-2 max-w-xs">
                    <PWAIcon url={item.url} name={item.name} customIcon={item.icon} size="sm" />
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-neutral-200 group-hover:text-white truncate block">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 truncate block">
                        {domain}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td className="py-1 px-3 whitespace-nowrap">
                  <span className="text-[11px] text-neutral-400 font-mono tracking-tight">
                    {item.category}
                  </span>
                </td>

                {/* Compact Inline Editable Notes Field */}
                <td className="py-1 px-3">
                  <InlineNoteInput
                    initialValue={item.notes}
                    onSave={(newNote) => onUpdateNote(item, newNote)}
                    placeholder="Adicionar nota rápida..."
                  />
                </td>

                {/* Quick Actions (Launch & Menu) */}
                <td className="py-1 px-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onLaunch(item)}
                      title={`Abrir ${item.name} (marca como acessado hoje)`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3 text-emerald-400" />
                      <span>Abrir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      title="Editar detalhes"
                      aria-label={`Editar ${item.name}`}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      title="Excluir PWA"
                      aria-label={`Excluir ${item.name}`}
                      className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
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
