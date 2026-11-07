import React from 'react';
import { CheckSquare, Square, Trash2, Edit3, CheckCircle2, X } from 'lucide-react';

interface BatchActionsBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchToggleStatus: () => void;
  onBatchEdit: () => void;
  onBatchDelete: () => void;
}

export const BatchActionsBar: React.FC<BatchActionsBarProps> = ({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onDeselectAll,
  onBatchToggleStatus,
  onBatchEdit,
  onBatchDelete,
}) => {
  if (selectedCount === 0) return null;

  return (
    <aside
      aria-label="Barra de ações em lote"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl bg-neutral-900/95 backdrop-blur-md border border-emerald-500/50 shadow-2xl shadow-black/80 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-5 duration-200"
    >
      {/* Left: Selection count & select all toggle */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onToggleSelectAll}
          className="flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title={allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          ) : (
            <Square className="w-4 h-4 text-neutral-400" />
          )}
          <span className="font-semibold text-white">
            {selectedCount} de {totalCount} selecionada{selectedCount > 1 ? 's' : ''}
          </span>
        </button>
      </div>

      {/* Center & Right: Action Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {/* Mudar Status */}
        <button
          type="button"
          onClick={onBatchToggleStatus}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap"
          title="Alternar status diário das PWAs selecionadas"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mudar Status</span>
        </button>

        {/* Editar */}
        <button
          type="button"
          onClick={onBatchEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap"
          title="Editar grupo, classificação e anotações em lote"
        >
          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
          <span>Editar</span>
        </button>

        {/* Excluir */}
        <button
          type="button"
          onClick={onBatchDelete}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap"
          title="Excluir PWAs selecionadas"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>Excluir</span>
        </button>

        {/* Desmarcar / Cancelar */}
        <button
          type="button"
          onClick={onDeselectAll}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
          title="Cancelar seleção"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
