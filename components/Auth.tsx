import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/solid';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!auth) throw new Error("Firebase не настроен. Проверьте services/firebase.ts");

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') setError("Неверный email или пароль");
      else if (err.code === 'auth/email-already-in-use') setError("Этот email уже занят");
      else if (err.code === 'auth/weak-password') setError("Пароль должен быть минимум 6 символов");
      else setError(err.message || "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0fdf4] p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-brand-100 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20 mb-4">
            <ClipboardDocumentCheckIcon className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Замечания по квартире</h1>
          <p className="text-slate-500 text-sm">Синхронизация данных между устройствами</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
              placeholder="name@example.com"
            />
          </div>

          <div>
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Пароль</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 active:scale-[0.98] transition-all flex justify-center"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              isLogin ? 'Войти' : 'Создать аккаунт'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-brand-600 font-medium hover:underline"
          >
            {isLogin ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>
      </div>
      
      <div className="mt-8 text-center max-w-xs">
        <p className="text-xs text-slate-400">
          Для работы синхронизации необходимо добавить конфигурацию Firebase в файл <code>services/firebase.ts</code>
        </p>
      </div>
    </div>
  );
};