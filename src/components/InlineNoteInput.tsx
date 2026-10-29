import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';

interface InlineNoteInputProps {
  initialValue: string;
  onSave: (newNote: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const InlineNoteInput: React.FC<InlineNoteInputProps> = ({
  initialValue,
  onSave,
  placeholder = 'Adicionar anotação...',
  className = '',
  compact = true,
}) => {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleBlur = () => {
    setIsEditing(false);
    if (value !== initialValue) {
      onSave(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setValue(initialValue);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Editar anotação da PWA"
        className={`w-full bg-neutral-900 border border-neutral-700 text-neutral-100 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${className}`}
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title={value ? `Anotação: ${value} (Clique para editar)` : 'Clique para adicionar anotação'}
      className={`group/note flex items-center gap-1.5 cursor-text text-xs rounded px-1.5 py-0.5 transition-colors hover:bg-neutral-900/80 border border-transparent hover:border-neutral-800 ${className}`}
    >
      <span
        className={`truncate ${
          value ? 'text-neutral-300' : 'text-neutral-400 italic'
        } ${compact ? 'max-w-md' : 'w-full'}`}
      >
        {value || placeholder}
      </span>
      <Pencil className="w-2.5 h-2.5 text-neutral-400 opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0" />
    </div>
  );
};
