import React, { useState, useRef, useEffect } from 'react';
import { CheckSquare, Square, Trash2, Edit3, CheckCircle2, X, FolderPlus, FileDown, Plus, ChevronUp } from 'lucide-react';

interface BatchActionsBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchToggleStatus: () => void;
  onBatchEdit: () => void;
  onBatchDelete: () => void;
  onBatchAssignGroup?: (groupName: string) => void;
  onBatchExtractUrls?: () => void;
  existingGroups?: string[];
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
  onBatchAssignGroup,
  onBatchExtractUrls,
  existingGroups = [],
}) => {
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [customGroupName, setCustomGroupName] = useState('');
  const [isCustomizing, setIsCustomizing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close group dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsGroupDropdownOpen(false);
        setIsCustomizing(false);
      }
    };
    if (isGroupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGroupDropdownOpen]);

  if (selectedCount === 0) return null;

  const handleSelectGroup = (grpName: string) => {
    if (onBatchAssignGroup) {
      onBatchAssignGroup(grpName);
    }
    setIsGroupDropdownOpen(false);
    setIsCustomizing(false);
  };

  const handleCreateCustomGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customGroupName.trim();
    if (!trimmed) return;
    if (onBatchAssignGroup) {
      onBatchAssignGroup(trimmed);
    }
    setCustomGroupName('');
    setIsGroupDropdownOpen(false);
    setIsCustomizing(false);
  };

  return (
    <aside
      aria-label="Barra de ações em lote"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-3xl bg-[#14151a]/95 backdrop-blur-md border border-emerald-500/50 shadow-2xl shadow-black/80 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-5 duration-200"
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
      <div className="flex items-center gap-2 relative overflow-visible flex-wrap sm:flex-nowrap">
        {/* Mudar Status */}
        <button
          type="button"
          onClick={onBatchToggleStatus}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap border border-[#2c2e3d]"
          title="Alternar status diário das PWAs selecionadas"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mudar Status</span>
        </button>

        {/* Add a Grupo */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsGroupDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap border border-[#2c2e3d]"
            title="Adicionar PWAs selecionadas a um grupo"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add a Grupo</span>
            <ChevronUp className={`w-3 h-3 text-neutral-400 transition-transform ${isGroupDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Quick Group Selector Dropdown Popover */}
          {isGroupDropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 z-50 w-56 bg-[#14151a] border border-[#2c2e3d] rounded-xl shadow-2xl shadow-black py-2 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-3 py-1 border-b border-[#242633] text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Mover para o Grupo:
              </div>

              <div className="max-h-48 overflow-y-auto py-1">
                {existingGroups.length === 0 ? (
                  <p className="px-3 py-1.5 text-[11px] text-neutral-500 italic">Nenhum grupo cadastrado</p>
                ) : (
                  existingGroups.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => handleSelectGroup(grp)}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#1f212a] hover:text-white flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{grp}</span>
                    </button>
                  ))
                )}
              </div>

              {/* Custom group creation */}
              <div className="border-t border-[#242633] pt-1 px-1">
                {!isCustomizing ? (
                  <button
                    type="button"
                    onClick={() => setIsCustomizing(true)}
                    className="w-full text-left px-2.5 py-1.5 text-emerald-400 hover:bg-[#1f212a] rounded-lg flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Criar Novo Grupo...</span>
                  </button>
                ) : (
                  <form onSubmit={handleCreateCustomGroup} className="p-1 space-y-1">
                    <input
                      type="text"
                      placeholder="Nome do novo grupo..."
                      value={customGroupName}
                      onChange={(e) => setCustomGroupName(e.target.value)}
                      autoFocus
                      className="w-full px-2 py-1 text-[11px] bg-neutral-950 border border-neutral-700 text-white rounded focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setIsCustomizing(false)}
                        className="px-2 py-0.5 text-[10px] text-neutral-400 hover:text-white"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!customGroupName.trim()}
                        className="px-2 py-0.5 text-[10px] font-bold text-neutral-950 bg-emerald-400 rounded hover:bg-emerald-300 disabled:opacity-50"
                      >
                        Mover
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Extrair URL */}
        <button
          type="button"
          onClick={onBatchExtractUrls}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap border border-[#2c2e3d]"
          title="Baixar lista e URLs das PWAs selecionadas em um arquivo Markdown (.md)"
        >
          <FileDown className="w-3.5 h-3.5 text-sky-400" />
          <span>Extrair URL</span>
        </button>

        {/* Editar */}
        <button
          type="button"
          onClick={onBatchEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap border border-[#2c2e3d]"
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
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer shrink-0 ml-1"
          title="Cancelar seleção"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
