import React, { useRef, useEffect } from 'react';
import { Search, X, List, LayoutGrid, Rows3, ArrowUpDown, Filter } from 'lucide-react';
import { SortOption, StatusFilter, ViewDensity } from '../types/pwa';

interface ControlToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  categories: string[];
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  density: ViewDensity;
  onDensityChange: (mode: ViewDensity) => void;
  sortBy: SortOption;
  onSortByChange: (sort: SortOption) => void;
  totalCount: number;
  pendingCount: number;
  accessedCount: number;
}

export const ControlToolbar: React.FC<ControlToolbarProps> = ({
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  statusFilter,
  onStatusFilterChange,
  density,
  onDensityChange,
  sortBy,
  onSortByChange,
  totalCount,
  pendingCount,
  accessedCount,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: '/' focuses the search box
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-2 mb-3">
      {/* Top row: Search, Status Segments, Density, Sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, URL, notas... (Pressione '/')"
            className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 placeholder:text-neutral-500 text-xs rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              title="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Segmented Controls */}
        <div className="inline-flex items-center p-0.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => onStatusFilterChange('all')}
            className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-neutral-800 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Todas ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange('pending')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80 shadow-xs'
                : 'text-neutral-400 hover:text-rose-400'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Pendentes ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onStatusFilterChange('accessed')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'accessed'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-xs'
                : 'text-neutral-400 hover:text-emerald-400'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Acessadas ({accessedCount})</span>
          </button>
        </div>

        {/* Right controls: View Density & Sort */}
        <div className="flex items-center gap-2">
          {/* Sort Selector */}
          <div className="relative flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400 absolute left-2 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as SortOption)}
              aria-label="Ordenar PWAs"
              className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-neutral-600 appearance-none cursor-pointer"
            >
              <option value="pinned">Fixadas primeiro</option>
              <option value="name">Nome (A - Z)</option>
              <option value="category">Por Categoria</option>
              <option value="accessCount">Mais Acessadas</option>
              <option value="lastAccessed">Último Acesso</option>
            </select>
          </div>

          {/* Density View Switcher */}
          <div className="inline-flex items-center p-0.5 bg-neutral-900 border border-neutral-800 rounded-lg">
            <button
              type="button"
              onClick={() => onDensityChange('compact-table')}
              title="Modo Tabela Ultra-Compacta (ideal para 100+ PWAs)"
              aria-label="Tabela compacta"
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                density === 'compact-table'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDensityChange('dense-grid')}
              title="Modo Grade Compacta (estilo launcher do Chrome)"
              aria-label="Grade compacta"
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                density === 'dense-grid'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDensityChange('cards')}
              title="Modo Cards Compactos"
              aria-label="Cards compactos"
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                density === 'cards'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Category filter strip: Horizontal scrolling clean buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <div className="flex items-center gap-1 text-neutral-400 shrink-0 mr-1">
          <Filter className="w-3 h-3" />
          <span className="text-[11px]">Categorias:</span>
        </div>

        <button
          type="button"
          onClick={() => onCategoryChange('all')}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-neutral-200 text-neutral-950 font-semibold'
              : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800/80'
          }`}
        >
          Todas
        </button>

        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryChange(cat)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === cat
                ? 'bg-neutral-200 text-neutral-950 font-semibold'
                : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};
