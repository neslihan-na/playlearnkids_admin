import React, { useState, useEffect, useRef } from 'react';
import { database, getDatabasePath } from '../firebase';
import { ref, get } from 'firebase/database';
import {
  getAllUsers,
  adminUserManagement,
  checkUserSyncStatus,
  adminUpgradeToPremium,
  adminDowngradeFromPremium,
  updateUserData,
  deleteUser,
  type AdminPanelUser
} from '../utils/adminFunctions';
import StoryManager from './StoryManager';
import SimilarityQuestionsManager from './SimilarityQuestionsManager';
import WordHuntQuestionsManager from './WordHuntQuestionsManager';
import VideoManager from './VideoManager';
import NotificationManager from './NotificationManager';
import MessagesManager from './MessagesManager';
import HighFiveManager from './HighFiveManager';
import './AdminPanel.css';

interface AdminPanelProps {
  user: {
    name: string;
    isAdmin: boolean;
  };
  onLogout: () => void;
}

// User interface kaldırıldı - AdminPanelUser kullanılacak

const AdminPanel: React.FC<AdminPanelProps> = ({ user, onLogout }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');
  const [allUsers, setAllUsers] = useState<AdminPanelUser[]>([]);

  const [selectedUser, setSelectedUser] = useState<AdminPanelUser | null>(null);
  const [selectedDetailUser, setSelectedDetailUser] = useState<AdminPanelUser | null>(null);
  const [showUserEdit, setShowUserEdit] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'stories' | 'similarity' | 'wordhunt' | 'videos' | 'notifications' | 'database' | 'admin-actions' | 'messages' | 'highfive'>('users');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const lastUnreadCount = useRef(0);
  const isFirstCheck = useRef(true);

  // Browser Notification & Sound Logic
  useEffect(() => {
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const checkUnreadMessages = async () => {
      try {
        const usersPath = getDatabasePath('').replace(/\/$/, '');
        const usersRef = ref(database, usersPath);
        const usersSnapshot = await get(usersRef);

        if (usersSnapshot.exists()) {
          const userIds = Object.keys(usersSnapshot.val());
          let totalUnread = 0;

          await Promise.all(userIds.map(async (userId) => {
            try {
              const msgRef = ref(database, `user_messages/${userId}`);
              const msgSnapshot = await get(msgRef);
              if (msgSnapshot.exists()) {
                const messages = msgSnapshot.val();
                const unread = Object.values(messages).filter((m: any) => m.sender === 'user' && !m.read).length;
                totalUnread += unread;
              }
            } catch (e) { }
          }));

          setUnreadMessageCount(totalUnread);

          // If new unread messages arrived AND it's not the initial load
          if (totalUnread > lastUnreadCount.current && !isFirstCheck.current) {
            // Play sound
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Sound play blocked'));

            // Show Browser Notification
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Yeni Mesaj!", {
                body: `${totalUnread} okunmamış mesajınız var.`,
                icon: "/favicon.ico"
              });
            }
          }
          lastUnreadCount.current = totalUnread;
          isFirstCheck.current = false;
        }
      } catch (error) {
        console.error("Error checking unread messages:", error);
      }
    };

    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 45000); // Check every 45 seconds

    return () => clearInterval(interval);
  }, []);

  // Otomatik kullanıcı listeleme
  useEffect(() => {
    if (!hasLoadedInitially) {
      handleGetAllUsers();
      setHasLoadedInitially(true);
    }
  }, [hasLoadedInitially]);

  const handleAdminAction = async (action: 'check' | 'sync' | 'cleanup') => {
    try {
      setIsLoading(true);
      setLastAction(`İşlem başlatıldı: ${action}`);

      const result = await adminUserManagement(action);

      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        if (action === 'check') {
          setSyncStatus(result.details);
        }
        alert(`Başarılı! ${result.message}`);
      } else {
        setLastAction(`❌ ${result.message}`);
        alert(`Hata! ${result.message}`);
      }
    } catch (error) {
      setLastAction(`❌ Hata: ${(error as Error).message}`);
      alert(`Hata! İşlem başarısız: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetAllUsers = async () => {
    try {
      setIsLoading(true);
      setLastAction('Tüm kullanıcılar getiriliyor...');

      const result = await getAllUsers();

      if (result.success) {
        setAllUsers(result.users || []);

        setLastAction(`✅ ${result.users?.length || 0} kullanıcı getirildi`);
      } else {
        setLastAction(`❌ Kullanıcılar getirilemedi`);
        alert('Hata! Kullanıcılar getirilemedi');
      }
    } catch (error) {
      setLastAction(`❌ Hata: ${(error as Error).message}`);
      alert(`Hata! Kullanıcılar getirilemedi: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = (user: AdminPanelUser) => {
    setSelectedUser(user);
    setShowUserEdit(true);
  };

  const handleUpdateUser = async (username: string, updates: any) => {
    try {
      setIsLoading(true);
      setLastAction(`${username} güncelleniyor...`);

      const result = await updateUserData(username, updates);

      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        alert(`Başarılı! ${result.message}`);

        setShowUserEdit(false);
        setSelectedUser(null);
        await handleGetAllUsers();
      } else {
        setLastAction(`❌ ${result.message}`);
        alert(`Hata! ${result.message}`);
      }
    } catch (error) {
      setLastAction(`❌ Hata: ${(error as Error).message}`);
      alert(`Hata! Kullanıcı güncellenemedi: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePremium = async (user: AdminPanelUser, isPremium: boolean) => {
    setIsLoading(true);
    try {
      let result;
      if (isPremium) {
        result = await adminUpgradeToPremium(user.key);
      } else {
        result = await adminDowngradeFromPremium(user.key);
      }

      if (result.success) {
        setLastAction(result.message);
        await handleGetAllUsers();
        alert(`Başarılı! ${result.message}`);
      } else {
        alert(`Hata! ${result.message}`);
      }
    } catch (error) {
      console.error('Premium toggle error:', error);
      alert('Hata! Premium durumu güncellenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    try {
      setIsLoading(true);
      const result = await checkUserSyncStatus();
      if (result.success) {
        setSyncStatus(result);
        setLastAction('✅ Durum kontrol edildi');
      } else {
        setLastAction('❌ Durum kontrol edilemedi');
      }
    } catch (error) {
      setLastAction(`❌ Hata: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (user: AdminPanelUser) => {
    const confirmDelete = window.confirm(`'${user.username}' (Key: ${user.key}) isimli kullanıcıyı tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`);

    if (!confirmDelete) return;

    try {
      setIsLoading(true);
      setLastAction(`${user.username} siliniyor...`);

      const result = await deleteUser(user.key);

      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        alert(`Başarılı! ${result.message}`);
        await handleGetAllUsers();
      } else {
        setLastAction(`❌ ${result.message}`);
        alert(`Hata! ${result.message}`);
      }
    } catch (error) {
      setLastAction(`❌ Hata: ${(error as Error).message}`);
      alert(`Hata! Kullanıcı silinemedi: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="header-top">
          <h1>👑 Admin Panel</h1>
          <button
            className="logout-button"
            onClick={onLogout}
            disabled={isLoading}
          >
            🚪 Çıkış
          </button>
        </div>
        <p className="header-subtitle">Yönetim Paneli</p>
        <p className="current-user">Aktif Admin: {user.name}</p>
      </div>

      <div className="admin-main-container">
        {/* Navigation Sidebar */}
        <div className={`admin-tabs ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <button
            className="sidebar-toggle-header"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            ☰
          </button>

          <button
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 {!sidebarCollapsed && 'Kullanıcı Yönetimi'}
          </button>

          <button
            className={`tab-button ${activeTab === 'stories' ? 'active' : ''}`}
            onClick={() => setActiveTab('stories')}
          >
            📚 {!sidebarCollapsed && 'Hikaye Yönetimi'}
          </button>

          <button
            className={`tab-button ${activeTab === 'similarity' ? 'active' : ''}`}
            onClick={() => setActiveTab('similarity')}
          >
            🎯 {!sidebarCollapsed && 'Benzerlik Soruları'}
          </button>

          <button
            className={`tab-button ${activeTab === 'wordhunt' ? 'active' : ''}`}
            onClick={() => setActiveTab('wordhunt')}
          >
            🔍 {!sidebarCollapsed && 'Word Hunt Soruları'}
          </button>

          <button
            className={`tab-button ${activeTab === 'videos' ? 'active' : ''}`}
            onClick={() => setActiveTab('videos')}
          >
            🎥 {!sidebarCollapsed && 'Video Yönetimi'}
          </button>

          <button
            className={`tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            📬 {!sidebarCollapsed && 'Bildirim Gönder'}
          </button>

          <button
            className={`tab-button ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            💬 {!sidebarCollapsed && 'Mesajlar'}
            {unreadMessageCount > 0 && (
              <span className="notification-badge">{unreadMessageCount}</span>
            )}
          </button>

          <button
            className={`tab-button ${activeTab === 'highfive' ? 'active' : ''}`}
            onClick={() => setActiveTab('highfive')}
          >
            ✋ {!sidebarCollapsed && 'High Five Gönder'}
          </button>

          <div className="sidebar-divider"></div>

          <button
            className={`tab-button ${activeTab === 'admin-actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin-actions')}
          >
            🔧 {!sidebarCollapsed && 'Sistem İşlemleri'}
          </button>
        </div>

        {/* Content Area */}
        <div className="admin-content">
          {activeTab === 'users' ? (
            <div className="admin-section users-section">
              <div className="section-header">
                <h2>👥 Kullanıcı Listesi ({allUsers.length})</h2>
                <button
                  className="admin-button primary"
                  onClick={handleGetAllUsers}
                  disabled={isLoading}
                  style={{ padding: '8px 16px', fontSize: '14px' }}
                >
                  🔄 Yenile
                </button>
              </div>

              <div className="user-table-container">
                <table className="user-sql-table">
                  <thead>
                    <tr>
                      <th className="col-index">#</th>
                      <th>Kullanıcı Adı</th>
                      <th>Email</th>
                      <th>Level</th>
                      <th>Puan</th>
                      <th>Yetki</th>
                      <th>Üyelik</th>
                      <th>Doğum Yılı</th>
                      <th className="col-actions">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((user, index) => (
                      <tr key={user.key || index}>
                        <td className="col-index">{index + 1}</td>
                        <td className="col-username">
                          <div className="user-name-cell">
                            <strong>{user.username}</strong>
                            <span className="user-key-hint">{user.key}</span>
                          </div>
                        </td>
                        <td>{user.email || <span className="no-data">Email yok</span>}</td>
                        <td className="text-center">{user.level || 1}</td>
                        <td className="text-center">{user.score || 0}</td>
                        <td>
                          <span className={`badge ${user.isAdmin ? 'admin' : 'user'}`}>
                            {user.isAdmin ? '👑 Admin' : '👤 User'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${user.isPremium ? 'premium' : 'normal'}`}>
                            {user.isPremium ? '💎 Premium' : '✨ Normal'}
                          </span>
                        </td>
                        <td className="text-center">{user.birthYear || '-'}</td>
                        <td className="col-actions">
                          <div className="user-actions-cell">
                            <button
                              className={`action-btn ${user.isPremium ? 'premium' : 'normal'}`}
                              onClick={() => handleTogglePremium(user, !user.isPremium)}
                              disabled={isLoading}
                              title={user.isPremium ? 'Normal Yap' : 'Premium Yap'}
                            >
                              {user.isPremium ? '👑' : '⭐'}
                            </button>
                            <button
                              className="action-btn edit"
                              onClick={() => handleEditUser(user)}
                              title="Düzenle"
                            >
                              ✏️
                            </button>
                            <button
                              className="action-btn detail"
                              onClick={() => setSelectedDetailUser(user)}
                              title="Detaylar"
                            >
                              📊
                            </button>
                            <button
                              className="action-btn delete"
                              onClick={() => handleDeleteUser(user)}
                              disabled={isLoading}
                              title="Sil"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'stories' ? (
            <StoryManager />
          ) : activeTab === 'similarity' ? (
            <SimilarityQuestionsManager />
          ) : activeTab === 'wordhunt' ? (
            <WordHuntQuestionsManager />
          ) : activeTab === 'videos' ? (
            <VideoManager />
          ) : activeTab === 'notifications' ? (
            <NotificationManager />
          ) : activeTab === 'messages' ? (
            <MessagesManager />
          ) : activeTab === 'highfive' ? (
            <HighFiveManager users={allUsers} />
          ) : activeTab === 'admin-actions' ? (
            <>
              <div className="admin-section">
                <h2>🔧 Sistem İşlemleri</h2>
                <div className="button-grid">
                  <button className="admin-button primary" onClick={() => handleAdminAction('check')} disabled={isLoading}>📊 Durum Kontrol</button>
                  <button className="admin-button success" onClick={() => handleAdminAction('sync')} disabled={isLoading}>🔄 Senkronize Et</button>
                  <button className="admin-button warning" onClick={() => handleAdminAction('cleanup')} disabled={isLoading}>🧹 Temizlik</button>
                  <button className="admin-button info" onClick={handleCheckStatus} disabled={isLoading}>🔍 Detaylı Check</button>
                </div>
              </div>

              {lastAction && (
                <div className="admin-section">
                  <h2>📝 Son İşlem</h2>
                  <div className="status-box"><p>{lastAction}</p></div>
                </div>
              )}

              {syncStatus && (
                <div className="admin-section">
                  <h2>📋 Senkronizasyon Durumu</h2>
                  <div className="status-box">
                    <p>📊 Database: {syncStatus.dbUsers?.length || 0}</p>
                    <p>🔐 Auth: {syncStatus.authUsers?.length || 0}</p>
                    <p>🚫 Orphans: {syncStatus.orphans?.length || 0}</p>
                    <p>🔄 Sync Gerekli: {syncStatus.syncNeeded ? 'Evet' : 'Hayır'}</p>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Kullanıcı Düzenleme Modal - Gelişmiş Görünüm */}
      {showUserEdit && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content edit-modal-premium">
            <div className="modal-header">
              <div className="header-title-complex">
                <span className="edit-icon">✏️</span>
                <div>
                  <h3>Kullanıcıyı Düzenle</h3>
                  <p className="subtitle">{selectedUser.username} ({selectedUser.key})</p>
                </div>
              </div>
              <button
                className="close-button-circle"
                onClick={() => {
                  setShowUserEdit(false);
                  setSelectedUser(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="edit-form-grid">
                {Object.entries(selectedUser)
                  .filter(([key]) => !['key', 'username', 'lastUpdated', 'password', 'uid'].includes(key))
                  .sort(([a], [b]) => {
                    // Important fields first
                    const priority = ['email', 'isPremium', 'isAdmin', 'level', 'score'];
                    const aIdx = priority.indexOf(a);
                    const bIdx = priority.indexOf(b);
                    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                    if (aIdx !== -1) return -1;
                    if (bIdx !== -1) return 1;
                    return a.localeCompare(b);
                  })
                  .map(([key, value]) => {
                    const isReadOnly = ['createdAt', 'deviceName', 'userId', 'premiumUpgradedAt', 'premiumDowngradedAt', 'avatarKey', 'avatar'].includes(key);
                    const isObject = typeof value === 'object' && value !== null;
                    const isBoolean = typeof value === 'boolean';

                    return (
                      <div className={`form-group ${isReadOnly ? 'read-only' : ''} ${isBoolean ? 'boolean-group' : ''}`} key={key}>
                        <div className="label-wrapper">
                          <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                          {isReadOnly && <span className="read-only-badge">Sadece Okunur</span>}
                        </div>

                        {isBoolean ? (
                          <div className="premium-toggle-wrapper">
                            <label className="switch">
                              <input
                                type="checkbox"
                                checked={value}
                                disabled={isReadOnly}
                                onChange={(e) => setSelectedUser({ ...selectedUser, [key]: e.target.checked })}
                              />
                              <span className="slider round"></span>
                            </label>
                            <span className="toggle-label">{value ? 'Aktif' : 'Pasif'}</span>
                            {key === 'isPremium' && <span className="visual-badge">👑</span>}
                            {key === 'isAdmin' && <span className="visual-badge">🛡️</span>}
                          </div>
                        ) : isObject ? (
                          <textarea
                            value={JSON.stringify(value, null, 2)}
                            readOnly={isReadOnly}
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setSelectedUser({ ...selectedUser, [key]: parsed });
                              } catch (err) { }
                            }}
                            className="json-textarea"
                          />
                        ) : (
                          <div className="input-with-icon">
                            <input
                              type={typeof value === 'number' ? 'number' : 'text'}
                              value={(value === null || value === undefined) ? '' : (value as any)}
                              readOnly={isReadOnly}
                              onChange={(e) => setSelectedUser({
                                ...selectedUser,
                                [key]: typeof value === 'number' ? parseFloat(e.target.value) : e.target.value
                              })}
                              placeholder={`${key} girin...`}
                            />
                            {key === 'email' && <span className="input-icon">📧</span>}
                            {key === 'level' && <span className="input-icon">🆙</span>}
                            {key === 'score' && <span className="input-icon">🏆</span>}
                            {key === 'birthYear' && <span className="input-icon">📅</span>}
                            {key === 'avatar' && <span className="input-icon">👤</span>}
                            {key === 'avatarKey' && <span className="input-icon">🖼️</span>}
                          </div>
                        )}

                        {key === 'createdAt' && typeof value === 'number' && (
                          <div className="field-hint">Tarih: {new Date(value).toLocaleString()}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="modal-footer premium-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowUserEdit(false);
                  setSelectedUser(null);
                }}
              >
                İptal
              </button>
              <button
                className="btn-primary-gradient"
                onClick={() => {
                  const { key, username, ...updates } = selectedUser;
                  handleUpdateUser(key, updates);
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Güncelleniyor...' : 'Değişiklikleri Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedDetailUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: 'white' }}>
              <h3 style={{ color: 'white' }}>📊 Detaylar: {selectedDetailUser.username}</h3>
              <button className="close-button" onClick={() => setSelectedDetailUser(null)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Game Metrics simplified view */}
              <div className="detail-section">
                <h4>🎮 Oyun Verileri</h4>
                <pre style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
                  {JSON.stringify(selectedDetailUser, (key, value) =>
                    ['password', 'uid'].includes(key) ? undefined : value
                    , 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>İşlem yapılıyor...</p>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
