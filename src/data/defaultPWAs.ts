import { PWAItem } from '../types/pwa';

/**
 * Clean default state: 0 PWAs embedded.
 * Users add their own PWAs via Ubuntu .desktop files or manual entry.
 */
export const INITIAL_PWAS: PWAItem[] = [];

export function getExpanded100PWAs(): PWAItem[] {
  return [];
}
