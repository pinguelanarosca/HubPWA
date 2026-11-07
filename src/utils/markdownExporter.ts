import { PWAItem } from '../types/pwa';
import { formatAccessLogDash } from './pwaLogic';

/**
 * Extracts selected PWAs into a formatted Markdown (.md) document and triggers browser file download.
 */
export function extractPWAsToMarkdown(items: PWAItem[], selectedIds: Set<string>): void {
  const selectedItems = items.filter((it) => selectedIds.has(it.id));
  if (selectedItems.length === 0) return;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  let mdContent = `# Relatório de PWAs Extraídas - Chrome PWA Hub\n\n`;
  mdContent += `> **Data de Extração:** ${dateFormatted} às ${timeFormatted}  \n`;
  mdContent += `> **Total de PWAs Selecionadas:** ${selectedItems.length}\n\n`;
  mdContent += `---\n\n`;

  // Group items by group name for a clean document structure
  const groupsMap = new Map<string, PWAItem[]>();
  selectedItems.forEach((item) => {
    const grp = item.group || item.category || 'Geral';
    if (!groupsMap.has(grp)) {
      groupsMap.set(grp, []);
    }
    groupsMap.get(grp)!.push(item);
  });

  const sortedGroups = Array.from(groupsMap.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  for (const grpName of sortedGroups) {
    const grpItems = groupsMap.get(grpName) || [];
    mdContent += `## Grupo: ${grpName} (${grpItems.length})\n\n`;

    for (const item of grpItems) {
      const accessLogStr = formatAccessLogDash(item.lastAccessedDate);
      const ratingStr = typeof item.rating === 'number' && item.rating > 0 ? '⭐'.repeat(item.rating) : 'Sem classificação';

      mdContent += `### [${item.name}](${item.url})\n`;
      mdContent += `- **URL:** \`${item.url}\`\n`;
      mdContent += `- **Classificação:** ${ratingStr}\n`;
      mdContent += `- **Último Acesso:** ${accessLogStr}\n`;
      if (item.notes && item.notes.trim()) {
        mdContent += `- **Anotações:** ${item.notes.trim()}\n`;
      }
      mdContent += `\n`;
    }
  }

  mdContent += `---\n*Gerado automaticamente pelo Chrome PWA Hub*\n`;

  // Trigger browser download of .md file
  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateSuffix = now.toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `pwa-urls-${dateSuffix}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
