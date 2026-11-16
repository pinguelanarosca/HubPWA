import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Search,
  X,
  List,
  Rows3,
  Folder,
  Star,
  StarOff,
  Compass,
  Settings,
  FolderOpen,
  FolderPlus,
  Tag,
  CheckSquare,
  Square,
  Layers,
  ChevronDown,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Edit3,
  Trash2,
  Eraser,
  Check,
  LayoutGrid,
} from 'lucide-react';
import { DailyFlagKey, FlagFilterKey, PWAFolder, SortOption, StatusFilter, StarFilter, ViewDensity } from '../types/pwa';
import { getGroupTheme, GROUP_COLOR_THEMES } from '../utils/groupLogic';
import { flattenFoldersHierarchy } from '../utils/folderLogic';
import { DAILY_FLAG_META, FILTER_FLAG_META, MoneySymbolIcon } from './PWAFlagsControl';

interface ControlToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedGroup: string;
  onGroupChange: (group: string) => void;
  groups: string[];
  groupConfigs?: Record<string, string>;
  groupColors?: Record<string, string>;
  onOpenGroupManager?: () => void;
  folders?: PWAFolder[];
  selectedFolder?: string;
  onFolderChange?: (folderId: string) => void;
  onOpenFolderManager?: () => void;
  onDropPwaOnFolder?: (pwaIds: string[], targetFolderId: string | null) => void;
  unfiledCount?: number;
  folderItemCounts?: Record<string, number>;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  starFilter: StarFilter;
  onStarFilterChange: (star: StarFilter) => void;
  flagFilters?: FlagFilterKey[];
  flagCounts?: Record<FlagFilterKey, number>;
  onToggleFlagFilter?: (flag: FlagFilterKey) => void;
  onClearFlagFilters?: () => void;
  density: ViewDensity;
  onDensityChange: (mode: ViewDensity) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  totalCount: number;
  pendingCount: number;
  accessedCount: number;
  groupByGroup?: boolean;
  onToggleGroupByGroup?: () => void;
  selectableCount?: number;
  selectedCount?: number;
  allSelected?: boolean;
  onToggleSelectAll?: () => void;
  onDeselectAll?: () => void;
  onBulkSetRating?: (rating: number) => void;
  onBulkSetStatus?: (mode: 'accessed' | 'pending') => void;
  onBulkSetDailyFlag?: (flag: DailyFlagKey, active: boolean) => void;
  onBulkClearFlags?: () => void;
  onBulkRefreshIcons?: () => void;
  onBulkOpenEdit?: () => void;
  onBulkDelete?: () => void;
}

