import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Search, X, List, Rows3, Folder, Star, Compass, Settings, FolderOpen, FolderPlus, Tag } from 'lucide-react';
import { FlagFilterKey, PWAFolder, SortOption, StatusFilter, StarFilter, ViewDensity } from '../types/pwa';
import { getGroupTheme, GROUP_COLOR_THEMES } from '../utils/groupLogic';
import { flattenFoldersHierarchy } from '../utils/folderLogic';
import { FLAG_META, renderFlagIcon } from './PWAFlagsControl';

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
  flagCounts = { money: 0, transfer: 0, gold: 0 },
  onToggleFlagFilter,
  onClearFlagFilters,
  density,
  onDensityChange,
  sortBy,
  onSortByChange,
  totalCount,
  pendingCount,
  accessedCount,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const flatFolders = useMemo(() => flattenFoldersHierarchy(folders), [folders]);

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
        </div>
      </div>

      {/* Marcações Filter Strip (Dinheiro, Vai e Volta, Barra de Ouro) */}
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

          {FLAG_META.map(({ key, label, filterActiveClass, iconColorClass }) => {
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
                title={`Filtrar PWAs com ${label} marcado`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap border transition-all cursor-pointer ${
                  isActive
                    ? `${filterActiveClass} font-semibold`
                    : 'bg-[#14151a] hover:bg-[#1b1d26] text-neutral-300 hover:text-white border-[#242633]'
                }`}
              >
                <span className={`inline-flex items-center ${iconColorClass}`}>
                  {renderFlagIcon(
                    key,
                    key === 'gold' ? 'w-[17px] h-[12px]' : 'w-3.5 h-3.5',
                    true
                  )}
                </span>
                <span>{label}</span>
                <span className={`text-[11px] font-mono tabular-nums ${isActive ? 'opacity-95' : 'text-neutral-500'}`}>
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
