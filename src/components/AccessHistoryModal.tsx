import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  History,
  Clock,
  Calendar,
  RefreshCw,
  Search,
  User,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { AccessHistoryEntry, PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import {
  ChromeProfileOption,
  buildAvailableChromeProfiles,
  formatAccessDateTime,
  formatChromeProfileDisplay,
  getCleanDomain,
  getTodayString,
} from '../utils/pwaLogic';
import {
  groupAccessHistoryByDay,
  mergeAccessHistoryRecords,
  resolveHistoryProfileDirectory,
} from '../utils/historyLogic';

interface AccessHistoryModalProps {
  isOpen: boolean;
  item: PWAItem | null;
  allItems: PWAItem[];
  todayStr?: string;
  discoveredProfiles?: ChromeProfileOption[];
  onClose: () => void;
  onSyncProfileHistory: (
    item: PWAItem,
    profileOverride?: string
  ) => Promise<{
    historyFound: boolean;
    chromeVisitsCount: number;
    profileDirectory: string;
    reason?: string | null;
  }>;
  onClearHistory?: (item: PWAItem) => void;
}

export const AccessHistoryModal: React.FC<AccessHistoryModalProps> = ({
  isOpen,
  item,
  allItems,
  todayStr = getTodayString(),
  discoveredProfiles = [],
  onClose,
  onSyncProfileHistory,
  onClearHistory,
}) => {
  const [selectedProfile, setSelectedProfile] = useState('Default');
  const [filterMode, setFilterMode] = useState<'all' | 'today'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    historyFound: boolean;
    chromeVisitsCount: number;
    profileDirectory: string;
    reason?: string | null;
  } | null>(null);

  const availableProfiles = useMemo(
    () => buildAvailableChromeProfiles(allItems, discoveredProfiles),
    [allItems, discoveredProfiles]
  );

  // Resolve current item from live allItems so updates immediately reflect in modal
  const liveItem = useMemo(() => {
    if (!item) return null;
    return allItems.find((it) => it.id === item.id) || item;
  }, [allItems, item]);

  const handleSync = useCallback(
    async (targetItem: PWAItem, profileOverride?: string) => {
      setIsSyncing(true);
      try {
        const res = await onSyncProfileHistory(targetItem, profileOverride);
        setSyncFeedback(res);
      } finally {
        setIsSyncing(false);
      }
    },
    [onSyncProfileHistory]
  );

  useEffect(() => {
    if (!isOpen || !item) return;
    const defaultProf = resolveHistoryProfileDirectory(item);
    setSelectedProfile(defaultProf);
    setFilterMode('all');
    setSearchQuery('');
    setSyncFeedback(null);
    void handleSync(item, defaultProf);
  }, [isOpen, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const mergedTimeline: AccessHistoryEntry[] = useMemo(() => {
    if (!liveItem) return [];
    return mergeAccessHistoryRecords(liveItem, []).accessHistory;
  }, [liveItem]);

  const filteredTimeline = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedTimeline.filter((entry) => {
      if (filterMode === 'today' && !entry.timestamp.startsWith(todayStr)) {
        return false;
      }
      if (!q) return true;
      const dt = formatAccessDateTime(entry.timestamp);
      const haystack = [
        dt.dateStr,
        dt.timeStr,
        entry.title || '',
        entry.visitedUrl || '',
        entry.profileDirectory || '',
        entry.source === 'chrome' ? 'chrome' : 'hub',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [mergedTimeline, filterMode, searchQuery, todayStr]);

  const dayGroups = useMemo(
    () => groupAccessHistoryByDay(filteredTimeline, todayStr),
    [filteredTimeline, todayStr]
  );

  if (!isOpen || !liveItem) return null;

  const domain = getCleanDomain(liveItem.url);
  const lastFormatted = formatAccessDateTime(liveItem.lastAccessedDate);
  const profileBadge = formatChromeProfileDisplay({ profileDirectory: selectedProfile });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[88vh] bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-history-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <h2 id="access-history-modal-title" className="text-sm font-semibold text-white">
              Histórico de Acesso (Dia e Hora)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar histórico"
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary & Controls */}
        <div className="p-4 border-b border-neutral-800/80 space-y-3 bg-neutral-950/40 shrink-0">
          {/* PWA Summary Strip */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <PWAIcon
                icon={liveItem.icon}
                name={liveItem.name}
                url={liveItem.url}
                size="md"
              />
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-white truncate">{liveItem.name}</h3>
                <p className="text-[11px] text-neutral-400 truncate font-mono">{domain}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[11px] font-mono text-neutral-200 font-semibold">
                {mergedTimeline.length} {mergedTimeline.length === 1 ? 'registro' : 'registros'}
              </div>
              <div className="text-[10px] font-mono text-neutral-400">
                {lastFormatted.hasRecord
                  ? `Último: ${lastFormatted.dateStr} às ${lastFormatted.timeStr || '00:00:00'}`
                  : 'Sem registro recente'}
              </div>
            </div>
          </div>

          {/* Chrome Profile Selector + Sync Action */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-950/80 border border-sky-700/70 text-sky-300 text-[11px] font-semibold">
                <User className="w-3 h-3 text-sky-400" />
                <span>Perfil:</span>
                <select
                  aria-label="Perfil do Chrome para histórico"
                  value={selectedProfile}
                  onChange={(e) => {
                    const nextProf = e.target.value;
                    setSelectedProfile(nextProf);
                    void handleSync(liveItem, nextProf);
                  }}
                  className="bg-transparent text-sky-200 font-mono text-[11px] focus:outline-none cursor-pointer"
                >
                  {availableProfiles.map((prof) => {
                    const disp = formatChromeProfileDisplay({ profileDirectory: prof.directory });
                    return (
                      <option
                        key={prof.directory}
                        value={prof.directory}
                        className="bg-neutral-900 text-neutral-100"
                      >
                        {disp?.badgeText || prof.directory} ({prof.directory})
                      </option>
                    );
                  })}
                  {!availableProfiles.some(
                    (p) => p.directory.toLowerCase() === selectedProfile.toLowerCase()
                  ) && (
                    <option value={selectedProfile} className="bg-neutral-900 text-neutral-100">
                      {profileBadge?.badgeText || selectedProfile} ({selectedProfile})
                    </option>
                  )}
                </select>
              </span>
            </div>

            <button
              type="button"
              data-testid="sync-profile-history-btn"
              disabled={isSyncing}
              onClick={() => void handleSync(liveItem, selectedProfile)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Histórico do Perfil'}</span>
            </button>
          </div>

          {/* Sync Status Notice */}
          {syncFeedback && (
            <div
              className={`px-3 py-2 rounded-lg border text-[11px] flex items-start gap-2 ${
                syncFeedback.historyFound
                  ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-200'
                  : 'bg-amber-950/35 border-amber-800/60 text-amber-200'
              }`}
            >
              {syncFeedback.historyFound ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span>
                {syncFeedback.historyFound
                  ? `Banco do Chrome (${syncFeedback.profileDirectory}) lido com sucesso: ${syncFeedback.chromeVisitsCount} visita(s) encontrada(s) para este domínio.`
                  : `${syncFeedback.reason || `Arquivo History do perfil "${syncFeedback.profileDirectory}" não encontrado neste ambiente.`} Exibindo registros salvos no Hub.`}
              </span>
            </div>
          )}

          {/* Filter Tabs & Search */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg bg-neutral-950 border border-neutral-800 p-0.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Todos ({mergedTimeline.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('today')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  filterMode === 'today'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Hoje ({mergedTimeline.filter((e) => e.timestamp.startsWith(todayStr)).length})
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[180px] justify-end">
              <div className="relative flex-1 max-w-[230px]">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar dia, hora, título..."
                  aria-label="Filtrar histórico por dia, hora ou título"
                  className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {onClearHistory && mergedTimeline.length > 0 && (
                <button
                  type="button"
                  onClick={() => onClearHistory(liveItem)}
                  title="Limpar registros locais de acesso desta PWA"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-rose-300 hover:text-rose-200 hover:bg-rose-950/60 border border-rose-900/60 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grouped Day/Time Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {dayGroups.length === 0 ? (
            <div className="py-12 text-center space-y-1.5">
              <History className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs font-medium text-neutral-300">
                Nenhum registro de acesso encontrado
              </p>
              <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                Abra a PWA pelo Hub ou clique em "Sincronizar Histórico do Perfil" no Ubuntu para importar as datas e horas do perfil Chrome configurado.
              </p>
            </div>
          ) : (
            dayGroups.map((group) => (
              <section key={group.dateKey} className="space-y-2">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1">
                  <h4 className="inline-flex items-center gap-1.5 text-[11px] font-bold text-neutral-200 uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{group.label}</span>
                  </h4>
                  <span className="text-[10px] font-mono text-neutral-400">
                    {group.entries.length} {group.entries.length === 1 ? 'acesso' : 'acessos'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.entries.map((entry, idx) => {
                    const profDisplay = entry.profileDirectory
                      ? formatChromeProfileDisplay({ profileDirectory: entry.profileDirectory })
                      : null;

                    return (
                      <div
                        key={`${entry.timestamp}_${idx}`}
                        className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg bg-neutral-950/75 border border-neutral-800/80 hover:border-neutral-700 transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-emerald-400">
                              <Clock className="w-3 h-3" />
                              <span>{entry.timeStr}</span>
                            </span>
                            <span className="font-mono text-[11px] text-neutral-400">
                              {entry.dateStr}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                entry.source === 'chrome'
                                  ? 'bg-sky-950/80 border-sky-700/70 text-sky-300'
                                  : 'bg-emerald-950/70 border-emerald-800/70 text-emerald-300'
                              }`}
                            >
                              {entry.source === 'chrome'
                                ? `Chrome${profDisplay ? ` (${profDisplay.badgeText})` : ''}`
                                : `Hub PWA${profDisplay ? ` (${profDisplay.badgeText})` : ''}`}
                            </span>
                          </div>

                          {(entry.title || entry.visitedUrl) && (
                            <p className="text-[11px] text-neutral-300 truncate flex items-center gap-1.5">
                              <span className="truncate">{entry.title || entry.visitedUrl}</span>
                              {entry.visitedUrl && entry.title && (
                                <span className="text-[10px] text-neutral-500 font-mono truncate hidden sm:inline">
                                  ({getCleanDomain(entry.visitedUrl)})
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        {entry.visitedUrl && (
                          <a
                            href={entry.visitedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={entry.visitedUrl}
                            className="p-1 rounded text-neutral-500 hover:text-emerald-400 hover:bg-neutral-800 transition-colors shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
