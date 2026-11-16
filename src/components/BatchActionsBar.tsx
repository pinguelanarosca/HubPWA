import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  FolderPlus,
  FileDown,
  Plus,
  ChevronUp,
  FolderInput,
  Star,
  StarOff,
  Tag,
  Image as ImageIcon,
  Check,
  Eraser,
} from 'lucide-react';
import { DailyFlagKey, PWAFolder } from '../types/pwa';
import { flattenFoldersHierarchy } from '../utils/folderLogic';
import { DAILY_FLAG_META, MoneySymbolIcon } from './PWAFlagsControl';

interface BatchActionsBarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchSetStatus: (mode: 'accessed' | 'pending' | 'toggle') => void;
  onBatchSetRating: (rating: number) => void;
  onBatchSetDailyFlag?: (flag: DailyFlagKey, active: boolean) => void;
  onBatchClearFlags?: (options: { clearDaily?: boolean; clearMoneyDate?: boolean }) => void;
  onBatchRefreshIcons?: () => void;
  onBatchEdit: () => void;
  onBatchDelete: () => void;
  onBatchAssignGroup?: (groupName: string) => void;
  onBatchAssignFolder?: (folderId: string | null) => void;
  onCreateAndAssignFolder?: (folderName: string) => void;
  onBatchExtractUrls?: () => void;
  existingGroups?: string[];
  folders?: PWAFolder[];
}

type OpenMenu = 'stars' | 'status' | 'flags' | 'folder' | 'group' | null;

