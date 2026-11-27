/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AccessTimeWindowFilter, DailyFlagKey, DailyFlagState, PWAFolder, PWAItem, ViewDensity, StatusFilter, StarFilter, SortOption, FlagFilterKey } from './types/pwa';
import {
  getTodayString,
  getMsUntilNextMidnight,
  getScopedSelectableItems,
  markAsAccessed,
  toggleAccessedToday,
  calculateStats,
  filterAndSortPWAs,
  resolveFaviconAtInsertion,
  isDeprecatedGenericIconUrl,
  shouldUpgradeChromeShortcutIcon,
  appendCacheBuster,
  isPreservableIconUrl,
  isAndroidOrRedroidApp,
  isSameOrMatchingPWA,
  extractChromeProfileDirectory,
  togglePWAFlag,
  updatePWAMoneyDate,
  countPWAFlags,
  countPWAFlagBreakdown,
  migratePWAFlags,
  batchSetRating,
  batchSetStatus,
  batchSetDailyFlag,
  batchClearFlags,
  ChromeProfileOption,
  clonePWAForProfile,
  ensureUniquePWAIds,
  CardSelectModifiers,
  computeCardSelection,
  getVisuallyOrderedPWAIds,
  buildChromeProfileFilterOptions,
  resolveConsolidatedScannedProfile,
  sanitizeLauncherMetadataForProfile,
  filterNonDuplicateImportedPWAs,
  findSameProfileDuplicateGroups,
  removeSameProfileDuplicates,
  SameProfileDedupePlan,
} from './utils/pwaLogic';
import {
  FOLDERS_STORAGE_KEY,
  loadFolders,
  saveFolders,
  createFolder,
  renameFolder,
  deleteFolderSafe,
  assignPWAsToFolder,
  getFolderDescendantIds,
} from './utils/folderLogic';
import { parseDesktopFile, ParsedDesktopApp } from './utils/desktopParser';
import { normalizeAppUrl } from './utils/desktopDeduplicator';
import { matchesAccessTimeWindow, mergeAccessHistoryRecords } from './utils/historyLogic';
import {
  PWA_WINDOW_WIDTH,
  PWA_WINDOW_HEIGHT,
  PWA_SAME_ITEM_COOLDOWN_MS,
  getPopupWindowFeatures,
  normalizeLaunchUrl,
  tryAcquirePwaLaunchSlot,
} from './utils/launchConfig';
import { TopBar, TopBarActivityStatus } from './components/TopBar';
import { ControlToolbar } from './components/ControlToolbar';
import { CompactTableView } from './components/CompactTableView';
import { DenseGridView } from './components/DenseGridView';
import { CardsView } from './components/CardsView';
import { MiniCardsView } from './components/MiniCardsView';
import { FolderView } from './components/FolderView';
import { BatchActionsBar } from './components/BatchActionsBar';
import { BatchEditModal } from './components/BatchEditModal';
import { AddEditPWAModal } from './components/AddEditPWAModal';
import { BackupModal } from './components/BackupModal';
import { DesktopImportModal } from './components/DesktopImportModal';
import { GitHubUpdateModal } from './components/GitHubUpdateModal';
import { AutostartModal } from './components/AutostartModal';
import { loadGroupConfigs, saveGroupConfigs, loadGroupColors, saveGroupColors } from './utils/groupLogic';
import { applyMarkdownAccessUpdates, extractPWAsToMarkdown, MarkdownStatusApplyResult } from './utils/markdownExporter';
import { GroupManagerModal } from './components/GroupManagerModal';
import { FolderManagerModal } from './components/FolderManagerModal';
import { QuickAssignFolderModal } from './components/QuickAssignFolderModal';
import { RatingConfirmModal } from './components/RatingConfirmModal';
import { ClonePWAProfileModal } from './components/ClonePWAProfileModal';
import { AccessHistoryModal } from './components/AccessHistoryModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { AlertCircle, CheckCircle2, ExternalLink, FolderUp, FolderOpen, Plus, X } from 'lucide-react';

const STORAGE_KEY = 'chrome_pwa_hub_items_empty_v1';
const DENSITY_STORAGE_KEY = 'chrome_pwa_hub_density';
const GROUP_BY_STORAGE_KEY = 'chrome_pwa_hub_group_by_group';

