import React, { useState } from 'react';
import { X, Layers, Star, Tag, FileText } from 'lucide-react';
import { StarRating } from './StarRating';

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  existingGroups: string[];
  onApply: (changes: {
    group?: string;
    rating?: number;
    notes?: string;
    notesMode?: 'append' | 'replace';
  }) => void;
}

export const BatchEditModal: React.FC<BatchEditModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  existingGroups,
  onApply,
}) => {
  const [changeGroup, setChangeGroup] = useState(false);
  const [group, setGroup] = useState('');
  const [changeRating, setChangeRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [changeNotes, setChangeNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesMode, setNotesMode] = useState<'append' | 'replace'>('append');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({
      ...(changeGroup ? { group: group.trim() || 'Geral' } : {}),
      ...(changeRating ? { rating } : {}),
      ...(changeNotes ? { notes: notes.trim(), notesMode } : {}),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-edit-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 id="batch-edit-title" className="text-sm font-semibold text-white">
              Edição em Lote ({selectedCount} {selectedCount === 1 ? 'PWA' : 'PWAs'})
            </h2>
          </div>
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
          <p className="text-xs text-neutral-400">
            Marque as opções que deseja alterar para todas as <strong>{selectedCount}</strong> PWAs selecionadas.
          </p>

          {/* Group */}
          <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={changeGroup}
                onChange={(e) => setChangeGroup(e.target.checked)}
                className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-400" />
                Definir Grupo
              </span>
            </label>
            {changeGroup && (
              <div className="pt-1">
                <input
                  type="text"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="Ex: Produtividade, Dev, Social..."
                  list="batch-group-suggestions"
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <datalist id="batch-group-suggestions">
                  {existingGroups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={changeRating}
                onChange={(e) => setChangeRating(e.target.checked)}
                className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                Definir Classificação (Estrelas)
              </span>
            </label>
            {changeRating && (
              <div className="pt-1 flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  {rating === 0 ? 'Sem estrelas' : `${rating} estrela${rating > 1 ? 's' : ''}`}
                </span>
                <StarRating rating={rating} onChange={setRating} size="md" />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={changeNotes}
                onChange={(e) => setChangeNotes(e.target.checked)}
                className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                Anotações
              </span>
            </label>
            {changeNotes && (
              <div className="pt-1 space-y-2">
                <div className="flex items-center gap-3 text-xs text-neutral-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="batchNotesMode"
                      checked={notesMode === 'append'}
                      onChange={() => setNotesMode('append')}
                      className="text-emerald-500"
                    />
                    <span>Anexar ao final</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="batchNotesMode"
                      checked={notesMode === 'replace'}
                      onChange={() => setNotesMode('replace')}
                      className="text-emerald-500"
                    />
                    <span>Substituir existentes</span>
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observação para todas as selecionadas..."
                  className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
            )}
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
              disabled={!changeGroup && !changeRating && !changeNotes}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs cursor-pointer"
            >
              Aplicar a {selectedCount} PWAs
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
