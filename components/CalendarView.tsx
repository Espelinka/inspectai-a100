import React from 'react';
import { ApartmentCard } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface CalendarViewProps {
  cards: ApartmentCard[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ cards }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = React.useState(today);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay(); // 0 = Sunday
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Group cards by date
  const eventsByDate = cards.reduce((acc, card) => {
    if (card.upload_date) {
      const dateStr = card.upload_date.split('T')[0];
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(card);
    }
    return acc;
  }, {} as Record<string, ApartmentCard[]>);

  const daysInMonth = getDaysInMonth(currentMonth);
  // Adjust for Monday start
  let firstDay = getFirstDayOfMonth(currentMonth) - 1;
  if (firstDay < 0) firstDay = 6;

  const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const renderCalendarGrid = () => {
    const days = [];
    // Empty cells for prev month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-28 bg-slate-50/30 border-b border-r border-slate-100"></div>);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateStr = formatDate(date);
      const events = eventsByDate[dateStr] || [];
      const isToday = dateStr === formatDate(today);

      days.push(
        <div key={day} className={`h-28 border-b border-r border-slate-100 p-2 relative group hover:bg-white transition-colors ${isToday ? 'bg-brand-50/50' : 'bg-white/60'}`}>
          <div className={`text-xs font-bold mb-2 flex justify-between items-center ${isToday ? 'text-brand-600' : 'text-slate-400'}`}>
            <span className={`w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-brand-600 text-white shadow-sm' : ''}`}>
              {day}
            </span>
          </div>
          
          <div className="space-y-1.5 overflow-y-auto max-h-[calc(100%-32px)] no-scrollbar">
            {events.map((card, idx) => {
              const uploadTime = new Date(card.upload_date!).getTime();
              const diffTime = Math.abs(today.getTime() - uploadTime);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

              return (
                <div key={idx} className="text-[10px] bg-white border border-brand-200 text-slate-700 px-2 py-1 rounded-md shadow-sm truncate leading-tight cursor-default hover:border-brand-400 transition-colors">
                  <div className="font-bold text-brand-700">кв. {card.apartment_number}</div>
                  <div className="text-slate-400 text-[9px]">{diffDays} дн. назад</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
        <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-slate-800 capitalize">
          {monthNames[currentMonth.getMonth()]} <span className="text-brand-600">{currentMonth.getFullYear()}</span>
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 text-center bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider py-3">
        <div>Пн</div>
        <div>Вт</div>
        <div>Ср</div>
        <div>Чт</div>
        <div>Пт</div>
        <div>Сб</div>
        <div>Вс</div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 bg-slate-50">
        {renderCalendarGrid()}
      </div>
      
      <div className="p-4 bg-white border-t border-slate-100 text-xs text-slate-500 flex gap-6 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-white border border-brand-300 rounded shadow-sm"></div>
          <span>— загрузка акта</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-brand-600 rounded-full text-white text-[8px] flex items-center justify-center"></div>
          <span>— сегодня</span>
        </div>
      </div>
    </div>
  );
};