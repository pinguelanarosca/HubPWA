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

  // 1. Raw candidate icon path or name (from desktop file or custom entry)
  if (rawCandidate) {
    let candidatePath = rawCandidate;
    if (domain && candidatePath.includes('/api/icon') && !candidatePath.includes('domain=')) {
      candidatePath += `&domain=${encodeURIComponent(domain)}`;
    }
    if (!candidateSources.includes(candidatePath)) {
      candidateSources.push(candidatePath);
    }
  }

  // 2. Server-side smart proxy for domain
  if (domain && domain !== 'app.com' && domain !== 'seu-app.com') {
    const localProxyFavicon = `/api/icon?domain=${encodeURIComponent(domain)}&name=${encodeURIComponent(name)}`;
    if (!candidateSources.includes(localProxyFavicon)) {
      candidateSources.push(localProxyFavicon);
    }
  }

  // Reset fallback index when candidate inputs change
  useEffect(() => {
    setCurrentSourceIndex(0);
  }, [rawCandidate, url, name]);

  const activeSrc = candidateSources[currentSourceIndex] || null;
  const isExhausted = !activeSrc || currentSourceIndex >= candidateSources.length;

  // Short clean label for badge fallback (e.g. "11KK", "31M", "03W")
  const badgeLabel = (name || domain || 'PWA')
    .replace(/^https?:\/\//i, '')
    .split('.')[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'PWA';

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
        className={`${sizeClasses} shrink-0 rounded flex items-center justify-center font-black tracking-tight border ${getInitialBg(name)} ${className}`}
        title={name}
        aria-hidden="true"
      >
        {name ? badgeLabel : <Globe className="w-3 h-3 opacity-70" />}
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
