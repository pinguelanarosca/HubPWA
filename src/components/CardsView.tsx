import React, { useState, useRef, useEffect } from 'react';
import { DailyFlagKey, DailyFlagState, PWAFolder, PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { InlineNoteInput } from './InlineNoteInput';
import { StarRating } from './StarRating';
import { PWAFlagsControl } from './PWAFlagsControl';
import { isAccessedToday, formatAccessLogDash, formatChromeProfileDisplay } from '../utils/pwaLogic';
import { getGroupTheme } from '../utils/groupLogic';
import { flattenFoldersHierarchy } from '../utils/folderLogic';
import { Check, CheckCircle2, Clock, MoreVertical, Edit2, Trash2, Folder, ExternalLink, RotateCw, Upload, FolderInput, ChevronRight, User, Copy, History } from 'lucide-react';

interface CardsViewProps {
  items: PWAItem[];
  todayStr: string;
  folders?: PWAFolder[];
  groupConfigs?: Record<string, string>;
  groupColors?: Record<string, string>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectCard?: (
    id: string,
    modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; fromCheckbox?: boolean }
  ) => void;
  onLaunch: (item: PWAItem) => void;
  onToggleStatus: (item: PWAItem) => void;
  onUpdateNote: (item: PWAItem, newNote: string) => void;
  onToggleFlag?: (item: PWAItem, flag: DailyFlagKey, state?: DailyFlagState | null) => void;
  onUpdateMoneyDate?: (item: PWAItem, moneyDate: string) => void;
  onTogglePin?: (item: PWAItem) => void;
  onSetRating?: (item: PWAItem, rating: number) => void;
  onEdit: (item: PWAItem) => void;
  onClone?: (item: PWAItem) => void;
  onDelete: (id: string) => void;
  onRefreshIcon?: (item: PWAItem) => void;
  onSaveCustomIcon?: (item: PWAItem, iconDataUrl: string) => void;
  onMoveToFolder?: (pwaIds: string[], targetFolderId: string | null) => void;
  onViewHistory?: (item: PWAItem) => void;
  groupByGroup?: boolean;
}

