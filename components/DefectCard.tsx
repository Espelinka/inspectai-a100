import React, { useEffect, useRef } from 'react';
import { Defect } from '../types';
import { TrashIcon } from '@heroicons/react/24/outline';

interface DefectCardProps {
  defect: Defect;
  index: number;
  onChange: (id: string, updates: Partial<Defect>) => void;
  onDelete: (id: string) => void;
}

export const DefectCard: React.FC<DefectCardProps> = ({ defect, index, onChange, onDelete }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [defect.description]);

  return (
    <div className="group flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
      <span className="text-slate-400 font-mono text-sm mt-1 select-none w-6 text-right font-medium">
        {index + 1}.
      </span>
      
      <div className="flex-1 min-w-0">
        <textarea
          ref={textareaRef}
          value={defect.description}
          onChange={(e) => onChange(defect.id, { description: e.target.value })}
          className="w-full text-base text-slate-800 bg-transparent border-none focus:ring-0 p-0 resize-none placeholder:text-slate-300 leading-relaxed"
          rows={1}
          placeholder="Описание дефекта..."
        />
      </div>

      <button 
        onClick={() => onDelete(defect.id)}
        className="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all p-1.5 rounded hover:bg-red-50"
        title="Удалить пункт"
      >
        <TrashIcon className="w-5 h-5" />
      </button>
    </div>
  );
};