export const BatchActionsBar: React.FC<BatchActionsBarProps> = ({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onDeselectAll,
  onBatchSetStatus,
  onBatchSetRating,
  onBatchSetDailyFlag,
  onBatchClearFlags,
  onBatchRefreshIcons,
  onBatchEdit,
  onBatchDelete,
  onBatchAssignGroup,
  onBatchAssignFolder,
  onCreateAndAssignFolder,
  onBatchExtractUrls,
  existingGroups = [],
  folders = [],
}) => {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [customGroupName, setCustomGroupName] = useState('');
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customFolderName, setCustomFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const barRef = useRef<HTMLElement>(null);
  const flatFolders = useMemo(() => flattenFoldersHierarchy(folders), [folders]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setIsCustomizing(false);
        setIsCreatingFolder(false);
      }
    };
    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  if (selectedCount === 0) return null;

  const toggleMenu = (menu: Exclude<OpenMenu, null>) => {
    setIsCustomizing(false);
    setIsCreatingFolder(false);
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const handleSelectGroup = (grpName: string) => {
    onBatchAssignGroup?.(grpName);
    setOpenMenu(null);
    setIsCustomizing(false);
  };

  const handleCreateCustomGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customGroupName.trim();
    if (!trimmed) return;
    onBatchAssignGroup?.(trimmed);
    setCustomGroupName('');
    setOpenMenu(null);
    setIsCustomizing(false);
  };

  const handleSelectFolder = (folderId: string | null) => {
    onBatchAssignFolder?.(folderId);
    setOpenMenu(null);
    setIsCreatingFolder(false);
  };

  const handleCreateFolderAndMove = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customFolderName.trim();
    if (!trimmed) return;
    onCreateAndAssignFolder?.(trimmed);
    setCustomFolderName('');
    setOpenMenu(null);
    setIsCreatingFolder(false);
  };

  return (
    <aside
      ref={barRef}
      aria-label="Barra de ações em lote"
      data-testid="batch-actions-bar"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[96%] max-w-6xl bg-[#14151a]/95 backdrop-blur-md border border-emerald-500/50 shadow-2xl shadow-black/80 rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs animate-in slide-in-from-bottom-5 duration-200"
    >
      {/* Left: Selection count & select all toggle */}
      <div className="flex items-center gap-2 shrink-0">
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

      {/* Center & Right: Bulk Action Buttons */}
      <div className="flex items-center gap-1.5 relative overflow-visible flex-wrap justify-end">
        {/* Estrelas em Massa */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('stars')}
            data-testid="batch-stars-btn"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap border ${
              openMenu === 'stars'
                ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                : 'bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white border-[#2c2e3d]'
            }`}
            title="Adicionar ou remover estrelas das PWAs selecionadas"
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Estrelas</span>
            <ChevronUp className={`w-3 h-3 text-neutral-400 transition-transform ${openMenu === 'stars' ? 'rotate-180' : ''}`} />
          </button>

          {openMenu === 'stars' && (
            <div
              data-testid="batch-stars-menu"
              className="absolute bottom-full mb-2.5 left-0 z-50 w-64 bg-[#14151a] border border-[#2c2e3d] rounded-xl shadow-2xl shadow-black p-2.5 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100 space-y-2"
            >
              <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider px-1">
                Estrelas em Massa ({selectedCount})
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((starCount) => (
                  <button
                    key={starCount}
                    type="button"
                    data-testid={`batch-stars-set-${starCount}`}
                    onClick={() => {
                      onBatchSetRating(starCount);
                      setOpenMenu(null);
                    }}
                    title={`Definir ${starCount} estrela${starCount > 1 ? 's' : ''} nas selecionadas`}
                    className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg bg-[#1e2028] hover:bg-amber-500/20 border border-[#2c2e3d] hover:border-amber-400/70 text-amber-300 font-bold cursor-pointer transition-colors"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-[11px]">{starCount}★</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-testid="batch-stars-clear"
                onClick={() => {
                  onBatchSetRating(0);
                  setOpenMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/70 text-rose-200 hover:text-white flex items-center gap-2 font-semibold cursor-pointer transition-colors"
              >
                <StarOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Remover todas as estrelas</span>
              </button>
            </div>
          )}
        </div>

        {/* Status Hoje em Massa */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('status')}
            data-testid="batch-status-btn"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap border ${
              openMenu === 'status'
                ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200'
                : 'bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white border-[#2c2e3d]'
            }`}
            title="Alterar status diário das PWAs selecionadas"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Status</span>
            <ChevronUp className={`w-3 h-3 text-neutral-400 transition-transform ${openMenu === 'status' ? 'rotate-180' : ''}`} />
          </button>

          {openMenu === 'status' && (
            <div className="absolute bottom-full mb-2.5 left-0 z-50 w-56 bg-[#14151a] border border-[#2c2e3d] rounded-xl shadow-2xl shadow-black py-1.5 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 border-b border-[#242633] text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Status Hoje ({selectedCount})
              </div>
              <button
                type="button"
                data-testid="batch-status-accessed"
                onClick={() => {
                  onBatchSetStatus('accessed');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#1f212a] flex items-center gap-2 text-emerald-300 font-medium cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Marcar Acessadas</span>
              </button>
              <button
                type="button"
                data-testid="batch-status-pending"
                onClick={() => {
                  onBatchSetStatus('pending');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#1f212a] flex items-center gap-2 text-rose-300 font-medium cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>Marcar Pendentes</span>
              </button>
              <button
                type="button"
                data-testid="batch-status-toggle"
                onClick={() => {
                  onBatchSetStatus('toggle');
                  setOpenMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#1f212a] flex items-center gap-2 text-sky-300 font-medium cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                <span>Alternar Status</span>
              </button>
            </div>
          )}
        </div>

        {/* Marcações (COM, RB, BON) em Massa */}
        {onBatchSetDailyFlag && (
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('flags')}
              data-testid="batch-flags-btn"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap border ${
                openMenu === 'flags'
                  ? 'bg-violet-500/20 border-violet-400/70 text-violet-200'
                  : 'bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white border-[#2c2e3d]'
              }`}
              title="Marcar ou limpar COM, RB, BON e data ($) em lote"
            >
              <Tag className="w-3.5 h-3.5 text-violet-400" />
              <span>Marcações</span>
              <ChevronUp className={`w-3 h-3 text-neutral-400 transition-transform ${openMenu === 'flags' ? 'rotate-180' : ''}`} />
            </button>

            {openMenu === 'flags' && (
              <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 z-50 w-64 bg-[#14151a] border border-[#2c2e3d] rounded-xl shadow-2xl shadow-black p-2.5 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100 space-y-2">
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider px-0.5">
                  Marcações Hoje ({selectedCount})
                </div>
                <div className="space-y-1.5">
                  {DAILY_FLAG_META.map(({ key, label, badgeColorClass }) => (
                    <div key={key} className="flex items-center justify-between gap-2 px-1.5 py-1 rounded-lg bg-neutral-950/70 border border-neutral-800/80">
                      <span className={`font-bold text-[11px] ${badgeColorClass}`}>{label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onBatchSetDailyFlag(key, true);
                            setOpenMenu(null);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/50 text-emerald-200 text-[10px] font-semibold cursor-pointer"
                        >
                          <Check className="w-2.5 h-2.5" />
                          <span>Marcar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onBatchSetDailyFlag(key, false);
                            setOpenMenu(null);
                          }}
                          className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {onBatchClearFlags && (
                  <div className="pt-1 border-t border-[#242633] space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        onBatchClearFlags({ clearDaily: true, clearMoneyDate: false });
                        setOpenMenu(null);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#1f212a] flex items-center gap-2 text-neutral-300 hover:text-white cursor-pointer"
                    >
                      <Eraser className="w-3.5 h-3.5 text-amber-400" />
                      <span>Limpar COM, RB e BON</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onBatchClearFlags({ clearDaily: false, clearMoneyDate: true });
                        setOpenMenu(null);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-950/50 flex items-center gap-2 text-rose-300 hover:text-white cursor-pointer"
                    >
                      <MoneySymbolIcon className="w-3.5 h-3.5" />
                      <span>Limpar Data ($)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mover para Pasta */}
        {onBatchAssignFolder && (
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('folder')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap border border-[#2c2e3d]"
              title="Mover PWAs selecionadas para uma pasta"
            >
              <FolderInput className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pasta</span>
              <ChevronUp className={`w-3 h-3 text-neutral-400 transition-transform ${openMenu === 'folder' ? 'rotate-180' : ''}`} />
            </button>

            {openMenu === 'folder' && (
              <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 z-50 w-60 bg-[#14151a] border border-[#2c2e3d] rounded-xl shadow-2xl shadow-black py-2 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 border-b border-[#242633] text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Mover para Pasta:
                </div>

                <div className="max-h-48 overflow-y-auto py-1">
                  <button
                    type="button"
                    onClick={() => handleSelectFolder(null)}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#1f212a] text-neutral-300 hover:text-white cursor-pointer"
                  >
                    Sem Pasta (Raiz)
                  </button>
                  {flatFolders.map(({ folder, label }) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => handleSelectFolder(folder.id)}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#1f212a] hover:text-white flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>

                {onCreateAndAssignFolder && (
                  <div className="border-t border-[#242633] pt-1 px-1">
                    {!isCreatingFolder ? (
                      <button
                        type="button"
                        onClick={() => setIsCreatingFolder(true)}
                        className="w-full text-left px-2.5 py-1.5 text-emerald-400 hover:bg-[#1f212a] rounded-lg flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Criar Nova Pasta...</span>
                      </button>
                    ) : (
                      <form onSubmit={handleCreateFolderAndMove} className="p-1 space-y-1">
                        <input
                          type="text"
                          placeholder="Nome da nova pasta..."
                          value={customFolderName}
                          onChange={(e) => setCustomFolderName(e.target.value)}
                          autoFocus
                          className="w-full px-2 py-1 text-[11px] bg-neutral-950 border border-neutral-700 text-white rounded focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setIsCreatingFolder(false)}
                            className="px-2 py-0.5 text-[10px] text-neutral-400 hover:text-white cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={!customFolderName.trim()}
                            className="px-2 py-0.5 text-[10px] font-bold text-neutral-950 bg-emerald-400 rounded hover:bg-emerald-300 disabled:opacity-50 cursor-pointer"
                          >
                            Criar e Mover
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Add a Grupo */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('group')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap border border-[#2c2e3d]"
            title="Adicionar PWAs selecionadas a um grupo"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>Grupo</span>
            <ChevronUp className={`w-3 h-3 text-neutral-400 transition-transform ${openMenu === 'group' ? 'rotate-180' : ''}`} />
          </button>

          {openMenu === 'group' && (
            <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 z-50 w-56 bg-[#14151a] border border-[#2c2e3d] rounded-xl shadow-2xl shadow-black py-2 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100">
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

        {/* Atualizar Ícones em Massa */}
        {onBatchRefreshIcons && (
          <button
            type="button"
            onClick={onBatchRefreshIcons}
            data-testid="batch-refresh-icons-btn"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap border border-[#2c2e3d]"
            title="Atualizar automaticamente os ícones das PWAs selecionadas"
          >
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ícones</span>
          </button>
        )}

        {/* Extrair URL */}
        <button
          type="button"
          onClick={onBatchExtractUrls}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap border border-[#2c2e3d]"
          title="Baixar lista e URLs das PWAs selecionadas em um arquivo Markdown (.md)"
        >
          <FileDown className="w-3.5 h-3.5 text-sky-400" />
          <span>Extrair URL</span>
        </button>

        {/* Editar */}
        <button
          type="button"
          onClick={onBatchEdit}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] text-neutral-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap border border-[#2c2e3d]"
          title="Editar pasta, grupo, classificação e anotações em lote"
        >
          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
          <span>Editar</span>
        </button>

        {/* Excluir */}
        <button
          type="button"
          onClick={onBatchDelete}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-200 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap"
          title="Excluir PWAs selecionadas"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>Excluir</span>
        </button>

        {/* Desmarcar / Cancelar */}
        <button
          type="button"
          onClick={onDeselectAll}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer shrink-0 ml-0.5"
          title="Cancelar seleção"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