export const CardsView: React.FC<CardsViewProps> = React.memo(({
  items,
  todayStr,
  folders = [],
  groupConfigs = {},
  groupColors = {},
  selectedIds = new Set<string>(),
  onToggleSelect,
  onSelectCard,
  onLaunch,
  onToggleStatus,
  onUpdateNote,
  onToggleFlag,
  onUpdateMoneyDate,
  onSetRating,
  onEdit,
  onClone,
  onDelete,
  onRefreshIcon,
  onSaveCustomIcon,
  onMoveToFolder,
  onViewHistory,
  groupByGroup = false,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [moveSubmenuOpen, setMoveSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const flatFolders = React.useMemo(() => flattenFoldersHierarchy(folders), [folders]);
  const folderMap = React.useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  // Close card menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId]);

  if (items.length === 0) {
    return (
      <div key="cards-empty" data-testid="cards-empty-state" className="py-20 text-center text-neutral-400">
        <p className="text-sm font-medium text-neutral-300">Nenhuma PWA encontrada com os filtros atuais.</p>
        <p className="text-xs text-neutral-500 mt-1">Tente ajustar a busca, alterar a categoria ou cadastrar novas PWAs.</p>
      </div>
    );
  }

  // Render an individual card with translucent background elements color-coding its group
  const renderCard = (item: PWAItem, renderKey: string) => {
    const isAccessed = isAccessedToday(item.lastAccessedDate, todayStr);
    const accessLogStr = formatAccessLogDash(item.lastAccessedDate);
    const isSelected = selectedIds.has(item.id);
    const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
    const grpName = item.group || item.category || 'Geral';
    const groupTheme = getGroupTheme(grpName, groupColors);
    const assignedFolder = item.folderId ? folderMap.get(item.folderId) : null;
    const chromeProfile = formatChromeProfileDisplay(item);

    return (
      <div
        key={renderKey}
        data-testid={`pwa-card-${item.id}`}
        draggable={Boolean(onMoveToFolder)}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/pwa-id', item.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onMouseDown={(e) => {
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.preventDefault();
          }
        }}
        onClick={(e) => {
          if (onSelectCard) {
            onSelectCard(item.id, {
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
            });
          } else if (onToggleSelect) {
            onToggleSelect(item.id);
          }
        }}
        className={`group relative p-3.5 rounded-xl bg-[#14151a] hover:bg-[#181920] transition-all flex flex-col justify-between cursor-pointer select-none ${
          activeMenuId === item.id ? 'z-20' : ''
        } ${
          isAccessed
            ? 'border-[3px] border-emerald-400/90 hover:border-emerald-300 shadow-[0_0_20px_-4px_rgba(16,185,129,0.5),inset_0_0_30px_4px_rgba(16,185,129,0.34)]'
            : 'border-[3px] border-rose-500/90 hover:border-rose-400 shadow-[0_0_20px_-4px_rgba(244,63,94,0.48),inset_0_0_30px_4px_rgba(244,63,94,0.32)]'
        } ${isSelected ? 'outline-2 outline-offset-2 outline-sky-400 bg-[#1a2030]' : ''}`}
      >
        {/* Inner Clipped Wrapper for Ambient Background Glows & Inward Border Smoke */}
        <div className="absolute inset-0 overflow-hidden rounded-[9px] pointer-events-none">
          {/* Translucent Top Edge Accent Bar for Group Identification */}
          <div
            className={`absolute top-0 left-0 right-0 h-0.5 ${groupTheme.accentBar} opacity-80 group-hover:opacity-100 transition-opacity`}
          />

          {/* Translucent Background Element 1: Vibrant Top-Right Ambient Radial Glow Orb */}
          <div
            className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-2xl transition-all duration-300 opacity-75 group-hover:opacity-95 ${groupTheme.glow}`}
          />

          {/* Translucent Background Element 2: High-Contrast Corner Accent Gradient Overlay */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${groupTheme.gradient} opacity-55 group-hover:opacity-85 transition-opacity`}
          />

          {/* Translucent Background Element 3: Bottom-Left Ambient Glow Orb */}
          <div
            className={`absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-xl opacity-35 group-hover:opacity-65 transition-opacity ${groupTheme.secondaryGlow}`}
          />

          {/* Status Border Inward Smoke/Fade Gradient */}
          <div
            className={`absolute inset-0 rounded-[9px] transition-opacity ${
              isAccessed
                ? 'shadow-[inset_0_0_26px_4px_rgba(16,185,129,0.32)] bg-[radial-gradient(ellipse_at_center,transparent_48%,rgba(16,185,129,0.22)_100%)]'
                : 'shadow-[inset_0_0_26px_4px_rgba(244,63,94,0.3)] bg-[radial-gradient(ellipse_at_center,transparent_48%,rgba(244,63,94,0.22)_100%)]'
            }`}
          />
        </div>

        {/* Card Interactive Content */}
        <div className="relative z-10">
          {/* Card Top Row: 5 Stars + Profile on Left | Today Badge + 3-Dots Menu on Right */}
          <div className="flex items-center justify-between gap-1.5 mb-3">
            {/* Left: Interactive 5 Stars Rating + Chrome Profile Badge */}
            <div className="flex items-center gap-1 min-w-0">
              {(onSelectCard || onToggleSelect) && (
                <button
                  type="button"
                  draggable={false}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectCard) {
                      onSelectCard(item.id, {
                        shiftKey: e.shiftKey,
                        ctrlKey: e.ctrlKey,
                        metaKey: e.metaKey,
                        fromCheckbox: true,
                      });
                    } else if (onToggleSelect) {
                      onToggleSelect(item.id);
                    }
                  }}
                  data-testid={`select-pwa-${item.id}`}
                  aria-label={`Selecionar ${item.name}`}
                  aria-pressed={isSelected}
                  className={`mr-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 border-emerald-400 text-neutral-950'
                      : 'border-neutral-600 bg-neutral-950/80 hover:border-neutral-400 text-transparent'
                  }`}
                  title={isSelected ? 'Desmarcar PWA' : 'Selecionar PWA'}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </button>
              )}

              <StarRating
                rating={currentRating}
                onChange={(newRating) => onSetRating && onSetRating(item, newRating)}
                size="sm"
                compact={true}
                className="shrink-0"
              />

              {chromeProfile && (
                <span
                  title={chromeProfile.tooltip}
                  aria-label={chromeProfile.tooltip}
                  data-testid={`chrome-profile-badge-${item.id}`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/90 border border-sky-700/70 text-sky-300 text-[10px] font-sans font-semibold min-w-0 max-w-[84px] leading-none whitespace-nowrap"
                >
                  <User className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                  <span className="truncate">{chromeProfile.badgeText}</span>
                </span>
              )}
            </div>

            {/* Right: Status Badge & 3-Dots Menu */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Today Status Badge (Clickable to Toggle Status) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStatus(item);
                }}
                title={
                  isAccessed
                    ? 'Acessado hoje (Clique para marcar como pendente)'
                    : 'Pendente hoje (Clique para marcar como acessado)'
                }
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-transform active:scale-95 cursor-pointer border whitespace-nowrap ${
                  isAccessed
                    ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/90'
                    : 'bg-rose-950/80 border-rose-800/80 text-rose-300 hover:bg-rose-900/90'
                }`}
              >
                {isAccessed ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    <span>Hoje</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                    <span>Pendente</span>
                  </>
                )}
              </button>

              {/* 3-Dots Menu Button */}
              <div className="relative">
                <button
                  type="button"
                  data-testid={`card-menu-btn-${item.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMoveSubmenuOpen(false);
                    setActiveMenuId(activeMenuId === item.id ? null : item.id);
                  }}
                  className="p-0.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Opções da PWA"
                  aria-label={`Opções de ${item.name}`}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown Menu */}
                {activeMenuId === item.id && (
                  <div
                    ref={menuRef}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 z-30 w-52 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl py-1 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuId(null);
                        onLaunch(item);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer text-emerald-400 font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir PWA</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuId(null);
                        onEdit(item);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Editar PWA</span>
                    </button>
                    {onClone && (
                      <button
                        type="button"
                        data-testid={`clone-pwa-menu-btn-${item.id}`}
                        onClick={() => {
                          setActiveMenuId(null);
                          onClone(item);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer text-sky-300 font-medium"
                      >
                        <Copy className="w-3.5 h-3.5 text-sky-400" />
                        <span>Clonar para outro Perfil</span>
                      </button>
                    )}
                    {onViewHistory && (
                      <button
                        type="button"
                        data-testid={`history-pwa-menu-btn-${item.id}`}
                        onClick={() => {
                          setActiveMenuId(null);
                          onViewHistory(item);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer text-emerald-300 font-medium"
                      >
                        <History className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Histórico (Dia e Hora)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenuId(null);
                        onToggleStatus(item);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Alternar Status</span>
                    </button>
                    {onMoveToFolder && (
                      <div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveSubmenuOpen((prev) => !prev);
                          }}
                          className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center justify-between gap-2 cursor-pointer text-emerald-300"
                        >
                          <span className="flex items-center gap-2">
                            <FolderInput className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Mover para Pasta</span>
                          </span>
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${moveSubmenuOpen ? 'rotate-90' : ''}`} />
                        </button>
                        {moveSubmenuOpen && (
                          <div className="mx-1.5 my-1 p-1 rounded-md bg-neutral-950 border border-neutral-800 max-h-40 overflow-y-auto space-y-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                onMoveToFolder([item.id], null);
                                setActiveMenuId(null);
                                setMoveSubmenuOpen(false);
                              }}
                              className={`w-full px-2 py-1 rounded text-left text-[11px] hover:bg-neutral-800 cursor-pointer flex items-center justify-between ${
                                !item.folderId ? 'text-emerald-400 font-semibold' : 'text-neutral-300'
                              }`}
                            >
                              <span>Sem Pasta (Raiz)</span>
                              {!item.folderId && <Check className="w-3 h-3" />}
                            </button>
                            {flatFolders.map(({ folder, label }) => (
                              <button
                                key={folder.id}
                                type="button"
                                onClick={() => {
                                  onMoveToFolder([item.id], folder.id);
                                  setActiveMenuId(null);
                                  setMoveSubmenuOpen(false);
                                }}
                                className={`w-full px-2 py-1 rounded text-left text-[11px] hover:bg-neutral-800 cursor-pointer flex items-center justify-between gap-1 ${
                                  item.folderId === folder.id ? 'text-emerald-400 font-semibold' : 'text-neutral-300'
                                }`}
                              >
                                <span className="truncate">{label}</span>
                                {item.folderId === folder.id && <Check className="w-3 h-3 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {onSaveCustomIcon && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          id={`card-icon-upload-${item.id}`}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                if (event.target?.result) {
                                  onSaveCustomIcon(item, String(event.target.result));
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                        />
                        <label
                          htmlFor={`card-icon-upload-${item.id}`}
                          onClick={() => setActiveMenuId(null)}
                          className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer text-amber-300 font-medium"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-400" />
                          <span>Upload Imagem do Ícone</span>
                        </label>
                      </>
                    )}
                    {onRefreshIcon && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onRefreshIcon(item);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-neutral-800 flex items-center gap-2 cursor-pointer text-sky-400 font-medium"
                      >
                        <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                        <span>Atualizar Ícone Web</span>
                      </button>
                    )}
                    <div className="my-1 border-t border-neutral-800" />
                    <button
                      type="button"
                      data-testid={`delete-pwa-menu-btn-${item.id}`}
                      onClick={() => {
                        setActiveMenuId(null);
                        onDelete(item.id);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-rose-950/60 text-rose-300 flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Excluir PWA</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card Middle Section: Large Icon on Left | Name, Access Log & Notes on Right */}
          <div className="flex items-start gap-3">
            {/* Prominent Large Icon - Somente o ícone abre a PWA */}
            <button
              type="button"
              draggable={false}
              data-testid={`launch-pwa-icon-${item.id}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onLaunch(item);
              }}
              className="shrink-0 rounded-2xl transition-transform hover:scale-105 active:scale-95 hover:ring-2 hover:ring-emerald-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
              title={`Clique no ícone para abrir ${item.name}`}
              aria-label={`Abrir ${item.name}`}
            >
              <PWAIcon
                icon={item.icon}
                name={item.name}
                url={item.url}
                size="xl"
                className="w-14 h-14 rounded-2xl shadow-md border border-neutral-800/80 bg-neutral-900 object-cover"
              />
            </button>

            {/* Right Information Column */}
            <div className="min-w-0 flex-1">
              {/* 1. PWA Name - Clicável para abrir a PWA */}
              <h3 className="leading-snug truncate">
                <button
                  type="button"
                  data-testid={`launch-pwa-name-${item.id}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunch(item);
                  }}
                  className="max-w-full font-bold text-sm text-white hover:text-emerald-400 cursor-pointer truncate transition-colors text-left align-top focus-visible:outline-none focus-visible:underline"
                  title={`Abrir ${item.name} (${grpName})`}
                >
                  {item.name}
                </button>
              </h3>

              {/* 2. Access Log: DD/MM - HH:MM (clickable to open Day/Time History) & Folder indicator */}
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-neutral-400 mt-0.5 notranslate" translate="no">
                {onViewHistory ? (
                  <button
                    type="button"
                    data-testid={`card-history-btn-${item.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewHistory(item);
                    }}
                    title="Ver histórico completo de acessos (dia e hora)"
                    className="inline-flex items-center gap-1 truncate hover:text-emerald-300 transition-colors cursor-pointer text-left"
                  >
                    <History className="w-3 h-3 text-neutral-500 shrink-0" />
                    <span className="truncate">{accessLogStr}</span>
                    {(item.accessHistory?.length || item.accessCount || 0) > 1 && (
                      <span className="px-1 py-0.2 rounded bg-neutral-800/90 text-[9px] text-neutral-300 shrink-0">
                        {item.accessHistory?.length || item.accessCount}x
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="truncate">{accessLogStr}</span>
                )}
                {assignedFolder && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-900/90 border border-neutral-700/80 text-[10px] font-sans text-neutral-300 truncate max-w-[110px] shrink-0"
                    title={`Pasta: ${assignedFolder.name}`}
                  >
                    <Folder className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{assignedFolder.name}</span>
                  </span>
                )}
              </div>

              {/* 3. Personal Notes */}
              <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                <InlineNoteInput
                  initialValue={item.notes}
                  onSave={(newNote) => onUpdateNote(item, newNote)}
                  placeholder="Anotações pessoais..."
                  className="text-xs text-neutral-300"
                  compact={false}
                />
              </div>
            </div>
          </div>

          {/* Card Bottom Bar (Below Icon & Notes): Vibrant Green $ + DD/MM Date on Left | COM, RD, IRB Daily Checkboxes */}
          {onToggleFlag && (
            <div className="mt-3 pt-2.5 border-t border-white/[0.08]">
              <PWAFlagsControl
                item={item}
                todayStr={todayStr}
                onToggleFlag={onToggleFlag}
                onUpdateMoneyDate={onUpdateMoneyDate}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const getRenderKey = (() => {
    const seen = new Map<string, number>();
    return (item: PWAItem, idx: number) => {
      const base = item.id || `idx_${idx}`;
      const count = seen.get(base) || 0;
      seen.set(base, count + 1);
      return count === 0 ? base : `${base}__rk_${count}`;
    };
  })();

  // Grouped layout if groupByGroup toggle is enabled
  if (groupByGroup) {
    const groupsMap = new Map<string, PWAItem[]>();
    items.forEach((item) => {
      const g = item.group || item.category || 'Geral';
      if (!groupsMap.has(g)) {
        groupsMap.set(g, []);
      }
      groupsMap.get(g)!.push(item);
    });

    const sortedGroupNames = Array.from(groupsMap.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return (
      <div key="cards-grouped" className="space-y-6">
        {sortedGroupNames.map((grpName) => {
          const groupItems = groupsMap.get(grpName) || [];
          return (
            <section key={grpName} className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-xs font-bold text-neutral-200 tracking-wider uppercase">
                    {grpName}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] font-mono text-neutral-400">
                    {groupItems.length}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {groupItems.map((it, idx) => renderCard(it, getRenderKey(it, idx)))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // Standard responsive cards grid (3-4 columns on desktop as requested)
  return (
    <div key="cards-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map((it, idx) => renderCard(it, getRenderKey(it, idx)))}
    </div>
  );
});
