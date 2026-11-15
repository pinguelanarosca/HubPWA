import React, { useState, useMemo, useEffect } from 'react';
import { X, Folder, FolderPlus, Edit2, Check, Trash2, ListChecks } from 'lucide-react';
import { PWAFolder, PWAItem } from '../types/pwa';
import { GROUP_COLOR_THEMES } from '../utils/groupLogic';
import { flattenFoldersHierarchy, getFolderStats } from '../utils/folderLogic';

interface FolderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: PWAFolder[];
  items: PWAItem[];
  todayStr: string;
  initialParentId?: string | null;
  onCreateFolder: (name: string, color: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, newName: string, newColor: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onOpenQuickAssign?: (folderId: string) => void;
}

export const FolderManagerModal: React.FC<FolderManagerModalProps> = ({
  isOpen,
  onClose,
  folders,
  items,
  todayStr,
  initialParentId = null,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onOpenQuickAssign,
}) => {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('emerald');
  const [newParentId, setNewParentId] = useState<string>(initialParentId || '');
  const [formError, setFormError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('emerald');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewParentId(initialParentId || '');
      setFormError('');
      setEditingId(null);
      setConfirmDeleteId(null);
    }
  }, [isOpen, initialParentId]);

  const flatFolders = useMemo(() => flattenFoldersHierarchy(folders), [folders]);

  if (!isOpen) return null;

  const colorKeys = Object.keys(GROUP_COLOR_THEMES);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setFormError('Digite um nome para a pasta.');
      return;
    }
    setFormError('');
    onCreateFolder(trimmed, newColor, newParentId || null);
    setNewName('');
  };

  const handleStartEdit = (folder: PWAFolder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
    setEditColor(folder.color || 'emerald');
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = (folderId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    onRenameFolder(folderId, trimmed, editColor);
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-xl bg-[#14151a] border border-[#242633] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-folders-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#242633] flex items-center justify-between bg-[#0f1014]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 id="modal-folders-title" className="text-sm font-bold text-white">
                Gerenciar Pastas
              </h2>
              <p className="text-[11px] text-neutral-400">
                Crie pastas e subpastas para organizar suas PWAs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar gerenciador de pastas"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Create Folder Form */}
          <form onSubmit={handleCreate} className="p-3.5 rounded-xl bg-[#1a1c24] border border-[#262835] space-y-3">
            <span className="text-xs font-bold text-white block">Criar Nova Pasta</span>

            {formError && (
              <div className="px-2.5 py-1.5 rounded bg-rose-950/70 border border-rose-800 text-rose-300 text-[11px]">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="new-folder-name" className="block text-[11px] text-neutral-400 mb-1">
                  Nome da Pasta *
                </label>
                <input
                  id="new-folder-name"
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="Ex: Jogos, Bancos, Trabalho..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="new-folder-parent" className="block text-[11px] text-neutral-400 mb-1">
                  Dentro de (Opcional)
                </label>
                <select
                  id="new-folder-parent"
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Raiz (Pasta Principal)</option>
                  {flatFolders.map(({ folder, label }) => (
                    <option key={folder.id} value={folder.id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color Swatches */}
            <div>
              <span className="text-[11px] text-neutral-400 block mb-1.5">Cor da Pasta:</span>
              <div className="flex flex-wrap gap-1.5">
                {colorKeys.map((k) => {
                  const t = GROUP_COLOR_THEMES[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setNewColor(k)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 cursor-pointer border transition-all ${
                        newColor === k
                          ? 'bg-neutral-800 border-white text-white shadow-xs'
                          : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${t.dotColor}`} />
                      <span>{t.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Criar Pasta</span>
              </button>
            </div>
          </form>

          {/* Existing Folders Tree */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-neutral-300 block">
              Pastas Criadas ({folders.length})
            </span>

            {flatFolders.length === 0 ? (
              <div className="py-8 px-4 rounded-xl border border-dashed border-[#242633] text-center text-xs text-neutral-500">
                Nenhuma pasta criada ainda. Crie sua primeira pasta acima para organizar suas PWAs.
              </div>
            ) : (
              <div className="space-y-2">
                {flatFolders.map(({ folder, depth }) => {
                  const stats = getFolderStats(folders, items, folder.id, todayStr);
                  const theme = GROUP_COLOR_THEMES[folder.color || 'emerald'] || GROUP_COLOR_THEMES.emerald;
                  const isEditing = editingId === folder.id;
                  const isConfirmingDelete = confirmDeleteId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      style={{ marginLeft: `${Math.min(depth, 4) * 16}px` }}
                      className="p-3 rounded-xl bg-[#14151a] border border-[#242633] hover:border-neutral-700 transition-colors space-y-2"
                    >
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              aria-label="Editar nome da pasta"
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(folder.id)}
                              aria-label={`Salvar edição da pasta ${folder.name}`}
                              className="p-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-bold cursor-pointer"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancelar edição"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {colorKeys.map((k) => {
                              const t = GROUP_COLOR_THEMES[k];
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => setEditColor(k)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 cursor-pointer border ${
                                    editColor === k
                                      ? 'bg-neutral-800 border-white text-white'
                                      : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${t.dotColor}`} />
                                  <span>{t.label.split(' ')[0]}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.dotColor}`} />
                            <Folder className={`w-4 h-4 shrink-0 ${theme.textAccent}`} />
                            <span className="text-xs font-semibold text-white truncate">{folder.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-neutral-400 shrink-0">
                              {stats.totalCount} PWA{stats.totalCount !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {onOpenQuickAssign && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenQuickAssign(folder.id);
                                }}
                                title={`Organizar PWAs na pasta ${folder.name}`}
                                aria-label={`Organizar PWAs na pasta ${folder.name}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-emerald-400 hover:bg-emerald-950/60 border border-transparent hover:border-emerald-800/70 transition-colors cursor-pointer"
                              >
                                <ListChecks className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Adicionar PWAs</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(folder)}
                              title={`Editar pasta ${folder.name}`}
                              aria-label={`Editar pasta ${folder.name}`}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteId(isConfirmingDelete ? null : folder.id)
                              }
                              title={`Excluir pasta ${folder.name}`}
                              aria-label={`Excluir pasta ${folder.name}`}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {isConfirmingDelete && (
                        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <span className="text-rose-200">
                            Excluir pasta "{folder.name}"? As PWAs dentro dela NÃO serão apagadas.
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded text-neutral-300 hover:text-white bg-neutral-800 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteFolder(folder.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1 rounded font-semibold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer"
                            >
                              Confirmar Exclusão
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#242633] flex items-center justify-end bg-[#0f1014]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
