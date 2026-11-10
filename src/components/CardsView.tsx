import React, { useState, useRef, useEffect } from 'react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { InlineNoteInput } from './InlineNoteInput';
import { StarRating } from './StarRating';
import { isAccessedToday, formatAccessLogDash } from '../utils/pwaLogic';
import { getGroupTheme } from '../utils/groupLogic';
import { Check, CheckCircle2, Clock, MoreVertical, Edit2, Trash2, Folder, ExternalLink, RotateCw, Upload } from 'lucide-react';

interface CardsViewProps {
  items: PWAItem[];
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
  groupByGroup?: boolean;
}

export const CardsView: React.FC<CardsViewProps> = ({
  items,
  todayStr,
  groupConfigs = {},
  groupColors = {},
  selectedIds = new Set<string>(),
  onToggleSelect,
  onLaunch,
  onToggleStatus,
  onUpdateNote,
  onSetRating,
  onEdit,
  onDelete,
  onRefreshIcon,
  onSaveCustomIcon,
  groupByGroup = false,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      <div className="py-20 text-center text-neutral-400">
        <p className="text-sm font-medium text-neutral-300">Nenhuma PWA encontrada com os filtros atuais.</p>
        <p className="text-xs text-neutral-500 mt-1">Tente ajustar a busca, alterar a categoria ou cadastrar novas PWAs.</p>
      </div>
    );
  }

  // Render an individual card with translucent background elements color-coding its group
  const renderCard = (item: PWAItem) => {
    const isAccessed = isAccessedToday(item.lastAccessedDate, todayStr);
    const accessLogStr = formatAccessLogDash(item.lastAccessedDate);
    const isSelected = selectedIds.has(item.id);
    const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
    const grpName = item.group || item.category || 'Geral';
    const groupTheme = getGroupTheme(grpName, groupColors);

    return (
      <div
        key={item.id}
        className={`group relative p-3.5 rounded-xl border bg-[#14151a] hover:bg-[#181920] transition-all flex flex-col justify-between shadow-sm hover:shadow-md overflow-hidden hover:border-t-neutral-600 hover:border-r-neutral-600 hover:border-b-neutral-600 ${
          isAccessed
            ? 'border-l-4 border-l-emerald-500 hover:border-l-emerald-500 border-t border-r border-b border-[#242633]'
            : 'border-l-4 border-l-rose-500 hover:border-l-rose-500 border-t border-r border-b border-[#242633]'
        } ${isSelected ? 'ring-2 ring-emerald-500/80 bg-[#1a1c24]' : ''}`}
      >
        {/* Translucent Top Edge Accent Bar for Group Identification */}
        <div
          className={`absolute top-0 left-0 right-0 h-0.5 ${groupTheme.accentBar} opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none`}
        />

        {/* Translucent Background Element 1: Vibrant Top-Right Ambient Radial Glow Orb */}
        <div
          className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-2xl pointer-events-none transition-all duration-300 opacity-80 group-hover:opacity-100 ${groupTheme.glow}`}
        />

        {/* Translucent Background Element 2: High-Contrast Corner Accent Gradient Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${groupTheme.gradient} pointer-events-none opacity-60 group-hover:opacity-90 transition-opacity`}
        />

        {/* Translucent Background Element 3: Bottom-Left Ambient Glow Orb */}
        <div
          className={`absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-xl pointer-events-none opacity-35 group-hover:opacity-70 transition-opacity ${groupTheme.secondaryGlow}`}
        />

        {/* Card Interactive Content */}
        <div className="relative z-10">
          {/* Card Top Row: 5 Stars on Left | Today Badge + 3-Dots Menu + Group Symbol on Right */}
          <div className="flex items-start justify-between gap-2 mb-3">
            {/* Left: Interactive 5 Stars Rating */}
            <div className="flex items-center gap-1">
              {onToggleSelect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect(item.id);
                  }}
                  className={`mr-1.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 border-emerald-400 text-neutral-950'
                      : 'border-neutral-700 bg-neutral-950/80 hover:border-neutral-500 text-transparent'
                  }`}
                  title={isSelected ? 'Desmarcar PWA' : 'Selecionar PWA'}
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </button>
              )}

              <StarRating
                rating={currentRating}
                onChange={(newRating) => onSetRating && onSetRating(item, newRating)}
                size="sm"
              />
            </div>

            {/* Right: Status Badge & 3-Dots Menu */}
            <div className="flex items-center gap-1.5 shrink-0">
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
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-transform active:scale-95 cursor-pointer border ${
                  isAccessed
                    ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/90'
                    : 'bg-rose-950/80 border-rose-800/80 text-rose-300 hover:bg-rose-900/90'
                }`}
              >
                {isAccessed ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Hoje</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3 text-rose-400" />
                    <span>Pendente</span>
                  </>
                )}
              </button>

              {/* 3-Dots Menu Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(activeMenuId === item.id ? null : item.id);
                  }}
                  className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Opções da PWA"
                  aria-label="Opções"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {/* Dropdown Menu */}
                {activeMenuId === item.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-full mt-1 z-30 w-44 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl py-1 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100"
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
            {/* Prominent Large Icon - Clicável para abrir */}
            <div
              onClick={() => onLaunch(item)}
              className="shrink-0 transition-transform active:scale-95 group-hover:opacity-95 cursor-pointer"
              title={`Abrir ${item.name}`}
            >
              <PWAIcon
                icon={item.icon}
                name={item.name}
                url={item.url}
                size="xl"
                className="w-14 h-14 rounded-2xl shadow-md border border-neutral-800/80 bg-neutral-900 object-cover"
              />
            </div>

            {/* Right Information Column */}
            <div className="min-w-0 flex-1">
              {/* 1. PWA Name - Clicável para abrir */}
              <h3
                onClick={() => onLaunch(item)}
                className="font-bold text-sm text-white hover:text-emerald-400 cursor-pointer truncate transition-colors leading-snug"
                title={`Abrir ${item.name} (${grpName})`}
              >
                {item.name}
              </h3>

              {/* 2. Access Log: DD/MM - HH:MM or - Sem registro - */}
              <div className="text-[11px] font-mono text-neutral-400 mt-0.5 notranslate" translate="no">
                <span>{accessLogStr}</span>
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
        </div>
      </div>
    );
  };

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
      <div className="space-y-6">
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
                {groupItems.map(renderCard)}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // Standard responsive cards grid (3-4 columns on desktop as requested)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map(renderCard)}
    </div>
  );
};
