import React, { useState } from 'react';
import { X, Check, CheckCircle2, AlertTriangle, Globe, FolderOpen } from 'lucide-react';
import { ParsedDesktopApp } from '../utils/desktopParser';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';

interface DesktopImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedApps: ParsedDesktopApp[];
  onConfirmImport: (items: PWAItem[]) => void;
  existingCategories: string[];
}

export const DesktopImportModal: React.FC<DesktopImportModalProps> = ({
  isOpen,
  onClose,
  parsedApps,
  onConfirmImport,
  existingCategories,
}) => {
  const [apps, setApps] = useState<ParsedDesktopApp[]>(parsedApps);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(parsedApps.map((a) => a.id))
  );

  // Sync state if parsedApps changes
  React.useEffect(() => {
    setApps(parsedApps);
    setSelectedIds(new Set(parsedApps.map((a) => a.id)));
  }, [parsedApps]);

  if (!isOpen || parsedApps.length === 0) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === apps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(apps.map((a) => a.id)));
    }
  };

  const handleUpdateApp = (id: string, field: keyof ParsedDesktopApp, value: string) => {
    setApps((prev) =>
      prev.map((app) => (app.id === id ? { ...app, [field]: value } : app))
    );
  };

  const handleImport = () => {
    const toImport = apps.filter((app) => selectedIds.has(app.id));
    if (toImport.length === 0) return;

    const newPwaItems: PWAItem[] = toImport.map((app) => ({
      id: app.id,
      name: app.name.trim(),
      url: app.url.trim().startsWith('http') ? app.url.trim() : `https://${app.url.trim()}`,
      category: app.category.trim() || 'Produtividade',
      notes: app.notes.trim() || 'Importado do Ubuntu Desktop',
      icon: app.icon,
      lastAccessedDate: null, // Initialized as RED (pending today)
      accessCount: 0,
      pinned: false,
      createdAt: new Date().toISOString(),
    }));

    onConfirmImport(newPwaItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-ubuntu-title"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FolderOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 id="import-ubuntu-title" className="text-sm font-semibold text-white">
                PWAs Identificadas no Ubuntu ({apps.length})
              </h2>
              <p className="text-[11px] text-neutral-400">
                Arquivos <code className="text-neutral-300">.desktop</code> lidos com sucesso. Revise e confirme a importação para o hub.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Ubuntu Tip Banner */}
        <div className="px-5 py-2 bg-neutral-950/70 border-b border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-neutral-300 font-medium">Dica Ubuntu:</span>
            <span className="truncate">
              No navegador de arquivos, use <kbd className="px-1 py-0.5 bg-neutral-800 text-neutral-200 rounded text-[10px]">Ctrl+H</kbd> para exibir pastas ocultas (<code className="text-emerald-400">~/.local/share/applications</code>).
            </span>
          </div>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-emerald-400 hover:text-emerald-300 font-medium shrink-0 ml-2 cursor-pointer"
          >
            {selectedIds.size === apps.length ? 'Desmarcar todas' : 'Selecionar todas'}
          </button>
        </div>

        {/* Scrollable list of parsed apps */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {apps.map((app) => {
            const isSelected = selectedIds.has(app.id);

            return (
              <div
                key={app.id}
                className={`p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-neutral-950/60 border-neutral-700/80'
                    : 'bg-neutral-950/20 border-neutral-800/40 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(app.id)}
                      aria-label={`Selecionar ${app.name}`}
                      className="rounded bg-neutral-900 border-neutral-700 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </div>

                  {/* Icon */}
                  <div className="pt-0.5">
                    <PWAIcon url={app.url} name={app.name} customIcon={app.icon} size="md" />
                  </div>

                  {/* Fields */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* Name input */}
                      <div className="flex-1 min-w-[160px]">
                        <input
                          type="text"
                          value={app.name}
                          onChange={(e) => handleUpdateApp(app.id, 'name', e.target.value)}
                          placeholder="Nome da PWA"
                          className="w-full bg-neutral-900 border border-neutral-800 text-neutral-100 font-semibold text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* Category select */}
                      <div className="w-36">
                        <input
                          type="text"
                          value={app.category}
                          list="modal-categories"
                          onChange={(e) => handleUpdateApp(app.id, 'category', e.target.value)}
                          placeholder="Categoria"
                          className="w-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* URL input */}
                    <div className="relative">
                      <Globe className="w-3 h-3 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={app.url}
                        onChange={(e) => handleUpdateApp(app.id, 'url', e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded pl-7 pr-2 py-1 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    {/* Notes field */}
                    <div>
                      <input
                        type="text"
                        value={app.notes}
                        onChange={(e) => handleUpdateApp(app.id, 'notes', e.target.value)}
                        placeholder="Anotação referente a esta PWA..."
                        className="w-full bg-neutral-900/80 border border-neutral-800 text-neutral-400 text-xs rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Desktop file reference */}
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                      <span className="truncate">Arquivo: {app.rawFileName}</span>
                      {app.hasExactUrl ? (
                        <span className="text-emerald-400 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>URL confirmada</span>
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          <span>URL sugerida</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <datalist id="modal-categories">
          {existingCategories.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/40 flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            {selectedIds.size} de {apps.length} selecionadas
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Adicionar {selectedIds.size} PWAs ao Hub</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
