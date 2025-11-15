import React from 'react';
import { ApartmentCard } from '../types';
import { HomeIcon, UserIcon, CalendarIcon, PhoneIcon } from '@heroicons/react/24/outline';

interface ApartmentFormProps {
  data: ApartmentCard;
  onChange: (updates: Partial<ApartmentCard>) => void;
}

export const ApartmentForm: React.FC<ApartmentFormProps> = ({ data, onChange }) => {
  
  const handleOwnerChange = (field: 'full_name' | 'phone', value: string) => {
    onChange({
      owner: {
        ...data.owner,
        [field]: value
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
          <div className="p-1.5 bg-brand-50 rounded-lg text-brand-600">
             <HomeIcon className="w-5 h-5" />
          </div>
          Объект и Владелец
        </h2>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Address Block */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Номер Дома</label>
            <input 
              type="text" 
              value={data.house_number || ''} 
              onChange={(e) => onChange({ house_number: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none transition-all font-medium text-slate-700"
              placeholder="Например: 5"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Квартира</label>
            <input 
              type="text" 
              value={data.apartment_number || ''} 
              onChange={(e) => onChange({ apartment_number: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none transition-all font-medium text-slate-700"
              placeholder="Например: 24"
            />
          </div>
        </div>

        {/* Owner Block */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              Собственник
            </label>
            <div className="relative">
              <UserIcon className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" 
                value={data.owner.full_name || ''} 
                onChange={(e) => handleOwnerChange('full_name', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none transition-all font-medium text-slate-700"
                placeholder="ФИО"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                Телефон
              </label>
              <div className="relative">
                <PhoneIcon className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="text" 
                  value={data.owner.phone || ''} 
                  onChange={(e) => handleOwnerChange('phone', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none transition-all font-medium text-slate-700"
                  placeholder="+375..."
                />
              </div>
            </div>
            <div className="w-2/5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                Дата
              </label>
              <input 
                type="date" 
                value={data.acceptance_date || ''} 
                onChange={(e) => onChange({ acceptance_date: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:outline-none transition-all font-medium text-slate-700 text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};