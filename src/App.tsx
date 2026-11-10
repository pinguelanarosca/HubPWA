/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { PWAItem, ViewDensity, StatusFilter, StarFilter, SortOption } from './types/pwa';
import {
  getTodayString,
  isAccessedToday,
  markAsAccessed,
  toggleAccessedToday,
  calculateStats,
  filterAndSortPWAs,
  resolveFaviconAtInsertion,
  getCleanDomain,
  isAndroidOrRedroidApp,
  isSameOrMatchingPWA,
} from './utils/pwaLogic';
import { parseDesktopFile, ParsedDesktopApp } from './utils/desktopParser';
import { normalizeAppUrl } from './utils/desktopDeduplicator';
import { TopBar } from './components/TopBar';
import { ControlToolbar } from './components/ControlToolbar';
import { CompactTableView } from './components/CompactTableView';
import { DenseGridView } from './components/DenseGridView';
import { CardsView } from './components/CardsView';
import { BatchActionsBar } from './components/BatchActionsBar';
import { BatchEditModal } from './components/BatchEditModal';
import { AddEditPWAModal } from './components/AddEditPWAModal';
import { BackupModal } from './components/BackupModal';
import { DesktopImportModal } from './components/DesktopImportModal';
import { GitHubUpdateModal } from './components/GitHubUpdateModal';
import { AutostartModal } from './components/AutostartModal';
import { loadGroupConfigs, saveGroupConfigs, loadGroupColors, saveGroupColors } from './utils/groupLogic';
import { extractPWAsToMarkdown } from './utils/markdownExporter';
import { GroupManagerModal } from './components/GroupManagerModal';
import { RatingConfirmModal } from './components/RatingConfirmModal';
import { FolderUp, FolderOpen, Plus } from 'lucide-react';

const STORAGE_KEY = 'chrome_pwa_hub_items_empty_v1';
const DENSITY_STORAGE_KEY = 'chrome_pwa_hub_density';
const GROUP_BY_STORAGE_KEY = 'chrome_pwa_hub_group_by_group';

