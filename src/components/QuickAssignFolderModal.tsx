import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, CheckSquare, Square, FolderInput } from 'lucide-react';
import { PWAFolder, PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { matchesPWASearch } from '../utils/pwaLogic';

interface QuickAssignFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFolder: PWAFolder | null;
  allFolders: PWAFolder[];
  items: PWAItem[];
  onAssignPWAs: (pwaIds: string[], targetFolderId: string | null) => void;
}

export const QuickAssignFolderModal: React.FC<QuickAssignFolderModalProps> = ({
  isOpen,
  onClose,
  targetFolder,
  allFolders,
  items,
  onAssignPWAs,
}) => {
  const [query, setQuery] = useState('');
  const [onlyUnfiled, setOnlyUnfiled] = useState(true);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCheckedIds(new Set());
    }
  }, [isOpen, targetFolder?.id]);

  const folderNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allFolders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [allFolders]);

  const candidateItems = useMemo(() => {
    return items
      .filter((it) => {
        if (targetFolder && it.folderId === targetFolder.id) return false;
        if (onlyUnfiled && it.folderId && folderNameMap.has(it.folderId)) return false;
        if (query.trim() && !matchesPWASearch(it, query)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [items, targetFolder, onlyUnfiled, folderNameMap, query]);

  if (!isOpen || !targetFolder) return null;

  const allVisibleChecked =
    candidateItems.length > 0 && candidateItems.every((it) => checkedIds.has(it.id));

  const toggleItem = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) {
        candidateItems.forEach((it) => next.delete(it.id));
      } else {
        candidateItems.forEach((it) => next.add(it.id));
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (checkedIds.size === 0) return;
    onAssignPWAs(Array.from(checkedIds), targetFolder.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-[#14151a] border border-[#242633] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-quick-assign-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#242633] flex items-center justify-between bg-[#0f1014]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0">
              <FolderInput className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="modal-quick-assign-title" className="text-sm font-bold text-white truncate">
                Adicionar PWAs à pasta "{targetFolder.name}"
              </h2>
              <p className="text-[11px] text-neutral-400">
                Selecione várias PWAs de uma vez para mover para esta pasta
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar seleção rápida de PWAs"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="px-5 py-3 border-b border-[#242633] bg-[#121318] flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar PWA por nome ou domínio..."
              autoFocus
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyUnfiled((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                onlyUnfiled
                  ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {onlyUnfiled ? 'Mostrando: Sem Pasta' : 'Mostrando: Todas'}
            </button>

            <button
              type="button"
              onClick={toggleAllVisible}
              disabled={candidateItems.length === 0}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 disabled:opacity-40 cursor-pointer"
            >
              {allVisibleChecked ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-neutral-400" />
              )}
              <span>Selecionar ({candidateItems.length})</span>
            </button>
          </div>
        </div>

        {/* Checklist */}
        <div className="p-4 overflow-y-auto flex-1 space-y-1.5">
          {candidateItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              {onlyUnfiled
                ? 'Nenhuma PWA sem pasta encontrada com este filtro. Clique em "Mostrando: Sem Pasta" para ver PWAs de outras pastas também.'
                : 'Nenhuma PWA disponível encontrada com esta busca.'}
            </div>
          ) : (
            candidateItems.map((item) => {
              const isChecked = checkedIds.has(item.id);
              const currentFolderName = item.folderId ? folderNameMap.get(item.folderId) : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isChecked
                      ? 'bg-emerald-950/40 border-emerald-600/70 text-white'
                      : 'bg-neutral-950/50 border-neutral-800/80 hover:bg-neutral-900/80 text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-neutral-500 shrink-0" />
                    )}
                    <PWAIcon icon={item.icon} name={item.name} url={item.url} size="sm" />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold block truncate">{item.name}</span>
                      <span className="text-[10px] text-neutral-400 block truncate">{item.url}</span>
                    </div>
                  </div>

                  {currentFolderName && (
                    <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-[10px] text-neutral-300 shrink-0">
                      Em: {currentFolderName}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#242633] flex items-center justify-between bg-[#0f1014]">
          <span className="text-xs text-neutral-400">
            <strong className="text-white">{checkedIds.size}</strong> selecionada{checkedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={checkedIds.size === 0}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Mover para "{targetFolder.name}"
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
