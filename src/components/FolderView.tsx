import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  Home,
  ListChecks,
  Settings,
  MoreVertical,
  Trash2,
  FolderInput,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { PWAFolder, PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { CardsView } from './CardsView';
import { GROUP_COLOR_THEMES } from '../utils/groupLogic';
import { getFolderPath, getFolderStats } from '../utils/folderLogic';

interface FolderViewProps {
  allItems: PWAItem[];
  filteredItems: PWAItem[];
  folders: PWAFolder[];
  currentFolderId: string | null;
  onNavigateFolder: (folderId: string | null) => void;
  todayStr: string;
  groupConfigs?: Record<string, string>;
  groupColors?: Record<string, string>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onLaunch: (item: PWAItem) => void;
  onToggleStatus: (item: PWAItem) => void;
  onUpdateNote: (item: PWAItem, newNote: string) => void;
  onTogglePin?: (item: PWAItem) => void;
  onSetRating?: (item: PWAItem, rating: number) => void;
  onEdit: (item: PWAItem) => void;
  onDelete: (id: string) => void;
  onRefreshIcon?: (item: PWAItem) => void;
  onSaveCustomIcon?: (item: PWAItem, iconDataUrl: string) => void;
  onMoveToFolder: (pwaIds: string[], targetFolderId: string | null) => void;
  onCreateFolder: (name: string, color: string, parentId: string | null) => void;
  onDeleteFolder: (folderId: string) => void;
  onOpenFolderManager: (parentId?: string | null) => void;
  onOpenQuickAssign: (folderId: string) => void;
}

export const FolderView: React.FC<FolderViewProps> = ({
  allItems,
  filteredItems,
  folders,
  currentFolderId,
  onNavigateFolder,
  todayStr,
  groupConfigs = {},
  groupColors = {},
  selectedIds = new Set<string>(),
  onToggleSelect,
  onLaunch,
  onToggleStatus,
  onUpdateNote,
  onTogglePin,
  onSetRating,
  onEdit,
  onDelete,
  onRefreshIcon,
  onSaveCustomIcon,
  onMoveToFolder,
  onCreateFolder,
  onDeleteFolder,
  onOpenFolderManager,
  onOpenQuickAssign,
}) => {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [activeFolderMenuId, setActiveFolderMenuId] = useState<string | null>(null);
  const [inlineCreateOpen, setInlineCreateOpen] = useState(false);
  const [inlineFolderName, setInlineFolderName] = useState('');
  const [inlineFolderColor, setInlineFolderColor] = useState('emerald');

  const validFolderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);

  const breadcrumbPath = useMemo(
    () => getFolderPath(folders, currentFolderId),
    [folders, currentFolderId]
  );

  const currentFolder = useMemo(
    () => (currentFolderId ? folders.find((f) => f.id === currentFolderId) || null : null),
    [folders, currentFolderId]
  );

  // Folders visible at the current directory level
  const visibleFolders = useMemo(() => {
    return folders
      .filter((f) => {
        const parent = f.parentId && validFolderIds.has(f.parentId) ? f.parentId : null;
        return parent === (currentFolder ? currentFolder.id : null);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [folders, validFolderIds, currentFolder]);

  // PWAs sitting directly at the current folder level (or unfiled if at root)
  const levelItems = useMemo(() => {
    if (!currentFolder) {
      return filteredItems.filter((it) => !it.folderId || !validFolderIds.has(it.folderId));
    }
    return filteredItems.filter((it) => it.folderId === currentFolder.id);
  }, [filteredItems, currentFolder, validFolderIds]);

  const handleDropOnFolder = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const draggedPwaId = e.dataTransfer.getData('text/pwa-id');
    if (draggedPwaId) {
      onMoveToFolder([draggedPwaId], targetFolderId);
    }
  };

  const handleInlineCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inlineFolderName.trim();
    if (!trimmed) return;
    onCreateFolder(trimmed, inlineFolderColor, currentFolder ? currentFolder.id : null);
    setInlineFolderName('');
    setInlineCreateOpen(false);
  };

  const colorKeys = Object.keys(GROUP_COLOR_THEMES);

  return (
    <div className="space-y-4">
      {/* Breadcrumb & Folder Action Header */}
      <div className="p-3 rounded-xl bg-[#14151a] border border-[#242633] flex flex-wrap items-center justify-between gap-3">
        {/* Breadcrumb Navigation (Also acts as drop targets to move PWAs up!) */}
        <nav aria-label="Navegação de pastas" className="flex items-center flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => onNavigateFolder(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverFolderId('__root__');
            }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => handleDropOnFolder(e, null)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border ${
              !currentFolder
                ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300 font-semibold'
                : dragOverFolderId === '__root__'
                ? 'bg-emerald-900/60 border-emerald-400 text-white'
                : 'bg-[#1a1c24] border-[#262835] text-neutral-300 hover:text-white'
            }`}
          >
            <Home className="w-3.5 h-3.5 text-emerald-400" />
            <span>Todas as Pastas</span>
          </button>

          {breadcrumbPath.map((folder, index) => {
            const isLast = index === breadcrumbPath.length - 1;
            const theme = GROUP_COLOR_THEMES[folder.color || 'emerald'] || GROUP_COLOR_THEMES.emerald;
            return (
              <React.Fragment key={folder.id}>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <button
                  type="button"
                  onClick={() => onNavigateFolder(folder.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => handleDropOnFolder(e, folder.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border ${
                    isLast
                      ? 'bg-[#20232e] border-emerald-500/60 text-white font-semibold'
                      : dragOverFolderId === folder.id
                      ? 'bg-emerald-900/60 border-emerald-400 text-white'
                      : 'bg-[#1a1c24] border-[#262835] text-neutral-300 hover:text-white'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${theme.dotColor}`} />
                  <span>{folder.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentFolder && (
            <button
              type="button"
              onClick={() => onOpenQuickAssign(currentFolder.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 transition-colors cursor-pointer"
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Adicionar PWAs aqui</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setInlineCreateOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-800/70 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>{currentFolder ? 'Nova Subpasta' : 'Nova Pasta'}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenFolderManager(currentFolder?.id || null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-[#1a1c24] hover:bg-[#232632] border border-[#262835] transition-colors cursor-pointer"
            title="Abrir gerenciador completo de pastas"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Gerenciar</span>
          </button>
        </div>
      </div>

      {/* Inline New Folder Creator */}
      {inlineCreateOpen && (
        <form
          onSubmit={handleInlineCreateSubmit}
          className="p-3.5 rounded-xl bg-[#14151a] border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
            <FolderPlus className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={inlineFolderName}
              onChange={(e) => setInlineFolderName(e.target.value)}
              placeholder={
                currentFolder
                  ? `Nome da subpasta dentro de "${currentFolder.name}"...`
                  : 'Nome da nova pasta (ex: Jogos, Bancos, Trabalho)...'
              }
              aria-label="Nome da nova pasta"
              autoFocus
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-950 border border-neutral-700 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {colorKeys.slice(0, 7).map((k) => {
              const t = GROUP_COLOR_THEMES[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setInlineFolderColor(k)}
                  aria-label={`Cor ${t.label.split(' ')[0]}`}
                  title={t.label.split(' ')[0]}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer transition-transform ${
                    t.dotColor
                  } ${inlineFolderColor === k ? 'scale-110 ring-2 ring-white border-white' : 'border-white/20 opacity-75 hover:opacity-100'}`}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInlineCreateOpen(false)}
              className="px-2.5 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!inlineFolderName.trim()}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 cursor-pointer"
            >
              Criar
            </button>
          </div>
        </form>
      )}

      {/* Subfolders / Folders Grid */}
      {visibleFolders.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-emerald-400" />
              <span>
                {currentFolder ? `Subpastas em "${currentFolder.name}"` : 'Pastas'} ({visibleFolders.length})
              </span>
            </h2>
            <span className="text-[11px] text-neutral-500 hidden sm:inline">
              Dica: arraste qualquer cartão de PWA para dentro de uma pasta
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleFolders.map((folder) => {
              const stats = getFolderStats(folders, allItems, folder.id, todayStr);
              const theme = GROUP_COLOR_THEMES[folder.color || 'emerald'] || GROUP_COLOR_THEMES.emerald;
              const isDragTarget = dragOverFolderId === folder.id;
              const isMenuOpen = activeFolderMenuId === folder.id;

              return (
                <div
                  key={folder.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => handleDropOnFolder(e, folder.id)}
                  className={`group relative rounded-xl border bg-[#14151a] hover:bg-[#191b23] transition-all shadow-sm ${
                    isMenuOpen ? 'z-30' : ''
                  } ${
                    isDragTarget
                      ? 'border-emerald-400 ring-2 ring-emerald-400/60 scale-[1.01]'
                      : 'border-[#242633] hover:border-neutral-600'
                  }`}
                >
                  {/* Top Accent Bar & Ambient Glow clipped to card corners */}
                  <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                    <div className={`h-1 w-full ${theme.accentBar} opacity-85`} />
                    <div
                      className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity ${theme.glow}`}
                    />
                  </div>

                  <div className="relative z-10 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      {/* Clickable Folder Main Trigger */}
                      <button
                        type="button"
                        onClick={() => onNavigateFolder(folder.id)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        {/* 2x2 Mini Preview Mosaic OR Folder Icon */}
                        <div className="w-12 h-12 rounded-xl bg-neutral-950/90 border border-neutral-800 p-1 shrink-0 grid grid-cols-2 grid-rows-2 gap-0.5 place-items-center">
                          {stats.previewItems.length > 0 ? (
                            stats.previewItems.map((preview) => (
                              <PWAIcon
                                key={preview.id}
                                icon={preview.icon}
                                name={preview.name}
                                url={preview.url}
                                size="xs"
                                className="w-4 h-4 rounded-sm"
                              />
                            ))
                          ) : (
                            <div className="col-span-2 row-span-2 flex items-center justify-center">
                              <Folder className={`w-6 h-6 ${theme.textAccent}`} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-white group-hover:text-emerald-300 truncate transition-colors">
                            {folder.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 font-mono">
                            <span className="text-neutral-200 font-semibold">
                              {stats.totalCount} PWA{stats.totalCount !== 1 ? 's' : ''}
                            </span>
                            {stats.subfolderCount > 0 && (
                              <span className="text-neutral-500">
                                · {stats.subfolderCount} sub
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Folder Menu */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFolderMenuId(isMenuOpen ? null : folder.id);
                          }}
                          aria-label={`Opções da pasta ${folder.name}`}
                          className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl py-1 text-xs text-neutral-200">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                onNavigateFolder(folder.id);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer text-emerald-400"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              <span>Abrir Pasta</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                onOpenQuickAssign(folder.id);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
                            >
                              <FolderInput className="w-3.5 h-3.5 text-sky-400" />
                              <span>Adicionar PWAs</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                onOpenFolderManager(folder.id);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Settings className="w-3.5 h-3.5 text-neutral-400" />
                              <span>Editar / Subpasta</span>
                            </button>
                            <div className="my-1 border-t border-neutral-800" />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFolderMenuId(null);
                                onDeleteFolder(folder.id);
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-rose-950/60 text-rose-300 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>Excluir Pasta</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Daily Progress Footer inside Folder Card */}
                    <div className="mt-3 pt-2 border-t border-neutral-800/70 flex items-center justify-between text-[10px] font-mono">
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{stats.accessedTodayCount} hoje</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-rose-400">
                        <Clock className="w-3 h-3" />
                        <span>
                          {stats.pendingTodayCount} pendente{stats.pendingTodayCount !== 1 ? 's' : ''}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* PWAs at Current Folder Level */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
            {currentFolder
              ? `PWAs em "${currentFolder.name}" (${levelItems.length})`
              : `PWAs sem pasta (${levelItems.length})`}
          </h2>
        </div>

        {levelItems.length === 0 ? (
          <div className="py-12 px-4 rounded-xl border border-dashed border-[#242633] bg-[#14151a]/40 text-center space-y-3">
            <p className="text-xs text-neutral-400">
              {currentFolder
                ? `Nenhuma PWA diretamente dentro da pasta "${currentFolder.name}" ainda.`
                : folders.length > 0
                ? 'Todas as PWAs filtradas já estão organizadas em pastas!'
                : 'Crie sua primeira pasta acima e mova suas PWAs para organizar seu hub.'}
            </p>
            {currentFolder && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenQuickAssign(currentFolder.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 cursor-pointer"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>Selecionar PWAs para esta pasta</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <CardsView
            items={levelItems}
            todayStr={todayStr}
            folders={folders}
            groupConfigs={groupConfigs}
            groupColors={groupColors}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onLaunch={onLaunch}
            onToggleStatus={onToggleStatus}
            onUpdateNote={onUpdateNote}
            onTogglePin={onTogglePin}
            onSetRating={onSetRating}
            onEdit={onEdit}
            onDelete={onDelete}
            onRefreshIcon={onRefreshIcon}
            onSaveCustomIcon={onSaveCustomIcon}
            onMoveToFolder={onMoveToFolder}
          />
        )}
      </section>
    </div>
  );
};
