import React from 'react';
import { CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  isLoading: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, isLoading }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onImageSelected(event.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="border-2 border-dashed border-brand-200 rounded-3xl bg-white p-8 text-center transition-all hover:border-brand-400 hover:shadow-xl hover:shadow-brand-500/5 group">
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <PhotoIcon className="w-10 h-10 text-brand-400" />
          </div>
          
          <div className="space-y-1">
            <h3 className="text-slate-800 font-bold text-lg">Загрузите фото акта</h3>
            <p className="text-slate-400 text-sm font-medium">JPG, PNG до 10MB</p>
          </div>

          <div className="grid grid-cols-1 gap-4 w-full mt-2">
            {/* Camera Button */}
            <label className={`flex items-center justify-center gap-3 w-full py-4 px-6 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold cursor-pointer shadow-lg shadow-brand-500/30 active:scale-[0.98] transition-all ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              <CameraIcon className="w-6 h-6" />
              <span>Сделать фото</span>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                onChange={handleFileChange}
                disabled={isLoading}
              />
            </label>
            
            {/* File Picker */}
            <label className={`flex items-center justify-center gap-3 w-full py-4 px-6 bg-white border-2 border-slate-100 text-slate-600 hover:border-brand-200 hover:text-brand-700 rounded-xl font-bold cursor-pointer active:scale-[0.98] transition-all ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
              <PhotoIcon className="w-6 h-6" />
              <span>Галерея</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange}
                disabled={isLoading}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};