/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PWAItem, ViewDensity, StatusFilter, SortOption } from './types/pwa';
import { INITIAL_PWAS, getExpanded100PWAs } from './data/defaultPWAs';
import {
  getTodayString,
  isAccessedToday,
  markAsAccessed,
  toggleAccessedToday,
  calculateStats,
  filterAndSortPWAs,
  resolveFaviconAtInsertion,
} from './utils/pwaLogic';
import { parseDesktopFile, ParsedDesktopApp } from './utils/desktopParser';
import { TopBar } from './components/TopBar';
import { ControlToolbar } from './components/ControlToolbar';
import { CompactTableView } from './components/CompactTableView';
import { DenseGridView } from './components/DenseGridView';
import { CardsView } from './components/CardsView';
import { AddEditPWAModal } from './components/AddEditPWAModal';
import { BackupModal } from './components/BackupModal';
import { DesktopImportModal } from './components/DesktopImportModal';
import { GitHubUpdateModal } from './components/GitHubUpdateModal';
import { FolderUp, FolderOpen, Plus } from 'lucide-react';

const STORAGE_KEY = 'chrome_pwa_hub_items_empty_v1';
const DENSITY_STORAGE_KEY = 'chrome_pwa_hub_density';

export default function App() {
  // Empty by default: User adds their own PWAs (via Ubuntu .desktop file selection or manual entry)
  const [items, setItems] = useState<PWAItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return []; // Empty by default!
  });

  const [density, setDensity] = useState<ViewDensity>(() => {
    try {
      const saved = localStorage.getItem(DENSITY_STORAGE_KEY) as ViewDensity;
      if (saved === 'compact-table' || saved === 'dense-grid' || saved === 'cards') {
        return saved;
      }
    } catch {
      // Fallback
    }
    return 'compact-table';
  });

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('pinned');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PWAItem | null>(null);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Ubuntu desktop file import state
  const [parsedDesktopApps, setParsedDesktopApps] = useState<ParsedDesktopApp[]>([]);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Current day string (YYYY-MM-DD)
  const [todayStr, setTodayStr] = useState(() => getTodayString());

  // Periodically keep todayStr in sync (in case the tab is open past midnight)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getTodayString();
      if (current !== todayStr) {
        setTodayStr(current);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [todayStr]);

  // Persist items to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  // Persist density setting
  const handleDensityChange = (newDensity: ViewDensity) => {
    setDensity(newDensity);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, newDensity);
    } catch {
      // ignore
    }
  };

  // Process Ubuntu .desktop files selected via native file dialog or drag & drop
  const processDesktopFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const parsedList: ParsedDesktopApp[] = [];

    for (const file of fileArray) {
      try {
        const text = await file.text();
        const parsed = parseDesktopFile(text, file.name);
        if (parsed) {
          parsedList.push(parsed);
        }
      } catch (err) {
        console.error(`Erro ao ler arquivo ${file.name}:`, err);
      }
    }

    if (parsedList.length > 0) {
      setParsedDesktopApps(parsedList);
      setIsDesktopModalOpen(true);
    } else {
      window.alert('Nenhum atalho de PWA (.desktop) válido foi encontrado nos arquivos selecionados.');
    }
  }, []);

  // Global Drag & Drop handler for Ubuntu .desktop files
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDraggingOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        processDesktopFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [processDesktopFiles]);

  // Confirm import of parsed Ubuntu desktop PWAs
  const handleConfirmDesktopImport = useCallback((newItems: PWAItem[]) => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const withResolvedIcons = newItems.map((item) => ({
        ...item,
        icon: item.icon || resolveFaviconAtInsertion(item.url),
      }));
      const filtered = withResolvedIcons.filter((i) => !existingIds.has(i.id));
      return [...filtered, ...prev];
    });
  }, []);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [items]);

  // Compute daily stats
  const stats = useMemo(() => {
    return calculateStats(items, todayStr);
  }, [items, todayStr]);

  // Filtered and sorted items
  const displayedItems = useMemo(() => {
    return filterAndSortPWAs(items, {
      search,
      category: selectedCategory,
      statusFilter,
      sortBy,
      todayStr,
    });
  }, [items, search, selectedCategory, statusFilter, sortBy, todayStr]);

  // Today display string
  const todayDisplay = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(new Date());
    } catch {
      return todayStr;
    }
  }, [todayStr]);

  // Launch PWA: opens link and automatically marks accessed today (GREEN indicator)
  const handleLaunch = useCallback((item: PWAItem) => {
    // Open in separate app window / tab
    window.open(item.url, '_blank', 'noopener,noreferrer');

    // Automatically mark as accessed today
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? markAsAccessed(it) : it))
    );
  }, []);

  // Toggle status (green <-> red)
  const handleToggleStatus = useCallback((item: PWAItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? toggleAccessedToday(it, todayStr) : it))
    );
  }, [todayStr]);

  // Update inline note
  const handleUpdateNote = useCallback((item: PWAItem, newNote: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, notes: newNote } : it))
    );
  }, []);

  // Toggle pin
  const handleTogglePin = useCallback((item: PWAItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, pinned: !it.pinned } : it))
    );
  }, []);

  // Delete item
  const handleDelete = useCallback((id: string) => {
    const target = items.find((it) => it.id === id);
    const confirmMessage = target ? `Excluir a PWA "${target.name}"?` : 'Excluir esta PWA?';
    if (window.confirm(confirmMessage)) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  }, [items]);

  // Save new or edited PWA
  const handleSavePWA = useCallback((data: Partial<PWAItem> & { name: string; url: string; category: string; notes: string }) => {
    const finalIcon = data.icon || resolveFaviconAtInsertion(data.url);
    if (data.id) {
      // Edit
      setItems((prev) =>
        prev.map((it) => (it.id === data.id ? { ...it, ...data, icon: finalIcon } : it))
      );
    } else {
      // Add
      const newItem: PWAItem = {
        id: `pwa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: data.name,
        url: data.url,
        category: data.category,
        notes: data.notes,
        icon: finalIcon,
        pinned: Boolean(data.pinned),
        lastAccessedDate: null,
        accessCount: 0,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [newItem, ...prev]);
    }
  }, []);

  // Batch refresh icons for all PWAs based on their URLs
  const handleRefreshAllIcons = useCallback(() => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        icon: resolveFaviconAtInsertion(it.url),
      }))
    );
  }, []);

  // Batch mark all today as accessed
  const handleMarkAllToday = useCallback(() => {
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        lastAccessedDate: nowIso,
        accessCount: (it.accessCount || 0) + (isAccessedToday(it.lastAccessedDate, todayStr) ? 0 : 1),
      }))
    );
  }, [todayStr]);

  // Batch reset today's status
  const handleResetToday = useCallback(() => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        lastAccessedDate: null,
      }))
    );
  }, []);

  // Load sample of 104 PWAs
  const handleLoad100Sample = useCallback(() => {
    setItems(getExpanded100PWAs());
  }, []);

  // Restore default set (42 PWAs)
  const handleResetDefault = useCallback(() => {
    setItems(INITIAL_PWAS);
  }, []);

  // Import JSON items
  const handleImport = useCallback((newItems: PWAItem[], mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      setItems(newItems);
    } else {
      setItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const nonDuplicate = newItems.filter((i) => !existingIds.has(i.id));
        return [...prev, ...nonDuplicate];
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300 relative">
      {/* Drag & Drop Visual Overlay for Ubuntu .desktop files */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-emerald-950/80 backdrop-blur-xs border-4 border-dashed border-emerald-400 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
          <FolderUp className="w-16 h-16 text-emerald-400 mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-white mb-2">
            Solte seus atalhos .desktop do Ubuntu aqui
          </h2>
          <p className="text-sm text-emerald-200 max-w-md">
            O Chrome PWA Hub irá ler os arquivos .desktop e extrair automaticamente o nome, ícone, URL e anotações.
          </p>
        </div>
      )}

      {/* Top Header */}
      <TopBar
        stats={stats}
        todayDisplay={todayDisplay}
        onSelectDesktopFiles={processDesktopFiles}
        onOpenManualAddModal={() => {
          setEditingItem(null);
          setIsAddEditOpen(true);
        }}
        onOpenBackupModal={() => setIsBackupOpen(true)}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onMarkAllToday={handleMarkAllToday}
        onResetToday={handleResetToday}
        onLoad100Sample={handleLoad100Sample}
        onRefreshAllIcons={handleRefreshAllIcons}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-3 flex flex-col">
        {items.length === 0 ? (
          /* Empty state by default as requested: 0 PWAs initially */
          <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400 mb-4 shadow-inner">
              <FolderOpen className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-white mb-1.5">
              Nenhuma PWA adicionada ainda
            </h2>
            <p className="text-xs text-neutral-400 max-w-md mb-6 leading-relaxed">
              O seu Hub está pronto e limpo. Adicione as PWAs que você já tem instaladas no seu Ubuntu selecionando os arquivos <code className="text-neutral-300 font-mono">.desktop</code> ou cadastre manualmente por URL.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>(
                    'input[data-testid="ubuntu-desktop-file-input"]'
                  );
                  input?.click();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-xs cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Selecionar arquivos .desktop (Ubuntu)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsAddEditOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar PWA manualmente</span>
              </button>
            </div>
            <div className="mt-8 p-3.5 rounded-lg bg-neutral-900/40 border border-neutral-800/80 max-w-lg text-left text-xs text-neutral-400 space-y-1">
              <span className="font-semibold text-neutral-300 block">Dica para Ubuntu:</span>
              <p className="text-[11px] leading-relaxed">
                As PWAs instaladas pelo Chrome no Ubuntu ficam localizadas na pasta oculta <code className="text-emerald-400 font-mono">~/.local/share/applications/</code>. No seletor de arquivos, pressione <kbd className="px-1 py-0.5 bg-neutral-800 text-neutral-200 rounded text-[10px]">Ctrl+H</kbd> para vê-la. Você também pode arrastar arquivos <code className="text-neutral-300 font-mono">.desktop</code> direto para a tela.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Compact Daily Status Banner & Progress Bar */}
            <div className="mb-3 px-3.5 py-2 rounded-lg bg-neutral-900/50 border border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {/* Indicator explanation */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/50">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Verde: Acessado hoje ({stats.accessedTodayCount})</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-700/50">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Vermelho: Pendente hoje ({stats.pendingTodayCount})</span>
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2.5 sm:w-64">
                <div className="flex-1 bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${stats.completionPercentage}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-neutral-400 whitespace-nowrap">
                  {stats.completionPercentage}% do dia
                </span>
              </div>
            </div>

            {/* Search, Filter, Density & Sort Controls */}
            <ControlToolbar
              search={search}
              onSearchChange={setSearch}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              categories={categories}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              density={density}
              onDensityChange={handleDensityChange}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              totalCount={items.length}
              pendingCount={stats.pendingTodayCount}
              accessedCount={stats.accessedTodayCount}
            />

            {/* View Render */}
            <div className="flex-1">
              {density === 'compact-table' && (
                <CompactTableView
                  items={displayedItems}
                  todayStr={todayStr}
                  onLaunch={handleLaunch}
                  onToggleStatus={handleToggleStatus}
                  onUpdateNote={handleUpdateNote}
                  onTogglePin={handleTogglePin}
                  onEdit={(item) => {
                    setEditingItem(item);
                    setIsAddEditOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              )}

              {density === 'dense-grid' && (
                <DenseGridView
                  items={displayedItems}
                  todayStr={todayStr}
                  onLaunch={handleLaunch}
                  onToggleStatus={handleToggleStatus}
                  onUpdateNote={handleUpdateNote}
                  onTogglePin={handleTogglePin}
                  onEdit={(item) => {
                    setEditingItem(item);
                    setIsAddEditOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              )}

              {density === 'cards' && (
                <CardsView
                  items={displayedItems}
                  todayStr={todayStr}
                  onLaunch={handleLaunch}
                  onToggleStatus={handleToggleStatus}
                  onUpdateNote={handleUpdateNote}
                  onTogglePin={handleTogglePin}
                  onEdit={(item) => {
                    setEditingItem(item);
                    setIsAddEditOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              )}
            </div>

            {/* Compact Footer Status */}
            <footer className="mt-6 pt-3 border-t border-neutral-900 flex flex-wrap items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span>
                Exibindo {displayedItems.length} de {items.length} PWAs cadastradas
              </span>
              <span className="text-neutral-400">
                Dica Ubuntu: Você pode selecionar ou arrastar arquivos <code className="text-neutral-300 font-mono">.desktop</code> de <code className="text-neutral-300 font-mono">~/.local/share/applications</code> direto para o Hub.
              </span>
            </footer>
          </>
        )}
      </main>

      {/* Add / Edit Modal (Manual Entry) */}
      <AddEditPWAModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSavePWA}
        editingItem={editingItem}
        existingCategories={categories}
      />

      {/* Ubuntu .desktop Import Review Modal */}
      <DesktopImportModal
        isOpen={isDesktopModalOpen}
        onClose={() => {
          setIsDesktopModalOpen(false);
          setParsedDesktopApps([]);
        }}
        parsedApps={parsedDesktopApps}
        onConfirmImport={handleConfirmDesktopImport}
        existingCategories={categories}
      />

      {/* Backup & Import Modal */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        items={items}
        onImport={handleImport}
        onResetDefault={handleResetDefault}
        onLoad100Sample={handleLoad100Sample}
      />

      {/* GitHub Update Modal */}
      <GitHubUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
      />
    </div>
  );
}
