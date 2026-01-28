import React, { useState } from 'react';
import './Login.css';

interface LoginProps {
  onLogin: (email: string, password: string) => void;
  error: string;
  loading: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, error, loading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      onLogin(email.trim(), password);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>👑 PlayLearnKids Admin</h1>
          <p>Admin Paneline Giriş</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@playlearnkids.com"
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label>Şifre:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifrenizi girin"
              required
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className="login-button" 
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? '🔄 Giriş yapılıyor...' : '🚪 Giriş Yap'}
          </button>
        </form>
        
        <div className="login-footer">
          <p>⚠️ Sadece admin yetkisi olan hesaplar giriş yapabilir</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
