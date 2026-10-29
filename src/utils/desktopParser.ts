import { PWAItem } from '../types/pwa';
import { resolveFaviconAtInsertion } from './pwaLogic';

export interface ParsedDesktopApp {
  id: string;
  name: string;
  url: string;
  category: string;
  notes: string;
  icon?: string;
  rawFileName: string;
  hasExactUrl: boolean;
  appId?: string;
}

// Known common web apps map for Chrome --app-id PWAs on Linux
const COMMON_APP_URLS: Record<string, { url: string; category: string }> = {
  gmail: { url: 'https://mail.google.com', category: 'Google Workspace' },
  'google agenda': { url: 'https://calendar.google.com', category: 'Google Workspace' },
  'google calendar': { url: 'https://calendar.google.com', category: 'Google Workspace' },
  'google drive': { url: 'https://drive.google.com', category: 'Google Workspace' },
  'google docs': { url: 'https://docs.google.com', category: 'Google Workspace' },
  'google sheets': { url: 'https://sheets.google.com', category: 'Google Workspace' },
  'google keep': { url: 'https://keep.google.com', category: 'Google Workspace' },
  'google meet': { url: 'https://meet.google.com', category: 'Google Workspace' },
  'google maps': { url: 'https://maps.google.com', category: 'Google Workspace' },
  'google fotos': { url: 'https://photos.google.com', category: 'Google Workspace' },
  'google photos': { url: 'https://photos.google.com', category: 'Google Workspace' },
  'google gemini': { url: 'https://gemini.google.com', category: 'IA & Assistentes' },
  gemini: { url: 'https://gemini.google.com', category: 'IA & Assistentes' },
  notion: { url: 'https://notion.so', category: 'Produtividade' },
  linear: { url: 'https://linear.app', category: 'Produtividade' },
  trello: { url: 'https://trello.com', category: 'Produtividade' },
  todoist: { url: 'https://todoist.com', category: 'Produtividade' },
  github: { url: 'https://github.com', category: 'Dev & Código' },
  vercel: { url: 'https://vercel.com', category: 'Dev & Código' },
  stackblitz: { url: 'https://stackblitz.com', category: 'Dev & Código' },
  excalidraw: { url: 'https://excalidraw.com', category: 'Dev & Código' },
  figma: { url: 'https://figma.com', category: 'Design & Criatividade' },
  canva: { url: 'https://canva.com', category: 'Design & Criatividade' },
  spotify: { url: 'https://open.spotify.com', category: 'Design & Criatividade' },
  youtube: { url: 'https://youtube.com', category: 'Design & Criatividade' },
  'youtube music': { url: 'https://music.youtube.com', category: 'Design & Criatividade' },
  slack: { url: 'https://slack.com', category: 'Comunicação' },
  discord: { url: 'https://discord.com', category: 'Comunicação' },
  'whatsapp web': { url: 'https://web.whatsapp.com', category: 'Comunicação' },
  whatsapp: { url: 'https://web.whatsapp.com', category: 'Comunicação' },
  'telegram web': { url: 'https://web.telegram.org', category: 'Comunicação' },
  telegram: { url: 'https://web.telegram.org', category: 'Comunicação' },
  chatgpt: { url: 'https://chatgpt.com', category: 'IA & Assistentes' },
  claude: { url: 'https://claude.ai', category: 'IA & Assistentes' },
  perplexity: { url: 'https://perplexity.ai', category: 'IA & Assistentes' },
  bitwarden: { url: 'https://vault.bitwarden.com', category: 'Ferramentas & Utilitários' },
  stripe: { url: 'https://dashboard.stripe.com', category: 'Finanças & Negócios' },
  'stripe dashboard': { url: 'https://dashboard.stripe.com', category: 'Finanças & Negócios' },
  wise: { url: 'https://wise.com', category: 'Finanças & Negócios' },
  nubank: { url: 'https://conta.nubank.com.br', category: 'Finanças & Negócios' },
};

/**
 * Maps standard XDG desktop entry categories to app categories
 */
