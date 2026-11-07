import React, { useState, useEffect } from 'react';
import { X, Power, CheckCircle2, Terminal, AlertTriangle, Play, ShieldCheck, Copy, Check } from 'lucide-react';

interface AutostartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AutostartModal: React.FC<AutostartModalProps> = ({ isOpen, onClose }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [details, setDetails] = useState<{
    projectPath?: string;
    autostartFilePath?: string;
    systemdFilePath?: string;
  }>({});

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/autostart/status');
      const data = await res.json();
      setIsEnabled(data.enabled);
      setDetails({
        projectPath: data.projectPath,
        autostartFilePath: data.autostartFilePath,
        systemdFilePath: data.systemdFilePath,
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEnable = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/autostart/enable', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsEnabled(true);
        setMessage(data.message || 'Inicialização automática no Ubuntu ativada com sucesso!');
      } else {
        setMessage(data.message || 'Falha ao ativar autostart.');
      }
    } catch (err) {
      setMessage(`Erro: ${(err as Error).message}`);
    } finally {
      setLoading(false);
      checkStatus();
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/autostart/disable', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsEnabled(false);
        setMessage(data.message || 'Inicialização automática desativada.');
      }
    } catch (err) {
      setMessage(`Erro: ${(err as Error).message}`);
    } finally {
      setLoading(false);
      checkStatus();
    }
  };

  const terminalCommand = `./scripts/setup-ubuntu-autostart.sh`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(terminalCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-lg bg-[#14151a] border border-[#242633] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-autostart-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#242633] flex items-center justify-between bg-[#0f1014]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Power className="w-4 h-4" />
            </div>
            <div>
              <h2 id="modal-autostart-title" className="text-sm font-bold text-white">
                Inicialização Automática com o Ubuntu
              </h2>
              <p className="text-[11px] text-neutral-400">
                Inicia o servidor e o Hub automaticamente ao ligar/reiniciar o PC
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-neutral-300">
          {/* Status Box */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
              isEnabled
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                : 'bg-amber-950/30 border-amber-800/60 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isEnabled ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <span className="font-bold block text-white text-xs">
                  {isEnabled ? 'Autostart Ativo no Ubuntu' : 'Autostart Inativo'}
                </span>
                <span className="text-[11px] opacity-90 block">
                  {isEnabled
                    ? 'O servidor no localhost:3000 iniciará automaticamente no boot do sistema.'
                    : 'O localhost para quando você reinicia o PC até que seja ativado.'}
                </span>
              </div>
            </div>

            {isEnabled ? (
              <button
                type="button"
                disabled={loading}
                onClick={handleDisable}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950 text-neutral-300 hover:text-rose-300 border border-neutral-700 font-medium whitespace-nowrap cursor-pointer transition-colors"
              >
                Desativar
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleEnable}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-bold whitespace-nowrap cursor-pointer transition-colors shadow-xs"
              >
                {loading ? 'Configurando...' : '🚀 Ativar com 1 Clique'}
              </button>
            )}
          </div>

          {message && (
            <div className="p-3 rounded-lg bg-[#1b1c24] border border-[#262835] text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* Explanation & Technical details */}
          <div className="space-y-2">
            <h3 className="font-semibold text-white text-xs flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              Como funciona o autostart no Ubuntu:
            </h3>
            <ul className="list-disc pl-4 space-y-1 text-neutral-400 leading-relaxed text-[11px]">
              <li>
                Cria o arquivo de inicialização GNOME em <code className="text-neutral-200 font-mono">~/.config/autostart/chrome-pwa-hub-autostart.desktop</code>.
              </li>
              <li>
                Cria e registra o serviço de usuário no systemd em <code className="text-neutral-200 font-mono">~/.config/systemd/user/chrome-pwa-hub.service</code>.
              </li>
              <li>
                Inicia o processo Node em background na porta 3000 toda vez que o Ubuntu é iniciado.
              </li>
            </ul>
          </div>

          {/* Alternative Terminal Script Command */}
          <div className="p-3 rounded-xl bg-[#0d0e12] border border-[#242633] space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400 font-medium flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                Ou execute via Terminal no Ubuntu:
              </span>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <div className="bg-black/80 rounded-lg p-2 font-mono text-[11px] text-emerald-400 border border-neutral-800 break-all select-all">
              {terminalCommand}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#242633] flex items-center justify-end bg-[#0f1014]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-xs cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
