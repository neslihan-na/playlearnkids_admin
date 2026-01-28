import React, { useState, useEffect } from 'react';
import { signIn, signOut, getUserInfo, onAuthStateChange } from './firebase';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import './utils/createFirstAdmin'; // Debug için
import './App.css';

interface User {
  name: string;
  isAdmin: boolean;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setLoading(true);
      try {
        if (firebaseUser) {
          // Firebase user var, admin bilgilerini kontrol et
          const userInfo = await getUserInfo();
          if (userInfo && userInfo.isAdmin) {
            setUser(userInfo);
          } else {
            setUser(null);
          }
        } else {
          // Firebase user yok, logout yap
          setUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    // Cleanup function
    return () => unsubscribe();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setError('');
    setLoading(true);
    
    try {
      const result = await signIn(email, password);
      
      if (result.success) {
        const userInfo = await getUserInfo();
        
        if (userInfo && userInfo.isAdmin) {
          setUser(userInfo);
        } else {
          setError('Bu hesap admin değil. Admin yetkisi gereklidir.');
          await signOut();
        }
      } else {
        setError(result.error || 'Giriş başarısız');
      }
    } catch (error: any) {
      setError(error.message || 'Giriş sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="App">
      {user ? (
        <AdminPanel user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} error={error} loading={loading} />
      )}
    </div>
  );
}

export default App;