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
  ChevronUp,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Edit3,
  Trash2,
  Eraser,
  Check,
  LayoutGrid,
  SlidersHorizontal,
  User,
  Copy,
} from 'lucide-react';
import { AccessTimeWindowFilter, DailyFlagKey, DailyFlagState, FlagFilterKey, PWAFolder, SortOption, StatusFilter, StarFilter, ViewDensity } from '../types/pwa';
import { getGroupTheme, GROUP_COLOR_THEMES } from '../utils/groupLogic';
import { flattenFoldersHierarchy } from '../utils/folderLogic';
import { ChromeProfileFilterSummary, PWAFlagBreakdown } from '../utils/pwaLogic';
import { buildRelativeTimeWindow } from '../utils/historyLogic';
import { DAILY_FLAG_META, MoneySymbolIcon } from './PWAFlagsControl';

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
  profileFilter?: string;
  onProfileFilterChange?: (profile: string) => void;
  profileSummary?: ChromeProfileFilterSummary;
  flagFilters?: FlagFilterKey[];
  flagCounts?: Record<'moneyDate' | DailyFlagKey, number>;
  flagBreakdown?: PWAFlagBreakdown;
  onToggleFlagFilter?: (flag: FlagFilterKey) => void;
  onClearFlagFilters?: () => void;
  timeWindow?: AccessTimeWindowFilter;
  onTimeWindowChange?: (next: AccessTimeWindowFilter) => void;
  timeWindowMatchCount?: number;
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
  onBulkSetDailyFlag?: (flag: DailyFlagKey, activeOrState: boolean | DailyFlagState | null) => void;
  onBulkClearFlags?: () => void;
  onBulkRefreshIcons?: () => void;
  onBulkOpenEdit?: () => void;
  onBulkRemoveDuplicates?: () => void;
  sameProfileDuplicatesCount?: number;
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
  profileFilter = 'all',
  onProfileFilterChange,
  profileSummary,
  flagFilters = [],
  flagCounts = { moneyDate: 0, com: 0, rb: 0, bon: 0 },
  flagBreakdown,
  onToggleFlagFilter,
  onClearFlagFilters,
  timeWindow,
  onTimeWindowChange,
  timeWindowMatchCount = 0,
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
  onBulkRemoveDuplicates,
  sameProfileDuplicatesCount = 0,
  onBulkDelete,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const [isTimePanelOpen, setIsTimePanelOpen] = useState(false);
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(true);

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

  const activeSecondaryFiltersCount =
    (timeWindow?.enabled ? 1 : 0) +
    (profileFilter !== 'all' ? 1 : 0) +
    (starFilter !== 'all' ? 1 : 0) +
    flagFilters.length +
    (selectedFolder !== 'all' ? 1 : 0) +
    (selectedGroup !== 'all' ? 1 : 0);

  return (
    <div data-testid="control-toolbar" className="space-y-1.5">
      {/* Primary Compact Toolbar Row: Search + Status + View Switcher + Mass Actions + Filters Toggle */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Search Input (clicking immediately clears existing search text for quick new search) */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            data-testid="search-input"
            type="text"
            value={search}
            onClick={() => {
              if (search) onSearchChange('');
            }}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar nome, domínio ou notas... ( / )"
            title={search ? 'Clique no campo para limpar e digitar nova busca' : 'Buscar por nome, domínio ou anotações (atalho /)'}
            className="w-full bg-[#14151a] border border-[#242633] text-neutral-100 placeholder:text-neutral-500 text-xs rounded-md pl-8 pr-7 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              title="Limpar busca"
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Segmented Controls */}
        <div
          className="inline-flex items-center p-0.5 bg-[#14151a] border border-[#242633] rounded-md text-[11px] font-medium notranslate shrink-0"
          translate="no"
        >
          <button
            type="button"
            onClick={() => onStatusFilterChange('all')}
            className={`px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
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
            className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80 shadow-xs font-semibold'
                : 'text-neutral-400 hover:text-rose-400'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Pendentes ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange('accessed')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'accessed'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-xs font-semibold'
                : 'text-neutral-400 hover:text-emerald-400'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Acessadas ({accessedCount})</span>
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="inline-flex items-center p-0.5 bg-[#14151a] border border-[#242633] rounded-md gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onDensityChange('folders')}
            title="Visualização por Pastas e Subpastas"
            aria-label="Modo Pastas"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
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
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
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
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
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
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
              density === 'compact-table'
                ? 'bg-emerald-500 text-neutral-950 font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tabela</span>
          </button>
        </div>

        {/* Select All + Bulk Actions */}
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
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
              {allSelected ? `Desmarcar (${selectableCount})` : `Selecionar (${selectableCount})`}
            </span>
          </button>
        )}

        {selectableCount > 0 && onBulkSetRating && (
          <div className="relative shrink-0" ref={bulkMenuRef}>
            <button
              type="button"
              onClick={() => setIsBulkMenuOpen((prev) => !prev)}
              data-testid="toolbar-bulk-actions-btn"
              aria-expanded={isBulkMenuOpen}
              title="Executar ações em massa (adicionar/remover estrelas, status, marcações, ícones)"
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                isBulkMenuOpen
                  ? 'bg-amber-500/20 border-amber-400/75 text-amber-200'
                  : 'bg-[#14151a] hover:bg-[#1f212a] border-[#242633] text-neutral-200 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Em Massa</span>
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
                      <div className="space-y-1">
                        {DAILY_FLAG_META.map(({ key, label, badgeColorClass }) => (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-[#191b22] border border-[#2c2e3d]"
                          >
                            <span className={`font-bold text-[11px] ${badgeColorClass}`}>{label}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                data-testid={`bulk-menu-flag-${key}-check`}
                                title={`Marcar check verde (✓) em ${label}`}
                                onClick={() => {
                                  onBulkSetDailyFlag(key, 'check');
                                  setIsBulkMenuOpen(false);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold cursor-pointer"
                              >
                                <Check className="w-3 h-3 stroke-[2.8]" />
                              </button>
                              <button
                                type="button"
                                data-testid={`bulk-menu-flag-${key}-x`}
                                title={`Marcar X vermelho (✕) em ${label}`}
                                onClick={() => {
                                  onBulkSetDailyFlag(key, 'x');
                                  setIsBulkMenuOpen(false);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/50 text-rose-300 text-[10px] font-bold cursor-pointer"
                              >
                                <X className="w-3 h-3 stroke-[2.8]" />
                              </button>
                            </div>
                          </div>
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
                    {onBulkRemoveDuplicates && (
                      <button
                        type="button"
                        data-testid="bulk-menu-remove-duplicates"
                        onClick={() => {
                          setIsBulkMenuOpen(false);
                          onBulkRemoveDuplicates();
                        }}
                        title="Remover cópias com a mesma URL apenas dentro do mesmo perfil do Chrome"
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-950/40 flex items-center justify-between gap-2 text-amber-300 font-medium cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Remover duplicadas (mesmo perfil)</span>
                        </span>
                        {sameProfileDuplicatesCount > 0 && (
                          <span className="text-[10px] font-mono font-bold text-amber-300">
                            ({sameProfileDuplicatesCount})
                          </span>
                        )}
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

        {/* Toggle secondary filter strips */}
        <button
          type="button"
          data-testid="toggle-secondary-filters-btn"
          aria-expanded={showSecondaryFilters}
          onClick={() => setShowSecondaryFilters((prev) => !prev)}
          title={showSecondaryFilters ? 'Recolher barra de filtros extras' : 'Expandir barra de filtros (Horário, Marcações, Pastas, Grupos)'}
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            showSecondaryFilters
              ? 'bg-[#1b1d26] border-[#2d3040] text-neutral-200 hover:text-white'
              : activeSecondaryFiltersCount > 0
              ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-300'
              : 'bg-[#14151a] hover:bg-[#1f212a] border-[#242633] text-neutral-300 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3 h-3 text-emerald-400" />
          <span className="hidden sm:inline">Filtros</span>
          {activeSecondaryFiltersCount > 0 && (
            <span className="px-1 py-0 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
              {activeSecondaryFiltersCount}
            </span>
          )}
          {showSecondaryFilters ? (
            <ChevronUp className="w-3 h-3 text-neutral-400" />
          ) : (
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          )}
        </button>
      </div>

      {/* Collapsible Compact Secondary Filters (Selectors + Marcações, Time Window, Pastas, Grupos) */}
      {showSecondaryFilters && (
        <div data-testid="secondary-filters-section" className="space-y-1">
          {/* Combined Compact Row: Time Trigger + Classificação + Ordenar por + Marcações */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {/* Time Window Filter Trigger */}
            {onTimeWindowChange && timeWindow && (
              <div className="inline-flex items-center shrink-0">
                <button
                  type="button"
                  data-testid="time-window-toggle-btn"
                  aria-expanded={isTimePanelOpen || timeWindow.enabled}
                  onClick={() => setIsTimePanelOpen((prev) => !prev)}
                  title="Filtrar PWAs acessadas por janela de horário (ex: hoje entre X e Y hora)"
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    timeWindow.enabled
                      ? 'bg-emerald-950/80 border-emerald-500/75 text-emerald-200 font-semibold rounded-l-md'
                      : isTimePanelOpen
                      ? 'bg-[#1f212a] border-emerald-500/60 text-white rounded-md'
                      : 'bg-[#14151a] hover:bg-[#1f212a] border-[#242633] text-neutral-200 hover:text-white rounded-md'
                  }`}
                >
                  <Clock className={`w-3 h-3 ${timeWindow.enabled ? 'text-emerald-400' : 'text-sky-400'}`} />
                  <span>
                    {timeWindow.enabled
                      ? `${timeWindow.dayScope === 'today' ? 'Hoje' : 'Qualquer dia'} ${timeWindow.startTime}–${timeWindow.endTime}`
                      : 'Janela Horário'}
                  </span>
                </button>
                {timeWindow.enabled && (
                  <button
                    type="button"
                    data-testid="time-window-quick-clear"
                    aria-label="Limpar filtro de horário"
                    title="Desativar filtro de horário"
                    onClick={() => {
                      onTimeWindowChange({ ...timeWindow, enabled: false });
                      setIsTimePanelOpen(false);
                    }}
                    className="px-1.5 py-1 rounded-r-md bg-emerald-950/80 hover:bg-rose-950/80 border border-l-0 border-emerald-500/75 hover:border-rose-500/75 text-emerald-300 hover:text-rose-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Chrome Profile Filter Dropdown */}
            {onProfileFilterChange && (
              <div className="relative flex items-center shrink-0">
                <User
                  className={`w-3 h-3 absolute left-2 pointer-events-none ${
                    profileFilter !== 'all' ? 'text-sky-300' : 'text-sky-400'
                  }`}
                />
                <select
                  data-testid="profile-filter-select"
                  value={profileFilter}
                  onChange={(e) => onProfileFilterChange(e.target.value)}
                  aria-label="Filtrar por perfil do Chrome"
                  title="Filtrar PWAs pelo perfil do Google Chrome"
                  className={`text-[11px] pl-6 pr-2.5 py-1 focus:outline-none focus:border-sky-500 appearance-none cursor-pointer border transition-colors ${
                    profileFilter !== 'all'
                      ? 'bg-sky-950/75 border-sky-500/75 text-sky-200 font-semibold rounded-l-md'
                      : 'bg-[#14151a] border-[#242633] text-neutral-200 rounded-md'
                  }`}
                >
                  <option value="all">Perfil Chrome (Todos)</option>
                  {(profileSummary?.options || []).map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label} ({opt.count})
                    </option>
                  ))}
                  {(profileSummary?.unassignedCount || 0) > 0 && (
                    <option value="none">Sem perfil ({profileSummary?.unassignedCount})</option>
                  )}
                  {profileFilter !== 'all' &&
                    profileFilter !== 'none' &&
                    !(profileSummary?.options || []).some((opt) => opt.key === profileFilter) && (
                      <option value={profileFilter}>{profileFilter} (0)</option>
                    )}
                </select>
                {profileFilter !== 'all' && (
                  <button
                    type="button"
                    data-testid="profile-filter-quick-clear"
                    aria-label="Limpar filtro de perfil do Chrome"
                    title="Mostrar todos os perfis do Chrome"
                    onClick={() => onProfileFilterChange('all')}
                    className="px-1.5 py-1 rounded-r-md bg-sky-950/75 hover:bg-rose-950/80 border border-l-0 border-sky-500/75 hover:border-rose-500/75 text-sky-300 hover:text-rose-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Star Filter Dropdown */}
            <div className="relative flex items-center shrink-0">
              <Star className="w-3 h-3 text-amber-400 absolute left-2 pointer-events-none fill-amber-400" />
              <select
                value={starFilter}
                onChange={(e) => onStarFilterChange(e.target.value as StarFilter)}
                aria-label="Filtrar por classificação"
                className="bg-[#14151a] border border-[#242633] text-neutral-200 text-[11px] rounded-md pl-6 pr-2.5 py-1 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
              >
                <option value="all">Classificação (Todas)</option>
                <option value="5">5 Estrelas</option>
                <option value="4">4+ Estrelas</option>
                <option value="3">3+ Estrelas</option>
                <option value="unrated">Sem estrelas</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="relative flex items-center shrink-0">
              <Compass className="w-3 h-3 text-emerald-400 absolute left-2 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value as SortOption)}
                aria-label="Ordenar por"
                className="bg-[#14151a] border border-[#242633] text-neutral-200 text-[11px] rounded-md pl-6 pr-2.5 py-1 focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
              >
                <option value="pinned">Ordem: Classificação</option>
                <option value="pendingFirst">Ordem: Pendentes Primeiro</option>
                <option value="name">Ordem: Nome (A - Z)</option>
                <option value="lastAccessed">Ordem: Último Acesso</option>
                <option value="accessCount">Ordem: Mais Acessadas</option>
                <option value="leastAccessed">Ordem: Menos Acessadas</option>
              </select>
            </div>

            {/* Marcações Filter Strip ($ Data, COM, RB, BON) inline on desktop */}
            {onToggleFlagFilter && (
              <>
                <span className="hidden lg:inline-block h-4 w-px bg-[#242633] mx-0.5 shrink-0" aria-hidden="true" />
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0">
                  <div className="flex items-center gap-1 text-neutral-400 shrink-0 mr-0.5">
                    <Tag className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] font-semibold text-neutral-300">Marcações:</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onClearFlagFilters && onClearFlagFilters()}
                    aria-pressed={flagFilters.length === 0}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      flagFilters.length === 0
                        ? 'bg-neutral-200 text-neutral-950 font-bold shadow-xs'
                        : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
                    }`}
                  >
                    Todas
                  </button>

                  {(() => {
                    const isMoneyActive = flagFilters.includes('moneyDate');
                    const moneyCount = flagBreakdown ? flagBreakdown.moneyDate : flagCounts.moneyDate || 0;
                    return (
                      <button
                        type="button"
                        onClick={() => onToggleFlagFilter('moneyDate')}
                        aria-pressed={isMoneyActive}
                        aria-label="Filtrar por $ Data"
                        data-testid="filter-flag-moneyDate"
                        title="Filtrar PWAs com data (DD/MM) preenchida"
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                          isMoneyActive
                            ? 'bg-emerald-500/18 border-emerald-400/75 text-emerald-200 shadow-[0_0_12px_-4px_rgba(16,185,129,0.5)]'
                            : 'bg-[#14151a] hover:bg-[#1b1d26] text-neutral-200 hover:text-white border-[#242633]'
                        }`}
                      >
                        <span className="inline-flex items-center">
                          <MoneySymbolIcon className="w-3 h-3" />
                        </span>
                        <span className={isMoneyActive ? '' : 'text-emerald-400'}>$ Data</span>
                        <span className={`text-[10px] font-mono tabular-nums ${isMoneyActive ? 'opacity-95' : 'text-neutral-400'}`}>
                          ({moneyCount})
                        </span>
                      </button>
                    );
                  })()}

                  {DAILY_FLAG_META.map(({ key, label, filterActiveClass, badgeColorClass }) => {
                    const checkFilterKey = `${key}:check` as FlagFilterKey;
                    const xFilterKey = `${key}:x` as FlagFilterKey;
                    const isAnyActive = flagFilters.includes(key);
                    const isCheckActive = flagFilters.includes(checkFilterKey);
                    const isXActive = flagFilters.includes(xFilterKey);

                    const totalForKey = flagBreakdown ? flagBreakdown[key].total : flagCounts[key] || 0;
                    const checkForKey = flagBreakdown ? flagBreakdown[key].check : 0;
                    const xForKey = flagBreakdown ? flagBreakdown[key].x : 0;

                    return (
                      <div
                        key={key}
                        className="inline-flex items-center rounded-md border border-[#242633] bg-[#14151a] overflow-hidden shrink-0"
                      >
                        <button
                          type="button"
                          onClick={() => onToggleFlagFilter(key)}
                          aria-pressed={isAnyActive}
                          aria-label={`Filtrar por ${label}`}
                          data-testid={`filter-flag-${key}`}
                          title={`Filtrar PWAs com ${label} marcado hoje (✓ ou ✕)`}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            isAnyActive
                              ? filterActiveClass
                              : 'hover:bg-[#1b1d26] text-neutral-200 hover:text-white'
                          }`}
                        >
                          <span className={isAnyActive ? '' : badgeColorClass}>{label}</span>
                          <span className={`text-[10px] font-mono tabular-nums ${isAnyActive ? 'opacity-95' : 'text-neutral-400'}`}>
                            ({totalForKey})
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleFlagFilter(checkFilterKey)}
                          aria-pressed={isCheckActive}
                          aria-label={`Filtrar ${label} com check verde`}
                          data-testid={`filter-flag-${key}-check`}
                          title={`Filtrar apenas ${label} com check verde (✓)`}
                          className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-mono border-l border-[#242633] transition-colors cursor-pointer ${
                            isCheckActive
                              ? 'bg-emerald-500/25 text-emerald-200 font-bold'
                              : 'text-emerald-400/80 hover:bg-emerald-500/15 hover:text-emerald-300'
                          }`}
                        >
                          <Check className="w-2.5 h-2.5 stroke-[2.8]" />
                          <span>{checkForKey}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleFlagFilter(xFilterKey)}
                          aria-pressed={isXActive}
                          aria-label={`Filtrar ${label} com X vermelho`}
                          data-testid={`filter-flag-${key}-x`}
                          title={`Filtrar apenas ${label} com X vermelho (✕)`}
                          className={`inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-mono border-l border-[#242633] transition-colors cursor-pointer ${
                            isXActive
                              ? 'bg-rose-500/25 text-rose-200 font-bold'
                              : 'text-rose-400/80 hover:bg-rose-500/15 hover:text-rose-300'
                          }`}
                        >
                          <X className="w-2.5 h-2.5 stroke-[2.8]" />
                          <span>{xForKey}</span>
                        </button>
                      </div>
                    );
                  })}

                  {flagFilters.length > 0 && onClearFlagFilters && (
                    <button
                      type="button"
                      onClick={onClearFlagFilters}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] text-neutral-400 hover:text-white hover:bg-[#1f212a] cursor-pointer shrink-0"
                      title="Limpar filtros de marcações"
                    >
                      <X className="w-3 h-3" />
                      <span>Limpar</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Expandable Time Window Filter Bar ("Acessadas hoje entre X e Y hora") */}
          {onTimeWindowChange && timeWindow && (isTimePanelOpen || timeWindow.enabled) && (
            <div
              data-testid="time-window-panel"
              className="px-2.5 py-1.5 rounded-lg bg-[#14151a] border border-[#242633] flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-100"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 text-sky-300 font-semibold shrink-0 text-[11px]">
                  <Clock className="w-3 h-3 text-sky-400" />
                  <span>Janela:</span>
                </div>

                {/* Day Scope Toggle */}
                <div className="inline-flex items-center p-0.5 rounded-md bg-neutral-950 border border-neutral-800">
                  <button
                    type="button"
                    data-testid="time-window-scope-today"
                    onClick={() =>
                      onTimeWindowChange({ ...timeWindow, enabled: true, dayScope: 'today' })
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      timeWindow.dayScope === 'today'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Acessadas hoje
                  </button>
                  <button
                    type="button"
                    data-testid="time-window-scope-any"
                    onClick={() =>
                      onTimeWindowChange({ ...timeWindow, enabled: true, dayScope: 'any' })
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      timeWindow.dayScope === 'any'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Qualquer dia
                  </button>
                </div>

                {/* Start / End Time Inputs */}
                <div className="inline-flex items-center gap-1">
                  <label htmlFor="time-window-start-input" className="text-[11px] text-neutral-400">
                    Das
                  </label>
                  <input
                    id="time-window-start-input"
                    data-testid="time-window-start"
                    type="time"
                    aria-label="Horário inicial"
                    value={timeWindow.startTime}
                    onChange={(e) =>
                      onTimeWindowChange({
                        ...timeWindow,
                        enabled: true,
                        startTime: e.target.value || '00:00',
                      })
                    }
                    className="bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded px-1.5 py-0.5 text-[11px] font-mono text-white focus:outline-none"
                  />
                  <label htmlFor="time-window-end-input" className="text-[11px] text-neutral-400">
                    às
                  </label>
                  <input
                    id="time-window-end-input"
                    data-testid="time-window-end"
                    type="time"
                    aria-label="Horário final"
                    value={timeWindow.endTime}
                    onChange={(e) =>
                      onTimeWindowChange({
                        ...timeWindow,
                        enabled: true,
                        endTime: e.target.value || '23:59',
                      })
                    }
                    className="bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded px-1.5 py-0.5 text-[11px] font-mono text-white focus:outline-none"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    {
                      id: 'last1h',
                      label: 'Última 1h',
                      getRange: () => buildRelativeTimeWindow(1),
                    },
                    {
                      id: 'last3h',
                      label: 'Últimas 3h',
                      getRange: () => buildRelativeTimeWindow(3),
                    },
                    {
                      id: 'morning',
                      label: 'Manhã (06–12h)',
                      getRange: () => ({ startTime: '06:00', endTime: '11:59' }),
                    },
                    {
                      id: 'afternoon',
                      label: 'Tarde (12–18h)',
                      getRange: () => ({ startTime: '12:00', endTime: '17:59' }),
                    },
                    {
                      id: 'night',
                      label: 'Noite (18–00h)',
                      getRange: () => ({ startTime: '18:00', endTime: '23:59' }),
                    },
                  ].map((preset) => {
                    const presetRange = preset.getRange();
                    const isActive =
                      timeWindow.enabled &&
                      timeWindow.startTime === presetRange.startTime &&
                      timeWindow.endTime === presetRange.endTime;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        data-testid={`time-window-preset-${preset.id}`}
                        onClick={() =>
                          onTimeWindowChange({
                            ...timeWindow,
                            enabled: true,
                            startTime: presetRange.startTime,
                            endTime: presetRange.endTime,
                          })
                        }
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                          isActive
                            ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200 font-semibold'
                            : 'bg-neutral-950/80 hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Status + Clear */}
              <div className="flex items-center gap-2 shrink-0">
                {timeWindow.enabled ? (
                  <span
                    data-testid="time-window-match-count"
                    className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-700/70 text-emerald-300 font-mono text-[11px] font-semibold"
                  >
                    {timeWindowMatchCount} na janela
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTimeWindowChange({ ...timeWindow, enabled: true })}
                    className="px-2 py-0.5 rounded bg-emerald-400 hover:bg-emerald-300 text-neutral-950 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Aplicar
                  </button>
                )}

                <button
                  type="button"
                  data-testid="time-window-clear"
                  onClick={() => {
                    onTimeWindowChange({
                      ...timeWindow,
                      enabled: false,
                    });
                    setIsTimePanelOpen(false);
                  }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>{timeWindow.enabled ? 'Limpar' : 'Fechar'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Pastas Filter Strip (supports drag-and-drop assignment) */}
          {onFolderChange && (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px]">
              <div className="flex items-center gap-1 text-neutral-400 shrink-0 mr-0.5">
                <FolderOpen className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px] font-semibold text-neutral-300">Pastas:</span>
                {onOpenFolderManager && (
                  <button
                    type="button"
                    onClick={onOpenFolderManager}
                    title="Criar ou gerenciar pastas"
                    aria-label="Gerenciar Pastas"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 border border-emerald-800/60 transition-colors cursor-pointer text-[10px] font-semibold"
                  >
                    <FolderPlus className="w-2.5 h-2.5" />
                    <span>Nova</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => onFolderChange('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
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
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
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
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      isDragTarget
                        ? 'bg-emerald-900/70 text-white border border-emerald-400 ring-1 ring-emerald-400'
                        : isActive
                        ? 'bg-emerald-400 text-neutral-950 font-bold shadow-xs'
                        : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${theme.dotColor}`} />
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
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px]">
            <div className="flex items-center gap-1 text-neutral-400 shrink-0 mr-0.5">
              <Folder className="w-3 h-3 text-emerald-400" />
              <span className="text-[11px] font-semibold text-neutral-300">Grupos:</span>
              {onOpenGroupManager && (
                <button
                  type="button"
                  onClick={onOpenGroupManager}
                  title="Gerenciar nomes e símbolos dos grupos"
                  className="p-0.5 rounded text-neutral-400 hover:text-emerald-400 hover:bg-[#1f212a] transition-colors cursor-pointer"
                >
                  <Settings className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onGroupChange('all')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedGroup === 'all'
                  ? 'bg-neutral-100 text-neutral-950 font-bold shadow-xs'
                  : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
              }`}
            >
              Todos
            </button>

            {groups.map((grp) => {
              const theme = getGroupTheme(grp, groupColors);
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => onGroupChange(grp)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedGroup === grp
                      ? 'bg-neutral-100 text-neutral-950 font-bold shadow-xs'
                      : 'bg-[#14151a] hover:bg-[#1f212a] text-neutral-300 hover:text-white border border-[#242633]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.dotColor}`} />
                  <span>{grp}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