export default function App() {
  const [items, setItems] = useState<PWAItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((it: PWAItem) => !isAndroidOrRedroidApp(it));
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
            return parsed.filter((it: PWAItem) => !isAndroidOrRedroidApp(it));
          }
        }
      }
    } catch {
      // Fallback
    }
    return [];
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
    return 'cards';
  });

  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [starFilter, setStarFilter] = useState<StarFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('pinned');
  const [groupByGroup, setGroupByGroup] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GROUP_BY_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Card batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PWAItem | null>(null);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isAutostartOpen, setIsAutostartOpen] = useState(false);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);

  // Group Configurations (name -> symbol mapping)
  const [groupConfigs, setGroupConfigs] = useState<Record<string, string>>(() => loadGroupConfigs());

  // Group Color Themes (name -> colorKey mapping)
  const [groupColors, setGroupColors] = useState<Record<string, string>>(() => loadGroupColors());

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

  // Current day string (YYYY-MM-DD)
  const [todayStr, setTodayStr] = useState(() => getTodayString());

  // Periodically keep todayStr in sync (in case the tab is open past midnight or user switches back)
  useEffect(() => {
    const syncToday = () => {
      const current = getTodayString();
      if (current !== todayStr) {
        setTodayStr(current);
      }
    };
    const interval = setInterval(syncToday, 30000);
    window.addEventListener('focus', syncToday);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncToday);
    };
  }, [todayStr]);

  // Merge scanned local Ubuntu PWAs with stored user tracking state
  // Consolidates all previously saved versions of the same platform into the Profile 5 card
  const mergeScannedPWAs = useCallback((scannedItems: PWAItem[]) => {
    const validScanned = scannedItems.filter((s) => !isAndroidOrRedroidApp(s));
    setItems((prev) => {
      const cleanPrev = prev.filter((p) => !isAndroidOrRedroidApp(p));
      const absorbedPrevIds = new Set<string>();

      const mergedList = validScanned.map((scanned) => {
        const normScannedUrl = normalizeAppUrl(scanned.url);

        // Find ALL previous entries that belong to this platform
        const matches = cleanPrev.filter((p) => {
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

          // Preserve working icon from previous state
          const existingWorkingIcon = matches.find(
            (m) => m.icon && !m.icon.includes('/api/icon') && m.icon.trim()
          )?.icon;
          const finalMergedIcon = existingWorkingIcon || scanned.icon || resolveFaviconAtInsertion(scanned.url);

          return {
            ...scanned,
            name: customName,
            category: customCategory,
            icon: finalMergedIcon,
            pinned: isAnyPinned || maxRating > 0,
            rating: maxRating,
            aliases: Array.from(allAliases).filter(Boolean),
            notes: noteList.join(' | '),
            lastAccessedDate: latestDate,
            accessCount: totalAccess,
          };
        }

        return {
          ...scanned,
          icon: scanned.icon || resolveFaviconAtInsertion(scanned.url),
        };
      });

      // Keep only manual items that weren't absorbed into any platform
      const remainingManualItems = cleanPrev.filter((p) => !absorbedPrevIds.has(p.id));
      const finalMerged = [...mergedList, ...remainingManualItems].filter((it) => !isAndroidOrRedroidApp(it));

      // Sync merged state to server disk database
      fetch('/api/pwas/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: finalMerged }),
      }).catch(() => {});

      return finalMerged;
    });
  }, []);

  // Automatic discovery scan on launch & on demand
  const handleRescanLocalPWAs = useCallback(async () => {
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
    }
  }, [mergeScannedPWAs]);

  // Trigger local discovery scan when app loads
  useEffect(() => {
    handleRescanLocalPWAs();
  }, [handleRescanLocalPWAs]);

  // Persist items to localStorage and sync to server database
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }

    if (items.length > 0) {
      const timer = setTimeout(() => {
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        }).catch(() => {});
      }, 600);
      return () => clearTimeout(timer);
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
    const validNew = newItems.filter((i) => !isAndroidOrRedroidApp(i));
    setItems((prev) => {
      const cleanPrev = prev.filter((p) => !isAndroidOrRedroidApp(p));
      const existingIds = new Set(cleanPrev.map((i) => i.id));
      const withResolvedIcons = validNew.map((item) => ({
        ...item,
        icon: item.icon || resolveFaviconAtInsertion(item.url),
      }));
      const filtered = withResolvedIcons.filter((i) => !existingIds.has(i.id));
      return [...filtered, ...cleanPrev];
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

  // Filtered and sorted items
  const displayedItems = useMemo(() => {
    return filterAndSortPWAs(cleanItems, {
      search,
      group: selectedGroup,
      statusFilter,
      starFilter,
      sortBy,
      todayStr,
    });
  }, [cleanItems, search, selectedGroup, statusFilter, starFilter, sortBy, todayStr]);

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

  // Launch PWA: opens link as a true standalone PWA window and automatically marks accessed today (GREEN indicator)
  const handleLaunch = useCallback(async (item: PWAItem) => {
    // Anti-double-click mechanism: reject rapid repeat clicks on the same PWA within 1500ms or global bursts within 350ms
    const nowMs = Date.now();
    const itemKey = item.id || item.appId || item.rawFileName || item.url || item.name;
    const lastItemTime = launchCooldownRef.current.get(itemKey) || 0;
    const globalLastTime = launchCooldownRef.current.get('__global__') || 0;

    if ((lastItemTime > 0 && nowMs - lastItemTime < 1500) || (globalLastTime > 0 && nowMs - globalLastTime < 350)) {
      return;
    }

    launchCooldownRef.current.set(itemKey, nowMs);
    launchCooldownRef.current.set('__global__', nowMs);

    // 1. Immediately update React state using resilient matching so rapid clicks or ID variations are never lost
    const now = new Date();
    const accessedItem = markAsAccessed(item, now, todayStr);

    setItems((prev) => {
      const updatedList = prev.map((it) => (isSameOrMatchingPWA(it, item) ? markAsAccessed(it, now, todayStr) : it));
      // Save directly to localStorage immediately without waiting for debounce
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      } catch {}
      return updatedList;
    });

    // 2. Persist immediately to server disk database to prevent background throttling drops
    fetch('/api/pwas/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [accessedItem] }),
    }).catch(() => {});

    try {
      // 3. Attempt native OS launch on Ubuntu (opens standalone Chrome App window or gtk-launch)
      const res = await fetch('/api/launch-pwa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          url: item.url,
          rawFileName: item.rawFileName,
          appId: item.appId,
          profileDirectory: item.profileDirectory,
          execLine: item.execLine,
          desktopPath: item.desktopPath,
          todayStr,
        }),
      });

      const data = await res.json();

      // If server confirmed a timestamp, ensure it is recorded in React state
      if (data.lastAccessedDate) {
        setItems((prev) =>
          prev.map((it) =>
            isSameOrMatchingPWA(it, item)
              ? {
                  ...it,
                  lastAccessedDate: data.lastAccessedDate,
                  accessCount: Math.max(it.accessCount || 0, 1),
                }
              : it
          )
        );
      }

      if (!data.launchedNative && item.url) {
        // Fallback: Open in a standalone App Window without browser tabs or address bar
        window.open(
          item.url,
          `pwa_${item.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
          'popup=yes,width=1280,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
        );
      }
    } catch {
      // Fallback for cloud preview
      if (item.url) {
        window.open(
          item.url,
          `pwa_${item.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
          'popup=yes,width=1280,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
        );
      }
    }
  }, [todayStr]);

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

  // Delete item
  const handleDelete = useCallback((id: string) => {
    const target = items.find((it) => it.id === id);
    const confirmMessage = target ? `Excluir a PWA "${target.name}"?` : 'Excluir esta PWA?';
    if (window.confirm(confirmMessage)) {
      setItems((prev) => prev.filter((it) => it.id !== id));
      // Persist deletion on backend so re-scan doesn't re-introduce it
      fetch('/api/pwas/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).catch((err) => console.warn('Erro ao persistir exclusão no servidor:', err));
    }
  }, [items]);

  // Save new or edited PWA
  const handleSavePWA = useCallback((data: Partial<PWAItem> & { name: string; url: string; category: string; group?: string; notes: string }) => {
    const finalIcon =
      data.icon && !data.icon.includes('/api/icon')
        ? data.icon
        : resolveFaviconAtInsertion(data.url);
    const grp = data.group || data.category || 'Geral';

    if (data.id) {
      // Edit
      setItems((prev) => {
        const updatedList = prev.map((it) =>
          it.id === data.id
            ? { ...it, ...data, group: grp, category: grp, icon: finalIcon }
            : it
        );
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
        notes: data.notes,
        icon: finalIcon,
        pinned: initialRating > 0,
        rating: initialRating,
        lastAccessedDate: null,
        accessCount: 0,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => {
        const nextList = [newItem, ...prev];
        fetch('/api/pwas/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: nextList }),
        }).catch(() => {});
        return nextList;
      });
    }
  }, []);

  // Card selection handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visibleIds = displayedItems.map((it) => it.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(visibleIds);
      }
    });
  }, [displayedItems]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Batch toggle status (acessado / pendente)
  const handleBatchToggleStatus = useCallback(() => {
    if (selectedIds.size === 0) return;
    setItems((prev) => {
      const updatedList: PWAItem[] = [];
      const next = prev.map((it) => {
        if (selectedIds.has(it.id)) {
          const updated = toggleAccessedToday(it, todayStr);
          updatedList.push(updated);
          return updated;
        }
        return it;
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
  }, [selectedIds, todayStr]);

  // Batch delete selected items
  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (window.confirm(`Tem certeza que deseja excluir ${count} PWA${count > 1 ? 's' : ''} selecionada${count > 1 ? 's' : ''}?`)) {
      const idsToDelete = Array.from(selectedIds);
      setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)));
      setSelectedIds(new Set());

      idsToDelete.forEach((id) => {
        fetch('/api/pwas/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        }).catch(() => {});
      });
    }
  }, [selectedIds]);

  // Batch edit apply
  const handleApplyBatchEdit = useCallback((changes: {
    group?: string;
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

  // Batch extract URLs to Markdown (.md)
  const handleBatchExtractUrls = useCallback(() => {
    if (selectedIds.size === 0) return;
    extractPWAsToMarkdown(items, selectedIds);
  }, [items, selectedIds]);

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch {
      // ignore
    }
  }, []);

  // Import JSON items
  const handleImport = useCallback((newItems: PWAItem[], mode: 'replace' | 'merge') => {
    const validNew = newItems.filter((i) => !isAndroidOrRedroidApp(i));
    if (mode === 'replace') {
      setItems(validNew);
    } else {
      setItems((prev) => {
        const cleanPrev = prev.filter((p) => !isAndroidOrRedroidApp(p));
        const existingIds = new Set(cleanPrev.map((i) => i.id));
        const nonDuplicate = validNew.filter((i) => !existingIds.has(i.id));
        return [...cleanPrev, ...nonDuplicate];
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
        onOpenAutostartModal={() => setIsAutostartOpen(true)}
        onMarkAllToday={handleMarkAllToday}
        onResetToday={handleResetToday}
        onRefreshAllIcons={handleRefreshAllIcons}
        onRescanLocalPWAs={handleRescanLocalPWAs}
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
            <div className="mb-3 px-3.5 py-2 rounded-lg bg-neutral-900/50 border border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 notranslate" translate="no">
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
              selectedGroup={selectedGroup}
              onGroupChange={setSelectedGroup}
              groups={groups}
              groupConfigs={groupConfigs}
              groupColors={groupColors}
              onOpenGroupManager={() => setIsGroupManagerOpen(true)}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              starFilter={starFilter}
              onStarFilterChange={setStarFilter}
              density={density}
              onDensityChange={handleDensityChange}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              totalCount={cleanItems.length}
              pendingCount={stats.pendingTodayCount}
              accessedCount={stats.accessedTodayCount}
              groupByGroup={groupByGroup}
              onToggleGroupByGroup={handleToggleGroupByGroup}
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
                  onSetRating={handleSetRating}
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
                  onSetRating={handleSetRating}
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
                  groupConfigs={groupConfigs}
                  groupColors={groupColors}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onLaunch={handleLaunch}
                  onToggleStatus={handleToggleStatus}
                  onUpdateNote={handleUpdateNote}
                  onTogglePin={handleTogglePin}
                  onSetRating={handleSetRating}
                  onEdit={(item) => {
                    setEditingItem(item);
                    setIsAddEditOpen(true);
                  }}
                  onDelete={handleDelete}
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
        totalCount={displayedItems.length}
        allSelected={displayedItems.length > 0 && displayedItems.every((it) => selectedIds.has(it.id))}
        onToggleSelectAll={handleToggleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBatchToggleStatus={handleBatchToggleStatus}
        onBatchAssignGroup={handleBatchAssignGroup}
        onBatchExtractUrls={handleBatchExtractUrls}
        onBatchEdit={() => setIsBatchEditOpen(true)}
        onBatchDelete={handleBatchDelete}
        existingGroups={groups}
      />

      {/* Batch Edit Modal */}
      <BatchEditModal
        isOpen={isBatchEditOpen}
        onClose={() => setIsBatchEditOpen(false)}
        selectedCount={selectedIds.size}
        existingGroups={groups}
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

      {/* Rating Change Confirmation Modal */}
      <RatingConfirmModal
        isOpen={pendingRatingChange !== null}
        item={pendingRatingChange?.item || null}
        newRating={pendingRatingChange?.newRating ?? 0}
        onConfirm={handleConfirmRatingChange}
        onClose={() => setPendingRatingChange(null)}
      />
    </div>
  );
}
