import React, { useState, useEffect } from 'react';
import { X, Globe, Star, RotateCw } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { getCleanDomain, resolveFaviconAtInsertion } from '../utils/pwaLogic';

interface AddEditPWAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pwaData: Partial<PWAItem> & { name: string; url: string; category: string; notes: string }) => void;
  editingItem: PWAItem | null;
  existingCategories: string[];
}

export const AddEditPWAModal: React.FC<AddEditPWAModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem,
  existingCategories,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('Produtividade');
  const [notes, setNotes] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setUrl(editingItem.url);
      setCategory(editingItem.category);
      setNotes(editingItem.notes || '');
      // If icon is auto-resolved Google favicon, don't lock customIcon so changing URL dynamically updates icon
      const isAutoFavicon = editingItem.icon?.includes('google.com/s2/favicons');
      setCustomIcon(isAutoFavicon ? '' : (editingItem.icon || ''));
      setPinned(Boolean(editingItem.pinned));
      setError('');
    } else {
      setName('');
      setUrl('');
      setCategory(existingCategories[0] || 'Produtividade');
      setNotes('');
      setCustomIcon('');
      setPinned(false);
      setError('');
    }
  }, [editingItem, isOpen, existingCategories]);

  if (!isOpen) return null;

  // Auto-suggest name from URL domain if name is empty
  const handleUrlBlur = () => {
    if (!name.trim() && url.trim()) {
      try {
        const clean = getCleanDomain(url);
        const parts = clean.split('.');
        const domainName = parts[0] || '';
        if (domainName && !name.trim()) {
          setName(domainName.charAt(0).toUpperCase() + domainName.slice(1));
        }
      } catch {
        // ignore
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome da PWA.');
      return;
    }
    if (!url.trim()) {
      setError('Por favor, informe a URL da PWA.');
      return;
    }

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }

    onSave({
      ...(editingItem ? { id: editingItem.id } : {}),
      name: name.trim(),
      url: finalUrl,
      category: category.trim() || 'Geral',
      notes: notes.trim(),
      icon: customIcon.trim() || resolveFaviconAtInsertion(finalUrl),
      pinned,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-pwa-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between">
          <h2 id="modal-pwa-title" className="text-sm font-semibold text-white">
            {editingItem ? 'Editar PWA' : 'Adicionar Nova PWA'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-md bg-rose-950/70 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Icon Preview */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <PWAIcon icon={customIcon || (url ? resolveFaviconAtInsertion(url) : '')} name={name || 'P'} size="lg" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-neutral-200 block truncate">
                  {name || 'Nome da PWA'}
                </span>
                <span className="text-[11px] text-neutral-400 block truncate">
                  {url ? getCleanDomain(url) : 'https://seu-app.com'}
                </span>
              </div>
            </div>
            {url && (
              <button
                type="button"
                onClick={() => setCustomIcon('')}
                title="Recarregar ícone padrão a partir da URL"
                className="shrink-0 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/80 rounded-md transition-colors cursor-pointer flex items-center gap-1"
              >
                <RotateCw className="w-3 h-3" />
                <span>Atualizar Ícone</span>
              </button>
            )}
          </div>

          {/* URL Input */}
          <div>
            <label htmlFor="pwa-url" className="block text-xs font-medium text-neutral-300 mb-1">
              URL da Aplicação *
            </label>
            <div className="relative">
              <Globe className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="pwa-url"
                type="text"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://app.example.com"
                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label htmlFor="pwa-name" className="block text-xs font-medium text-neutral-300 mb-1">
              Nome da PWA *
            </label>
            <input
              id="pwa-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Notion, Linear, GitHub..."
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Category Input */}
          <div>
            <label htmlFor="pwa-category" className="block text-xs font-medium text-neutral-300 mb-1">
              Categoria
            </label>
            <div className="flex gap-2">
              <input
                id="pwa-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Produtividade, Dev, Social..."
                list="category-suggestions"
                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <datalist id="category-suggestions">
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Notes / Anotações Field */}
          <div>
            <label htmlFor="pwa-notes" className="block text-xs font-medium text-neutral-300 mb-1">
              Campo para Anotações referentes à PWA
            </label>
            <textarea
              id="pwa-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Sprint diário às 10h; verificar backlog Q4; login na conta corporativa..."
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Optional Custom Icon URL */}
          <div>
            <label htmlFor="pwa-custom-icon" className="block text-xs font-medium text-neutral-400 mb-1">
              Ícone Customizado (Opcional - por padrão usa o Favicon do Chrome)
            </label>
            <input
              id="pwa-custom-icon"
              type="text"
              value={customIcon}
              onChange={(e) => setCustomIcon(e.target.value)}
              placeholder="https://exemplo.com/icon.png"
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-400 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-neutral-600"
            />
          </div>

          {/* Pin option */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="pwa-pinned"
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="rounded bg-neutral-950 border-neutral-800 text-emerald-500 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="pwa-pinned" className="text-xs text-neutral-300 flex items-center gap-1 cursor-pointer">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Fixar no topo da lista</span>
            </label>
          </div>

          {/* Form Actions */}
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
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-xs cursor-pointer"
            >
              {editingItem ? 'Salvar Alterações' : 'Adicionar PWA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
