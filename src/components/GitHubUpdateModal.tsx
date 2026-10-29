import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  Github,
  ArrowRight,
} from 'lucide-react';
import {
  LocalVersionInfo,
  RemoteCommitInfo,
  GITHUB_REPO,
  DEFAULT_BRANCH,
  formatCommitDate,
} from '../utils/githubUpdater';

interface GitHubUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess?: () => void;
}

export const GitHubUpdateModal: React.FC<GitHubUpdateModalProps> = ({
  isOpen,
  onClose,
  onUpdateSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [localVersion, setLocalVersion] = useState<LocalVersionInfo | null>(null);
  const [remoteCommit, setRemoteCommit] = useState<RemoteCommitInfo | null>(null);
  const [hasUpdate, setHasUpdate] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const checkUpdates = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/updater/status');
      if (!res.ok) {
        throw new Error(`Servidor respondeu com código ${res.status}`);
      }
      const data = await res.json();
      setLocalVersion(data.localVersion);
      setRemoteCommit(data.remoteCommit);
      setHasUpdate(Boolean(data.hasUpdate));
    } catch (err) {
      console.error('Erro ao verificar atualizações:', err);
      // Fallback direct to GitHub API
      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/commits/${DEFAULT_BRANCH}`
        );
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          const fallbackRemote: RemoteCommitInfo = {
            sha: ghData.sha,
            shortSha: ghData.sha.slice(0, 7),
            author: ghData.commit?.author?.name || 'pinguelanarosca',
            date: ghData.commit?.author?.date || new Date().toISOString(),
            message: ghData.commit?.message || '',
            htmlUrl: ghData.html_url,
          };
          setRemoteCommit(fallbackRemote);
          // Default local fallback if API failed
          const fallbackLocal: LocalVersionInfo = {
            repo: GITHUB_REPO,
            branch: DEFAULT_BRANCH,
            commitSha: '92ba6d88bd06e2d6350d78c55ab4698c6568a595',
            commitShort: '92ba6d8',
            commitDate: '2026-10-29T12:58:32Z',
            commitMessage: 'feat: initialize Chrome PWA Hub project',
            version: '1.1.0',
          };
          setLocalVersion(fallbackLocal);
          setHasUpdate(fallbackRemote.sha !== fallbackLocal.commitSha);
          return;
        }
      } catch (fallbackErr) {
        setError((fallbackErr as Error).message);
      }
      setError((err as Error).message || 'Erro ao conectar ao GitHub.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUpdate = async () => {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch('/api/updater/apply', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Falha ao aplicar atualização.');
      }
      setSuccessMessage('Atualização baixada e instalada com sucesso! Recarregando...');
      onUpdateSuccess?.();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkUpdates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="updater-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-white">
              <Github className="w-4 h-4" />
            </div>
            <div>
              <h2 id="updater-modal-title" className="text-sm font-semibold text-white">
                Atualização via GitHub
              </h2>
              <a
                href={`https://github.com/${GITHUB_REPO}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-neutral-400 hover:text-emerald-400 font-mono inline-flex items-center gap-1 transition-colors"
              >
                <span>{GITHUB_REPO}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
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

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Status card */}
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <p className="text-xs text-neutral-300">
                Consultando alterações mais recentes no repositório {GITHUB_REPO}...
              </p>
            </div>
          ) : error ? (
            <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Erro na verificação</span>
                <span>{error}</span>
              </div>
            </div>
          ) : hasUpdate ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-700/60 flex items-start gap-3">
                <Download className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-emerald-300">
                    Nova atualização disponível no GitHub!
                  </h3>
                  <p className="text-[11px] text-emerald-400/90 mt-0.5">
                    Há novas alterações publicadas na branch <code className="bg-emerald-900/60 px-1 py-0.5 rounded">{DEFAULT_BRANCH}</code>.
                  </p>
                </div>
              </div>

              {/* Version Comparison */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* Local */}
                <div className="p-2.5 rounded bg-neutral-950/60 border border-neutral-800 space-y-1">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-semibold">
                    Versão Local
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-neutral-300 text-xs">
                    <GitBranch className="w-3 h-3 text-neutral-400" />
                    <span>{localVersion?.commitShort || '92ba6d8'}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate">
                    {localVersion?.commitMessage || 'Inicial'}
                  </p>
                </div>

                {/* Remote */}
                <div className="p-2.5 rounded bg-neutral-950/60 border border-emerald-800/80 space-y-1">
                  <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-semibold">
                    No GitHub (Mais recente)
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-emerald-300 text-xs">
                    <GitBranch className="w-3 h-3 text-emerald-400" />
                    <span>{remoteCommit?.shortSha}</span>
                  </div>
                  <p className="text-[11px] text-neutral-200 truncate">
                    {remoteCommit?.message}
                  </p>
                  <span className="text-[10px] text-neutral-400 block">
                    {remoteCommit?.date ? formatCommitDate(remoteCommit.date) : ''}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-neutral-950/60 border border-neutral-800 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="text-xs font-semibold text-neutral-100">
                Seu aplicativo está 100% atualizado!
              </h3>
              <p className="text-[11px] text-neutral-400">
                A versão local coincide com o último commit da branch <code className="text-neutral-300 font-mono">{DEFAULT_BRANCH}</code> do GitHub (<code className="text-neutral-300 font-mono">{localVersion?.commitShort}</code>).
              </p>
              {localVersion?.commitDate && (
                <p className="text-[10px] text-neutral-400 font-mono">
                  Última alteração: {formatCommitDate(localVersion.commitDate)}
                </p>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/40 flex items-center justify-between">
          <button
            type="button"
            onClick={checkUpdates}
            disabled={loading || updating}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Verificar novamente</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={updating}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Fechar
            </button>

            {hasUpdate && (
              <button
                type="button"
                onClick={handleApplyUpdate}
                disabled={updating}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {updating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Baixando e instalando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar e Atualizar Agora</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
