import React from 'react';
import { ExternalLink, Star, Trash2, Edit2 } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { StatusIndicator } from './StatusIndicator';
import { InlineNoteInput } from './InlineNoteInput';
import { isAccessedToday, getCleanDomain } from '../utils/pwaLogic';

interface DenseGridViewProps {
  items: PWAItem[];
  todayStr: string;
  onLaunch: (item: PWAItem) => void;
  onToggleStatus: (item: PWAItem) => void;
  onUpdateNote: (item: PWAItem, newNote: string) => void;
  onTogglePin: (item: PWAItem) => void;
  onEdit: (item: PWAItem) => void;
  onDelete: (id: string) => void;
}

export const DenseGridView: React.FC<DenseGridViewProps> = ({
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
      {items.map((item) => {
        const accessed = isAccessedToday(item.lastAccessedDate, todayStr);
        const domain = getCleanDomain(item.url);

        return (
          <div
            key={item.id}
            className={`group relative flex flex-col justify-between p-2.5 rounded-lg border bg-neutral-900/40 hover:bg-neutral-900/80 transition-all ${
              accessed
                ? 'border-neutral-800/80 hover:border-emerald-700/50'
                : 'border-neutral-800/80 hover:border-rose-700/50'
            }`}
          >
            {/* Header: Icon, Name, Pin, Status */}
            <div>
              <div className="flex items-start justify-between gap-1.5 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <PWAIcon icon={item.icon} name={item.name} size="md" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-xs text-neutral-200 group-hover:text-white truncate">
                      {item.name}
                    </h3>
                    <p className="text-[10px] text-neutral-400 truncate">{domain}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onTogglePin(item)}
                    title={item.pinned ? 'Desafixar PWA' : 'Fixar'}
                    aria-label={item.pinned ? 'Desafixar PWA' : 'Fixar'}
                    className={`p-0.5 rounded cursor-pointer transition-colors ${
                      item.pinned
                        ? 'text-amber-400'
                        : 'text-neutral-400 hover:text-neutral-300 opacity-20 group-hover:opacity-100'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${item.pinned ? 'fill-amber-400' : ''}`} />
                  </button>

                  <StatusIndicator
                    lastAccessedDate={item.lastAccessedDate}
                    todayStr={todayStr}
                    onToggle={() => onToggleStatus(item)}
                    compact={true}
                    showText={false}
                  />
                </div>
              </div>

              {/* Category indicator */}
              <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1.5 font-mono">
                <span>{item.category}</span>
                <span className={accessed ? 'text-emerald-400 font-medium' : 'text-rose-400/90'}>
                  {accessed ? '✓ Acessado' : '● Pendente'}
                </span>
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
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 mt-1">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  title="Editar"
                  aria-label={`Editar ${item.name}`}
                  className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  title="Excluir"
                  aria-label={`Excluir ${item.name}`}
                  className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onLaunch(item)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
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
