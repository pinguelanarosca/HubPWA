export interface PWAFolder {
  id: string;
  name: string;
  color?: string;
  parentId?: string | null;
  createdAt: string;
}

export type DailyFlagState = 'check' | 'x';

export interface PWAFlags {
  moneyDate?: string; // Persistent DD/MM date beside green $ icon (never resets at midnight)
  comDate?: string | null; // YYYY-MM-DD when COM was selected (resets daily at midnight)
  comState?: DailyFlagState | null; // Optional 'check' (green check) or 'x' (red X)
  rbDate?: string | null; // YYYY-MM-DD when RB was selected (resets daily at midnight)
  rbState?: DailyFlagState | null; // Optional 'check' (green check) or 'x' (red X)
  bonDate?: string | null; // YYYY-MM-DD when BON was selected (resets daily at midnight)
  bonState?: DailyFlagState | null; // Optional 'check' (green check) or 'x' (red X)
}

export type DailyFlagKey = 'com' | 'rb' | 'bon';

export type FlagFilterKey =
  | 'moneyDate'
  | DailyFlagKey
  | `${DailyFlagKey}:check`
  | `${DailyFlagKey}:x`;

export interface AccessHistoryEntry {
  timestamp: string; // Local ISO YYYY-MM-DDTHH:mm:ss.000Z
  source: 'chrome' | 'hub';
  profileDirectory?: string;
  visitedUrl?: string;
  title?: string;
}

export interface PWAItem {
  id: string;
  name: string;
  url: string;
  icon?: string;
  category: string;
  group?: string;
  folderId?: string | null;
  notes: string;
  lastAccessedDate: string | null; // ISO YYYY-MM-DD or full timestamp
  accessLogs?: string[]; // Array of recent access timestamps
  accessHistory?: AccessHistoryEntry[]; // Detailed access logs with source (Chrome profile history / Hub)
  accessCount: number;
  pinned?: boolean;
  rating?: number; // 0 to 5 stars (0 = sem estrelas, 1 a 5)
  flags?: PWAFlags;
  clonedFromId?: string;
  createdAt: string;
  rawFileName?: string;
  appId?: string;
  profileDirectory?: string;
  execLine?: string;
  desktopPath?: string;
  // Deduplication & Intelligent Search fields:
  aliases?: string[];
  mergedNames?: string[];
  mergedDesktopFiles?: string[];
  alternateDesktopPaths?: string[];
  isPossibleDuplicate?: boolean;
  possibleDuplicateReason?: string;
  duplicateCandidateId?: string;
}

export interface ParsedDesktopApp {
  id: string;
  name: string;
  url: string;
  category: string;
  group?: string;
  notes: string;
  icon?: string;
  rawFileName: string;
  hasExactUrl: boolean;
  appId?: string;
  profileDirectory?: string;
  execLine?: string;
  desktopPath?: string;
  desktopFileName?: string;
  aliases?: string[];
  mergedNames?: string[];
  mergedDesktopFiles?: string[];
  alternateDesktopPaths?: string[];
  isPossibleDuplicate?: boolean;
  possibleDuplicateReason?: string;
  duplicateCandidateId?: string;
  iconHash?: string;
}

export type ViewDensity = 'compact-table' | 'dense-grid' | 'cards' | 'mini-cards' | 'folders';

export type StatusFilter = 'all' | 'pending' | 'accessed';

export type StarFilter = 'all' | '5' | '4' | '3' | 'unrated';

export type SortOption = 'pinned' | 'name' | 'lastAccessed' | 'category' | 'accessCount' | 'leastAccessed' | 'pendingFirst';

export interface PWAStats {
  total: number;
  accessedTodayCount: number;
  pendingTodayCount: number;
  completionPercentage: number;
}
