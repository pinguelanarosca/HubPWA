import React, { useEffect } from 'react';
import { X, Trash2, AlertTriangle, User } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { formatChromeProfileDisplay, getCleanDomain } from '../utils/pwaLogic';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  itemsToDelete: PWAItem[];
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  itemsToDelete,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || itemsToDelete.length === 0) return null;

  const isMultiple = itemsToDelete.length > 1;
  const singleItem = itemsToDelete[0];
  const previewList = itemsToDelete.slice(0, 5);
  const extraCount = itemsToDelete.length - previewList.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      onClick={onClose}
      data-testid="delete-confirm-modal"
    >
      <div
        className="w-full max-w-md bg-[#14151a] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-[#0f1014]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-950/80 border border-rose-800/70 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 id="delete-confirm-title" className="text-sm font-semibold text-white">
              {isMultiple
                ? `Excluir ${itemsToDelete.length} PWAs selecionadas?`
                : 'Excluir PWA?'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar confirmação"
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {!isMultiple ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-neutral-950/75 border border-neutral-800">
              <div className="flex items-center gap-3 min-w-0">
                <PWAIcon
                  icon={singleItem.icon}
                  name={singleItem.name}
                  url={singleItem.url}
                  size="md"
                />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate">
                    {singleItem.name}
                  </span>
                  <span className="text-[11px] text-neutral-400 block truncate">
                    {getCleanDomain(singleItem.url)}
                  </span>
                </div>
              </div>
              {(() => {
                const profile = formatChromeProfileDisplay(singleItem);
                if (!profile) return null;
                return (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/80 border border-sky-700/70 text-[10px] font-medium text-sky-300 shrink-0 whitespace-nowrap">
                    <User className="w-2.5 h-2.5 text-sky-400" />
                    <span>{profile.badgeText}</span>
                  </span>
                );
              })()}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-neutral-300">
                Você está prestes a remover <strong className="text-white">{itemsToDelete.length}</strong> itens selecionados do seu Hub:
              </p>
              <div className="rounded-lg bg-neutral-950/75 border border-neutral-800 divide-y divide-neutral-800/70 max-h-48 overflow-y-auto">
                {previewList.map((it) => {
                  const profile = formatChromeProfileDisplay(it);
                  return (
                    <div key={it.id} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PWAIcon icon={it.icon} name={it.name} url={it.url} size="sm" />
                        <span className="text-xs font-medium text-neutral-100 truncate">
                          {it.name}
                        </span>
                      </div>
                      {profile && (
                        <span className="text-[10px] text-sky-300 bg-sky-950/70 border border-sky-800/60 px-1.5 py-0.5 rounded shrink-0">
                          {profile.badgeText}
                        </span>
                      )}
                    </div>
                  );
                })}
                {extraCount > 0 && (
                  <div className="px-3 py-1.5 text-[11px] text-neutral-400 font-medium text-center">
                    + {extraCount} outra{extraCount > 1 ? 's' : ''} selecionada{extraCount > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Apenas {isMultiple ? 'os itens selecionados acima serão removidos' : 'este card será removido'}. Todas as demais PWAs, pastas e anotações continuarão intactas.
          </p>

          {/* Actions */}
          <div className="pt-2 border-t border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="cancel-delete-pwa-btn"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              data-testid="confirm-delete-pwa-btn"
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isMultiple ? `Excluir (${itemsToDelete.length})` : 'Excluir PWA'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