// Automatically repairs and fixes any malformed domains, missing URLs, or broken local icon references
export function repairAndSanitizePWA(it: PWAItem): PWAItem {
  let url = it.url || '';
  if (it.name) {
    const domainMatch = it.name.trim().match(/^([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)$/i);
    if (domainMatch) {
      const detectedDomain = domainMatch[1].toLowerCase();
      if (!url || url.includes('com.com') || url.includes('app.com') || !url.includes('.')) {
        url = `https://${detectedDomain}`;
      }
    }
  }
  if (url.endsWith('com.com')) {
    url = url.slice(0, -7) + '.com';
  }

  // Preserve working/custom PWA icon, replacing missing, deprecated third-party, or Chrome shortcut monogram URLs
  let icon = it.icon;
  if (!icon || isDeprecatedGenericIconUrl(icon) || shouldUpgradeChromeShortcutIcon(icon, url)) {
    icon = resolveFaviconAtInsertion(url, undefined, it.name);
  }

  const profileDirectory = it.profileDirectory?.trim() || extractChromeProfileDirectory(it);
  const migratedFlags = it.flags ? migratePWAFlags(it.flags as unknown as Record<string, unknown>) : undefined;

  return {
    ...it,
    url,
    icon,
    ...(migratedFlags ? { flags: migratedFlags } : {}),
    ...(profileDirectory ? { profileDirectory } : {}),
  };
}

export default function App() {
  const [items, setItems] = useState<PWAItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed
            .filter((it: PWAItem) => !isAndroidOrRedroidApp(it))
            .map(repairAndSanitizePWA);
          const repairedIds = ensureUniquePWAIds(sanitized);
          if (repairedIds.some((it, i) => it.id !== sanitized[i]?.id)) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(repairedIds));
            } catch {}
          }
          return repairedIds;
        }
      }
      // Check legacy keys to prevent data loss across updates
      const legacyKeys = [
        'chrome_pwa_hub_items_v2',
        'chrome_pwa_hub_items_v1',
        'chrome_pwa_hub_items',
        'pwa_items',
      ];
      for (const k of legacyKeys) {
        const legacy = localStorage.getItem(k);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return ensureUniquePWAIds(
              parsed.filter((it: PWAItem) => !isAndroidOrRedroidApp(it)).map(repairAndSanitizePWA)
            );
          }
        }
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const [folders, setFolders] = useState<PWAFolder[]>(() => loadFolders());

  const [density, setDensity] = useState<ViewDensity>(() => {
    try {
      const saved = localStorage.getItem(DENSITY_STORAGE_KEY) as ViewDensity;
      if (saved === 'compact-table' || saved === 'dense-grid' || saved === 'cards' || saved === 'mini-cards' || saved === 'folders') {
        return saved;
      }
    } catch {
      // Fallback
    }
    return 'cards';
  });

  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [currentExplorerFolderId, setCurrentExplorerFolderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [starFilter, setStarFilter] = useState<StarFilter>('all');
  const [profileFilter, setProfileFilter] = useState<string>('all');
  const [flagFilters, setFlagFilters] = useState<FlagFilterKey[]>([]);
  const [timeWindow, setTimeWindow] = useState<AccessTimeWindowFilter>({
    enabled: false,
    startTime: '08:00',
    endTime: '18:00',
    dayScope: 'today',
  });
  const [sortBy, setSortBy] = useState<SortOption>('pinned');
  const [groupByGroup, setGroupByGroup] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GROUP_BY_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Card batch selection state (stores both selected IDs and anchor ID for Shift+Click ranges)
  const [selectionState, setSelectionState] = useState<{
    ids: Set<string>;
    lastId: string | null;
  }>({ ids: new Set(), lastId: null });
  const selectedIds = selectionState.ids;
  const setSelectedIds = useCallback(
    (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setSelectionState((prev) => {
        const nextIds = typeof updater === 'function' ? updater(prev.ids) : updater;
        if (nextIds === prev.ids) return prev;
        const nextLast = prev.lastId && nextIds.has(prev.lastId) ? prev.lastId : null;
        return { ids: nextIds, lastId: nextLast };
      });
    },
    []
  );

  // Clear selection when changing active folder or view mode so batch actions only target visible scope
  useEffect(() => {
    setSelectionState((prev) =>
      prev.ids.size > 0 || prev.lastId !== null ? { ids: new Set(), lastId: null } : prev
    );
  }, [currentExplorerFolderId, selectedFolder, density]);

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PWAItem | null>(null);
  const [cloningItem, setCloningItem] = useState<PWAItem | null>(null);
  const [historyModalItem, setHistoryModalItem] = useState<PWAItem | null>(null);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [executionTasks, setExecutionTasks] = useState<Array<{ id: string; label: string }>>([]);
  const [iconRefreshState, setIconRefreshState] = useState<{
    active: boolean;
    completed: number;
    total: number;
  }>({ active: false, completed: 0, total: 0 });
  const [serverActivity, setServerActivity] = useState<{
    executing: boolean;
    executingLabel: string | null;
    updatingIcons: boolean;
    updatingIconsCount: number;
    runningScript: boolean;
    runningScriptLabel: string | null;
  }>({
    executing: false,
    executingLabel: null,
    updatingIcons: false,
    updatingIconsCount: 0,
    runningScript: false,
    runningScriptLabel: null,
  });
  const [activityPollNonce, setActivityPollNonce] = useState(0);
  const [discoveredChromeProfiles, setDiscoveredChromeProfiles] = useState<ChromeProfileOption[]>([]);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isAutostartOpen, setIsAutostartOpen] = useState(false);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [folderManagerParentId, setFolderManagerParentId] = useState<string | null>(null);
  const [quickAssignTargetFolderId, setQuickAssignTargetFolderId] = useState<string | null>(null);

  // Group Configurations (name -> symbol mapping)
  const [groupConfigs, setGroupConfigs] = useState<Record<string, string>>(() => loadGroupConfigs());

  // Group Color Themes (name -> colorKey mapping)
  const [groupColors, setGroupColors] = useState<Record<string, string>>(() => loadGroupColors());

  // Track whether localStorage already had persisted items/folders before hydration
  const initialHadLocalItemsRef = useRef<boolean | null>(null);
  const initialHadLocalFoldersRef = useRef<boolean | null>(null);
  const isHydratedRef = useRef(false);
  if (initialHadLocalItemsRef.current === null) {
    try {
      initialHadLocalItemsRef.current = localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      initialHadLocalItemsRef.current = false;
    }
  }
  if (initialHadLocalFoldersRef.current === null) {
    try {
      initialHadLocalFoldersRef.current = localStorage.getItem(FOLDERS_STORAGE_KEY) !== null;
    } catch {
      initialHadLocalFoldersRef.current = false;
    }
  }

  // Persist folders to localStorage once hydrated
  useEffect(() => {
    if (!isHydratedRef.current) return;
    saveFolders(folders);
  }, [folders]);

  // Save group configs and colors whenever updated
  useEffect(() => {
    saveGroupConfigs(groupConfigs);
  }, [groupConfigs]);

  useEffect(() => {
    saveGroupColors(groupColors);
  }, [groupColors]);

  // Ubuntu desktop file import state
  const [parsedDesktopApps, setParsedDesktopApps] = useState<ParsedDesktopApp[]>([]);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Pending rating change confirmation: { item, newRating }
  const [pendingRatingChange, setPendingRatingChange] = useState<{
    item: PWAItem;
    newRating: number;
  } | null>(null);

  // Pending deletion confirmation modal (single or batch IDs) and same-profile dedupe confirmation
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [pendingDedupePlan, setPendingDedupePlan] = useState<SameProfileDedupePlan | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'warning' | 'success'>('warning');
  const [blockedLaunchFallback, setBlockedLaunchFallback] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const serverCanLaunchNativeRef = useRef<boolean | null>(
    typeof window !== 'undefined' &&
      typeof (window as unknown as { __HUB_CAN_LAUNCH_NATIVE__?: unknown }).__HUB_CAN_LAUNCH_NATIVE__ === 'boolean'
      ? Boolean((window as unknown as { __HUB_CAN_LAUNCH_NATIVE__: boolean }).__HUB_CAN_LAUNCH_NATIVE__)
      : null
  );

  // Current day string (YYYY-MM-DD)
  const [todayStr, setTodayStr] = useState(() => getTodayString());

  // Keep todayStr synced: exact timer for local midnight (00:00) + 30s fallback + focus check.
  // When todayStr rolls over at midnight, COM/RB/BON daily selections disappear automatically.
  useEffect(() => {
    const syncToday = () => {
      const current = getTodayString();
      if (current !== todayStr) {
        setTodayStr(current);
      }
    };
    const midnightTimeout = setTimeout(syncToday, getMsUntilNextMidnight());
    const interval = setInterval(syncToday, 30000);
    window.addEventListener('focus', syncToday);
    return () => {
      clearTimeout(midnightTimeout);
      clearInterval(interval);
      window.removeEventListener('focus', syncToday);
    };
  }, [todayStr]);

  // Merge scanned local Ubuntu PWAs with stored user tracking state
  // Consolidates all previously saved versions of the same platform into the Profile 5 card
  const mergeScannedPWAs = useCallback((scannedItems: PWAItem[]) => {
    const validScanned = scannedItems.filter((s) => !isAndroidOrRedroidApp(s));
    setItems((prev) => {
      if (prev.length === 0 && validScanned.length === 0) {
        return prev;
      }
      const cleanPrev = prev.filter((p) => !isAndroidOrRedroidApp(p));
      const absorbedPrevIds = new Set<string>();

      const mergedList = validScanned.map((scanned) => {
        const normScannedUrl = normalizeAppUrl(scanned.url);

        // Find ALL previous entries that belong to this platform (never absorb profile clones or preserved __dup_ copies)
        const matches = cleanPrev.filter((p) => {
          if (p.clonedFromId || p.id.startsWith('pwa_clone_') || p.id.includes('__dup_')) return false;
          if (p.id === scanned.id) return true;
          if (scanned.appId && p.appId && scanned.appId.toLowerCase() === p.appId.toLowerCase()) return true;
          if (scanned.desktopPath && p.desktopPath && (p.desktopPath === scanned.desktopPath || (scanned.alternateDesktopPaths || []).includes(p.desktopPath))) return true;
          if (scanned.rawFileName && p.rawFileName && (p.rawFileName === scanned.rawFileName || (scanned.mergedDesktopFiles || []).includes(p.rawFileName))) return true;
          if (normScannedUrl && normalizeAppUrl(p.url) === normScannedUrl) return true;
          if ((scanned.mergedNames || []).includes(p.name)) return true;
          return false;
        });

        matches.forEach((m) => absorbedPrevIds.add(m.id));

        if (matches.length > 0) {
          // Consolidate metadata across all matched previous installations
          const customName = matches.find((m) => m.name && m.name !== scanned.name)?.name || scanned.name;
          const customCategory = matches.find((m) => m.category && m.category !== 'Geral')?.category || scanned.category;

          const isAnyPinned = matches.some((m) => m.pinned) || Boolean(scanned.pinned);
          const maxRating = Math.max(
            typeof scanned.rating === 'number' ? scanned.rating : 0,
            ...matches.map((m) => (typeof m.rating === 'number' ? m.rating : (m.pinned ? 5 : 0)))
          );

          // Combine aliases
          const allAliases = new Set<string>(scanned.aliases || []);
          matches.forEach((m) => (m.aliases || []).forEach((a) => allAliases.add(a)));

          // Combine notes
          const noteList: string[] = [];
          if (scanned.notes && scanned.notes.trim()) noteList.push(scanned.notes.trim());
          matches.forEach((m) => {
            if (m.notes && m.notes.trim() && !noteList.includes(m.notes.trim())) {
              noteList.push(m.notes.trim());
            }
          });

          // Most recent lastAccessedDate
          let latestDate = scanned.lastAccessedDate || null;
          for (const m of matches) {
            if (m.lastAccessedDate) {
              if (!latestDate || m.lastAccessedDate > latestDate) {
                latestDate = m.lastAccessedDate;
              }
            }
          }

          // Total or highest accessCount
          const totalAccess = Math.max(
            scanned.accessCount || 0,
            ...matches.map((m) => m.accessCount || 0)
          );

          // Preserve folder assignment & working icon (custom URLs or web-resolved /api/icon?domain=...) across rescans
          const customFolderId = matches.find((m) => m.folderId)?.folderId ?? scanned.folderId ?? null;
          const existingWorkingIcon = matches.find((m) => isPreservableIconUrl(m.icon))?.icon;
          const finalMergedIcon = existingWorkingIcon || scanned.icon || resolveFaviconAtInsertion(scanned.url, undefined, customName);

          const {
            finalProfileDirectory,
            profileOverridden,
            nextExecLine,
          } = resolveConsolidatedScannedProfile(matches, scanned);

          const mergedFlags = matches.find((m) => m.flags)?.flags || scanned.flags;
          const combinedLogs = Array.from(
            new Set([
              ...(Array.isArray(scanned.accessLogs) ? scanned.accessLogs : []),
              ...matches.flatMap((m) => (Array.isArray(m.accessLogs) ? m.accessLogs : [])),
            ])
          ).slice(0, 60);
          const combinedHistoryEntries = [
            ...(Array.isArray(scanned.accessHistory) ? scanned.accessHistory : []),
            ...matches.flatMap((m) => (Array.isArray(m.accessHistory) ? m.accessHistory : [])),
          ];
          const mergedHist = mergeAccessHistoryRecords(
            {
              lastAccessedDate: latestDate,
              accessLogs: combinedLogs,
              accessHistory: combinedHistoryEntries,
              profileDirectory: finalProfileDirectory,
            },
            []
          );

          return {
            ...scanned,
            ...(profileOverridden
              ? {
                  execLine: nextExecLine,
                  rawFileName: undefined,
                  desktopPath: undefined,
                  appId: undefined,
                }
              : {}),
            name: customName,
            category: customCategory,
            folderId: customFolderId,
            icon: finalMergedIcon,
            profileDirectory: finalProfileDirectory,
            ...(mergedFlags ? { flags: mergedFlags } : {}),
            pinned: isAnyPinned || maxRating > 0,
            rating: maxRating,
            aliases: Array.from(allAliases).filter(Boolean),
            notes: noteList.join(' | '),
            lastAccessedDate: mergedHist.lastAccessedDate || latestDate,
            ...(mergedHist.accessLogs.length > 0 ? { accessLogs: mergedHist.accessLogs } : {}),
            ...(mergedHist.accessHistory.length > 0 ? { accessHistory: mergedHist.accessHistory } : {}),
            accessCount: totalAccess,
          };
        }

        const extractedProfile = extractChromeProfileDirectory(scanned);
        return {
          ...scanned,
          icon: scanned.icon || resolveFaviconAtInsertion(scanned.url),
          ...(extractedProfile ? { profileDirectory: extractedProfile } : {}),
        };
      });

      // Keep only manual items that weren't absorbed into any platform
      const remainingManualItems = cleanPrev.filter((p) => !absorbedPrevIds.has(p.id));
      const finalMerged = ensureUniquePWAIds(
        [...mergedList, ...remainingManualItems].filter((it) => !isAndroidOrRedroidApp(it))
      );
      const finalMergedIds = new Set(finalMerged.map((it) => it.id));
      const supersededIds = Array.from(absorbedPrevIds).filter((id) => !finalMergedIds.has(id));

      // Sync merged state to server disk database and remove absorbed duplicate IDs
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: finalMerged,
          ...(supersededIds.length > 0 ? { supersededIds } : {}),
        }),
      }).catch(() => {});

      return finalMerged;
    });
  }, []);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const launchOnlyItemsRef = useRef<WeakSet<PWAItem>>(new WeakSet());
  const lastSyncedItemsRef = useRef<PWAItem[]>(items);
  const lastSyncedFoldersRef = useRef<PWAFolder[]>(folders);

  const beginExecutionTask = useCallback((label: string) => {
    const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setExecutionTasks((prev) => [...prev, { id, label }]);
    return id;
  }, []);

  const endExecutionTask = useCallback((id: string) => {
    setExecutionTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const triggerActivityPoll = useCallback(() => {
    setActivityPollNonce((n) => n + 1);
  }, []);

  // Poll backend /api/activity/status only while local actions, modals, or backend scripts are active
  useEffect(() => {
    let cancelled = false;
    let idleTicks = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const hasLocalWork =
      executionTasks.length > 0 ||
      iconRefreshState.active ||
      isSyncingHistory ||
      isUpdateModalOpen ||
      isAutostartOpen;

    const pollOnce = async () => {
      try {
        const res = await fetch('/api/activity/status');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (typeof data.canLaunchNative === 'boolean') {
          serverCanLaunchNativeRef.current = data.canLaunchNative;
        }
        const snapshot = {
          executing: Boolean(data.executing),
          executingLabel: data.executingLabel ? String(data.executingLabel) : null,
          updatingIcons: Boolean(data.updatingIcons),
          updatingIconsCount: Number(data.updatingIconsCount || 0),
          runningScript: Boolean(data.runningScript),
          runningScriptLabel: data.runningScriptLabel ? String(data.runningScriptLabel) : null,
        };
        setServerActivity(snapshot);

        const isBusy =
          snapshot.executing ||
          snapshot.updatingIcons ||
          snapshot.runningScript ||
          hasLocalWork;

        if (isBusy) {
          idleTicks = 0;
        } else {
          idleTicks += 1;
          if (idleTicks >= 3 && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      } catch {
        // ignore transient network errors
      }
    };

    void pollOnce();
    if (activityPollNonce > 0 || hasLocalWork) {
      intervalId = setInterval(() => {
        void pollOnce();
      }, 550);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    activityPollNonce,
    executionTasks.length,
    iconRefreshState.active,
    isSyncingHistory,
    isUpdateModalOpen,
    isAutostartOpen,
  ]);

  // Controlled concurrency queue for icon resolution so batch refresh updates live progress cleanly
  const iconResolveRunIdRef = useRef(0);
  const runIconResolveQueue = useCallback(
    async (targets: Array<{ url: string; name?: string }>) => {
      const validTargets = targets.filter((t) => Boolean(t.url));
      if (validTargets.length === 0) return;

      const runId = ++iconResolveRunIdRef.current;
      let completed = 0;
      const total = validTargets.length;

      setIconRefreshState({ active: true, completed: 0, total });
      triggerActivityPoll();

      const concurrency = Math.min(6, validTargets.length);
      let cursor = 0;

      const worker = async () => {
        while (cursor < validTargets.length) {
          const idx = cursor++;
          const target = validTargets[idx];
          try {
            await fetch(
              `/api/icon/resolve?url=${encodeURIComponent(target.url)}&name=${encodeURIComponent(target.name || '')}&refresh=1`
            );
          } catch {
            // continue queue on individual icon failure
          } finally {
            completed += 1;
            if (iconResolveRunIdRef.current === runId) {
              setIconRefreshState({ active: true, completed, total });
            }
          }
        }
      };

      try {
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
      } finally {
        if (iconResolveRunIdRef.current === runId) {
          setIconRefreshState({ active: false, completed: 0, total: 0 });
          triggerActivityPoll();
        }
      }
    },
    [triggerActivityPoll]
  );

  // Sync Chrome profile History SQLite across items
  const syncAllProfilesHistory = useCallback(async (sourceItems?: PWAItem[]) => {
    const targetList = sourceItems || itemsRef.current;
    if (!targetList || targetList.length === 0) return;

    const execId = beginExecutionTask('Sincronizando histórico...');
    setIsSyncingHistory(true);
    triggerActivityPoll();
    try {
      const payloadItems = targetList.map((it) => ({
        id: it.id,
        url: it.url,
        profileDirectory: it.profileDirectory,
        execLine: it.execLine,
        rawFileName: it.rawFileName,
        desktopPath: it.desktopPath,
        lastAccessedDate: it.lastAccessedDate,
        accessLogs: it.accessLogs,
        accessHistory: it.accessHistory,
      }));

      const res = await fetch('/api/pwas/history/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems }),
      });

      if (!res.ok) return;
      const data = await res.json();
      const resultsMap = data?.results as
        | Record<
            string,
            {
              profileDirectory: string;
              historyFound: boolean;
              accessHistory: PWAItem['accessHistory'];
              accessLogs: string[];
              lastAccessedDate: string | null;
            }
          >
        | undefined;

      if (!resultsMap) return;

      setItems((prev) => {
        let changed = false;
        const next = prev.map((it) => {
          const synced = resultsMap[it.id];
          if (!synced || !Array.isArray(synced.accessHistory) || synced.accessHistory.length === 0) {
            return it;
          }
          const nextLogs = synced.accessLogs || [];
          const nextLast = synced.lastAccessedDate || it.lastAccessedDate;
          const prevCount = it.accessHistory?.length || 0;
          if (
            nextLast !== it.lastAccessedDate ||
            synced.accessHistory.length !== prevCount
          ) {
            changed = true;
          }
          return {
            ...it,
            lastAccessedDate: nextLast,
            accessLogs: nextLogs,
            accessHistory: synced.accessHistory,
            accessCount: Math.max(it.accessCount || 0, synced.accessHistory.length),
          };
        });
        if (changed) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {}
        }
        return changed ? next : prev;
      });
    } catch {
      // ignore offline or container sync fallback errors
    } finally {
      setIsSyncingHistory(false);
      endExecutionTask(execId);
      triggerActivityPoll();
    }
  }, [beginExecutionTask, endExecutionTask, triggerActivityPoll]);

  // Automatic discovery scan on launch & on demand
  const handleRescanLocalPWAs = useCallback(async () => {
    const execId = beginExecutionTask('Buscando PWAs locais...');
    try {
      const res = await fetch('/api/pwas/scan');
      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          mergeScannedPWAs(data.items);
        }
      }
    } catch (err) {
      console.warn('Scan de PWAs locais:', err);
    } finally {
      endExecutionTask(execId);
      setTimeout(() => {
        if (itemsRef.current.length > 0) {
          void syncAllProfilesHistory(itemsRef.current);
        }
      }, 250);
    }
  }, [beginExecutionTask, endExecutionTask, mergeScannedPWAs, syncAllProfilesHistory]);

  // Trigger local discovery scan & hydrate persisted folders/state when app loads
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/pwas/state');
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (typeof data?.canLaunchNative === 'boolean') {
            serverCanLaunchNativeRef.current = data.canLaunchNative;
          }
          const serverDb = data?.db;
          if (serverDb) {
            // Hydrate folders if localStorage has not saved folders yet
            if (Array.isArray(serverDb.folders) && serverDb.folders.length > 0 && !initialHadLocalFoldersRef.current) {
              lastSyncedFoldersRef.current = serverDb.folders;
              setFolders(serverDb.folders);
              saveFolders(serverDb.folders);
            }
            // Hydrate items on first clean load if localStorage has never been initialized
            const serverPwas = serverDb.pwas ? (Object.values(serverDb.pwas) as PWAItem[]) : [];
            if (!initialHadLocalItemsRef.current && serverPwas.length > 0) {
              const deletedSet = new Set<string>(Array.isArray(serverDb.deletedIds) ? serverDb.deletedIds : []);
              const hydrated = ensureUniquePWAIds(
                serverPwas
                  .filter((it) => it && it.id && it.name && it.url && !deletedSet.has(it.id) && !isAndroidOrRedroidApp(it))
                  .map(repairAndSanitizePWA)
              );
              if (hydrated.length > 0) {
                lastSyncedItemsRef.current = hydrated;
                setItems(hydrated);
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
                } catch {}
              }
            }
          }
        }
      } catch {
        // ignore server state hydration error
      } finally {
        if (!cancelled) {
          isHydratedRef.current = true;
          handleRescanLocalPWAs();
        }
      }
    })();
    fetch('/api/chrome-profiles')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.profiles && Array.isArray(data.profiles)) {
          setDiscoveredChromeProfiles(data.profiles);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [handleRescanLocalPWAs]);

  const pendingStorageWriteRef = useRef(false);
  const lastPersistedStorageItemsRef = useRef<PWAItem[]>(items);

  // Flush items to localStorage if the tab/window closes before the debounce timer fires
  useEffect(() => {
    const flushLocalStorage = () => {
      if (!isHydratedRef.current || !pendingStorageWriteRef.current) return;
      pendingStorageWriteRef.current = false;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsRef.current));
      } catch {
        // ignore
      }
    };
    window.addEventListener('pagehide', flushLocalStorage);
    window.addEventListener('beforeunload', flushLocalStorage);
    return () => {
      window.removeEventListener('pagehide', flushLocalStorage);
      window.removeEventListener('beforeunload', flushLocalStorage);
    };
  }, []);

  // Persist items to localStorage (debounced to keep click frame 0ms) and sync items + folders to server database
  useEffect(() => {
    if (!isHydratedRef.current) return;

    let storageTimer: ReturnType<typeof setTimeout> | null = null;
    if (
      items !== lastPersistedStorageItemsRef.current &&
      !(items.length === 0 && lastPersistedStorageItemsRef.current.length === 0)
    ) {
      pendingStorageWriteRef.current = true;
      storageTimer = setTimeout(() => {
        pendingStorageWriteRef.current = false;
        lastPersistedStorageItemsRef.current = items;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch {
          // ignore
        }
      }, 250);
    }

    const onlyLaunchUpdates =
      folders === lastSyncedFoldersRef.current &&
      items.length === lastSyncedItemsRef.current.length &&
      items.every(
        (it, idx) => it === lastSyncedItemsRef.current[idx] || launchOnlyItemsRef.current.has(it)
      );

    if (onlyLaunchUpdates) {
      lastSyncedItemsRef.current = items;
      return () => {
        if (storageTimer) clearTimeout(storageTimer);
      };
    }

    const syncTimer = setTimeout(() => {
      lastSyncedItemsRef.current = items;
      lastSyncedFoldersRef.current = folders;
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, folders }),
      }).catch(() => {});
    }, 600);

    return () => {
      if (storageTimer) clearTimeout(storageTimer);
      clearTimeout(syncTimer);
    };
  }, [items, folders]);

  // Persist density setting
  const handleDensityChange = (newDensity: ViewDensity) => {
    setDensity(newDensity);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, newDensity);
    } catch {
      // ignore
    }
  };

  // Update ONLY daily access status (accessed <-> pending) of existing PWAs from exported Markdown (.md)
  const handleImportMarkdownStatus = useCallback(
    (markdownText: string): MarkdownStatusApplyResult => {
      const result = applyMarkdownAccessUpdates(itemsRef.current, markdownText, {
        now: new Date(),
        todayStr,
      });

      if (result.updatedItems.length > 0) {
        itemsRef.current = result.items;
        setItems(result.items);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result.items));
        } catch {
          // ignore storage quota errors
        }
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: result.updatedItems }),
        }).catch(() => {});
      }

      if (result.parsedCount === 0) {
        setNoticeTone('warning');
        setNoticeMessage(
          'Nenhuma PWA com o parâmetro "Acesso" ou "Perfil do Chrome" foi encontrada no arquivo .md.'
        );
      } else if (result.matchedCount === 0) {
        setNoticeTone('warning');
        setNoticeMessage(
          `Nenhuma das ${result.parsedCount} PWAs do arquivo .md corresponde às cadastradas no Hub (nenhuma PWA adicionada).`
        );
      } else {
        setNoticeTone('success');
        const profilePart =
          result.updatedProfileCount > 0
            ? `, ${result.updatedProfileCount} perfil(is) atualizado(s)`
            : '';
        const unmatchedNote =
          result.unmatchedCount > 0
            ? ` · ${result.unmatchedCount} não encontrada(s) (nenhuma PWA adicionada)`
            : '';
        setNoticeMessage(
          `Atualizado via .md: ${result.markedAccessedCount} acessada(s) (verde), ${result.markedPendingCount} pendente(s) (vermelha)${profilePart}, ${result.unchangedCount} sem alteração${unmatchedNote}.`
        );
      }

      return result;
    },
    [todayStr]
  );

  const handleSelectMarkdownStatusFile = useCallback(
    async (file: File) => {
      const execId = beginExecutionTask('Lendo status .md...');
      try {
        const text = await file.text();
        handleImportMarkdownStatus(text);
      } catch {
        setNoticeTone('warning');
        setNoticeMessage(`Não foi possível ler o arquivo "${file.name}".`);
      } finally {
        endExecutionTask(execId);
      }
    },
    [beginExecutionTask, endExecutionTask, handleImportMarkdownStatus]
  );

  // Process Ubuntu .desktop files or status .md files selected via native file dialog or drag & drop
  const processDesktopFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const mdFiles = fileArray.filter((f) => /\.(?:md|markdown)$/i.test(f.name));
    const otherFiles = fileArray.filter((f) => !/\.(?:md|markdown)$/i.test(f.name));

    for (const mdFile of mdFiles) {
      await handleSelectMarkdownStatusFile(mdFile);
    }

    if (otherFiles.length === 0) {
      return;
    }

    const execId = beginExecutionTask('Lendo arquivos .desktop...');
    try {
      const parsedList: ParsedDesktopApp[] = [];

      for (const file of otherFiles) {
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
      } else if (mdFiles.length === 0) {
        setNoticeTone('warning');
        setNoticeMessage('Nenhum atalho de PWA (.desktop) válido foi encontrado nos arquivos selecionados.');
      }
    } finally {
      endExecutionTask(execId);
    }
  }, [beginExecutionTask, endExecutionTask, handleSelectMarkdownStatusFile]);

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

  // Confirm import of parsed Ubuntu desktop PWAs (deduplicated against existing PWAs & profiles)
  const handleConfirmDesktopImport = useCallback((newItems: PWAItem[]) => {
    const validNew = newItems.filter((i) => !isAndroidOrRedroidApp(i));
    setItems((prev) => {
      const cleanPrev = prev.filter((p) => !isAndroidOrRedroidApp(p));
      const withResolvedIcons = validNew.map((item) => ({
        ...item,
        icon: item.icon || resolveFaviconAtInsertion(item.url),
      }));
      const filtered = filterNonDuplicateImportedPWAs(cleanPrev, withResolvedIcons, 'desktop');
      if (filtered.length === 0) {
        return cleanPrev.length === prev.length ? prev : cleanPrev;
      }
      return ensureUniquePWAIds([...filtered, ...cleanPrev]);
    });
  }, []);

  // Active non-Android/Redroid items
  const cleanItems = useMemo(() => {
    return items.filter((it) => !isAndroidOrRedroidApp(it));
  }, [items]);

  // Extract unique groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    set.add('Geral');
    Object.keys(groupConfigs).forEach((g) => set.add(g));
    Object.keys(groupColors).forEach((g) => set.add(g));
    cleanItems.forEach((item) => {
      const g = item.group || item.category || 'Geral';
      if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [cleanItems, groupConfigs, groupColors]);

  // Compute daily stats
  const stats = useMemo(() => {
    return calculateStats(cleanItems, todayStr);
  }, [cleanItems, todayStr]);

  const validFolderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);

  const { unfiledCount, folderItemCounts } = useMemo(() => {
    let unfiled = 0;
    const directCounts: Record<string, number> = {};
    for (const it of cleanItems) {
      if (!it.folderId || !validFolderIds.has(it.folderId)) {
        unfiled++;
      } else {
        directCounts[it.folderId] = (directCounts[it.folderId] || 0) + 1;
      }
    }
    const recursiveCounts: Record<string, number> = {};
    for (const f of folders) {
      const desc = getFolderDescendantIds(folders, f.id);
      let sum = directCounts[f.id] || 0;
      desc.forEach((id) => {
        sum += directCounts[id] || 0;
      });
      recursiveCounts[f.id] = sum;
    }
    return { unfiledCount: unfiled, folderItemCounts: recursiveCounts };
  }, [cleanItems, folders, validFolderIds]);

  // Flag counts across all clean items (for current todayStr)
  const flagCounts = useMemo(() => countPWAFlags(cleanItems, todayStr), [cleanItems, todayStr]);
  const flagBreakdown = useMemo(() => countPWAFlagBreakdown(cleanItems, todayStr), [cleanItems, todayStr]);

  const timeWindowMatchCount = useMemo(() => {
    if (!timeWindow.enabled) return 0;
    return cleanItems.filter((it) => matchesAccessTimeWindow(it, timeWindow, todayStr)).length;
  }, [cleanItems, timeWindow, todayStr]);

  const chromeProfileSummary = useMemo(
    () => buildChromeProfileFilterOptions(cleanItems, discoveredChromeProfiles),
    [cleanItems, discoveredChromeProfiles]
  );

  const sameProfileDedupePlan = useMemo(
    () => findSameProfileDuplicateGroups(cleanItems),
    [cleanItems]
  );

  // Filtered and sorted items
  const displayedItems = useMemo(() => {
    const activeFolderFilter = density === 'folders' ? 'all' : selectedFolder;
    const folderFilterIds =
      activeFolderFilter !== 'all' && activeFolderFilter !== 'unfiled'
        ? new Set([activeFolderFilter, ...getFolderDescendantIds(folders, activeFolderFilter)])
        : undefined;

    return filterAndSortPWAs(cleanItems, {
      search,
      group: selectedGroup,
      folderFilter: activeFolderFilter,
      folderFilterIds,
      validFolderIds,
      statusFilter,
      starFilter,
      profileFilter,
      flagFilters,
      timeWindow,
      sortBy,
      todayStr,
    });
  }, [cleanItems, folders, validFolderIds, density, selectedFolder, search, selectedGroup, statusFilter, starFilter, profileFilter, flagFilters, timeWindow, sortBy, todayStr]);

  // Scoped selectable items (when inside a folder -> ONLY that folder; root/unfiled -> ONLY unfiled; cards -> displayedItems)
  const selectableItems = useMemo(() => {
    return getScopedSelectableItems(displayedItems, {
      density,
      folders,
      currentFolderId: currentExplorerFolderId,
    });
  }, [displayedItems, density, folders, currentExplorerFolderId]);

  const orderedSelectableIds = useMemo(() => {
    const usesGrouping = (density === 'cards' || density === 'mini-cards') && groupByGroup;
    return getVisuallyOrderedPWAIds(selectableItems, usesGrouping);
  }, [selectableItems, density, groupByGroup]);

  const allSelectableSelected = useMemo(() => {
    return selectableItems.length > 0 && selectableItems.every((it) => selectedIds.has(it.id));
  }, [selectableItems, selectedIds]);

  // Today display string in full Portuguese without abbreviation ambiguities
  const todayDisplay = useMemo(() => {
    try {
      const formatted = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }).format(new Date());
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return todayStr;
    }
  }, [todayStr]);

  // Anti-double-click cooldown tracker to prevent duplicate window launches
  const launchCooldownRef = useRef<Map<string, number>>(new Map());

  const handleOpenEditModal = useCallback((item: PWAItem) => {
    setEditingItem(item);
    setIsAddEditOpen(true);
  }, []);

  const handleStartClone = useCallback((item: PWAItem) => {
    setCloningItem(item);
  }, []);

  const handleOpenHistoryModal = useCallback((item: PWAItem) => {
    setHistoryModalItem(item);
  }, []);

  const openUrlInBrowserWindow = useCallback((targetUrl: string, item: PWAItem): boolean => {
    if (!targetUrl) return false;
    const windowName = `pwa_${(item.id || item.name || 'app').replace(/[^a-zA-Z0-9]/g, '_')}`;

    let opened = window.open(
      targetUrl,
      windowName,
      getPopupWindowFeatures(PWA_WINDOW_WIDTH, PWA_WINDOW_HEIGHT)
    );

    if (!opened || opened.closed) {
      // Never pass 'noopener,noreferrer' in features: HTML spec makes window.open return null even on success
      opened = window.open(targetUrl, '_blank');
    }

    if (!opened || opened.closed) {
      setBlockedLaunchFallback({ name: item.name, url: targetUrl });
      setNoticeTone('warning');
      setNoticeMessage(
        `O navegador bloqueou a abertura automática da janela de "${item.name}". Clique em "Abrir ${item.name}" ao lado ou permita pop-ups para este site.`
      );
      return false;
    }

    setBlockedLaunchFallback(null);
    try {
      opened.opener = null;
    } catch {
      // Cross-origin opener assignment may be restricted
    }
    try {
      opened.resizeTo(PWA_WINDOW_WIDTH, PWA_WINDOW_HEIGHT);
      if (item.name && opened.document) {
        opened.document.title = item.name;
      }
      opened.focus?.();
    } catch {
      // Cross-origin popup resize/title may be restricted by browser
    }
    return true;
  }, []);

  // Launch PWA: opens link as a true standalone PWA window and automatically marks accessed today (GREEN indicator)
  const handleLaunch = useCallback(async (item: PWAItem) => {
    // Anti-double-click mechanism: prevent duplicate clicks on the same PWA within 1000ms without dropping clicks on other PWAs
    const nowMs = Date.now();
    const itemKey = item.id || item.appId || item.rawFileName || item.url || item.name;
    if (!tryAcquirePwaLaunchSlot(launchCooldownRef.current, itemKey, nowMs, PWA_SAME_ITEM_COOLDOWN_MS)) {
      return;
    }

    setBlockedLaunchFallback(null);

    // 1. Immediately update React state without blocking the click frame with synchronous JSON.stringify
    const now = new Date();
    const accessedSample = markAsAccessed(item, now, todayStr);
    const localTimeStr = accessedSample.lastAccessedDate || '';
    const launchUrl = normalizeLaunchUrl(item.url);

    setItems((prev) =>
      prev.map((it) => {
        if (!isSameOrMatchingPWA(it, item)) return it;
        const updated = markAsAccessed(it, now, todayStr);
        launchOnlyItemsRef.current.add(updated);
        return updated;
      })
    );

    // 2. If running remotely (Cloud Preview) OR native Chrome launch is unavailable on server,
    //    open synchronously inside the click handler so browser popup blockers don't drop it after `await fetch`.
    const isLocalHost =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(window.location.hostname);
    const shouldOpenInBrowserSync =
      !isLocalHost || serverCanLaunchNativeRef.current === false;

    if (shouldOpenInBrowserSync) {
      if (launchUrl) {
        openUrlInBrowserWindow(launchUrl, item);
      } else {
        setNoticeTone('warning');
        setNoticeMessage(
          `A PWA "${item.name}" não possui uma URL válida configurada para abrir no navegador.`
        );
      }
    }

    try {
      // 3. Native OS launch on local Ubuntu (or recordOnly in Cloud Preview)
      const res = await fetch('/api/launch-pwa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          id: item.id,
          name: item.name,
          clonedFromId: item.clonedFromId,
          url: launchUrl || item.url,
          rawFileName: item.rawFileName,
          appId: item.appId,
          profileDirectory: item.profileDirectory,
          execLine: item.execLine,
          desktopPath: item.desktopPath,
          todayStr,
          accessedAt: localTimeStr,
          recordOnly: !isLocalHost,
        }),
      });

      const data = await res.json();

      // Only reconcile React state if the server returned a different timestamp
      if (data.lastAccessedDate && data.lastAccessedDate !== localTimeStr) {
        setItems((prev) =>
          prev.map((it) => {
            if (!isSameOrMatchingPWA(it, item)) return it;
            const prevLogs = Array.isArray(it.accessLogs) ? it.accessLogs : [];
            const nextLogs = [
              data.lastAccessedDate,
              ...prevLogs.filter((l) => l !== data.lastAccessedDate),
            ].slice(0, 60);
            const prevHist = Array.isArray(it.accessHistory) ? it.accessHistory : [];
            const nextHist = [
              {
                timestamp: data.lastAccessedDate,
                source: 'hub' as const,
                profileDirectory: it.profileDirectory,
                visitedUrl: launchUrl || it.url,
              },
              ...prevHist.filter((h) => h && h.timestamp !== data.lastAccessedDate),
            ].slice(0, 80);
            const updated = {
              ...it,
              lastAccessedDate: data.lastAccessedDate,
              accessLogs: nextLogs,
              accessHistory: nextHist,
              accessCount: Math.max(it.accessCount || 0, 1),
            };
            launchOnlyItemsRef.current.add(updated);
            return updated;
          })
        );
      }

      if (isLocalHost && !shouldOpenInBrowserSync && !data.launchedNative) {
        serverCanLaunchNativeRef.current = false;
        const fallbackTarget = normalizeLaunchUrl(data.fallbackUrl) || launchUrl;
        if (fallbackTarget) {
          openUrlInBrowserWindow(fallbackTarget, item);
        } else {
          setNoticeTone('warning');
          setNoticeMessage(
            `Não foi possível abrir "${item.name}": nenhum navegador local ou URL válida encontrados.`
          );
        }
      }
    } catch {
      if (isLocalHost && !shouldOpenInBrowserSync) {
        if (launchUrl) {
          openUrlInBrowserWindow(launchUrl, item);
        } else {
          setNoticeTone('warning');
          setNoticeMessage(`Falha ao comunicar com o servidor local para abrir "${item.name}".`);
        }
      }
    }
  }, [openUrlInBrowserWindow, todayStr]);

  // Sync Chrome profile SQLite history for a single PWA inside AccessHistoryModal
  const handleSyncSingleProfileHistory = useCallback(
    async (item: PWAItem, profileOverride?: string) => {
      const targetProfile = profileOverride || item.profileDirectory || '';
      const execId = beginExecutionTask(`Histórico: ${item.name || 'PWA'}...`);
      try {
        const params = new URLSearchParams({
          pwaId: item.id,
          url: item.url,
          ...(targetProfile ? { profileDirectory: targetProfile } : {}),
        });
        const res = await fetch(`/api/pwas/profile-history?${params.toString()}`);
        if (!res.ok) {
          return {
            historyFound: false,
            chromeVisitsCount: 0,
            profileDirectory: targetProfile || 'Default',
            reason: 'Falha ao consultar servidor de histórico.',
          };
        }
        const data = await res.json();
        const chromeVisits = Array.isArray(data.visits) ? data.visits : [];

        setItems((prev) => {
          const next = prev.map((it) => {
            if (it.id !== item.id) return it;
            const merged = mergeAccessHistoryRecords(it, chromeVisits);
            return {
              ...it,
              lastAccessedDate: merged.lastAccessedDate,
              accessLogs: merged.accessLogs,
              accessHistory: merged.accessHistory,
              accessCount: Math.max(it.accessCount || 0, merged.accessHistory.length),
            };
          });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {}
          const updatedItem = next.find((it) => it.id === item.id);
          if (updatedItem && chromeVisits.length > 0) {
            fetch('/api/pwas/state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: [updatedItem] }),
            }).catch(() => {});
          }
          return next;
        });

        return {
          historyFound: Boolean(data.historyFound),
          chromeVisitsCount: Number(data.chromeVisitsCount || 0),
          profileDirectory: String(data.profileDirectory || targetProfile || 'Default'),
          reason: data.reason || null,
        };
      } catch {
        return {
          historyFound: false,
          chromeVisitsCount: 0,
          profileDirectory: targetProfile || 'Default',
          reason: 'Erro de conexão ao consultar histórico do perfil.',
        };
      } finally {
        endExecutionTask(execId);
      }
    },
    [beginExecutionTask, endExecutionTask]
  );

  // Clear local access history entries for a specific PWA
  const handleClearItemHistory = useCallback((item: PWAItem) => {
    const cleared: PWAItem = {
      ...item,
      lastAccessedDate: null,
      accessLogs: [],
      accessHistory: [],
      accessCount: 0,
    };
    setItems((prev) => {
      const next = prev.map((it) => (it.id === item.id ? cleared : it));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [cleared] }),
    }).catch(() => {});
  }, []);

  // Toggle status (green <-> red)
  const handleToggleStatus = useCallback((item: PWAItem) => {
    const updated = toggleAccessedToday(item, todayStr);
    setItems((prev) =>
      prev.map((it) => (isSameOrMatchingPWA(it, item) ? updated : it))
    );
    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [updated] }),
    }).catch(() => {});
  }, [todayStr]);

  // Update inline note
  const handleUpdateNote = useCallback((item: PWAItem, newNote: string) => {
    const updated = { ...item, notes: newNote };
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? updated : it))
    );
    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [updated] }),
    }).catch(() => {});
  }, []);

  // Toggle or set daily-resetting selection (COM, RB, BON -> optional green 'check' or red 'x') scoped to todayStr
  const handleToggleFlag = useCallback((item: PWAItem, flag: DailyFlagKey, state?: DailyFlagState | null) => {
    const updated = togglePWAFlag(item, flag, todayStr, state);
    setItems((prev) => {
      const next = prev.map((it) =>
        isSameOrMatchingPWA(it, item) ? togglePWAFlag(it, flag, todayStr, state) : it
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [updated] }),
    }).catch(() => {});
  }, [todayStr]);

  // Update persistent DD/MM date beside the green $ icon (never resets at midnight)
  const handleUpdateMoneyDate = useCallback((item: PWAItem, moneyDate: string) => {
    const updated = updatePWAMoneyDate(item, moneyDate);
    setItems((prev) => {
      const next = prev.map((it) =>
        isSameOrMatchingPWA(it, item) ? updatePWAMoneyDate(it, moneyDate) : it
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [updated] }),
    }).catch(() => {});
  }, []);

  const handleToggleFlagFilter = useCallback((flag: FlagFilterKey) => {
    setFlagFilters((prev) => {
      if (prev.includes(flag)) {
        return prev.filter((f) => f !== flag);
      }
      if (flag === 'moneyDate') {
        return [...prev, flag];
      }
      // Within the same daily flag (e.g. com, com:check, com:x), replace conflicting variants
      const baseFlag = flag.split(':')[0] as DailyFlagKey;
      const withoutSameGroup = prev.filter(
        (f) => f !== baseFlag && f !== `${baseFlag}:check` && f !== `${baseFlag}:x`
      );
      return [...withoutSameGroup, flag];
    });
  }, []);

  const handleClearFlagFilters = useCallback(() => {
    setFlagFilters([]);
  }, []);

  // Request confirmation before changing rating (0 to 5 stars)
  const handleSetRating = useCallback((item: PWAItem, newRating: number) => {
    const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
    if (currentRating === newRating) return;

    setPendingRatingChange({ item, newRating });
  }, []);

  // Confirm and apply the pending rating change - preserves scroll position
  const handleConfirmRatingChange = useCallback(() => {
    if (!pendingRatingChange) return;

    const { item, newRating } = pendingRatingChange;
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    const updated = {
      ...item,
      rating: newRating,
      pinned: newRating > 0,
    };

    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? updated : it))
    );

    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [updated] }),
    }).catch(() => {});

    setPendingRatingChange(null);

    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });
    });
  }, [pendingRatingChange]);

  // Toggle pin / rating (toggles between 5 stars and 0) with confirmation
  const handleTogglePin = useCallback((item: PWAItem) => {
    const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
    const nextRating = currentRating > 0 ? 0 : 5;
    setPendingRatingChange({ item, newRating: nextRating });
  }, []);

  // Open in-app confirmation modal to delete a single PWA
  const handleDelete = useCallback((id: string) => {
    if (!id) return;
    setPendingDeleteIds([id]);
  }, []);

  // Apply confirmed single or batch deletion safely
  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteIds || pendingDeleteIds.length === 0) {
      setPendingDeleteIds(null);
      return;
    }

    const idsToDelete = [...pendingDeleteIds];
    const deleteSet = new Set(idsToDelete);

    setItems((prev) => {
      const next = prev.filter((it) => !deleteSet.has(it.id));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      idsToDelete.forEach((id) => next.delete(id));
      return next;
    });

    setPendingDeleteIds(null);

    fetch('/api/pwas/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsToDelete }),
    }).catch((err) => console.warn('Erro ao persistir exclusão no servidor:', err));
  }, [pendingDeleteIds]);

  // Request confirmation to remove duplicate PWAs within the exact same Chrome profile
  const handleRequestRemoveSameProfileDuplicates = useCallback(
    (targetIds?: Set<string>) => {
      const plan =
        targetIds && targetIds.size > 0
          ? findSameProfileDuplicateGroups(cleanItems, targetIds)
          : sameProfileDedupePlan;

      if (plan.totalDuplicates === 0) {
        setNoticeTone('warning');
        setNoticeMessage(
          'Nenhuma PWA duplicada encontrada dentro do mesmo perfil do Chrome.'
        );
        return;
      }

      setPendingDedupePlan(plan);
    },
    [cleanItems, sameProfileDedupePlan]
  );

  // Confirm and apply same-profile deduplication, merging metadata onto each kept card
  const handleConfirmRemoveSameProfileDuplicates = useCallback(() => {
    if (!pendingDedupePlan || pendingDedupePlan.totalDuplicates === 0) {
      setPendingDedupePlan(null);
      return;
    }

    const previewParticipantIds = new Set<string>();
    for (const grp of pendingDedupePlan.groups) {
      previewParticipantIds.add(grp.keeper.id);
      grp.duplicates.forEach((dup) => previewParticipantIds.add(dup.id));
    }

    const result = removeSameProfileDuplicates(itemsRef.current, previewParticipantIds);
    const removedIds = Array.from(result.plan.duplicateIds);

    if (removedIds.length === 0) {
      setPendingDedupePlan(null);
      return;
    }

    setItems(result.items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.items));
    } catch {}

    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      removedIds.forEach((id) => next.delete(id));
      return next;
    });

    setPendingDedupePlan(null);
    setNoticeTone('success');
    setNoticeMessage(
      `${removedIds.length} duplicada${removedIds.length > 1 ? 's' : ''} do mesmo perfil removida${removedIds.length > 1 ? 's' : ''} e dados consolidados no card mantido.`
    );

    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: result.plan.updatedKeepers,
        deletedIds: removedIds,
      }),
    }).catch((err) => console.warn('Erro ao persistir remoção de duplicadas no servidor:', err));
  }, [pendingDedupePlan, setSelectedIds]);

  // Save new or edited PWA
  const handleSavePWA = useCallback((data: Partial<PWAItem> & { name: string; url: string; category: string; group?: string; folderId?: string | null; notes: string }) => {
    const incomingCacheBust = typeof data.icon === 'string' && data.icon.includes('v=');
    const baseIcon =
      data.icon && !data.icon.includes('/api/icon')
        ? data.icon
        : resolveFaviconAtInsertion(data.url, undefined, data.name);
    const finalIcon =
      incomingCacheBust && data.icon && data.icon.includes('/api/icon')
        ? appendCacheBuster(baseIcon, Date.now())
        : baseIcon;
    const grp = data.group || data.category || 'Geral';
    const nextFolderId = data.folderId !== undefined ? data.folderId : null;

    // Trigger background icon pre-warming resolution endpoint so the server immediately fetches & caches authentic logo
    if (data.url || data.name) {
      void runIconResolveQueue([{ url: data.url, name: data.name }]);
    }

    if (data.id) {
      // Edit
      setItems((prev) => {
        const updatedList = prev.map((it) => {
          if (it.id !== data.id) return it;
          const draft: PWAItem = {
            ...it,
            ...data,
            group: grp,
            category: grp,
            folderId: nextFolderId,
            icon: finalIcon,
          };
          return 'profileDirectory' in data
            ? sanitizeLauncherMetadataForProfile(draft, data.profileDirectory).item
            : draft;
        });
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: updatedList }),
        }).catch(() => {});
        return updatedList;
      });
    } else {
      // Add
      const initialRating = typeof data.rating === 'number' ? data.rating : (data.pinned ? 5 : 0);
      const newItem: PWAItem = {
        id: `pwa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: data.name,
        url: data.url,
        category: grp,
        group: grp,
        folderId: nextFolderId,
        notes: data.notes,
        icon: finalIcon,
        profileDirectory: data.profileDirectory,
        aliases: data.aliases,
        pinned: initialRating > 0,
        rating: initialRating,
        lastAccessedDate: null,
        accessCount: 0,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => {
        const nextList = ensureUniquePWAIds([newItem, ...prev]);
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: nextList }),
        }).catch(() => {});
        return nextList;
      });
    }
  }, []);

  // Clone PWA with a different Chrome browser profile
  const handleClonePWA = useCallback((
    source: PWAItem,
    options: {
      profileDirectory: string;
      name: string;
      copyNotesAndFlags: boolean;
      keepFolderAndGroup: boolean;
    }
  ) => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((it) => it.id));
      const cloned = clonePWAForProfile(source, { ...options, existingIds });
      const idx = prev.findIndex((it) => it.id === source.id);
      const nextList = ensureUniquePWAIds(
        idx >= 0
          ? [...prev.slice(0, idx + 1), cloned, ...prev.slice(idx + 1)]
          : [cloned, ...prev]
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
      } catch {}
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [cloned] }),
      }).catch(() => {});
      return nextList;
    });
  }, []);

  // Card selection handlers (supports plain card click, Ctrl/Cmd toggle, and Shift range)
  const handleCardSelect = useCallback(
    (id: string, modifiers: CardSelectModifiers = {}) => {
      setSelectionState((prev) => {
        const result = computeCardSelection(
          prev.ids,
          prev.lastId,
          id,
          orderedSelectableIds,
          modifiers
        );
        return { ids: result.selectedIds, lastId: result.lastSelectedId };
      });
    },
    [orderedSelectableIds]
  );

  const handleToggleSelect = useCallback(
    (id: string) => {
      handleCardSelect(id, { fromCheckbox: true });
    },
    [handleCardSelect]
  );

  const handleToggleSelectAll = useCallback(() => {
    setSelectionState((prev) => {
      const visibleIds = orderedSelectableIds;
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.ids.has(id));
      if (allSelected) {
        return { ids: new Set(), lastId: null };
      }
      return {
        ids: new Set(visibleIds),
        lastId: visibleIds.length > 0 ? visibleIds[visibleIds.length - 1] : null,
      };
    });
  }, [orderedSelectableIds]);

  const handleDeselectAll = useCallback(() => {
    setSelectionState({ ids: new Set(), lastId: null });
  }, []);

  // Helper to resolve target IDs for bulk actions: selected items if any, otherwise scoped visible items
  const getBulkTargetIds = useCallback(() => {
    if (selectedIds.size > 0) return selectedIds;
    return new Set(selectableItems.map((it) => it.id));
  }, [selectedIds, selectableItems]);

  // Batch set daily status ('accessed' | 'pending' | 'toggle')
  const handleBatchSetStatus = useCallback((mode: 'accessed' | 'pending' | 'toggle') => {
    const targetIds = getBulkTargetIds();
    if (targetIds.size === 0) return;

    const now = new Date();
    setItems((prev) => {
      const next = batchSetStatus(prev, targetIds, mode, now, todayStr);
      const changed = next.filter((it) => targetIds.has(it.id));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (changed.length > 0) {
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: changed }),
        }).catch(() => {});
      }
      return next;
    });
  }, [getBulkTargetIds, todayStr]);

  // Batch set star rating (0 clears all stars, 1..5 sets stars)
  const handleBatchSetRating = useCallback((rating: number) => {
    const targetIds = getBulkTargetIds();
    if (targetIds.size === 0) return;

    setItems((prev) => {
      const next = batchSetRating(prev, targetIds, rating);
      const changed = next.filter((it) => targetIds.has(it.id));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (changed.length > 0) {
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: changed }),
        }).catch(() => {});
      }
      return next;
    });
  }, [getBulkTargetIds]);

  // Batch set or clear daily flag (COM, RB, BON -> 'check', 'x', or null)
  const handleBatchSetDailyFlag = useCallback((flag: DailyFlagKey, activeOrState: boolean | DailyFlagState | null) => {
    const targetIds = getBulkTargetIds();
    if (targetIds.size === 0) return;

    setItems((prev) => {
      const next = batchSetDailyFlag(prev, targetIds, flag, activeOrState, todayStr);
      const changed = next.filter((it) => targetIds.has(it.id));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (changed.length > 0) {
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: changed }),
        }).catch(() => {});
      }
      return next;
    });
  }, [getBulkTargetIds, todayStr]);

  // Batch clear flags (daily flags and/or moneyDate)
  const handleBatchClearFlags = useCallback((options: { clearDaily?: boolean; clearMoneyDate?: boolean } = { clearDaily: true, clearMoneyDate: false }) => {
    const targetIds = getBulkTargetIds();
    if (targetIds.size === 0) return;

    setItems((prev) => {
      const next = batchClearFlags(prev, targetIds, options);
      const changed = next.filter((it) => targetIds.has(it.id));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (changed.length > 0) {
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: changed }),
        }).catch(() => {});
      }
      return next;
    });
  }, [getBulkTargetIds]);

  // Batch refresh icons for targeted PWAs
  const handleBatchRefreshIcons = useCallback(() => {
    const targetIds = getBulkTargetIds();
    if (targetIds.size === 0) return;
    const bust = Date.now();

    setItems((prev) => {
      const next = prev.map((it) => {
        if (!targetIds.has(it.id)) return it;
        const repaired = repairAndSanitizePWA(it);
        const baseIcon = resolveFaviconAtInsertion(repaired.url, undefined, repaired.name);
        return {
          ...repaired,
          icon: baseIcon ? appendCacheBuster(baseIcon, bust) : baseIcon,
        };
      });
      const changed = next.filter((it) => targetIds.has(it.id));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      if (changed.length > 0) {
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: changed }),
        }).catch(() => {});
      }
      return next;
    });

    const queueTargets = itemsRef.current
      .filter((it) => targetIds.has(it.id))
      .map(repairAndSanitizePWA)
      .filter((it) => Boolean(it.url))
      .map((it) => ({ url: it.url, name: it.name }));

    if (queueTargets.length > 0) {
      void runIconResolveQueue(queueTargets);
    }
  }, [getBulkTargetIds, runIconResolveQueue]);

  // Open BatchEditModal for selected PWAs or all scoped visible PWAs
  const handleBulkOpenEdit = useCallback(() => {
    const targetIds = getBulkTargetIds();
    if (targetIds.size === 0) return;
    if (selectedIds.size === 0) {
      setSelectedIds(new Set(targetIds));
    }
    setIsBatchEditOpen(true);
  }, [getBulkTargetIds, selectedIds.size]);

  // Open in-app confirmation modal for batch deleting selected or scoped visible items
  const handleBatchDelete = useCallback(() => {
    const targetIds = getBulkTargetIds();
    if (targetIds.size === 0) return;
    setPendingDeleteIds(Array.from(targetIds));
  }, [getBulkTargetIds]);

  // Batch edit apply
  const handleApplyBatchEdit = useCallback((changes: {
    group?: string;
    folderId?: string | null;
    rating?: number;
    notes?: string;
    notesMode?: 'append' | 'replace';
  }) => {
    if (selectedIds.size === 0) return;

    setItems((prev) => {
      const updatedList: PWAItem[] = [];
      const next = prev.map((it) => {
        if (!selectedIds.has(it.id)) return it;

        let newNotes = it.notes;
        if (typeof changes.notes === 'string' && changes.notes.length > 0) {
          if (changes.notesMode === 'replace') {
            newNotes = changes.notes;
          } else {
            newNotes = it.notes ? `${it.notes} · ${changes.notes}` : changes.notes;
          }
        }

        const grp = changes.group ? changes.group.trim() : (it.group || it.category || 'Geral');

        const updated: PWAItem = {
          ...it,
          group: grp,
          category: grp,
          ...(changes.folderId !== undefined ? { folderId: changes.folderId } : {}),
          ...(typeof changes.rating === 'number' ? { rating: changes.rating, pinned: changes.rating > 0 } : {}),
          ...(typeof changes.notes === 'string' ? { notes: newNotes } : {}),
        };

        updatedList.push(updated);
        return updated;
      });

      if (updatedList.length > 0) {
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: updatedList }),
        }).catch(() => {});
      }

      return next;
    });

    setSelectedIds(new Set());
  }, [selectedIds]);

  // Batch reassign group for selected PWAs
  const handleBatchAssignGroup = useCallback((targetGroupName: string) => {
    if (selectedIds.size === 0 || !targetGroupName) return;

    setItems((prev) => {
      const updatedList: PWAItem[] = [];
      const next = prev.map((it) => {
        if (!selectedIds.has(it.id)) return it;
        const updated: PWAItem = {
          ...it,
          group: targetGroupName,
          category: targetGroupName,
        };
        updatedList.push(updated);
        return updated;
      });

      if (updatedList.length > 0) {
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: updatedList }),
        }).catch(() => {});
      }

      return next;
    });

    setSelectedIds(new Set());
  }, [selectedIds]);

  // Folder organization handlers
  const handleMovePWAsToFolder = useCallback((pwaIds: string[], targetFolderId: string | null) => {
    if (!pwaIds || pwaIds.length === 0) return;
    setItems((prev) => {
      const next = assignPWAsToFolder(prev, pwaIds, targetFolderId);
      const changed = next.filter((it) => pwaIds.includes(it.id));
      if (changed.length > 0) {
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: changed }),
        }).catch(() => {});
      }
      return next;
    });
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      pwaIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const handleCreateFolder = useCallback((name: string, color: string, parentId: string | null) => {
    setFolders((prev) => {
      const { folders: nextFolders } = createFolder(prev, { name, color, parentId });
      saveFolders(nextFolders);
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders: nextFolders }),
      }).catch(() => {});
      return nextFolders;
    });
  }, []);

  const handleRenameFolder = useCallback((folderId: string, newName: string, newColor: string) => {
    setFolders((prev) => {
      const nextFolders = renameFolder(prev, folderId, newName, newColor);
      saveFolders(nextFolders);
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folders: nextFolders }),
      }).catch(() => {});
      return nextFolders;
    });
  }, []);

  const handleDeleteFolder = useCallback((folderId: string) => {
    const deletedFolder = folders.find((f) => f.id === folderId);
    const parentTarget = deletedFolder?.parentId || null;

    const { folders: nextFolders, items: nextItems } = deleteFolderSafe(folders, items, folderId);
    setFolders(nextFolders);
    setItems(nextItems);
    saveFolders(nextFolders);

    if (selectedFolder === folderId) {
      setSelectedFolder('all');
    }
    if (currentExplorerFolderId === folderId) {
      setCurrentExplorerFolderId(parentTarget);
    }

    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folders: nextFolders, items: nextItems }),
    }).catch(() => {});
  }, [folders, items, selectedFolder, currentExplorerFolderId]);

  const handleCreateAndAssignFolder = useCallback((folderName: string) => {
    if (selectedIds.size === 0 || !folderName.trim()) return;
    const parentId = density === 'folders' ? currentExplorerFolderId : null;
    const { folders: nextFolders, folder: created } = createFolder(folders, {
      name: folderName,
      color: 'emerald',
      parentId,
    });
    setFolders(nextFolders);
    saveFolders(nextFolders);

    const idsToMove = Array.from(selectedIds);
    const nextItems = assignPWAsToFolder(items, idsToMove, created.id);
    setItems(nextItems);
    setSelectedIds(new Set());

    const changedItems = nextItems.filter((it) => idsToMove.includes(it.id));
    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folders: nextFolders, items: changedItems }),
    }).catch(() => {});
  }, [selectedIds, density, currentExplorerFolderId, folders, items]);

  // Batch extract URLs to Markdown (.md)
  const handleBatchExtractUrls = useCallback(() => {
    if (selectedIds.size === 0) return;
    extractPWAsToMarkdown(items, selectedIds, discoveredChromeProfiles);
  }, [items, selectedIds, discoveredChromeProfiles]);

  // Group manager actions
  const handleRenameGroup = useCallback((oldName: string, newName: string, colorKey: string) => {
    setItems((prev) =>
      prev.map((it) => {
        const currentGrp = it.group || it.category || 'Geral';
        if (currentGrp === oldName) {
          return {
            ...it,
            group: newName,
            category: newName,
          };
        }
        return it;
      })
    );

    setGroupColors((prev) => {
      const copy = { ...prev };
      delete copy[oldName];
      copy[newName] = colorKey;
      return copy;
    });

    if (selectedGroup === oldName) {
      setSelectedGroup(newName);
    }
  }, [selectedGroup]);

  const handleUpdateGroupColor = useCallback((groupName: string, colorKey: string) => {
    setGroupColors((prev) => ({
      ...prev,
      [groupName]: colorKey,
    }));
  }, []);

  const handleAddGroup = useCallback((name: string, colorKey: string) => {
    setGroupColors((prev) => ({
      ...prev,
      [name]: colorKey,
    }));
  }, []);

  const handleDeleteGroup = useCallback((groupName: string) => {
    setItems((prev) =>
      prev.map((it) => {
        const currentGrp = it.group || it.category || 'Geral';
        if (currentGrp === groupName) {
          return {
            ...it,
            group: 'Geral',
            category: 'Geral',
          };
        }
        return it;
      })
    );

    setGroupColors((prev) => {
      const copy = { ...prev };
      delete copy[groupName];
      return copy;
    });

    if (selectedGroup === groupName) {
      setSelectedGroup('all');
    }
  }, [selectedGroup]);

  // Toggle group by group layout
  const handleToggleGroupByGroup = useCallback(() => {
    setGroupByGroup((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GROUP_BY_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  // Batch refresh icons for all PWAs based on their URLs and names
  const handleRefreshAllIcons = useCallback(() => {
    const bust = Date.now();
    const queueTargets = itemsRef.current
      .map(repairAndSanitizePWA)
      .filter((it) => Boolean(it.url))
      .map((it) => ({ url: it.url, name: it.name }));

    setItems((prev) => {
      const refreshed = prev.map((it) => {
        const repaired = repairAndSanitizePWA(it);
        const baseIcon = resolveFaviconAtInsertion(repaired.url, undefined, repaired.name);
        return {
          ...repaired,
          icon: baseIcon ? appendCacheBuster(baseIcon, bust) : baseIcon,
        };
      });
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: refreshed }),
      }).catch(() => {});
      return refreshed;
    });

    if (queueTargets.length > 0) {
      void runIconResolveQueue(queueTargets);
    }
  }, [runIconResolveQueue]);

  // Refresh icon for a single PWA
  const handleRefreshSingleIcon = useCallback((item: PWAItem) => {
    const bust = Date.now();
    const repairedTarget = repairAndSanitizePWA(item);

    setItems((prev) => {
      const updatedList = prev.map((it) => {
        if (it.id === item.id) {
          const repaired = repairAndSanitizePWA(it);
          const baseIcon = resolveFaviconAtInsertion(repaired.url, undefined, repaired.name);
          return {
            ...repaired,
            icon: baseIcon ? appendCacheBuster(baseIcon, bust) : baseIcon,
          };
        }
        return it;
      });
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedList }),
      }).catch(() => {});
      return updatedList;
    });

    if (repairedTarget.url) {
      void runIconResolveQueue([{ url: repairedTarget.url, name: repairedTarget.name }]);
    }
  }, [runIconResolveQueue]);

  // Save custom image upload for a single PWA icon
  const handleSaveCustomIcon = useCallback((item: PWAItem, iconDataUrl: string) => {
    setItems((prev) => {
      const updatedList = prev.map((it) => {
        if (it.id === item.id) {
          return {
            ...it,
            icon: iconDataUrl,
          };
        }
        return it;
      });
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updatedList }),
      }).catch(() => {});
      return updatedList;
    });
  }, []);

  // Batch mark all today as accessed
  const handleMarkAllToday = useCallback(() => {
    setItems((prev) =>
      prev.map((it) => markAsAccessed(it, new Date(), todayStr))
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

  // Clear all items (0 PWAs default state)
  const handleClearAll = useCallback(() => {
    setItems([]);
    setSelectedIds(new Set());
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch {
      // ignore
    }
    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [], replaceAll: true }),
    }).catch(() => {});
  }, []);

  // Import JSON items
  const handleImport = useCallback((newItems: PWAItem[], mode: 'replace' | 'merge') => {
    const validNew = ensureUniquePWAIds(newItems.filter((i) => !isAndroidOrRedroidApp(i)));
    if (mode === 'replace') {
      setItems(validNew);
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validNew, replaceAll: true, allowRestore: true }),
      }).catch(() => {});
    } else {
      setItems((prev) => {
        const cleanPrev = prev.filter((p) => !isAndroidOrRedroidApp(p));
        const nonDuplicate = filterNonDuplicateImportedPWAs(cleanPrev, validNew, 'json');
        const nextList = ensureUniquePWAIds([...cleanPrev, ...nonDuplicate]);
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: nextList }),
        }).catch(() => {});
        return nextList;
      });
    }
  }, []);

  const topBarActivityStatus: TopBarActivityStatus = useMemo(() => {
    const currentExecTask = executionTasks[executionTasks.length - 1];
    const isExecuting =
      executionTasks.length > 0 || isSyncingHistory || serverActivity.executing;
    const executingLabel =
      currentExecTask?.label ||
      (isSyncingHistory ? 'Sincronizando histórico...' : null) ||
      serverActivity.executingLabel ||
      null;

    const isUpdatingIcons =
      iconRefreshState.active || serverActivity.updatingIcons;
    const iconsLabel = iconRefreshState.active
      ? iconRefreshState.total > 1
        ? `Íc. ${iconRefreshState.completed}/${iconRefreshState.total}`
        : 'Ícone...'
      : serverActivity.updatingIcons
        ? serverActivity.updatingIconsCount > 1
          ? `Íc. (${serverActivity.updatingIconsCount})`
          : 'Ícone...'
        : null;

    const isRunningScript = serverActivity.runningScript;
    const scriptLabel = serverActivity.runningScriptLabel || null;

    return {
      isExecuting,
      executingLabel,
      isUpdatingIcons,
      iconsLabel,
      isRunningScript,
      scriptLabel,
    };
  }, [executionTasks, isSyncingHistory, iconRefreshState, serverActivity]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300 relative">
      {/* Drag & Drop Visual Overlay for Ubuntu .desktop files */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-emerald-950/80 backdrop-blur-xs border-4 border-dashed border-emerald-400 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
          <FolderUp className="w-16 h-16 text-emerald-400 mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-white mb-2">
            Solte seus atalhos .desktop ou arquivo .md aqui
          </h2>
          <p className="text-sm text-emerald-200 max-w-md">
            Arquivos <code className="font-mono">.desktop</code> cadastram PWAs e arquivos <code className="font-mono">.md</code> exportados atualizam somente o status (Acesso: Sim/Não).
          </p>
        </div>
      )}

      {/* Unified Sticky Top Header & Control Toolbar */}
      <div
        data-testid="sticky-hub-header"
        className="sticky top-0 z-30 bg-[#0d0e12]/95 backdrop-blur-md border-b border-[#242633] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.85)]"
      >
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
          onOpenAutostartModal={() => setIsAutostartOpen(true)}
          onMarkAllToday={handleMarkAllToday}
          onResetToday={handleResetToday}
          onRefreshAllIcons={handleRefreshAllIcons}
          onRescanLocalPWAs={handleRescanLocalPWAs}
          onSyncProfileHistory={() => void syncAllProfilesHistory()}
          onSelectMarkdownStatusFile={(file) => void handleSelectMarkdownStatusFile(file)}
          onRemoveSameProfileDuplicates={() => handleRequestRemoveSameProfileDuplicates()}
          sameProfileDuplicatesCount={sameProfileDedupePlan.totalDuplicates}
          isSyncingHistory={isSyncingHistory}
          activityStatus={topBarActivityStatus}
        />

        {items.length > 0 && (
          <div className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-1.5 border-t border-[#242633]/60">
            <ControlToolbar
              search={search}
              onSearchChange={setSearch}
              selectedGroup={selectedGroup}
              onGroupChange={setSelectedGroup}
              groups={groups}
              groupConfigs={groupConfigs}
              groupColors={groupColors}
              onOpenGroupManager={() => setIsGroupManagerOpen(true)}
              folders={folders}
              selectedFolder={density === 'folders' ? (currentExplorerFolderId || 'all') : selectedFolder}
              onFolderChange={(folderId) => {
                if (density === 'folders') {
                  if (folderId === 'unfiled') {
                    setSelectedFolder('unfiled');
                    handleDensityChange('cards');
                  } else {
                    setCurrentExplorerFolderId(folderId === 'all' ? null : folderId);
                  }
                } else {
                  setSelectedFolder(folderId);
                }
              }}
              onOpenFolderManager={() => {
                setFolderManagerParentId(density === 'folders' ? currentExplorerFolderId : null);
                setIsFolderManagerOpen(true);
              }}
              onDropPwaOnFolder={handleMovePWAsToFolder}
              unfiledCount={unfiledCount}
              folderItemCounts={folderItemCounts}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              starFilter={starFilter}
              onStarFilterChange={setStarFilter}
              profileFilter={profileFilter}
              onProfileFilterChange={setProfileFilter}
              profileSummary={chromeProfileSummary}
              flagFilters={flagFilters}
              flagCounts={flagCounts}
              flagBreakdown={flagBreakdown}
              onToggleFlagFilter={handleToggleFlagFilter}
              onClearFlagFilters={handleClearFlagFilters}
              timeWindow={timeWindow}
              onTimeWindowChange={setTimeWindow}
              timeWindowMatchCount={timeWindowMatchCount}
              density={density}
              onDensityChange={handleDensityChange}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              totalCount={cleanItems.length}
              pendingCount={stats.pendingTodayCount}
              accessedCount={stats.accessedTodayCount}
              groupByGroup={groupByGroup}
              onToggleGroupByGroup={handleToggleGroupByGroup}
              selectableCount={selectableItems.length}
              selectedCount={selectedIds.size}
              allSelected={allSelectableSelected}
              onToggleSelectAll={handleToggleSelectAll}
              onDeselectAll={handleDeselectAll}
              onBulkSetRating={handleBatchSetRating}
              onBulkSetStatus={(mode) => handleBatchSetStatus(mode)}
              onBulkSetDailyFlag={handleBatchSetDailyFlag}
              onBulkClearFlags={() => handleBatchClearFlags({ clearDaily: true, clearMoneyDate: false })}
              onBulkRefreshIcons={handleBatchRefreshIcons}
              onBulkOpenEdit={handleBulkOpenEdit}
              onBulkRemoveDuplicates={() => handleRequestRemoveSameProfileDuplicates(getBulkTargetIds())}
              sameProfileDuplicatesCount={sameProfileDedupePlan.totalDuplicates}
              onBulkDelete={handleBatchDelete}
            />
          </div>
        )}
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-3 flex flex-col">
        {noticeMessage && (
          <div
            data-testid="hub-notice-banner"
            className={`mb-3 px-3.5 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 flex-wrap ${
              noticeTone === 'success'
                ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-200'
                : 'bg-amber-950/70 border-amber-800/70 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {noticeTone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{noticeMessage}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {blockedLaunchFallback && (
                <a
                  href={blockedLaunchFallback.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="blocked-launch-fallback-link"
                  onClick={() => {
                    setBlockedLaunchFallback(null);
                    setNoticeMessage(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir {blockedLaunchFallback.name}</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setNoticeMessage(null);
                  setBlockedLaunchFallback(null);
                }}
                aria-label="Fechar aviso"
                className={`p-1 rounded cursor-pointer ${
                  noticeTone === 'success'
                    ? 'hover:bg-emerald-900/60 text-emerald-300'
                    : 'hover:bg-amber-900/60 text-amber-300'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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
            {/* View Render */}
            <div className="flex-1">
              {density === 'folders' && (
                <FolderView
                  allItems={cleanItems}
                  filteredItems={displayedItems}
                  folders={folders}
                  currentFolderId={currentExplorerFolderId}
                  onNavigateFolder={setCurrentExplorerFolderId}
                  todayStr={todayStr}
                  groupConfigs={groupConfigs}
                  groupColors={groupColors}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectCard={handleCardSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                  onLaunch={handleLaunch}
                  onToggleStatus={handleToggleStatus}
                  onUpdateNote={handleUpdateNote}
                  onToggleFlag={handleToggleFlag}
                  onUpdateMoneyDate={handleUpdateMoneyDate}
                  onTogglePin={handleTogglePin}
                  onSetRating={handleSetRating}
                  onEdit={handleOpenEditModal}
                  onClone={handleStartClone}
                  onDelete={handleDelete}
                  onRefreshIcon={handleRefreshSingleIcon}
                  onSaveCustomIcon={handleSaveCustomIcon}
                  onMoveToFolder={handleMovePWAsToFolder}
                  onCreateFolder={handleCreateFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onOpenFolderManager={(parentId) => {
                    setFolderManagerParentId(parentId ?? null);
                    setIsFolderManagerOpen(true);
                  }}
                  onOpenQuickAssign={(folderId) => setQuickAssignTargetFolderId(folderId)}
                  onViewHistory={handleOpenHistoryModal}
                />
              )}

              {density === 'compact-table' && (
                <CompactTableView
                  items={displayedItems}
                  todayStr={todayStr}
                  folders={folders}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectCard={handleCardSelect}
                  onLaunch={handleLaunch}
                  onToggleStatus={handleToggleStatus}
                  onUpdateNote={handleUpdateNote}
                  onToggleFlag={handleToggleFlag}
                  onUpdateMoneyDate={handleUpdateMoneyDate}
                  onTogglePin={handleTogglePin}
                  onSetRating={handleSetRating}
                  onEdit={handleOpenEditModal}
                  onClone={handleStartClone}
                  onViewHistory={handleOpenHistoryModal}
                  onDelete={handleDelete}
                />
              )}

              {density === 'dense-grid' && (
                <DenseGridView
                  items={displayedItems}
                  todayStr={todayStr}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectCard={handleCardSelect}
                  onLaunch={handleLaunch}
                  onToggleStatus={handleToggleStatus}
                  onUpdateNote={handleUpdateNote}
                  onToggleFlag={handleToggleFlag}
                  onUpdateMoneyDate={handleUpdateMoneyDate}
                  onTogglePin={handleTogglePin}
                  onSetRating={handleSetRating}
                  onEdit={handleOpenEditModal}
                  onClone={handleStartClone}
                  onDelete={handleDelete}
                />
              )}

              {density === 'mini-cards' && (
                <MiniCardsView
                  items={displayedItems}
                  todayStr={todayStr}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectCard={handleCardSelect}
                  onLaunch={handleLaunch}
                  groupByGroup={groupByGroup}
                />
              )}

              {density === 'cards' && (
                <CardsView
                  items={displayedItems}
                  todayStr={todayStr}
                  folders={folders}
                  groupConfigs={groupConfigs}
                  groupColors={groupColors}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onSelectCard={handleCardSelect}
                  onLaunch={handleLaunch}
                  onToggleStatus={handleToggleStatus}
                  onUpdateNote={handleUpdateNote}
                  onToggleFlag={handleToggleFlag}
                  onUpdateMoneyDate={handleUpdateMoneyDate}
                  onTogglePin={handleTogglePin}
                  onSetRating={handleSetRating}
                  onEdit={handleOpenEditModal}
                  onClone={handleStartClone}
                  onDelete={handleDelete}
                  onRefreshIcon={handleRefreshSingleIcon}
                  onSaveCustomIcon={handleSaveCustomIcon}
                  onMoveToFolder={handleMovePWAsToFolder}
                  onViewHistory={handleOpenHistoryModal}
                  groupByGroup={groupByGroup}
                />
              )}
            </div>

            {/* Footer Counter (Página Única Sem Paginação) */}
            <footer className="mt-6 pt-4 border-t border-[#242633] flex flex-wrap items-center justify-between text-xs text-neutral-400 font-mono">
              <span>
                Exibindo todas as <strong className="text-white">{displayedItems.length}</strong> PWAs de <strong className="text-white">{items.length}</strong> cadastradas
              </span>
              <span className="text-neutral-500">
                Dica Ubuntu: Você pode selecionar ou arrastar arquivos <code className="text-neutral-400 font-mono">.desktop</code> de <code className="text-neutral-400 font-mono">~/.local/share/applications</code> direto para o Hub.
              </span>
            </footer>
          </>
        )}
      </main>

      {/* Floating Batch Actions Bar (Tarefas em Lote) */}
      <BatchActionsBar
        selectedCount={selectedIds.size}
        totalCount={selectableItems.length}
        allSelected={allSelectableSelected}
        onToggleSelectAll={handleToggleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBatchSetStatus={handleBatchSetStatus}
        onBatchSetRating={handleBatchSetRating}
        onBatchSetDailyFlag={handleBatchSetDailyFlag}
        onBatchClearFlags={handleBatchClearFlags}
        onBatchRefreshIcons={handleBatchRefreshIcons}
        onBatchAssignGroup={handleBatchAssignGroup}
        onBatchAssignFolder={(folderId) => handleMovePWAsToFolder(Array.from(selectedIds), folderId)}
        onCreateAndAssignFolder={handleCreateAndAssignFolder}
        onBatchExtractUrls={handleBatchExtractUrls}
        onBatchEdit={() => setIsBatchEditOpen(true)}
        onBatchDelete={handleBatchDelete}
        existingGroups={groups}
        folders={folders}
      />

      {/* Batch Edit Modal */}
      <BatchEditModal
        isOpen={isBatchEditOpen}
        onClose={() => setIsBatchEditOpen(false)}
        selectedCount={selectedIds.size}
        existingGroups={groups}
        folders={folders}
        onApply={handleApplyBatchEdit}
      />

      {/* Add / Edit Modal (Manual Entry) */}
      <AddEditPWAModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSavePWA}
        editingItem={editingItem}
        existingGroups={groups}
        folders={folders}
        defaultFolderId={
          density === 'folders'
            ? currentExplorerFolderId
            : selectedFolder !== 'all' && selectedFolder !== 'unfiled'
            ? selectedFolder
            : null
        }
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
        existingCategories={groups}
      />

      {/* Backup & Import Modal */}
      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        items={items}
        onImport={handleImport}
        onImportMarkdownStatus={handleImportMarkdownStatus}
        onClearAll={handleClearAll}
      />

      {/* GitHub Update Modal */}
      <GitHubUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      {/* Ubuntu Autostart Modal */}
      <AutostartModal
        isOpen={isAutostartOpen}
        onClose={() => setIsAutostartOpen(false)}
      />

      {/* Group Manager Modal */}
      <GroupManagerModal
        isOpen={isGroupManagerOpen}
        onClose={() => setIsGroupManagerOpen(false)}
        groups={groups}
        groupColors={groupColors}
        onRenameGroup={handleRenameGroup}
        onUpdateGroupColor={handleUpdateGroupColor}
        onAddGroup={handleAddGroup}
        onDeleteGroup={handleDeleteGroup}
      />

      {/* Folder Manager Modal */}
      <FolderManagerModal
        isOpen={isFolderManagerOpen}
        onClose={() => setIsFolderManagerOpen(false)}
        folders={folders}
        items={cleanItems}
        todayStr={todayStr}
        initialParentId={folderManagerParentId}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onOpenQuickAssign={(folderId) => setQuickAssignTargetFolderId(folderId)}
      />

      {/* Quick Assign PWAs to Folder Modal */}
      <QuickAssignFolderModal
        isOpen={quickAssignTargetFolderId !== null}
        onClose={() => setQuickAssignTargetFolderId(null)}
        targetFolder={folders.find((f) => f.id === quickAssignTargetFolderId) || null}
        allFolders={folders}
        items={cleanItems}
        onAssignPWAs={handleMovePWAsToFolder}
      />

      {/* Rating Change Confirmation Modal */}
      <RatingConfirmModal
        isOpen={pendingRatingChange !== null}
        item={pendingRatingChange?.item || null}
        newRating={pendingRatingChange?.newRating ?? 0}
        onConfirm={handleConfirmRatingChange}
        onClose={() => setPendingRatingChange(null)}
      />

      {/* Clone PWA with Different Chrome Profile Modal */}
      <ClonePWAProfileModal
        isOpen={cloningItem !== null}
        sourceItem={cloningItem}
        allItems={cleanItems}
        discoveredProfiles={discoveredChromeProfiles}
        onClose={() => setCloningItem(null)}
        onConfirmClone={handleClonePWA}
      />

      {/* Per-PWA Access History (Day & Time from Chrome Profile SQLite + Hub) */}
      <AccessHistoryModal
        isOpen={historyModalItem !== null}
        item={historyModalItem}
        allItems={cleanItems}
        todayStr={todayStr}
        discoveredProfiles={discoveredChromeProfiles}
        onClose={() => setHistoryModalItem(null)}
        onSyncProfileHistory={handleSyncSingleProfileHistory}
        onClearHistory={handleClearItemHistory}
      />

      {/* Non-blocking In-App Delete / Same-Profile Deduplicate Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={
          (pendingDedupePlan !== null && pendingDedupePlan.totalDuplicates > 0) ||
          (pendingDeleteIds !== null && pendingDeleteIds.length > 0)
        }
        mode={pendingDedupePlan ? 'dedupe' : 'delete'}
        dedupeGroups={
          pendingDedupePlan
            ? pendingDedupePlan.groups.map((grp) => ({
                profileLabel: grp.profileLabel,
                keeper: grp.keeper,
                duplicates: grp.duplicates,
              }))
            : undefined
        }
        itemsToDelete={
          pendingDedupePlan
            ? pendingDedupePlan.duplicateItems
            : pendingDeleteIds
            ? cleanItems.filter((it) => pendingDeleteIds.includes(it.id))
            : []
        }
        onConfirm={
          pendingDedupePlan
            ? handleConfirmRemoveSameProfileDuplicates
            : handleConfirmDelete
        }
        onClose={() => {
          if (pendingDedupePlan) setPendingDedupePlan(null);
          else setPendingDeleteIds(null);
        }}
      />
    </div>
  );
}
