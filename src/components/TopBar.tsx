import React, { useRef } from 'react';
import { Plus, Download, Upload, CheckCircle2, RotateCcw, RotateCw, Layers, FolderOpen, ChevronDown, Link, Github } from 'lucide-react';
import { PWAStats } from '../types/pwa';

interface TopBarProps {
  stats: PWAStats;
  todayDisplay: string;
  onSelectDesktopFiles: (files: FileList) => void;
  onOpenManualAddModal: () => void;
  onOpenBackupModal: () => void;
  onOpenUpdateModal: () => void;
  onMarkAllToday: () => void;
  onResetToday: () => void;
  onLoad100Sample: () => void;
  onRefreshAllIcons?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  stats,
  todayDisplay,
  onSelectDesktopFiles,
  onOpenManualAddModal,
  onOpenBackupModal,
  onOpenUpdateModal,
  onMarkAllToday,
  onResetToday,
  onLoad100Sample,
  onRefreshAllIcons,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectDesktopFiles(e.target.files);
      // Reset input value so re-selecting same files triggers change event
      e.target.value = '';
    }
  };

  const handleOpenExplorer = () => {
    fileInputRef.current?.click();
  };

  return (
    <header className="border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-20">
      {/* Hidden file input that opens native Ubuntu / OS file explorer for .desktop files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".desktop,application/x-desktop,text/plain"
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
        data-testid="ubuntu-desktop-file-input"
      />

      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/"
            className="text-base md:text-lg font-bold tracking-tight text-white hover:text-neutral-200 transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-400 via-rose-500 to-emerald-500 p-0.5 flex items-center justify-center shadow-xs">
              <div className="w-full h-full bg-neutral-950 rounded-[4px] flex items-center justify-center">
                <span className="text-[10px] font-black text-white">PWA</span>
              </div>
            </div>
            <span>Chrome PWA Hub</span>
          </a>
        </div>

        {/* Zone 2: Informational Stats (Clean unboxed text with typographic separators) */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400 whitespace-nowrap shrink-0 font-mono">
          <span className="text-neutral-300 font-sans">{todayDisplay}</span>
          <span aria-hidden="true" className="text-neutral-400">·</span>
          <span>
            <strong className="text-emerald-400 font-semibold tabular-nums">
              {stats.accessedTodayCount}
            </strong>{' '}
            / {stats.total} acessadas
          </span>
          <span aria-hidden="true" className="text-neutral-400">·</span>
          <span>
            <strong className="text-rose-400 font-semibold tabular-nums">
              {stats.pendingTodayCount}
            </strong>{' '}
            pendentes
          </span>
          <span aria-hidden="true" className="text-neutral-400">·</span>
          <span className="text-neutral-300 tabular-nums">
            {stats.completionPercentage}% concluído
          </span>
        </div>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Mark All / Reset Today dropdown/buttons */}
          <div className="relative group/actions">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Ações do Dia</span>
            </button>
            <div className="absolute right-0 mt-1 w-48 py-1 bg-neutral-900 border border-neutral-800 rounded-md shadow-xl opacity-0 invisible group-hover/actions:opacity-100 group-hover/actions:visible transition-all z-30">
              <button
                type="button"
                onClick={onMarkAllToday}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 hover:text-emerald-400 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Marcar todas hoje</span>
              </button>
              <button
                type="button"
                onClick={onResetToday}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 hover:text-rose-400 flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Resetar status de hoje</span>
              </button>
              {onRefreshAllIcons && (
                <button
                  type="button"
                  onClick={onRefreshAllIcons}
                  className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 hover:text-emerald-400 flex items-center gap-2 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Recarregar todos os ícones</span>
                </button>
              )}
              <div className="border-t border-neutral-800 my-1" />
              <button
                type="button"
                onClick={onOpenBackupModal}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-neutral-400" />
                <span>Backup / Restaurar</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenBackupModal}
            title="Importar ou exportar JSON"
            aria-label="Backup e exportação"
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors cursor-pointer hidden sm:block"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* GitHub Updater Button */}
          <button
            type="button"
            onClick={onOpenUpdateModal}
            title="Verificar e atualizar do GitHub (pinguelanarosca/HubPWA)"
            aria-label="Atualizações do GitHub"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-md transition-colors whitespace-nowrap cursor-pointer shrink-0"
          >
            <Github className="w-3.5 h-3.5 text-neutral-300" />
            <span className="hidden md:inline">Atualizar</span>
          </button>

          {/* Primary CTA: "Nova PWA" opens Ubuntu file explorer directly for .desktop files */}
          <div className="relative inline-flex items-stretch rounded-md shadow-xs">
            <button
              type="button"
              onClick={handleOpenExplorer}
              title="Abrir explorador de arquivos do Ubuntu para selecionar PWAs (.desktop)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-l-md transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5 text-neutral-950" />
              <span>Nova PWA</span>
            </button>

            {/* Dropdown toggle for alternative manual URL entry */}
            <div className="relative group/newpwa">
              <button
                type="button"
                aria-label="Mais opções de cadastro"
                className="h-full px-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-r-md border-l border-emerald-600/40 flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              <div className="absolute right-0 mt-1 w-56 py-1 bg-neutral-900 border border-neutral-800 rounded-md shadow-xl opacity-0 invisible group-hover/newpwa:opacity-100 group-hover/newpwa:visible transition-all z-30">
                <button
                  type="button"
                  onClick={handleOpenExplorer}
                  className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <span className="font-semibold block text-white">Selecionar arquivos .desktop</span>
                    <span className="text-[10px] text-neutral-400 block font-mono">~/.local/share/applications</span>
                  </div>
                </button>
                <div className="border-t border-neutral-800 my-1" />
                <button
                  type="button"
                  onClick={onOpenManualAddModal}
                  className="w-full text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5 text-neutral-400" />
                  <div>
                    <span className="font-medium block text-neutral-300">Cadastrar URL manualmente</span>
                    <span className="text-[10px] text-neutral-400 block">Digitar nome e endereço</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
