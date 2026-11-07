import React, { useState } from 'react';
import { X, Folder, Edit2, Check, Plus, Trash2, Palette } from 'lucide-react';
import { GROUP_COLOR_THEMES, getGroupColorKey, getGroupTheme } from '../utils/groupLogic';

interface GroupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: string[];
  groupColors: Record<string, string>;
  onRenameGroup: (oldName: string, newName: string, colorKey: string) => void;
  onUpdateGroupColor: (groupName: string, colorKey: string) => void;
  onAddGroup: (name: string, colorKey: string) => void;
  onDeleteGroup: (groupName: string) => void;
}

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  isOpen,
  onClose,
  groups,
  groupColors,
  onRenameGroup,
  onUpdateGroupColor,
  onAddGroup,
  onDeleteGroup,
}) => {
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('sky');

  // Add new group state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('emerald');

  // Color picker popover active group
  const [pickerTargetGroup, setPickerTargetGroup] = useState<string | null>(null);

  if (!isOpen) return null;

  const colorKeys = Object.keys(GROUP_COLOR_THEMES);

  const handleStartEdit = (groupName: string) => {
    setEditingGroup(groupName);
    setEditName(groupName);
    setEditColor(getGroupColorKey(groupName, groupColors));
  };

  const handleSaveEdit = (groupName: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    if (trimmed !== groupName || editColor !== getGroupColorKey(groupName, groupColors)) {
      onRenameGroup(groupName, trimmed, editColor);
    }
    setEditingGroup(null);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddGroup(trimmed, newColor || 'sky');
    setNewName('');
    setNewColor('sky');
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-[#14151a] border border-[#242633] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-groups-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#242633] flex items-center justify-between bg-[#0f1014]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 id="modal-groups-title" className="text-sm font-bold text-white">
                Gerenciar Grupos & Cores Translucidas
              </h2>
              <p className="text-[11px] text-neutral-400">
                Edite o nome dos grupos e atribua cores translucidas de fundo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Action Header: Add new group button */}
          {!isAdding ? (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-emerald-700/60 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Grupo com Cor Translúcida</span>
            </button>
          ) : (
            <form onSubmit={handleCreateGroup} className="p-3.5 rounded-xl bg-[#1a1c24] border border-[#262835] space-y-3">
              <span className="text-xs font-bold text-white block">Adicionar Novo Grupo</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nome do grupo (ex: Redes Sociais, Trabalho...)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Translucent Theme Swatch Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-neutral-400 block font-medium">Escolha a cor de fundo translúcida:</span>
                <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-950 rounded-lg border border-neutral-800">
                  {colorKeys.map((k) => {
                    const t = GROUP_COLOR_THEMES[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setNewColor(k)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 cursor-pointer border transition-all ${
                          newColor === k
                            ? 'bg-neutral-800 border-white text-white shadow-xs'
                            : 'border-transparent text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${t.dotColor}`} />
                        <span>{t.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Salvar Grupo
                </button>
              </div>
            </form>
          )}

          {/* Group List */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-neutral-300 block">
              Grupos Cadastrados ({groups.length}):
            </span>

            {groups.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-4 text-center">Nenhum grupo cadastrado.</p>
            ) : (
              groups.map((groupName) => {
                const isEditing = editingGroup === groupName;
                const currentTheme = getGroupTheme(groupName, groupColors);

                return (
                  <div
                    key={groupName}
                    className="p-3 rounded-xl bg-[#14151a] border border-[#242633] flex flex-col gap-2.5 transition-all hover:border-neutral-700"
                  >
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-emerald-500 font-medium"
                          />

                          <button
                            type="button"
                            onClick={() => handleSaveEdit(groupName)}
                            className="p-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-bold transition-colors cursor-pointer"
                            title="Salvar alterações"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>
                        </div>

                        {/* Color Selector */}
                        <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-950 rounded-lg border border-neutral-800">
                          {colorKeys.map((k) => {
                            const t = GROUP_COLOR_THEMES[k];
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => setEditColor(k)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 cursor-pointer border transition-all ${
                                  editColor === k
                                    ? 'bg-neutral-800 border-white text-white shadow-xs'
                                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                                }`}
                              >
                                <span className={`w-2.5 h-2.5 rounded-full ${t.dotColor}`} />
                                <span>{t.label.split(' ')[0]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Color Dot Swatch */}
                          <button
                            type="button"
                            onClick={() => {
                              setPickerTargetGroup(pickerTargetGroup === groupName ? null : groupName);
                            }}
                            className={`w-6 h-6 rounded-full border border-white/20 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 ${currentTheme.dotColor}`}
                            title="Clique para alterar a cor de fundo translúcida do grupo"
                          />

                          <span className="font-semibold text-xs text-white truncate">
                            {groupName}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(groupName)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                            title="Editar nome e cor do grupo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {groupName !== 'Geral' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Excluir o grupo "${groupName}"? As PWAs deste grupo serão reatribuídas para "Geral".`)) {
                                  onDeleteGroup(groupName);
                                }
                              }}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                              title="Excluir grupo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quick Color Picker Popover */}
                    {!isEditing && pickerTargetGroup === groupName && (
                      <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center justify-between text-[11px] text-neutral-400">
                          <span className="font-medium">Cor de fundo para "{groupName}":</span>
                          <button
                            type="button"
                            onClick={() => setPickerTargetGroup(null)}
                            className="text-neutral-500 hover:text-neutral-300 text-[10px]"
                          >
                            Fechar
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {colorKeys.map((k) => {
                            const t = GROUP_COLOR_THEMES[k];
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  onUpdateGroupColor(groupName, k);
                                  setPickerTargetGroup(null);
                                }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 cursor-pointer border transition-all ${
                                  currentTheme.colorKey === k
                                    ? 'bg-neutral-800 border-white text-white shadow-xs'
                                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                                }`}
                              >
                                <span className={`w-2.5 h-2.5 rounded-full ${t.dotColor}`} />
                                <span>{t.label.split(' ')[0]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#242633] flex items-center justify-end bg-[#0f1014]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-xs cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
