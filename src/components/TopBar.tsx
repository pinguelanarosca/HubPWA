import React, { useRef } from 'react';
import { Plus, Download, Upload, CheckCircle2, RotateCcw, RotateCw, FolderOpen, ChevronDown, Link, Github, Calendar, Target, Power } from 'lucide-react';
import { PWAStats } from '../types/pwa';

interface TopBarProps {
  stats: PWAStats;
  todayDisplay: string;
  onSelectDesktopFiles: (files: FileList) => void;
  onOpenManualAddModal: () => void;
  onOpenBackupModal: () => void;
  onOpenUpdateModal: () => void;
  onOpenAutostartModal?: () => void;
  onMarkAllToday: () => void;
  onResetToday: () => void;
  onRefreshAllIcons?: () => void;
  onRescanLocalPWAs?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  stats,
  todayDisplay,
  onSelectDesktopFiles,
  onOpenManualAddModal,
  onOpenBackupModal,
  onOpenUpdateModal,
  onOpenAutostartModal,
  onMarkAllToday,
  onResetToday,
  onRefreshAllIcons,
  onRescanLocalPWAs,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectDesktopFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleOpenExplorer = () => {
    fileInputRef.current?.click();
  };

  return (
    <header className="border-b border-[#242633] bg-[#0d0e12]/95 backdrop-blur-md sticky top-0 z-30">
      {/* Hidden file input for native Ubuntu .desktop files */}
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

      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Header */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/"
            className="text-base md:text-lg font-bold tracking-tight text-white hover:text-neutral-200 transition-colors whitespace-nowrap flex items-center gap-2.5"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 via-rose-500 to-emerald-500 p-0.5 flex items-center justify-center shadow-md">
              <div className="w-full h-full bg-[#0d0e12] rounded-[5px] flex items-center justify-center">
                <span className="text-[10px] font-black text-white tracking-widest">PWA</span>
              </div>
            </div>
            <span className="font-extrabold text-white text-base md:text-lg">Chrome PWA Hub</span>
          </a>
        </div>

        {/* Informational Stats & Progress Bar */}
        <div className="hidden xl:flex items-center gap-3 text-xs text-neutral-300 whitespace-nowrap shrink-0 notranslate" translate="no">
          {/* Current Date */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14151a] border border-[#242633]">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-medium text-neutral-200">{todayDisplay}</span>
          </div>

          {/* Accessed Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{stats.accessedTodayCount} acessadas</span>
          </div>

          {/* Pending Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{stats.pendingTodayCount} pendentes</span>
          </div>

          {/* Target completion percentage */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#14151a] border border-[#242633] text-neutral-300">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-white">{stats.completionPercentage}%</span>
            <span className="text-neutral-400">concluído</span>
          </div>

          {/* Visual Progress Bar */}
          <div className="flex items-center gap-2 pl-1">
            <div className="w-24 bg-[#1b1c24] rounded-full h-2 overflow-hidden border border-[#262835]">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.completionPercentage}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-neutral-400">
              {stats.accessedTodayCount} / {stats.total}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Daily Actions Dropdown */}
          <div className="relative group/actions">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:text-white bg-[#14151a] hover:bg-[#1e2028] border border-[#242633] rounded-lg transition-colors cursor-pointer"
            >
              <span>Ações do Dia</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>
            <div className="absolute right-0 mt-1 w-52 py-1 bg-[#14151a] border border-[#242633] rounded-xl shadow-2xl opacity-0 invisible group-hover/actions:opacity-100 group-hover/actions:visible transition-all z-40 text-xs">
              <button
                type="button"
                onClick={onMarkAllToday}
                className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-[#1e2028] hover:text-emerald-400 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Marcar todas como acessadas</span>
              </button>
              <button
                type="button"
                onClick={onResetToday}
                className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-[#1e2028] hover:text-rose-400 flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Resetar status de hoje</span>
              </button>
              {onRescanLocalPWAs && (
                <button
                  type="button"
                  onClick={onRescanLocalPWAs}
                  className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-[#1e2028] hover:text-emerald-400 flex items-center gap-2 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sincronizar PWAs locais</span>
                </button>
              )}
              {onRefreshAllIcons && (
                <button
                  type="button"
                  onClick={onRefreshAllIcons}
                  className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-[#1e2028] hover:text-emerald-400 flex items-center gap-2 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Recarregar todos os ícones</span>
                </button>
              )}
              <div className="border-t border-[#242633] my-1" />
              <button
                type="button"
                onClick={onOpenBackupModal}
                className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-[#1e2028] flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-neutral-400" />
                <span>Backup / Restaurar</span>
              </button>
            </div>
          </div>

          {/* Autostart Ubuntu Button */}
          {onOpenAutostartModal && (
            <button
              type="button"
              onClick={onOpenAutostartModal}
              title="Configurar inicialização automática ao ligar ou reiniciar o PC (Ubuntu)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/80 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <Power className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Autostart Ubuntu</span>
            </button>
          )}

          {/* GitHub Update Button */}
          <button
            type="button"
            onClick={onOpenUpdateModal}
            title="Atualizar do GitHub"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:text-white bg-[#14151a] hover:bg-[#1e2028] border border-[#242633] rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Atualizar</span>
          </button>

          {/* Primary CTA: "Nova PWA" */}
          <div className="relative inline-flex items-stretch rounded-lg shadow-sm">
            <button
              type="button"
              onClick={handleOpenExplorer}
              title="Abrir explorador de arquivos do Ubuntu (.desktop)"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-l-lg transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-neutral-950 stroke-[3]" />
              <span>Nova PWA</span>
            </button>

            {/* Dropdown toggle */}
            <div className="relative group/newpwa">
              <button
                type="button"
                aria-label="Mais opções de cadastro"
                className="h-full px-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-r-lg border-l border-emerald-600/40 flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              <div className="absolute right-0 mt-1 w-56 py-1 bg-[#14151a] border border-[#242633] rounded-xl shadow-2xl opacity-0 invisible group-hover/newpwa:opacity-100 group-hover/newpwa:visible transition-all z-40 text-xs">
                <button
                  type="button"
                  onClick={handleOpenExplorer}
                  className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-[#1e2028] flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <span className="font-semibold block text-white">Selecionar arquivos .desktop</span>
                    <span className="text-[10px] text-neutral-400 block font-mono">~/.local/share/applications</span>
                  </div>
                </button>
                <div className="border-t border-[#242633] my-1" />
                <button
                  type="button"
                  onClick={onOpenManualAddModal}
                  className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-[#1e2028] flex items-center gap-2 cursor-pointer"
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
