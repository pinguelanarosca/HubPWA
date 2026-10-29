export interface PWAItem {
  id: string;
  name: string;
  url: string;
  icon?: string;
  category: string;
  notes: string;
  lastAccessedDate: string | null; // ISO YYYY-MM-DD or full timestamp
  accessCount: number;
  pinned?: boolean;
  createdAt: string;
}

export type ViewDensity = 'compact-table' | 'dense-grid' | 'cards';

export type StatusFilter = 'all' | 'pending' | 'accessed';

export type SortOption = 'name' | 'lastAccessed' | 'category' | 'accessCount' | 'pinned';

export interface PWAStats {
  total: number;
  accessedTodayCount: number;
  pendingTodayCount: number;
  completionPercentage: number;
}
