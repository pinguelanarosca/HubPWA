import React, { useState } from 'react';
import { X, Download, Upload, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { exportPWAsToJson, importPWAsFromJson } from '../utils/pwaLogic';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PWAItem[];
  onImport: (newItems: PWAItem[], mode: 'replace' | 'merge') => void;
  onResetDefault: () => void;
  onLoad100Sample: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  items,
  onImport,
  onResetDefault,
  onLoad100Sample,
}) => {
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  if (!isOpen) return null;

  const jsonContent = exportPWAsToJson(items);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chrome-pwa-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportSuccess('');

    try {
      const parsed = importPWAsFromJson(importText);
      if (parsed.length === 0) {
        setImportError('Nenhuma PWA válida encontrada no JSON fornecido.');
        return;
      }
      onImport(parsed, importMode);
      setImportSuccess(`${parsed.length} PWAs importadas com sucesso!`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setImportError((err as Error).message || 'JSON inválido.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between">
          <h2 id="backup-modal-title" className="text-sm font-semibold text-white">
            Backup e Restauração de Dados
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Quick Preset Buttons */}
          <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800 space-y-2">
            <h3 className="text-xs font-semibold text-neutral-200">Conjuntos Pré-definidos</h3>
            <p className="text-[11px] text-neutral-400">
              Para quem organiza mais de 100 PWAs, você pode alternar facilmente entre o acervo completo de 104 PWAs ou restaurar os itens padrões.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onLoad100Sample();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-md bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Carregar 104 PWAs completas
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetDefault();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Restaurar Padrão (42 PWAs)
              </button>
            </div>
          </div>

          {/* Export Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-neutral-200">Exportar Dados ({items.length} PWAs)</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado!' : 'Copiar JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar Arquivo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Import Section */}
          <form onSubmit={handleImportSubmit} className="space-y-3 pt-2 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-neutral-200">Importar do Chrome / Backup</h3>
              <div className="flex items-center gap-2 text-[11px]">
                <label className="flex items-center gap-1 text-neutral-400 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="text-emerald-500 focus:ring-0"
                  />
                  <span>Mesclar</span>
                </label>
                <label className="flex items-center gap-1 text-neutral-400 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-emerald-500 focus:ring-0"
                  />
                  <span>Substituir tudo</span>
                </label>
              </div>
            </div>

            <textarea
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Cole aqui o conteúdo JSON com suas PWAs exportadas..."
              className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg p-2.5 font-mono focus:outline-none focus:border-emerald-500 resize-none"
            />

            {importError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{importSuccess}</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!importText.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar PWAs</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
