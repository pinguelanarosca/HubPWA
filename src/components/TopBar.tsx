import React, { useRef } from 'react';
import {
  Plus,
  Upload,
  CheckCircle2,
  RotateCcw,
  RotateCw,
  FolderOpen,
  ChevronDown,
  Link,
  Calendar,
  Target,
  Power,
  History,
  Loader2,
  RefreshCw,
  Terminal,
  Image as ImageIcon,
} from 'lucide-react';
import { PWAStats } from '../types/pwa';

export interface TopBarActivityStatus {
  isExecuting: boolean;
  executingLabel?: string | null;
  isUpdatingIcons: boolean;
  iconsLabel?: string | null;
  isRunningScript: boolean;
  scriptLabel?: string | null;
}

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
  onSyncProfileHistory?: () => void;
  isSyncingHistory?: boolean;
  activityStatus?: TopBarActivityStatus;
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
  onSyncProfileHistory,
  isSyncingHistory = false,
  activityStatus,
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

  const isExecuting = Boolean(activityStatus?.isExecuting || isSyncingHistory);
  const executingText = activityStatus?.executingLabel || (isSyncingHistory ? 'Sincronizando...' : 'Executando...');
  const isUpdatingIcons = Boolean(activityStatus?.isUpdatingIcons);
  const iconsText = activityStatus?.iconsLabel || 'Atualizando...';
  const isRunningScript = Boolean(activityStatus?.isRunningScript);
  const scriptText = activityStatus?.scriptLabel || 'Rodando...';

  return (
    <header
      data-testid="topbar"
      className="relative z-20 bg-[#0d0e12]/95"
    >
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

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 min-w-0">
        {/* Brand Header */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/"
            className="text-sm sm:text-base font-bold tracking-tight text-white hover:text-neutral-200 transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <img
              src="/favicon.svg"
              alt="Chrome PWA Hub Logo"
              className="w-6 h-6 rounded-md shadow-md shrink-0"
            />
            <span className="font-extrabold text-white text-sm sm:text-base">Chrome PWA Hub</span>
          </a>
        </div>

        {/* Real-time Activity Status Indicators (Executing, Updating Icons, Running Script) */}
        <div
          data-testid="topbar-activity-status"
          aria-live="polite"
          className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#14151a] border border-[#242633] text-[10px] font-medium whitespace-nowrap min-w-0 shrink max-w-[230px] xl:max-w-[265px] overflow-hidden"
        >
          {/* Executing Action Status */}
          <span
            data-testid="topbar-status-executing"
            title={isExecuting ? `Executando: ${executingText}` : 'Execução: nenhuma ação ativa'}
            className={`inline-flex items-center gap-1 min-w-0 transition-colors ${
              isExecuting ? 'text-amber-300 font-semibold' : 'text-neutral-500'
            }`}
          >
            {isExecuting ? (
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 shrink-0" />
            )}
            <span className="truncate max-w-[72px] xl:max-w-[84px]">
              {isExecuting ? executingText : 'Exec.'}
            </span>
          </span>

          <span aria-hidden="true" className="h-3 w-px bg-[#242633] shrink-0" />

          {/* Updating Icons Status */}
          <span
            data-testid="topbar-status-icons"
            title={isUpdatingIcons ? `Ícones: ${iconsText}` : 'Ícones: atualização inativa'}
            className={`inline-flex items-center gap-1 min-w-0 transition-colors ${
              isUpdatingIcons ? 'text-sky-300 font-semibold' : 'text-neutral-500'
            }`}
          >
            {isUpdatingIcons ? (
              <RefreshCw className="w-3 h-3 text-sky-400 animate-spin shrink-0" />
            ) : (
              <ImageIcon className="w-3 h-3 text-neutral-600 shrink-0" />
            )}
            <span className="truncate max-w-[66px] xl:max-w-[76px]">
              {isUpdatingIcons ? iconsText : 'Ícones'}
            </span>
          </span>

          <span aria-hidden="true" className="h-3 w-px bg-[#242633] shrink-0" />

          {/* Running Script Status */}
          <span
            data-testid="topbar-status-script"
            title={isRunningScript ? `Script ativo: ${scriptText}` : 'Script: nenhum em execução'}
            className={`inline-flex items-center gap-1 min-w-0 transition-colors ${
              isRunningScript ? 'text-violet-300 font-semibold' : 'text-neutral-500'
            }`}
          >
            <Terminal
              className={`w-3 h-3 shrink-0 ${
                isRunningScript ? 'text-violet-400 animate-pulse' : 'text-neutral-600'
              }`}
            />
            <span className="truncate max-w-[72px] xl:max-w-[84px]">
              {isRunningScript ? scriptText : 'Script'}
            </span>
          </span>
        </div>

        {/* Compact Single-Row Stats & Progress Bar */}
        <div
          className="hidden lg:flex items-center gap-1.5 text-[11px] text-neutral-300 whitespace-nowrap shrink-0 notranslate"
          translate="no"
        >
          {/* Current Date */}
          <div className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#14151a] border border-[#242633]">
            <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
            <span className="font-medium text-neutral-200">{todayDisplay}</span>
          </div>

          {/* Accessed Chip */}
          <div
            title={`Verde: ${stats.accessedTodayCount} acessadas hoje`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-semibold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="tabular-nums">{stats.accessedTodayCount} acess.</span>
          </div>

          {/* Pending Chip */}
          <div
            title={`Vermelho: ${stats.pendingTodayCount} pendentes hoje`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/80 text-rose-300 font-semibold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="tabular-nums">{stats.pendingTodayCount} pend.</span>
          </div>

          {/* Completion % + Compact Visual Progress Bar */}
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#14151a] border border-[#242633] text-neutral-300">
            <Target className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="font-bold text-white tabular-nums">{stats.completionPercentage}%</span>
            <div className="w-14 bg-[#1b1c24] rounded-full h-1.5 overflow-hidden border border-[#262835]">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.completionPercentage}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-neutral-400 tabular-nums">
              {stats.accessedTodayCount}/{stats.total}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Daily Actions Dropdown */}
          <div className="relative group/actions">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-200 hover:text-white bg-[#14151a] hover:bg-[#1e2028] border border-[#242633] rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Ações do Dia</span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>
            <div className="absolute right-0 mt-1 w-52 py-1 bg-[#14151a] border border-[#242633] rounded-xl shadow-2xl opacity-0 invisible group-hover/actions:opacity-100 group-hover/actions:visible transition-all z-50 text-xs">
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
              {onSyncProfileHistory && (
                <button
                  type="button"
                  data-testid="topbar-sync-history-btn"
                  disabled={isSyncingHistory}
                  onClick={onSyncProfileHistory}
                  className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-[#1e2028] hover:text-emerald-400 disabled:opacity-60 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <History className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingHistory ? 'animate-spin' : ''}`} />
                  <span>{isSyncingHistory ? 'Sincronizando histórico...' : 'Sincronizar Histórico dos Perfis'}</span>
                </button>
              )}
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
                  className="w-full text-left px-3 py-2 text-neutral-200 hover:bg-[#1e2028] hover:text-sky-400 flex items-center gap-2 cursor-pointer font-medium"
                >
                  <RotateCw className="w-3.5 h-3.5 text-sky-400" />
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
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/80 rounded-md transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Power className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Autostart</span>
            </button>
          )}

          {/* GitHub Update Button */}
          <button
            type="button"
            onClick={onOpenUpdateModal}
            title="Atualizar do GitHub"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-200 hover:text-white bg-[#14151a] hover:bg-[#1e2028] border border-[#242633] rounded-md transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <RotateCw className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {/* Primary CTA: "Nova PWA" */}
          <div className="relative inline-flex items-stretch rounded-md shadow-sm">
            <button
              type="button"
              onClick={handleOpenExplorer}
              title="Abrir explorador de arquivos do Ubuntu (.desktop)"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-l-md transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-neutral-950 stroke-[3]" />
              <span>Nova PWA</span>
            </button>

            {/* Dropdown toggle */}
            <div className="relative group/newpwa">
              <button
                type="button"
                aria-label="Mais opções de cadastro"
                className="h-full px-1 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-r-md border-l border-emerald-600/40 flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              <div className="absolute right-0 mt-1 w-56 py-1 bg-[#14151a] border border-[#242633] rounded-xl shadow-2xl opacity-0 invisible group-hover/newpwa:opacity-100 group-hover/newpwa:visible transition-all z-50 text-xs">
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
