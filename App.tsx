import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ApartmentForm } from './components/ApartmentForm';
import { DefectCard } from './components/DefectCard';
import { CalendarView } from './components/CalendarView';
import { Auth } from './components/Auth';
import { processActImage } from './services/geminiService';
import { subscribeToApartments, saveApartmentToCloud, deleteApartmentFromCloud, auth, isFirebaseReady } from './services/firebase';
import { ProcessingResponse, ApartmentCard, Defect } from './types';
import { PlusIcon, ArrowPathIcon, CheckCircleIcon, ListBulletIcon, CalendarDaysIcon, ChevronLeftIcon, PhotoIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { onAuthStateChanged, User } from 'firebase/auth';

type ViewMode = 'scan' | 'list' | 'calendar';

// Helper to convert file to Base64 for Persistence
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  
  // Standard App State
  const [savedCards, setSavedCards] = useState<ApartmentCard[]>([]);
  const [view, setView] = useState<ViewMode>('scan');
  const [processingResponse, setProcessingResponse] = useState<ProcessingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  
  // State for viewing details from the list
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // AUTH: Check login status on boot
  useEffect(() => {
    if (isFirebaseReady && auth) {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthChecked(true);
      });
      return () => unsubscribe();
    } else {
      // Fallback for Offline/Demo mode (No Firebase Configured)
      setAuthChecked(true);
      try {
        const saved = localStorage.getItem('inspect_ai_cards');
        if (saved) setSavedCards(JSON.parse(saved));
      } catch (e) { console.error(e); }
    }
  }, []);

  // SYNC: Load data from Firebase if logged in
  useEffect(() => {
    if (user) {
      const unsubscribe = subscribeToApartments(user.uid, (cards) => {
        setSavedCards(cards);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // PERSISTENCE: Fallback to localStorage if no Firebase
  useEffect(() => {
    if (!isFirebaseReady) {
      localStorage.setItem('inspect_ai_cards', JSON.stringify(savedCards));
    }
  }, [savedCards]);

  const handleImageSelected = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setProcessingResponse(null);
    setSelectedCardId(null);
    setView('scan');
    setCurrentImageFile(file);

    const objectUrl = URL.createObjectURL(file);
    setCurrentImageUrl(objectUrl);

    try {
      const response = await processActImage(file);
      if (response.apartment_card) {
        response.apartment_card.act_photos = [
          {
            filename: file.name,
            url: objectUrl,
            confidence: 1
          }
        ];
      }
      setProcessingResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!processingResponse) return;
    
    setIsSaving(true);
    try {
      let photoUrl = currentImageUrl;
      if (currentImageFile) {
        try {
           photoUrl = await fileToBase64(currentImageFile);
        } catch (err) {
           console.warn("Could not convert image to base64", err);
        }
      }

      const newCard: ApartmentCard = { 
        ...processingResponse.apartment_card,
        // If Firebase is ready, we let it generate ID, or we use temporary ID
        id: processingResponse.apartment_card.id || `card-${Date.now()}`,
        upload_date: new Date().toISOString(),
        act_photos: [{ 
            filename: currentImageFile?.name || 'upload.jpg', 
            url: photoUrl, 
            confidence: 1 
        }]
      };
      
      if (isFirebaseReady && user) {
        await saveApartmentToCloud(user.uid, newCard);
      } else {
        setSavedCards(prev => [newCard, ...prev]);
      }
      
      // Reset scan state
      setProcessingResponse(null);
      setCurrentImageFile(null);
      setCurrentImageUrl(null);
      setView('list'); 
      
    } catch (e) {
      console.error(e);
      setError("Ошибка сохранения карточки.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Вы уверены, что хотите удалить эту квартиру и все замечания? Это действие нельзя отменить.")) {
      if (isFirebaseReady && user) {
        await deleteApartmentFromCloud(id);
      } else {
        setSavedCards(prev => prev.filter(c => c.id !== id));
      }
      if (selectedCardId === id) {
        setSelectedCardId(null);
      }
    }
  };

  const handleApartmentUpdate = useCallback(async (updates: Partial<ApartmentCard>) => {
    if (processingResponse) {
      setProcessingResponse(prev => {
        if (!prev) return null;
        return { ...prev, apartment_card: { ...prev.apartment_card, ...updates } };
      });
    } 
    else if (selectedCardId) {
      // Optimistic update for local view
      setSavedCards(prev => prev.map(card => card.id === selectedCardId ? { ...card, ...updates } : card));
      
      // Cloud Update
      if (isFirebaseReady && user) {
         const card = savedCards.find(c => c.id === selectedCardId);
         if (card) {
            // Debouncing would be better here in a real app
            await saveApartmentToCloud(user.uid, { ...card, ...updates });
         }
      }
    }
  }, [processingResponse, selectedCardId, savedCards, user]);

  const handleDefectUpdate = useCallback((id: string, updates: Partial<Defect>) => {
    // Local update helper function logic...
    const updateCardDefects = (card: ApartmentCard) => {
       return {
          ...card,
          defects: card.defects.map(d => d.id === id ? { ...d, ...updates } : d)
       };
    };

    if (processingResponse) {
      setProcessingResponse(prev => prev ? ({ ...prev, apartment_card: updateCardDefects(prev.apartment_card) }) : null);
    } else if (selectedCardId) {
      const cardToUpdate = savedCards.find(c => c.id === selectedCardId);
      if (cardToUpdate) {
         const updatedCard = updateCardDefects(cardToUpdate);
         setSavedCards(prev => prev.map(c => c.id === selectedCardId ? updatedCard : c));
         
         if (isFirebaseReady && user) {
             saveApartmentToCloud(user.uid, updatedCard);
         }
      }
    }
  }, [processingResponse, selectedCardId, savedCards, user]);

  const handleDefectDelete = useCallback((id: string) => {
     // Helper logic
     const removeDefect = (card: ApartmentCard) => ({
        ...card,
        defects: card.defects.filter(d => d.id !== id)
     });

    if (processingResponse) {
      setProcessingResponse(prev => prev ? ({ ...prev, apartment_card: removeDefect(prev.apartment_card) }) : null);
    } else if (selectedCardId) {
       const cardToUpdate = savedCards.find(c => c.id === selectedCardId);
       if (cardToUpdate) {
          const updatedCard = removeDefect(cardToUpdate);
          setSavedCards(prev => prev.map(c => c.id === selectedCardId ? updatedCard : c));
          
          if (isFirebaseReady && user) {
              saveApartmentToCloud(user.uid, updatedCard);
          }
       }
    }
  }, [processingResponse, selectedCardId, savedCards, user]);

  const handleAddDefect = useCallback(() => {
    const newDefect: Defect = {
      id: `manual-${Date.now()}`,
      text_raw: '',
      description: '',
      category: 'other',
      severity: 'medium',
      suggested_deadline_days: 7,
      photo_refs: [],
      location_in_apartment: '',
      confidence: 1.0
    };

    if (processingResponse) {
      setProcessingResponse(prev => prev ? ({ ...prev, apartment_card: { ...prev.apartment_card, defects: [...prev.apartment_card.defects, newDefect] } }) : null);
    } else if (selectedCardId) {
       const cardToUpdate = savedCards.find(c => c.id === selectedCardId);
       if (cardToUpdate) {
          const updatedCard = { ...cardToUpdate, defects: [...cardToUpdate.defects, newDefect] };
          setSavedCards(prev => prev.map(c => c.id === selectedCardId ? updatedCard : c));
          
          if (isFirebaseReady && user) {
              saveApartmentToCloud(user.uid, updatedCard);
          }
       }
    }
  }, [processingResponse, selectedCardId, savedCards, user]);

  // Sorting
  const sortedCards = [...savedCards].sort((a, b) => {
    const houseA = a.house_number || '';
    const houseB = b.house_number || '';
    return houseA.localeCompare(houseB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const activeCard = processingResponse?.apartment_card || (selectedCardId ? savedCards.find(c => c.id === selectedCardId) : null);

  // RENDER
  
  if (!authChecked) return <div className="min-h-screen flex items-center justify-center bg-[#f0fdf4] text-brand-600">Загрузка...</div>;

  // Force Auth if Firebase is configured and no user
  if (isFirebaseReady && !user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-[#f0fdf4] pb-20">
      <Header />

      {!isFirebaseReady && (
        <div className="bg-orange-50 text-orange-800 text-xs text-center py-1 border-b border-orange-100">
          Демо-режим: Синхронизация отключена. Настройте Firebase для сохранения данных в облако.
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6">
        
        {/* NAVIGATION TABS */}
        {!activeCard && (
          <div className="flex justify-center mb-8">
            <div className="bg-white p-1.5 rounded-xl border border-brand-100 inline-flex shadow-sm">
              <button 
                onClick={() => setView('scan')}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${view === 'scan' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:text-brand-600 hover:bg-white'}`}
              >
                <PlusIcon className="w-4 h-4" />
                Внести замечания
              </button>
              <button 
                onClick={() => setView('list')}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${view === 'list' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:text-brand-600 hover:bg-white'}`}
              >
                <ListBulletIcon className="w-4 h-4" />
                Список квартир
                {savedCards.length > 0 && (
                  <span className="bg-brand-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{savedCards.length}</span>
                )}
              </button>
              <button 
                onClick={() => setView('calendar')}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${view === 'calendar' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:text-brand-600 hover:bg-white'}`}
              >
                <CalendarDaysIcon className="w-4 h-4" />
                Календарь
              </button>
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && !activeCard && (
          <div className="animate-fade-in">
            {savedCards.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
                <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <ListBulletIcon className="w-10 h-10 text-brand-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Список пока пуст</h3>
                <p className="text-slate-500 mb-8 max-w-xs mx-auto">База замечаний пуста. Загрузите первый акт.</p>
                <button onClick={() => setView('scan')} className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-lg shadow-brand-500/20 transition-all">
                  Внести замечания
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedCards.map((card, idx) => (
                  <div 
                    key={card.id || idx} 
                    onClick={() => setSelectedCardId(card.id!)}
                    className="bg-white p-5 rounded-2xl border border-brand-100/50 shadow-sm flex items-center justify-between hover:shadow-md hover:border-brand-200 transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 font-bold text-lg group-hover:bg-brand-600 group-hover:text-white transition-colors">
                         {card.apartment_number || '?'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-lg">
                          Дом {card.house_number || '—'}, Кв {card.apartment_number || '—'}
                        </div>
                        <div className="text-sm text-slate-500 mt-1 flex gap-3 items-center">
                           <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium text-slate-600">{card.acceptance_date || 'Дата?'}</span>
                           <span className="text-slate-400 text-xs">{card.owner.full_name || 'Владелец не указан'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 pl-4 border-l border-slate-100">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-brand-600">{card.defects.length}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Пунктов</div>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteCard(e, card.id!)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CALENDAR VIEW */}
        {view === 'calendar' && !activeCard && (
          <div className="animate-fade-in">
             <CalendarView cards={savedCards} />
          </div>
        )}

        {/* SCAN / DETAIL VIEW */}
        {(view === 'scan' || activeCard) && (
          <>
            {activeCard && !processingResponse && (
               <button 
                  onClick={() => setSelectedCardId(null)}
                  className="mb-6 flex items-center gap-2 text-slate-500 hover:text-brand-700 font-semibold transition-colors bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:shadow"
               >
                  <ChevronLeftIcon className="w-4 h-4" />
                  К списку
               </button>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 shadow-sm">
                <ExclamationTriangleIcon className="w-5 h-5" />
                {error}
              </div>
            )}

            {!activeCard && !isLoading && view === 'scan' && (
              <div className="mt-10">
                <div className="text-center mb-10">
                  <h2 className="text-3xl font-extrabold text-slate-800 mb-3 tracking-tight">Внести замечания</h2>
                  <p className="text-slate-500 max-w-md mx-auto text-lg">Загрузите фото акта для автоматического анализа.</p>
                </div>
                <ImageUploader onImageSelected={handleImageSelected} isLoading={isLoading} />
              </div>
            )}

            {isLoading && (
              <div className="mt-24 text-center flex flex-col items-center">
                <div className="relative">
                   <div className="w-20 h-20 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin mb-6"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-10 h-10 bg-white rounded-full"></div>
                   </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 animate-pulse">Обработка акта...</h3>
                <p className="text-slate-500 mt-2 text-lg">Распознаем почерк и ищем дефекты</p>
              </div>
            )}

            {activeCard && (
              <div className="animate-fade-in-up">
                {processingResponse && (
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">Проверка данных</h2>
                    <button 
                      onClick={() => {
                        setProcessingResponse(null);
                        setCurrentImageFile(null);
                      }}
                      className="text-sm text-slate-500 hover:text-brand-600 flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
                    >
                      <ArrowPathIcon className="w-4 h-4" /> Сброс
                    </button>
                  </div>
                )}

                <ApartmentForm 
                  data={activeCard} 
                  onChange={handleApartmentUpdate} 
                />

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-8">
                  <div className="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                      <ListBulletIcon className="w-5 h-5 text-brand-500" />
                      Замечания ({activeCard.defects.length})
                    </h3>
                    <button 
                      onClick={handleAddDefect}
                      className="text-xs bg-white border border-brand-200 text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors flex items-center gap-1 font-bold"
                    >
                      <PlusIcon className="w-3 h-3" /> Добавить
                    </button>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {activeCard.defects.length > 0 ? (
                      activeCard.defects.map((defect, idx) => (
                        <DefectCard 
                          key={defect.id} 
                          index={idx}
                          defect={defect} 
                          onChange={handleDefectUpdate}
                          onDelete={handleDefectDelete}
                        />
                      ))
                    ) : (
                      <div className="p-12 text-center text-slate-400">
                        <CheckCircleIcon className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                        <p>Нет замечаний.</p>
                        <button onClick={handleAddDefect} className="text-brand-600 font-medium mt-2 text-sm hover:underline">Добавить вручную</button>
                      </div>
                    )}
                  </div>
                  
                  {activeCard.act_photos && activeCard.act_photos.length > 0 && activeCard.act_photos[0].url && (
                    <div className="bg-slate-50 p-6 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
                        <PhotoIcon className="w-4 h-4 text-slate-500" />
                        Фото акта
                      </div>
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                        <img 
                          src={activeCard.act_photos[0].url || ''} 
                          alt="Фото акта" 
                          className="w-full h-auto object-contain max-h-[500px]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {processingResponse && (
                  <div className="flex flex-col gap-4 pt-2 pb-10">
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className={`w-full py-4 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/40 hover:bg-brand-700 hover:shadow-brand-500/50 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 text-lg ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
                    >
                        {isSaving ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Сохранение...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="w-6 h-6" />
                            Сохранить в базу
                          </>
                        )}
                    </button>
                    
                    <button 
                      onClick={() => setShowJson(!showJson)}
                      className="text-slate-400 text-xs mt-2 hover:text-brand-600 text-center"
                    >
                      {showJson ? 'Скрыть JSON' : 'Показать JSON'}
                    </button>

                    {showJson && (
                      <pre className="bg-slate-900 text-brand-400 p-6 rounded-2xl text-[10px] overflow-x-auto shadow-inner">
                        {JSON.stringify(processingResponse, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}