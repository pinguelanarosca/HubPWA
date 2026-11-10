import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { getCleanDomain } from '../utils/pwaLogic';

interface PWAIconProps {
  icon?: string;
  name: string;
  url?: string;
  customIcon?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const PWAIcon: React.FC<PWAIconProps> = ({
  icon,
  name,
  url,
  customIcon,
  size = 'sm',
  className = '',
}) => {
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

  const sizeClasses = {
    xs: 'w-4 h-4 text-[10px] rounded',
    sm: 'w-5 h-5 text-xs rounded',
    md: 'w-7 h-7 text-sm rounded-md',
    lg: 'w-9 h-9 text-base rounded-lg',
    xl: 'w-14 h-14 text-xl rounded-xl', // Protagonist Card View (56x56 px)
  }[size];

  const rawCandidate = (customIcon || icon || '').trim();

  // 1. Extract domain from name if name contains a domain (e.g. "03win.com", "13E.COM", "07win.com")
  let domain = '';
  const nameDomainMatch = name.trim().match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/i);
  if (nameDomainMatch) {
    domain = nameDomainMatch[1].toLowerCase().replace(/^www\./, '');
  }

  // 2. If no domain from name, extract from URL
  if (!domain && url) {
    domain = getCleanDomain(url);
  }
  if (domain && domain.endsWith('com.com')) {
    domain = domain.slice(0, -7) + '.com';
  }

  // Build candidate sources in order of priority
  const candidateSources: string[] = [];

  // If a valid custom icon or explicit external icon URL is provided (not an internal /api/icon path), try it
  if (
    rawCandidate &&
    (rawCandidate.startsWith('http://') || rawCandidate.startsWith('https://') || rawCandidate.startsWith('data:')) &&
    !rawCandidate.includes('/api/icon')
  ) {
    candidateSources.push(rawCandidate);
  }

  // DuckDuckGo, Google gstatic, local server proxy, and Google S2
  if (domain && domain !== 'app.com' && domain !== 'seu-app.com') {
    const duckDuckGoFavicon = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    if (!candidateSources.includes(duckDuckGoFavicon)) {
      candidateSources.push(duckDuckGoFavicon);
    }
    const googleGstatic = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
    if (!candidateSources.includes(googleGstatic)) {
      candidateSources.push(googleGstatic);
    }
    const localProxyFavicon = `/api/icon?domain=${encodeURIComponent(domain)}`;
    if (!candidateSources.includes(localProxyFavicon)) {
      candidateSources.push(localProxyFavicon);
    }
    const googleS2Favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    if (!candidateSources.includes(googleS2Favicon)) {
      candidateSources.push(googleS2Favicon);
    }
  }

  // Local /api/icon endpoint fallback with domain hint
  if (rawCandidate) {
    let candidateWithDomain = rawCandidate;
    if (domain && candidateWithDomain.includes('/api/icon') && !candidateWithDomain.includes('domain=')) {
      candidateWithDomain += `&domain=${encodeURIComponent(domain)}`;
    }
    if (!candidateSources.includes(candidateWithDomain)) {
      candidateSources.push(candidateWithDomain);
    }
  }

  // Reset fallback index when candidate inputs change
  useEffect(() => {
    setCurrentSourceIndex(0);
  }, [rawCandidate, url, name]);

  const activeSrc = candidateSources[currentSourceIndex] || null;
  const isExhausted = !activeSrc || currentSourceIndex >= candidateSources.length;

  const initial = (name.trim().charAt(0) || 'P').toUpperCase();

  // Consistent color for fallback initial badge based on name string
  const getInitialBg = (str: string) => {
    const hues = [
      'bg-blue-900/60 text-blue-300 border-blue-700/50',
      'bg-emerald-900/60 text-emerald-300 border-emerald-700/50',
      'bg-purple-900/60 text-purple-300 border-purple-700/50',
      'bg-amber-900/60 text-amber-300 border-amber-700/50',
      'bg-rose-900/60 text-rose-300 border-rose-700/50',
      'bg-cyan-900/60 text-cyan-300 border-cyan-700/50',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hues[Math.abs(hash) % hues.length];
  };

  // If all image sources fail or no sources exist, render colored initial badge
  if (isExhausted || !activeSrc) {
    return (
      <div
        className={`${sizeClasses} shrink-0 rounded flex items-center justify-center font-bold border ${getInitialBg(name)} ${className}`}
        title={name}
        aria-hidden="true"
      >
        {name ? initial : <Globe className="w-3 h-3 opacity-70" />}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses} shrink-0 rounded bg-neutral-900/80 border border-neutral-800 p-0.5 flex items-center justify-center overflow-hidden shadow-xs ${className}`}
    >
      <img
        key={activeSrc}
        src={activeSrc}
        alt={`Ícone de ${name}`}
        referrerPolicy="no-referrer"
        loading="lazy"
        className="w-full h-full object-contain"
        onError={() => setCurrentSourceIndex((prev) => prev + 1)}
      />
    </div>
  );
};
