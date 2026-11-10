import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating?: number; // 0 to 5
  onChange?: (rating: number) => void;
  size?: 'xs' | 'sm' | 'md';
  readonly?: boolean;
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating = 0,
  onChange,
  size = 'sm',
  readonly = false,
  className = '',
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const starSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  const effectiveRating = hoverRating !== null ? hoverRating : (rating || 0);

  const handleClick = (e: React.MouseEvent, starIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (readonly || !onChange) return;

    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.blur();
    }

    // Clicking the current rating resets to 0 (unrated)
    if (rating === starIndex) {
      onChange(0);
    } else {
      onChange(starIndex);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-0.5 select-none ${className}`}
      onMouseLeave={() => setHoverRating(null)}
      title={readonly ? `${rating || 0} de 5 estrelas` : undefined}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const isFilled = starIndex <= effectiveRating;

        return (
          <button
            key={starIndex}
            type="button"
            disabled={readonly}
            onClick={(e) => handleClick(e, starIndex)}
            onMouseEnter={() => !readonly && setHoverRating(starIndex)}
            title={
              readonly
                ? undefined
                : rating === starIndex
                ? `Remover classificação (${rating} estrelas)`
                : `Classificar com ${starIndex} estrela${starIndex > 1 ? 's' : ''}`
            }
            aria-label={`Classificação: ${starIndex} de 5 estrelas`}
            className={`p-0.5 rounded transition-transform duration-100 ${
              readonly
                ? 'cursor-default'
                : 'cursor-pointer hover:scale-115 active:scale-95 focus:outline-hidden'
            }`}
          >
            <Star
              className={`${starSizes} transition-colors ${
                isFilled
                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.6)]'
                  : 'text-neutral-600 hover:text-amber-400/60'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};
