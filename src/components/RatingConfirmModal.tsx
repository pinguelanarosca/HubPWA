import React, { useEffect, useRef } from 'react';
import { Star, X, ArrowRight, Check } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { PWAIcon } from './PWAIcon';
import { StarRating } from './StarRating';

interface RatingConfirmModalProps {
  isOpen: boolean;
  item: PWAItem | null;
  newRating: number;
  onConfirm: () => void;
  onClose: () => void;
}

export const RatingConfirmModal: React.FC<RatingConfirmModalProps> = ({
  isOpen,
  item,
  newRating,
  onConfirm,
  onClose,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when opened
    confirmBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onClose]);

  if (!isOpen || !item) return null;

  const currentRating = typeof item.rating === 'number' ? item.rating : (item.pinned ? 5 : 0);
  const isRemoving = newRating === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#14151a] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <h2 id="rating-confirm-title" className="text-sm font-semibold text-white">
              Confirmar Alteração de Estrelas
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Cancelar e fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* PWA Information Card */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
            <PWAIcon
              icon={item.icon}
              name={item.name}
              url={item.url}
              size="md"
              className="w-10 h-10 rounded-xl shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-white truncate" title={item.name}>
                {item.name}
              </h3>
              <p className="text-[11px] text-neutral-400 truncate">
                {item.group || item.category || 'Geral'}
              </p>
            </div>
          </div>

          {/* Rating Change Visualizer */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
            {/* Previous */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                Atual
              </span>
              <StarRating rating={currentRating} readonly={true} size="xs" />
              <span className="text-[11px] font-mono text-neutral-400">
                {currentRating > 0 ? `${currentRating} ★` : 'Sem estrelas'}
              </span>
            </div>

            <ArrowRight className="w-4 h-4 text-neutral-500 shrink-0" />

            {/* Target */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                Novo
              </span>
              <StarRating rating={newRating} readonly={true} size="xs" />
              <span className="text-[11px] font-mono font-semibold text-amber-300">
                {newRating > 0 ? `${newRating} ★` : 'Remover estrelas'}
              </span>
            </div>
          </div>

          {/* Message Prompt */}
          <p className="text-xs text-neutral-300 leading-relaxed text-center">
            {isRemoving ? (
              <>
                Deseja remover a classificação de estrelas de <strong className="text-white font-semibold">{item.name}</strong>?
              </>
            ) : (
              <>
                Deseja alterar a classificação de <strong className="text-white font-semibold">{item.name}</strong> para{' '}
                <strong className="text-amber-400 font-semibold">{newRating} {newRating === 1 ? 'estrela' : 'estrelas'}</strong>?
              </>
            )}
          </p>

          <p className="text-[11px] text-neutral-500 text-center leading-normal">
            A PWA será reposicionada na lista de acordo com o número de estrelas.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-3.5 border-t border-neutral-800 bg-neutral-900/40 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-xs cursor-pointer focus:ring-2 focus:ring-amber-400/50"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Confirmar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
