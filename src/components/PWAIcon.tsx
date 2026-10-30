import React, { useState } from 'react';
import { Globe } from 'lucide-react';

interface PWAIconProps {
  icon?: string;
  name: string;
  url?: string;
  customIcon?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const PWAIcon: React.FC<PWAIconProps> = ({
  icon,
  name,
  customIcon,
  size = 'sm',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: 'w-4 h-4 text-[10px]',
    sm: 'w-5 h-5 text-xs',
    md: 'w-7 h-7 text-sm',
    lg: 'w-9 h-9 text-base',
  }[size];

  // Use the pre-computed icon stored at insertion time
  const iconUrl = customIcon || icon;

  // Reset error state whenever the icon URL changes so new icons render properly
  React.useEffect(() => {
    setHasError(false);
  }, [iconUrl]);
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

  // If no icon was stored or if the image fails, render lightweight SVG initial badge with ZERO network calls
  if (!iconUrl || hasError) {
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
        src={iconUrl}
        alt={`Ícone de ${name}`}
        referrerPolicy="no-referrer"
        loading="lazy"
        className="w-full h-full object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
};
