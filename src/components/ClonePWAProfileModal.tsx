import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Copy, User, Check } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import {
  ChromeProfileOption,
  buildAvailableChromeProfiles,
  extractChromeProfileDirectory,
  formatChromeProfileDisplay,
  getCleanDomain,
  normalizeChromeProfileInput,
  stripProfileSuffixFromName,
} from '../utils/pwaLogic';

interface ClonePWAProfileModalProps {
  isOpen: boolean;
  sourceItem: PWAItem | null;
  allItems: PWAItem[];
  discoveredProfiles?: ChromeProfileOption[];
  onClose: () => void;
  onConfirmClone: (
    source: PWAItem,
    options: {
      profileDirectory: string;
      name: string;
      copyNotesAndFlags: boolean;
      keepFolderAndGroup: boolean;
    }
  ) => void;
}

export const ClonePWAProfileModal: React.FC<ClonePWAProfileModalProps> = ({
  isOpen,
  sourceItem,
  allItems,
  discoveredProfiles = [],
  onClose,
  onConfirmClone,
}) => {
  const availableProfiles = useMemo(
    () => buildAvailableChromeProfiles(allItems, discoveredProfiles),
    [allItems, discoveredProfiles]
  );

  const sourceProfileRaw = useMemo(
    () => (sourceItem ? extractChromeProfileDirectory(sourceItem) : undefined),
    [sourceItem]
  );

  const [selectedProfile, setSelectedProfile] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [keepFolderAndGroup, setKeepFolderAndGroup] = useState(true);
  const [copyNotesAndFlags, setCopyNotesAndFlags] = useState(true);
  const [error, setError] = useState('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !sourceItem) return;
    isSubmittingRef.current = false;

    const currentNorm = sourceProfileRaw ? normalizeChromeProfileInput(sourceProfileRaw).toLowerCase() : '';
    const firstDifferent =
      availableProfiles.find((p) => p.directory.toLowerCase() !== currentNorm) ||
      availableProfiles[1] ||
      availableProfiles[0];

    const initialDir = firstDifferent?.directory || 'Profile 1';
    const initialDisplay = formatChromeProfileDisplay({ profileDirectory: initialDir });
    const baseName = stripProfileSuffixFromName(sourceItem.name) || sourceItem.name;

    setSelectedProfile(initialDir);
    setCloneName(`${baseName} (${initialDisplay?.badgeText || initialDir})`);
    setNameManuallyEdited(false);
    setKeepFolderAndGroup(true);
    setCopyNotesAndFlags(true);
    setError('');
  }, [isOpen, sourceItem, sourceProfileRaw, availableProfiles]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !sourceItem) return null;

  const normalizedSelected = normalizeChromeProfileInput(selectedProfile);
  const targetDisplay = normalizedSelected
    ? formatChromeProfileDisplay({ profileDirectory: normalizedSelected })
    : null;
  const sourceDisplay = sourceProfileRaw
    ? formatChromeProfileDisplay({ profileDirectory: sourceProfileRaw })
    : null;

  const handleSelectProfilePreset = (dir: string) => {
    setSelectedProfile(dir);
    setError('');
    if (!nameManuallyEdited) {
      const disp = formatChromeProfileDisplay({ profileDirectory: dir });
      const baseName = stripProfileSuffixFromName(sourceItem.name) || sourceItem.name;
      setCloneName(`${baseName} (${disp?.badgeText || dir})`);
    }
  };

  const handleCustomProfileChange = (val: string) => {
    setSelectedProfile(val);
    setError('');
    if (!nameManuallyEdited) {
      const norm = normalizeChromeProfileInput(val);
      const disp = norm ? formatChromeProfileDisplay({ profileDirectory: norm }) : null;
      const baseName = stripProfileSuffixFromName(sourceItem.name) || sourceItem.name;
      setCloneName(disp ? `${baseName} (${disp.badgeText})` : baseName);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    const norm = normalizeChromeProfileInput(selectedProfile);
    if (!norm) {
      setError('Selecione ou digite um perfil do navegador válido.');
      return;
    }
    if (!cloneName.trim()) {
      setError('Informe o nome para a PWA clonada.');
      return;
    }

    isSubmittingRef.current = true;
    onConfirmClone(sourceItem, {
      profileDirectory: norm,
      name: cloneName.trim(),
      copyNotesAndFlags,
      keepFolderAndGroup,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-pwa-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-sky-400" />
            <h2 id="clone-pwa-modal-title" className="text-sm font-semibold text-white">
              Clonar PWA para outro Perfil
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-md bg-rose-950/70 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Source PWA Summary */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-neutral-950/70 border border-neutral-800">
            <div className="flex items-center gap-3 min-w-0">
              <PWAIcon
                icon={sourceItem.icon}
                name={sourceItem.name}
                url={sourceItem.url}
                size="md"
              />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white block truncate">
                  {sourceItem.name}
                </span>
                <span className="text-[11px] text-neutral-400 block truncate">
                  {getCleanDomain(sourceItem.url)}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-[10px] font-medium text-neutral-300 shrink-0 whitespace-nowrap">
              <User className="w-2.5 h-2.5 text-sky-400" />
              <span>{sourceDisplay ? sourceDisplay.badgeText : 'Sem perfil'}</span>
            </span>
          </div>

          {/* Profile Selection Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-neutral-200">
                Escolha o Perfil de Destino *
              </label>
              {targetDisplay && (
                <span className="text-[11px] font-mono text-sky-400">
                  {normalizedSelected}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
              {availableProfiles.map((prof) => {
                const disp = formatChromeProfileDisplay({ profileDirectory: prof.directory });
                const isCurrentSource = sourceProfileRaw
                  ? normalizeChromeProfileInput(sourceProfileRaw).toLowerCase() ===
                    prof.directory.toLowerCase()
                  : false;
                const isSelected =
                  normalizedSelected.toLowerCase() === prof.directory.toLowerCase();

                return (
                  <button
                    key={prof.directory}
                    type="button"
                    data-testid={`clone-profile-option-${prof.directory.replace(/\s+/g, '_')}`}
                    onClick={() => handleSelectProfilePreset(prof.directory)}
                    className={`relative flex flex-col items-start px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-400 text-white shadow-[0_0_12px_-4px_rgba(56,189,248,0.45)]'
                        : isCurrentSource
                        ? 'bg-neutral-950/60 border-neutral-800/80 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                        : 'bg-neutral-950/90 border-neutral-800 text-neutral-300 hover:border-neutral-600 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full gap-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                        <User className={`w-3 h-3 ${isSelected ? 'text-sky-400' : 'text-neutral-400'}`} />
                        <span>{disp?.badgeText || prof.directory}</span>
                      </span>
                      {isSelected && <Check className="w-3 h-3 text-sky-400 shrink-0" />}
                    </div>
                    {(prof.displayName || isCurrentSource) && (
                      <span className="text-[9px] text-neutral-400 truncate w-full mt-0.5">
                        {isCurrentSource ? 'Perfil atual' : prof.displayName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Manual custom profile input */}
            <div className="mt-2.5">
              <label htmlFor="clone-custom-profile" className="block text-[11px] text-neutral-400 mb-1">
                Ou digite outro número / diretório de perfil do Chrome:
              </label>
              <input
                id="clone-custom-profile"
                type="text"
                value={selectedProfile}
                onChange={(e) => handleCustomProfileChange(e.target.value)}
                placeholder="Ex: Profile 9, 12, Trabalho"
                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          {/* Clone Name */}
          <div>
            <label htmlFor="clone-pwa-name" className="block text-xs font-medium text-neutral-200 mb-1">
              Nome da PWA Clonada *
            </label>
            <input
              id="clone-pwa-name"
              type="text"
              required
              value={cloneName}
              onChange={(e) => {
                setCloneName(e.target.value);
                setNameManuallyEdited(true);
              }}
              placeholder="Ex: Linear (Perfil 2)"
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Options */}
          <div className="space-y-2 pt-0.5">
            <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepFolderAndGroup}
                onChange={(e) => setKeepFolderAndGroup(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-950 text-sky-500 focus:ring-sky-500"
              />
              <span>Manter mesma pasta e grupo</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={copyNotesAndFlags}
                onChange={(e) => setCopyNotesAndFlags(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-950 text-sky-500 focus:ring-sky-500"
              />
              <span>Copiar anotações e marcações</span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="confirm-clone-pwa"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-sky-400 hover:bg-sky-300 transition-colors shadow-xs cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Clonar ({targetDisplay?.badgeText || normalizedSelected || 'Perfil'})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