export const ControlToolbar: React.FC<ControlToolbarProps> = ({
  search,
  onSearchChange,
  selectedGroup,
  onGroupChange,
  groups,
  groupColors = {},
  onOpenGroupManager,
  folders = [],
  selectedFolder = 'all',
  onFolderChange,
  onOpenFolderManager,
  onDropPwaOnFolder,
  unfiledCount = 0,
  folderItemCounts = {},
  statusFilter,
  onStatusFilterChange,
  starFilter,
  onStarFilterChange,
  flagFilters = [],
  flagCounts = { moneyDate: 0, com: 0, rb: 0, bon: 0 },
  onToggleFlagFilter,
  onClearFlagFilters,
  density,
  onDensityChange,
  sortBy,
  onSortByChange,
  totalCount,
  pendingCount,
  accessedCount,
  selectableCount = 0,
  selectedCount = 0,
  allSelected = false,
  onToggleSelectAll,
  onDeselectAll,
  onBulkSetRating,
  onBulkSetStatus,
  onBulkSetDailyFlag,
  onBulkClearFlags,
  onBulkRefreshIcons,
  onBulkOpenEdit,
  onBulkDelete,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);

  const flatFolders = useMemo(() => flattenFoldersHierarchy(folders), [folders]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) {
        setIsBulkMenuOpen(false);
      }
    };
    if (isBulkMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isBulkMenuOpen]);

  // Keyboard shortcut: '/' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFolderDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const pwaId = e.dataTransfer.getData('text/pwa-id');
    if (pwaId && onDropPwaOnFolder) {
      onDropPwaOnFolder([pwaId], targetFolderId);
    }
  };

  return (
    <div className="space-y-2.5 mb-4">
      {/* Primary Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, domínio ou anotações... ( / )"
            className="w-full bg-[#14151a] border border-[#242633] text-neutral-100 placeholder:text-neutral-500 text-xs rounded-lg pl-9 pr-7 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              title="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Segmented Controls */}
        <div
          className="inline-flex items-center p-1 bg-[#14151a] border border-[#242633] rounded-lg text-xs font-medium notranslate"
          translate="no"
        >
          <button
            type="button"
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#242633] text-emerald-400 font-semibold shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            ⚡ Todas ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange('pending')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80 shadow-xs font-semibold'
                : 'text-neutral-400 hover:text-rose-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Pendentes ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange('accessed')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'accessed'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-xs font-semibold'
                : 'text-neutral-400 hover:text-emerald-400'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Acessadas ({accessedCount})</span>
          </button>
        </div>

        {/* Star Rating & Sorting Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Star Filter Dropdown */}
          <div className="relative flex items-center">
            <Star className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 pointer-events-none fill-amber-400" />
            <select
              value={starFilter}
              onChange={(e) => onStarFilterChange(e.target.value as StarFilter)}
              aria-label="Filtrar por classificação"
              className="bg-[#14151a] border border-[#242633] text-neutral-200 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
            >
              <option value="all">⭐ Classificação (Todas)</option>
              <option value="5">⭐⭐⭐⭐⭐ (5 Estrelas)</option>
              <option value="4">⭐⭐⭐⭐ (4+ Estrelas)</option>
              <option value="3">⭐⭐⭐ (3+ Estrelas)</option>
              <option value="unrated">Sem estrelas</option>
            </select>
          </div>

          {/* Sort Selector */}
          <div className="relative flex items-center">
            <Compass className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as SortOption)}
              aria-label="Ordenar por"
              className="bg-[#14151a] border border-[#242633] text-neutral-200 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
            >
              <option value="pinned">Ordenar por: Classificação</option>
              <option value="pendingFirst">Ordenar por: Pendentes Primeiro</option>
              <option value="name">Ordenar por: Nome (A - Z)</option>
              <option value="lastAccessed">Ordenar por: Último Acesso</option>
              <option value="accessCount">Ordenar por: Mais Acessadas</option>
              <option value="leastAccessed">Ordenar por: Menos Acessadas</option>
            </select>
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex items-center p-1 bg-[#14151a] border border-[#242633] rounded-lg gap-0.5">
            <button
              type="button"
              onClick={() => onDensityChange('folders')}
              title="Visualização por Pastas e Subpastas"
              aria-label="Modo Pastas"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                density === 'folders'
                  ? 'bg-emerald-500 text-neutral-950 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Pastas</span>
            </button>
            <button
              type="button"
              onClick={() => onDensityChange('cards')}
              title="Visualização em Grade de Cartões (Padrão)"
              aria-label="Grade de Cartões"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                density === 'cards'
                  ? 'bg-emerald-500 text-neutral-950 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Rows3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => onDensityChange('mini-cards')}
              data-testid="view-mode-mini-cards"
              title="Visualização em Mini Card (Ícone, Nome e Marcações)"
              aria-label="Mini Card"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap ${
                density === 'mini-cards'
                  ? 'bg-emerald-500 text-neutral-950 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mini Card</span>
            </button>
            <button
              type="button"
              onClick={() => onDensityChange('compact-table')}
              title="Visualização em Tabela Compacta"
              aria-label="Tabela Compacta"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                density === 'compact-table'
                  ? 'bg-emerald-500 text-neutral-950 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
          </div>

          {selectableCount > 0 && onToggleSelectAll && (
            <button
              type="button"
              onClick={onToggleSelectAll}
              data-testid="toolbar-select-all-btn"
              aria-pressed={allSelected}
              title={
                allSelected
                  ? 'Desmarcar todas as PWAs visíveis neste escopo'
                  : 'Selecionar todas as PWAs visíveis neste escopo'
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                allSelected
                  ? 'bg-emerald-500/20 border-emerald-400/75 text-emerald-200'
                  : 'bg-[#14151a] hover:bg-[#1f212a] border-[#242633] text-neutral-200 hover:text-white'
              }`}
            >
              {allSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-neutral-400" />
              )}
              <span>
                {allSelected ? `Desmarcar (${selectableCount})` : `Selecionar todas (${selectableCount})`}
              </span>
            </button>
          )}

          {selectableCount > 0 && onBulkSetRating && (
            <div className="relative" ref={bulkMenuRef}>
              <button
                type="button"
                onClick={() => setIsBulkMenuOpen((prev) => !prev)}
                data-testid="toolbar-bulk-actions-btn"
                aria-expanded={isBulkMenuOpen}
                title="Executar ações em massa (adicionar/remover estrelas, status, marcações, ícones)"
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  isBulkMenuOpen
                    ? 'bg-amber-500/20 border-amber-400/75 text-amber-200'
                    : 'bg-[#14151a] hover:bg-[#1f212a] border-[#242633] text-neutral-200 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Ações em Massa</span>
                <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${isBulkMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isBulkMenuOpen && (
                <div
                  data-testid="toolbar-bulk-actions-menu"
                  className="absolute right-0 top-full mt-2 z-50 w-80 bg-[#14151a] border border-[#2c2e3d] rounded-xl shadow-2xl shadow-black p-2.5 text-xs text-neutral-200 space-y-2.5 animate-in fade-in zoom-in-95 duration-100"
                >
                  {/* Scope Indicator */}
                  <div className="px-2 py-1.5 rounded-lg bg-neutral-950/90 border border-neutral-800/90 text-[11px] flex items-center justify-between">
                    <span className="text-neutral-400">Escopo:</span>
                    <span className="font-bold text-emerald-300">
                      {selectedCount > 0
                        ? `${selectedCount} selecionada${selectedCount > 1 ? 's' : ''}`
                        : `Todas as ${selectableCount} visíveis`}
                    </span>
                  </div>

                  {/* Selection shortcuts */}
                  {onToggleSelectAll && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!allSelected) onToggleSelectAll();
                          setIsBulkMenuOpen(false);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] border border-[#2c2e3d] text-neutral-200 hover:text-white text-[11px] font-medium whitespace-nowrap cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Selecionar todas</span>
                      </button>
                      <button
                        type="button"
                        disabled={selectedCount === 0}
                        onClick={() => {
                          onDeselectAll?.();
                          setIsBulkMenuOpen(false);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] border border-[#2c2e3d] text-neutral-300 hover:text-white disabled:opacity-40 text-[11px] font-medium whitespace-nowrap cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>Desmarcar</span>
                      </button>
                    </div>
                  )}

                  {/* Stars Bulk Section */}
                  <div className="pt-1.5 border-t border-[#242633] space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider px-0.5 flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span>Estrelas (Adicionar / Remover)</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map((starCount) => (
                        <button
                          key={starCount}
                          type="button"
                          data-testid={`bulk-menu-stars-${starCount}`}
                          onClick={() => {
                            onBulkSetRating(starCount);
                            setIsBulkMenuOpen(false);
                          }}
                          title={`Definir ${starCount} estrela${starCount > 1 ? 's' : ''}`}
                          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg bg-[#1e2028] hover:bg-amber-500/20 border border-[#2c2e3d] hover:border-amber-400/70 text-amber-300 font-bold cursor-pointer transition-colors"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-[11px]">{starCount}★</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      data-testid="bulk-menu-clear-stars"
                      onClick={() => {
                        onBulkSetRating(0);
                        setIsBulkMenuOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 text-rose-200 hover:text-white flex items-center gap-2 font-semibold cursor-pointer transition-colors"
                    >
                      <StarOff className="w-3.5 h-3.5 text-rose-400" />
                      <span>Remover todas as estrelas</span>
                    </button>
                  </div>

                  {/* Daily Status Bulk Section */}
                  {onBulkSetStatus && (
                    <div className="pt-1.5 border-t border-[#242633] space-y-1">
                      <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider px-0.5">
                        Status de Hoje
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          data-testid="bulk-menu-mark-accessed"
                          onClick={() => {
                            onBulkSetStatus('accessed');
                            setIsBulkMenuOpen(false);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-700/60 text-emerald-200 font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Acessadas</span>
                        </button>
                        <button
                          type="button"
                          data-testid="bulk-menu-mark-pending"
                          onClick={() => {
                            onBulkSetStatus('pending');
                            setIsBulkMenuOpen(false);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-700/60 text-rose-200 font-semibold cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-rose-400" />
                          <span>Pendentes</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Daily Flags Bulk Section (COM, RB, BON) */}
                  {onBulkSetDailyFlag && (
                    <div className="pt-1.5 border-t border-[#242633] space-y-1.5">
                      <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider px-0.5">
                        Marcar Hoje (COM / RB / BON)
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {DAILY_FLAG_META.map(({ key, label, badgeColorClass }) => (
                          <button
                            key={key}
                            type="button"
                            data-testid={`bulk-menu-flag-${key}`}
                            onClick={() => {
                              onBulkSetDailyFlag(key, true);
                              setIsBulkMenuOpen(false);
                            }}
                            className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#1e2028] hover:bg-[#282a36] border border-[#2c2e3d] font-bold cursor-pointer"
                          >
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className={badgeColorClass}>{label}</span>
                          </button>
                        ))}
                      </div>
                      {onBulkClearFlags && (
                        <button
                          type="button"
                          onClick={() => {
                            onBulkClearFlags();
                            setIsBulkMenuOpen(false);
                          }}
                          className="w-full px-2.5 py-1 rounded-lg hover:bg-[#1f212a] text-neutral-300 hover:text-white flex items-center gap-2 text-[11px] cursor-pointer"
                        >
                          <Eraser className="w-3.5 h-3.5 text-amber-400" />
                          <span>Limpar marcações do dia</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Icons, Edit & Delete Bulk Section */}
                  <div className="pt-1.5 border-t border-[#242633] space-y-1">
                    {onBulkRefreshIcons && (
                      <button
                        type="button"
                        data-testid="bulk-menu-refresh-icons"
                        onClick={() => {
                          onBulkRefreshIcons();
                          setIsBulkMenuOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#1f212a] flex items-center gap-2 text-cyan-300 font-medium cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Atualizar ícones pertinentes</span>
                      </button>
                    )}
                    {onBulkOpenEdit && (
                      <button
                        type="button"
                        data-testid="bulk-menu-edit"
                        onClick={() => {
                          setIsBulkMenuOpen(false);
                          onBulkOpenEdit();
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#1f212a] flex items-center gap-2 text-blue-300 font-medium cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Editar Pasta / Grupo / Notas...</span>
                      </button>
                    )}
                    {onBulkDelete && (
                      <button
                        type="button"
                        data-testid="bulk-menu-delete"
                        onClick={() => {
                          setIsBulkMenuOpen(false);
                          onBulkDelete();
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-950/60 flex items-center gap-2 text-rose-300 font-medium cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Excluir PWAs...</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Marcações Filter Strip ($ Data, COM, RB, BON) */}
      {onToggleFlagFilter && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
          <div className="flex items-center gap-1 text-neutral-400 shrink-0 mr-1">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-neutral-300">Marcações:</span>
          </div>

          <button
            type="button"
            onClick={() => onClearFlagFilters && onClearFlagFilters()}
            aria-pressed={flagFilters.length === 0}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              flagFilters.length === 0
                ? 'bg-neutral-200 text-neutral-950 font-bold shadow-xs'
                : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
            }`}
          >
            Todas
          </button>

          {FILTER_FLAG_META.map(({ key, label, filterActiveClass, badgeColorClass }) => {
            const isActive = flagFilters.includes(key);
            const count = flagCounts[key] || 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleFlagFilter(key)}
                aria-pressed={isActive}
                aria-label={`Filtrar por ${label}`}
                data-testid={`filter-flag-${key}`}
                title={
                  key === 'moneyDate'
                    ? 'Filtrar PWAs com data (DD/MM) preenchida'
                    : `Filtrar PWAs com ${label} marcado hoje`
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                  isActive
                    ? filterActiveClass
                    : 'bg-[#14151a] hover:bg-[#1b1d26] text-neutral-200 hover:text-white border-[#242633]'
                }`}
              >
                {key === 'moneyDate' ? (
                  <span className="inline-flex items-center">
                    <MoneySymbolIcon className="w-3.5 h-3.5" />
                  </span>
                ) : null}
                <span className={isActive ? '' : badgeColorClass}>{label}</span>
                <span className={`text-[11px] font-mono tabular-nums ${isActive ? 'opacity-95' : 'text-neutral-400'}`}>
                  ({count})
                </span>
              </button>
            );
          })}

          {flagFilters.length > 0 && onClearFlagFilters && (
            <button
              type="button"
              onClick={onClearFlagFilters}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-neutral-400 hover:text-white hover:bg-[#1f212a] cursor-pointer"
              title="Limpar filtros de marcações"
            >
              <X className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      )}

      {/* Pastas Filter Strip (supports drag-and-drop assignment) */}
      {onFolderChange && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <div className="flex items-center gap-1 text-neutral-400 shrink-0 mr-1">
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-neutral-300">Pastas:</span>
            {onOpenFolderManager && (
              <button
                type="button"
                onClick={onOpenFolderManager}
                title="Criar ou gerenciar pastas"
                aria-label="Gerenciar Pastas"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 border border-emerald-800/60 transition-colors cursor-pointer ml-0.5 text-[11px] font-semibold"
              >
                <FolderPlus className="w-3 h-3" />
                <span>Nova</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onFolderChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedFolder === 'all'
                ? 'bg-emerald-400 text-neutral-950 font-bold shadow-xs'
                : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
            }`}
          >
            Todas ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => onFolderChange('unfiled')}
            onDragOver={(e) => {
              if (!onDropPwaOnFolder) return;
              e.preventDefault();
              setDragOverFolderId('__unfiled__');
            }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => handleFolderDrop(e, null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              dragOverFolderId === '__unfiled__'
                ? 'bg-emerald-900/70 text-white border border-emerald-400'
                : selectedFolder === 'unfiled'
                ? 'bg-emerald-400 text-neutral-950 font-bold shadow-xs'
                : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
            }`}
          >
            Sem Pasta ({unfiledCount})
          </button>

          {flatFolders.map(({ folder, label }) => {
            const theme = GROUP_COLOR_THEMES[folder.color || 'emerald'] || GROUP_COLOR_THEMES.emerald;
            const count = folderItemCounts[folder.id] || 0;
            const isActive = selectedFolder === folder.id;
            const isDragTarget = dragOverFolderId === folder.id;

            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => onFolderChange(folder.id)}
                onDragOver={(e) => {
                  if (!onDropPwaOnFolder) return;
                  e.preventDefault();
                  setDragOverFolderId(folder.id);
                }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isDragTarget
                    ? 'bg-emerald-900/70 text-white border border-emerald-400 ring-1 ring-emerald-400'
                    : isActive
                    ? 'bg-emerald-400 text-neutral-950 font-bold shadow-xs'
                    : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${theme.dotColor}`} />
                <span>{label}</span>
                <span
                  className={`text-[10px] font-mono ${
                    isActive ? 'text-neutral-900' : 'text-neutral-500'
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grupos Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs">
        <div className="flex items-center gap-1 text-neutral-400 shrink-0 mr-1">
          <Folder className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-neutral-300">Grupos:</span>
          {onOpenGroupManager && (
            <button
              type="button"
              onClick={onOpenGroupManager}
              title="Gerenciar nomes e símbolos dos grupos"
              className="p-1 rounded text-neutral-400 hover:text-emerald-400 hover:bg-[#1f212a] transition-colors cursor-pointer ml-0.5"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onGroupChange('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
            selectedGroup === 'all'
              ? 'bg-neutral-100 text-neutral-950 font-bold shadow-xs'
              : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
          }`}
        >
          Todos os Grupos
        </button>

        {groups.map((grp) => {
          const theme = getGroupTheme(grp, groupColors);
          return (
            <button
              key={grp}
              type="button"
              onClick={() => onGroupChange(grp)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedGroup === grp
                  ? 'bg-neutral-100 text-neutral-950 font-bold shadow-xs'
                  : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${theme.dotColor}`} />
              <span>{grp}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
