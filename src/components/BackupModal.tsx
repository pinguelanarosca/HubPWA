import React, { useRef, useState } from 'react';
import { X, Download, Upload, Copy, Check, AlertCircle, Trash2, FileUp } from 'lucide-react';
import { PWAItem } from '../types/pwa';
import { exportPWAsToJson, importPWAsFromJson } from '../utils/pwaLogic';
import { MarkdownStatusApplyResult } from '../utils/markdownExporter';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PWAItem[];
  onImport: (newItems: PWAItem[], mode: 'replace' | 'merge') => void;
  onImportMarkdownStatus?: (markdownText: string) => MarkdownStatusApplyResult;
  onClearAll: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  items,
  onImport,
  onImportMarkdownStatus,
  onClearAll,
}) => {
  const mdInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [mdStatusMessage, setMdStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  if (!isOpen) return null;

  const handleMdFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImportMarkdownStatus) return;
    setMdStatusMessage(null);
    try {
      const content = await file.text();
      const res = onImportMarkdownStatus(content);
      if (res.parsedCount === 0) {
        setMdStatusMessage({
          type: 'error',
          text: 'Nenhuma PWA com o parâmetro "Acesso" ou "Perfil do Chrome" foi encontrada no arquivo .md.',
        });
      } else if (res.matchedCount === 0) {
        setMdStatusMessage({
          type: 'error',
          text: `Nenhuma das ${res.parsedCount} PWAs do documento corresponde às cadastradas no Hub (nenhuma PWA adicionada).`,
        });
      } else {
        const profilePart =
          res.updatedProfileCount > 0
            ? `, ${res.updatedProfileCount} perfil(is) atualizado(s)`
            : '';
        setMdStatusMessage({
          type: 'success',
          text: `Atualizado: ${res.markedAccessedCount} acessada(s) (verde), ${res.markedPendingCount} pendente(s) (vermelha)${profilePart}, ${res.unchangedCount} sem alteração.`,
        });
      }
    } catch {
      setMdStatusMessage({
        type: 'error',
        text: 'Não foi possível ler o arquivo .md selecionado.',
      });
    }
  };

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
          {/* Zero PWAs Default Management */}
          <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800 space-y-2">
            <h3 className="text-xs font-semibold text-neutral-200">Estado da Aplicação (Padrão: 0 PWAs)</h3>
            <p className="text-[11px] text-neutral-400">
              Esta aplicação opera 100% limpa por padrão. Você pode apagar todas as PWAs cadastradas a qualquer momento para retornar ao estado zerado.
            </p>
            <div className="pt-1">
              {!confirmingClear ? (
                <button
                  type="button"
                  data-testid="backup-clear-all-btn"
                  onClick={() => setConfirmingClear(true)}
                  disabled={items.length === 0}
                  className="px-3 py-1.5 rounded-md bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 disabled:opacity-40 disabled:pointer-events-none text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar todas as PWAs (Zerar Hub)</span>
                </button>
              ) : (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/70 space-y-2">
                  <p className="text-[11px] text-rose-200 font-medium">
                    Tem certeza que deseja apagar todas as {items.length} PWAs cadastradas e zerar a aplicação?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="confirm-clear-all-btn"
                      onClick={() => {
                        setConfirmingClear(false);
                        onClearAll();
                        onClose();
                      }}
                      className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      Confirmar Limpeza
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingClear(false)}
                      className="px-3 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
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

          {/* Status-Only Upload from Exported Markdown (.md) */}
          {onImportMarkdownStatus && (
            <div className="p-3.5 rounded-lg bg-sky-950/25 border border-sky-800/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-sky-200">
                    Atualizar Status e Perfil via Markdown (.md)
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Envie o documento <code className="text-sky-300 font-mono">.md</code> com <strong className="text-neutral-200">Perfil do Chrome</strong> e <strong className="text-neutral-200">Acesso: Sim/Não</strong>. Atualiza status e perfil das PWAs existentes (não adiciona novas).
                  </p>
                </div>
                <input
                  ref={mdInputRef}
                  type="file"
                  accept=".md,.markdown,text/markdown"
                  onChange={handleMdFileChange}
                  className="hidden"
                  data-testid="backup-md-status-input"
                />
                <button
                  type="button"
                  data-testid="backup-upload-md-status-btn"
                  onClick={() => mdInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/60 text-sky-200 text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <FileUp className="w-3.5 h-3.5 text-sky-300" />
                  <span>Enviar .md</span>
                </button>
              </div>
              {mdStatusMessage && (
                <div
                  data-testid="backup-md-status-feedback"
                  className={`flex items-start gap-1.5 text-[11px] ${
                    mdStatusMessage.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {mdStatusMessage.type === 'success' ? (
                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  )}
                  <span>{mdStatusMessage.text}</span>
                </div>
              )}
            </div>
          )}

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