export function mapDesktopCategory(categoriesStr: string): string {
  if (!categoriesStr) return 'Geral';
  const tokens = categoriesStr
    .toLowerCase()
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean);

  // Check high-specificity categories first
  if (tokens.some((t) => t === 'chat' || t === 'instantmessaging' || t === 'telephony' || t === 'email')) {
    return 'Comunicação';
  }
  if (tokens.some((t) => t === 'development' || t === 'programming' || t === 'ide' || t === 'texteditor')) {
    return 'Dev & Código';
  }
  if (tokens.some((t) => t === 'audiovideo' || t === 'audio' || t === 'video' || t === 'graphics' || t === 'player')) {
    return 'Design & Criatividade';
  }
  if (tokens.some((t) => t === 'office' || t === 'projectmanagement')) {
    return 'Produtividade';
  }
  if (tokens.some((t) => t === 'finance' || t === 'business')) {
    return 'Finanças & Negócios';
  }
  if (tokens.some((t) => t === 'utility' || t === 'settings' || t === 'security')) {
    return 'Ferramentas & Utilitários';
  }
  if (tokens.some((t) => t === 'network' || t === 'webbrowser')) {
    return 'Web';
  }

  return 'Produtividade';
}

/**
 * Parses the raw text content of an Ubuntu .desktop file
 */
export function parseDesktopFile(content: string, fileName: string = ''): ParsedDesktopApp | null {
  const lines = content.split(/\r?\n/);
  const data: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();
      // Keep first or specific localized keys
      if (!data[key]) {
        data[key] = value;
      }
    }
  }

  // Name resolution
  let name = data['Name[pt_BR]'] || data['Name[pt]'] || data['Name'] || '';
  if (!name && fileName) {
    name = fileName.replace(/\.desktop$/i, '').replace(/^chrome-.*?-/, '');
  }
  name = name.trim();
  if (!name) return null;

  // Exec line resolution
  const execLine = data['Exec'] || '';
  const comment = data['Comment[pt_BR]'] || data['Comment'] || data['GenericName'] || '';
  const rawCategories = data['Categories'] || '';
  const icon = data['Icon'] || '';

  let detectedUrl = '';
  let hasExactUrl = false;
  let appId: string | undefined = undefined;

  // 1. Direct URL= key in desktop entry
  if (data['URL']) {
    detectedUrl = data['URL'].trim();
    hasExactUrl = true;
  }

  // 2. Search for --app=https://... in Exec line
  if (!detectedUrl && execLine) {
    const appMatch = execLine.match(/--app=(?:["']([^"']+)["']|([^\s"']+))/i);
    if (appMatch) {
      detectedUrl = (appMatch[1] || appMatch[2] || '').trim();
      hasExactUrl = true;
    }
  }

  // 3. Search for direct https:// in Exec line
  if (!detectedUrl && execLine) {
    const httpMatch = execLine.match(/(https?:\/\/[^\s"']+)/i);
    if (httpMatch) {
      detectedUrl = httpMatch[1].trim();
      hasExactUrl = true;
    }
  }

  // 4. Extract --app-id=... from Chrome Exec
  if (execLine) {
    const appIdMatch = execLine.match(/--app-id=([a-zA-Z0-9_-]+)/i);
    if (appIdMatch) {
      appId = appIdMatch[1];
    }
  }

  // 5. If no exact URL, look up in common apps map by name
  let category = mapDesktopCategory(rawCategories);
  const normalizedName = name.toLowerCase().replace(/[\-_]/g, ' ').trim();

  if (!detectedUrl) {
    for (const [key, known] of Object.entries(COMMON_APP_URLS)) {
      if (normalizedName === key || normalizedName.startsWith(key) || normalizedName.includes(key)) {
        detectedUrl = known.url;
        category = known.category;
        hasExactUrl = true;
        break;
      }
    }
  }

  // Fallback URL if still not detected: create clean domain suggestion
  if (!detectedUrl) {
    const sanitizedDomain = normalizedName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
    detectedUrl = `https://${sanitizedDomain || 'app'}.com`;
    hasExactUrl = false;
  }

  let resolvedIcon: string | undefined = undefined;
  if (icon && (icon.startsWith('http') || icon.startsWith('/') || icon.startsWith('data:'))) {
    resolvedIcon = icon;
  } else if (detectedUrl) {
    resolvedIcon = resolveFaviconAtInsertion(detectedUrl);
  }

  return {
    id: `pwa_desktop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    url: detectedUrl,
    category,
    notes: comment ? `${comment} (Importado do Ubuntu)` : 'Importado do Ubuntu Desktop',
    icon: resolvedIcon,
    rawFileName: fileName,
    hasExactUrl,
    appId,
  };
}

/**
 * Converts a list of ParsedDesktopApp into PWAItem objects
 */
export function convertParsedToPWAs(parsedList: ParsedDesktopApp[]): PWAItem[] {
  return parsedList.map((parsed) => ({
    id: parsed.id,
    name: parsed.name,
    url: parsed.url,
    category: parsed.category,
    notes: parsed.notes,
    icon: parsed.icon,
    lastAccessedDate: null,
    accessCount: 0,
    pinned: false,
    createdAt: new Date().toISOString(),
  }));
}
