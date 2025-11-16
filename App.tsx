import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ApartmentForm } from './components/ApartmentForm';
import { DefectCard } from './components/DefectCard';
import { CalendarView } from './components/CalendarView';
import { Auth } from './components/Auth';
import { processActImage } from './services/geminiService';
import { subscribeToApartments, saveApartmentToCloud, deleteApartmentFromCloud, auth, isFirebaseReady } from './services/firebase';
import { ProcessingResponse, ApartmentCard, Defect, Comment } from './types';
import { PlusIcon, ArrowPathIcon, CheckCircleIcon, ListBulletIcon, CalendarDaysIcon, ChevronLeftIcon, PhotoIcon, TrashIcon, ExclamationTriangleIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { ChatBubbleLeftRightIcon, ClockIcon } from '@heroicons/react/24/outline';
import { onAuthStateChanged, User } from 'firebase/auth';

type ViewMode = 'scan' | 'list' | 'calendar';

// Helper to compress image and convert to Base64 to stay under Firestore 1MB limit
const compressAndConvertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Resize to max dimension of 1024px to ensure file size < 500KB
        const MAX_DIMENSION = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG with 0.6 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        } else {
          reject(new Error("Could not get canvas context"));
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (error) => reject(error);
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

  // State for local comment editing
  const [commentInput, setCommentInput] = useState<string>('');

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
        // Migration Logic: Ensure 'comments' array exists, fallback to legacy 'comment' field if present
        const normalizedCards = cards.map(card => ({
           ...card,
           comments: card.comments || (card.comment ? [{
               id: 'legacy', 
               text: card.comment, 
               createdAt: card.upload_date || new Date().toISOString()
           }] : [])
        }));
        setSavedCards(normalizedCards);
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
            url: objectUrl, // Temporary local URL for preview
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
      
      // IMPORTANT: Compress image before saving to Firestore
      // Firestore limit is 1MB. Raw mobile photos are 5MB+.
      if (currentImageFile) {
        try {
           photoUrl = await compressAndConvertToBase64(currentImageFile);
        } catch (err) {
           console.warn("Could not compress image", err);
           throw new Error("Ошибка обработки изображения. Попробуйте другое фото.");
        }
      }

      const newCard: ApartmentCard = { 
        ...processingResponse.apartment_card,
        // Temporarily assign a local ID until Firestore provides a real one
        id: `card-${Date.now()}`,
        userId: user?.uid, // Bind to current user!
        upload_date: new Date().toISOString(),
        comments: [],
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
      
    } catch (e: any) {
      console.error(e);
      if (e.message && e.message.includes("exceeds the maximum allowed size")) {
        setError("Файл слишком большой для базы данных. Попробуйте сделать фото с меньшим разрешением.");
      } else {
        setError("Ошибка сохранения: " + (e.message || "Проверьте соединение"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCard = async (e: React.MouseEvent, id: string | undefined) => {
    // CRITICAL FIX: Strictly prevent default and propagation
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation(); // Ensure no bubbling to parent div

    if (!id) {
        console.error("Cannot delete: ID is missing");
        return;
    }

    if (window.confirm("Вы уверены, что хотите удалить эту квартиру и все замечания?")) {
      
      // Optimistic Update: Remove from UI immediately
      setSavedCards(prev => prev.filter(c => c.id !== id));
      
      if (selectedCardId === id) {
        setSelectedCardId(null);
      }

      // Then try to delete from Cloud
      if (isFirebaseReady && user) {
        try {
          await deleteApartmentFromCloud(id);
        } catch (err) {
          console.error("Failed to delete from cloud", err);
        }
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
         if (card && card.id) {
            await saveApartmentToCloud(user.uid, { ...card, ...updates });
         } else {
            console.error("Cannot save update: Card not found or missing ID");
         }
      }
    }
  }, [processingResponse, selectedCardId, savedCards, user]);

  // --- Comments Logic ---

  const handleAddComment = async () => {
    if (!commentInput.trim()) return;
    
    const newComment: Comment = {
      id: `cmt-${Date.now()}`,
      text: commentInput.trim(),
      createdAt: new Date().toISOString()
    };

    const activeCard = processingResponse?.apartment_card || savedCards.find(c => c.id === selectedCardId);
    if (!activeCard) return;

    const updatedComments = [...(activeCard.comments || []), newComment];
    
    if (processingResponse) {
      setProcessingResponse(prev => prev ? ({
        ...prev,
        apartment_card: { ...prev.apartment_card, comments: updatedComments }
      }) : null);
    } else {
       // Update real card
       await handleApartmentUpdate({ comments: updatedComments });
    }
    
    setCommentInput('');
  };

  const handleDeleteComment = async (e: React.MouseEvent, commentId: string) => {
     e.preventDefault();
     e.stopPropagation();
     e.nativeEvent.stopImmediatePropagation();

     if (!window.confirm("Удалить этот комментарий?")) return;

     const activeCard = processingResponse?.apartment_card || savedCards.find(c => c.id === selectedCardId);
     if (!activeCard) return;

     const updatedComments = (activeCard.comments || []).filter(c => c.id !== commentId);

     if (processingResponse) {
      setProcessingResponse(prev => prev ? ({
        ...prev,
        apartment_card: { ...prev.apartment_card, comments: updatedComments }
      }) : null);
    } else {
       await handleApartmentUpdate({ comments: updatedComments });
    }
  };

  // --- Defect Logic ---

  const handleDefectUpdate = useCallback((id: string, updates: Partial<Defect>) => {
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

  // FILTERING: STRICTLY by userId to avoid "phantom" acts
  const filteredCards = savedCards.filter(card => {
    if (isFirebaseReady && user) {
      return card.userId === user.uid;
    }
    return true; // Offline mode shows all
  });

  const sortedCards = [...filteredCards].sort((a, b) => {
    const houseA = a.house_number || '';
    const houseB = b.house_number || '';
    return houseA.localeCompare(houseB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const activeCard = processingResponse?.apartment_card || (selectedCardId ? savedCards.find(c => c.id === selectedCardId) : null);

  // RENDER
  
  if (!authChecked) return <div className="min-h-screen flex items-center justify-center bg-[#f0fdf4] text-brand-600">Загрузка...</div>;

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
                {filteredCards.length > 0 && (
                  <span className="bg-brand-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{filteredCards.length}</span>
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
            {filteredCards.length === 0 ? (
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
                    className="bg-white p-5 rounded-2xl border border-brand-100/50 shadow-sm flex items-center justify-between hover:shadow-md hover:border-brand-200 transition-all cursor-pointer group active:scale-[0.99] relative"
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
                    
                    <div className="flex items-center gap-4 pl-4 border-l border-slate-100 relative z-10">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-brand-600">{card.defects.length}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Пунктов</div>
                      </div>
                      
                      {/* DELETE BUTTON - Fixed Propagation and Z-Index */}
                      <button 
                          onClick={(e) => handleDeleteCard(e, card.id)}
                          className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-white hover:bg-red-500 hover:border-red-500 rounded-xl transition-all shadow-sm cursor-pointer relative z-50"
                          title="Удалить"
                          type="button"
                      >
                          <TrashIcon className="w-5 h-5 pointer-events-none" />
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
             <CalendarView cards={filteredCards} />
          </div>
        )}

        {/* SCAN / DETAIL VIEW */}
        {(view === 'scan' || activeCard) && (
          <>
            {activeCard && !processingResponse && (
               <button 
                  onClick={() => {
                    setSelectedCardId(null);
                    setCommentInput(''); // Clear input on exit
                  }}
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

                {/* COMMENT BLOCK */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6 ring-1 ring-brand-100">
                  <div className="bg-gradient-to-r from-brand-50/50 to-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                      <div className="p-1.5 bg-white rounded-lg text-brand-600 shadow-sm border border-brand-100">
                         <ChatBubbleLeftRightIcon className="w-5 h-5" />
                      </div>
                      История и Комментарии
                    </h2>
                  </div>
                  <div className="p-6 bg-slate-50/50">
                    {/* Comment List */}
                    <div className="space-y-4 mb-6">
                      {(!activeCard.comments || activeCard.comments.length === 0) && (
                        <div className="text-center text-slate-400 text-sm py-4">
                          Нет заметок. Напишите что-нибудь важное.
                        </div>
                      )}
                      
                      {activeCard.comments?.map((comment) => (
                        <div key={comment.id} className="group flex gap-3 items-start">
                           <div className="flex-1 bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-200 relative">
                              <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                  <ClockIcon className="w-3 h-3" />
                                  {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                                <button 
                                  onClick={(e) => handleDeleteComment(e, comment.id)}
                                  className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full p-1.5 transition-all relative z-10"
                                  title="Удалить комментарий"
                                  type="button"
                                >
                                  <TrashIcon className="w-3.5 h-3.5 pointer-events-none" />
                                </button>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>

                    {/* Comment Input */}
                    <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-brand-200 flex gap-2 items-end focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-400 transition-all">
                      <textarea 
                        value={commentInput} 
                        onChange={(e) => setCommentInput(e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border-none focus:ring-0 text-slate-700 min-h-[50px] resize-none max-h-32 placeholder:text-slate-400"
                        placeholder="Добавить новый комментарий..."
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!commentInput.trim()}
                        className="mb-1 mr-1 p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors shadow-md disabled:opacity-50 disabled:shadow-none"
                      >
                        <PaperAirplaneIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

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

      <footer className="max-w-4xl mx-auto px-4 py-8 text-center">
        <a 
          href="https://t.me/Espelinka" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-brand-600 text-sm font-semibold transition-colors"
        >
          По вопросам сотрудничества @Espelinka
        </a>
      </footer>
    </div>
  );
}
