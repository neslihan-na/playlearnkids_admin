import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { database, getDatabasePath } from '../firebase';
import { getAllUsers, adminUserManagement, checkUserSyncStatus, adminUpgradeToPremium, adminDowngradeFromPremium, updateUserData, deleteUser, createUser, type AdminPanelUser } from '../utils/adminFunctions';
import { sendNotificationDirectly } from '../utils/notificationUtils';
import { ref, push, get } from 'firebase/database';
import StoryManager from './StoryManager';
import SimilarityQuestionsManager from './SimilarityQuestionsManager';
import WordHuntQuestionsManager from './WordHuntQuestionsManager';
import VideoManager from './VideoManager';
import NotificationManager from './NotificationManager';
import MessagesManager from './MessagesManager';
import HighFiveManager from './HighFiveManager';
import BotManager from './BotManager';
import { LAST_UPDATE } from '../utils/version';
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
  const [activeTab, setActiveTab] = useState<'users' | 'stories' | 'similarity' | 'wordhunt' | 'videos' | 'notifications' | 'database' | 'admin-actions' | 'messages' | 'highfive' | 'bots'>('users');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const lastUnreadCount = useRef(0);
  const isFirstCheck = useRef(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: '',
    isSystemUser: false,
    isPremium: false,
    level: 1,
    score: 0,
  });

  // Multiselect state
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([]);

  // Quick Notification/Message state
  const [showQuickNotify, setShowQuickNotify] = useState(false);
  const [showQuickMsg, setShowQuickMsg] = useState(false);
  const [quickTargetUser, setQuickTargetUser] = useState<AdminPanelUser | null>(null);
  const [quickNotifyData, setQuickNotifyData] = useState({
    titleTr: '',
    messageTr: '',
    titleEn: '',
    messageEn: '',
    type: 'custom',
    data: {}
  });
  const [quickMsgText, setQuickMsgText] = useState('');

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof AdminPanelUser | 'createdAt'; direction: 'asc' | 'desc' } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(20);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Process users list: Filter -> Sort
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...allUsers];

    // 1. Filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(user =>
        (user.username || '').toLowerCase().includes(term) ||
        (user.email || '').toLowerCase().includes(term) ||
        (user.deviceId || '').toLowerCase().includes(term) ||
        (user.key || '').toLowerCase().includes(term)
      );
    }

    // 2. Sort
    if (sortConfig) {
      result.sort((a: any, b: any) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [allUsers, searchTerm, sortConfig]);

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

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('tr-TR');
    } catch (e) {
      return '-';
    }
  };

  const handleGetAllUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setLastAction('Tüm kullanıcılar getiriliyor...');

      const result = await getAllUsers();

      if (result.success) {
        setAllUsers(result.users || []);
        setLastAction(`✅ ${(result.users || []).length} kullanıcı getirildi`);
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
  }, []);

  // Otomatik kullanıcı listeleme
  useEffect(() => {
    if (!hasLoadedInitially) {
      handleGetAllUsers();
      setHasLoadedInitially(true);
    }
  }, [hasLoadedInitially, handleGetAllUsers]);

  const handleCreateUser = async () => {
    if (!newUserForm.username) {
      alert('Lütfen kullanıcı adı girin');
      return;
    }

    try {
      setIsLoading(true);
      const result = await createUser(newUserForm);
      if (result.success) {
        alert('Başarılı! Kullanıcı oluşturuldu.');
        setShowCreateUser(false);
        setNewUserForm({
          username: '',
          email: '',
          isSystemUser: false,
          isPremium: false,
          level: 1,
          score: 0,
        });
        await handleGetAllUsers();
      } else {
        alert(`Hata: ${result.message}`);
      }
    } catch (e) {
      alert('Hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

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


  const requestSort = (key: keyof AdminPanelUser | 'createdAt') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    // Sayfayı başa alalım ki kafa karışmasın
    setCurrentPage(1);
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
    let expireDate: number | null = null;

    if (isPremium) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      const defaultDateStr = `${String(defaultDate.getDate()).padStart(2, '0')}.${String(defaultDate.getMonth() + 1).padStart(2, '0')}.${defaultDate.getFullYear()}`;

      const input = window.prompt("Premium bitiş tarihini girin (Format: GG.AA.YYYY - Örn: 31.12.2026. Sınırsız için boş bırakın):", defaultDateStr);
      if (input === null) {
        return; // İptal edildi
      }

      const trimmedInput = input.trim();
      if (trimmedInput !== "") {
        const parts = trimmedInput.split('.');
        if (parts.length !== 3) {
          alert("Lütfen geçerli bir tarih girin (Örn: 25.04.2026)");
          return;
        }
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        const d = new Date(year, month, day, 23, 59, 59);

        if (isNaN(d.getTime())) {
          alert("Geçersiz tarih! Lütfen GG.AA.YYYY formatında girin.");
          return;
        }
        expireDate = d.getTime();
      }
    }

    setIsLoading(true);
    try {
      let result;
      if (isPremium) {
        result = await adminUpgradeToPremium(user.key, expireDate);
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

  const handleBulkDelete = async () => {
    if (selectedUserKeys.length === 0) return;

    const confirmDelete = window.confirm(`${selectedUserKeys.length} kullanıcıyı tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`);
    if (!confirmDelete) return;

    try {
      setIsLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (const key of selectedUserKeys) {
        const result = await deleteUser(key);
        if (result.success) successCount++;
        else failCount++;
      }

      alert(`İşlem tamamlandı.\nBaşarılı: ${successCount}\nHatalı: ${failCount}`);
      setSelectedUserKeys([]);
      await handleGetAllUsers();
    } catch (error) {
      alert('Hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedUserKeys.length === filteredAndSortedUsers.length) {
      setSelectedUserKeys([]);
    } else {
      setSelectedUserKeys(filteredAndSortedUsers.map(u => u.key));
    }
  };

  const handleToggleSelectUser = (key: string) => {
    if (selectedUserKeys.includes(key)) {
      setSelectedUserKeys(prev => prev.filter(k => k !== key));
    } else {
      setSelectedUserKeys(prev => [...prev, key]);
    }
  };

  const handleSendQuickNotify = async () => {
    if (!quickNotifyData.titleTr || !quickNotifyData.messageTr) return;

    const targetKeys = quickTargetUser ? [quickTargetUser.key] : selectedUserKeys;
    if (targetKeys.length === 0) return;

    try {
      setIsLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (const key of targetKeys) {
        const result = await sendNotificationDirectly(key, {
          titleTr: quickNotifyData.titleTr,
          messageTr: quickNotifyData.messageTr,
          titleEn: quickNotifyData.titleEn || quickNotifyData.titleTr,
          messageEn: quickNotifyData.messageEn || quickNotifyData.messageTr,
          type: quickNotifyData.type,
          data: quickNotifyData.data,
        });
        if (result.success) successCount++;
        else failCount++;
      }

      alert(`Bildirim gönderimi tamamlandı.\nBaşarılı: ${successCount}\nHatalı: ${failCount}`);
      setShowQuickNotify(false);
      setQuickNotifyData({ titleTr: '', messageTr: '', titleEn: '', messageEn: '', type: 'custom', data: {} });
    } catch (error) {
      alert('Hata oluştu!');
    } finally {
      setIsLoading(false);
    }
  };

  const quickNotificationTemplates: any = {
    new_story: {
      titleTr: '📚 Yeni Hikaye!',
      titleEn: '📚 New Story!',
      messageTr: 'Yeni bir hikaye eklendi. Hemen okumaya başla!',
      messageEn: 'A new story has been added. Start reading now!',
      data: { storyId: '', route: '/stories' },
    },
    achievement: {
      titleTr: '🏆 Tebrikler!',
      titleEn: '🏆 Congratulations!',
      messageTr: 'Yeni bir rozet kazandın!',
      messageEn: 'You earned a new badge!',
      data: { achievementId: '', badgeKey: '', route: '/profile' },
    },
    congrats: {
      titleTr: '✋ Çak Bir Beşlik!',
      titleEn: '✋ High Five!',
      messageTr: 'Harikasın! Birisi sana beşlik çaktı.',
      messageEn: 'Awesome! Someone sent you a high five.',
      data: { type: 'high_five', route: '/profile' },
    },
    custom: {
      titleTr: '',
      titleEn: '',
      messageTr: '',
      messageEn: '',
      data: {},
    },
  };

  const applyQuickTemplate = (type: string) => {
    const template = quickNotificationTemplates[type] || quickNotificationTemplates.custom;
    setQuickNotifyData({
      ...template,
      type
    });
  };

  const handleSendQuickMsg = async () => {
    if (!quickMsgText.trim()) return;

    const targetKeys = quickTargetUser ? [quickTargetUser.key] : selectedUserKeys;
    if (targetKeys.length === 0) return;

    try {
      setIsLoading(true);
      let successCount = 0;

      for (const key of targetKeys) {
        const messagesRef = ref(database, `user_messages/${key}`);
        await push(messagesRef, {
          userId: key,
          text: quickMsgText,
          sender: 'admin',
          createdAt: Date.now(),
          read: false,
          adminId: 'admin'
        });
        successCount++;
      }

      alert(`${successCount} kullanıcıya mesaj başarıyla gönderildi`);
      setShowQuickMsg(false);
      setQuickMsgText('');
    } catch (error) {
      alert('Hata oluştu!');
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
        <div className="version-info">
          <span className="info-label">🚀 Son Güncelleme:</span>
          <span className="info-value">{LAST_UPDATE}</span>
        </div>
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

          <button
            className={`tab-button ${activeTab === 'bots' ? 'active' : ''}`}
            onClick={() => setActiveTab('bots')}
          >
            🤖 {!sidebarCollapsed && 'Bot Yönetimi'}
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
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="admin-button success"
                    onClick={() => setShowCreateUser(true)}
                    style={{ padding: '8px 16px', fontSize: '14px' }}
                  >
                    ➕ Yeni Kullanıcı
                  </button>
                  <div className="search-bar">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Kullanıcı adı, email veya ID ile ara..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1); // Aramada sayfayı 1 yap
                      }}
                      style={{
                        padding: '10px 15px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        width: '300px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <button
                    className="admin-button secondary"
                    onClick={handleGetAllUsers}
                    disabled={isLoading}
                    style={{ padding: '8px 16px', fontSize: '14px' }}
                  >
                    🔄 Yenile
                  </button>
                  {selectedUserKeys.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="admin-button info"
                        onClick={() => {
                          setQuickTargetUser(null);
                          setShowQuickNotify(true);
                        }}
                        disabled={isLoading}
                        style={{ padding: '8px 16px', fontSize: '14px' }}
                      >
                        🔔 Bildirim ({selectedUserKeys.length})
                      </button>
                      <button
                        className="admin-button warning"
                        onClick={() => {
                          setQuickTargetUser(null);
                          setShowQuickMsg(true);
                        }}
                        disabled={isLoading}
                        style={{ padding: '8px 16px', fontSize: '14px' }}
                      >
                        💬 Mesaj ({selectedUserKeys.length})
                      </button>
                      <button
                        className="admin-button danger"
                        onClick={handleBulkDelete}
                        disabled={isLoading}
                        style={{ padding: '8px 16px', fontSize: '14px' }}
                      >
                        🗑️ Sil ({selectedUserKeys.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="user-table-container">
                <table className="user-sql-table">
                  <thead>
                    <tr>
                      <th className="col-index">
                        <input
                          type="checkbox"
                          checked={selectedUserKeys.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                          onChange={handleToggleSelectAll}
                        />
                      </th>
                      <th className="sortable-header" onClick={() => requestSort('username')}>
                        Kullanıcı Adı {sortConfig?.key === 'username' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                      </th>
                      <th>Email</th>
                      <th className="sortable-header" onClick={() => requestSort('deviceId')}>
                        Cihaz No {sortConfig?.key === 'deviceId' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                      </th>
                      <th className="sortable-header" onClick={() => requestSort('level')}>
                        Level {sortConfig?.key === 'level' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                      </th>
                      <th className="sortable-header" onClick={() => requestSort('score')}>
                        Puan {sortConfig?.key === 'score' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                      </th>
                      <th>Yetki</th>
                      <th>Üyelik</th>
                      <th className="sortable-header" onClick={() => requestSort('createdAt')}>
                        Kayıt Tarihi {sortConfig?.key === 'createdAt' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                      </th>
                      <th className="col-actions">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const indexOfLastUser = currentPage * usersPerPage;
                      const indexOfFirstUser = indexOfLastUser - usersPerPage;
                      const currentUsers = filteredAndSortedUsers.slice(indexOfFirstUser, indexOfLastUser);

                      return currentUsers.map((user, index) => (
                        <tr key={user.key || index} className={selectedUserKeys.includes(user.key) ? 'selected-row' : ''}>
                          <td className="col-index text-center">
                            <input
                              type="checkbox"
                              checked={selectedUserKeys.includes(user.key)}
                              onChange={() => handleToggleSelectUser(user.key)}
                            />
                          </td>
                          <td className="col-username">
                            <div className="user-name-cell">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <strong>{user.username}</strong>
                                {user.isSystemUser && <span className="badge system small" style={{ fontSize: '10px', padding: '2px 6px' }}>🤖 Bot</span>}
                              </div>
                              <span className="user-key-hint">{user.key}</span>
                            </div>
                          </td>
                          <td>{user.email || <span className="no-data">Email yok</span>}</td>
                          <td style={{ fontSize: '11px', color: '#64748b' }}>{user.deviceId || '-'}</td>
                          <td className="text-center">{user.level || 1}</td>
                          <td className="text-center">{user.score || 0}</td>
                          <td>
                            <span className={`badge ${user.isAdmin ? 'admin' : 'user'}`}>
                              {user.isAdmin ? '👑 Admin' : '👤 User'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span className={`badge ${user.isPremium ? 'premium' : 'normal'}`}>
                                {user.isPremium ? '💎 Premium' : '✨ Normal'}
                              </span>
                              {user.isPremium && user.premiumExpirationDate && (
                                <span style={{ fontSize: '10px', color: '#666' }}>
                                  ⌛ {formatDate(user.premiumExpirationDate)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-center" style={{ fontSize: '11px', color: '#64748b' }}>
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('tr-TR') : '-'}
                          </td>
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
                                className="action-btn notify"
                                onClick={() => {
                                  setQuickTargetUser(user);
                                  setShowQuickNotify(true);
                                }}
                                title="Bildirim Gönder"
                              >
                                🔔
                              </button>
                              <button
                                className="action-btn message"
                                onClick={() => {
                                  setQuickTargetUser(user);
                                  setShowQuickMsg(true);
                                }}
                                title="Mesaj Gönder"
                              >
                                💬
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
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="pagination-container">
                <div className="pagination-info">
                  Toplam <strong>{filteredAndSortedUsers.length}</strong> kullanıcıdan {(currentPage - 1) * usersPerPage + 1}-{Math.min(currentPage * usersPerPage, filteredAndSortedUsers.length)} arası gösteriliyor
                </div>
                <div className="pagination-actions">
                  <div className="users-per-page">
                    <select value={usersPerPage} onChange={(e) => {
                      setUsersPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}>
                      <option value={10}>10 / Sayfa</option>
                      <option value={20}>20 / Sayfa</option>
                      <option value={50}>50 / Sayfa</option>
                      <option value={100}>100 / Sayfa</option>
                    </select>
                  </div>
                  <div className="page-numbers">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      className="page-btn nav"
                    >
                      Önceki
                    </button>
                    {(() => {
                      const totalPages = Math.ceil(allUsers.length / usersPerPage);
                      const pages = [];
                      let startPage = Math.max(1, currentPage - 2);
                      let endPage = Math.min(totalPages, startPage + 4);

                      if (endPage - startPage < 4) {
                        startPage = Math.max(1, endPage - 4);
                      }

                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`page-btn ${currentPage === i ? 'active' : ''}`}
                          >
                            {i}
                          </button>
                        );
                      }
                      return pages;
                    })()}
                    <button
                      disabled={currentPage === Math.ceil(allUsers.length / usersPerPage)}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      className="page-btn nav"
                    >
                      Sonraki
                    </button>
                  </div>
                </div>
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
            <HighFiveManager users={allUsers} onRefresh={handleGetAllUsers} />
          ) : activeTab === 'bots' ? (
            <BotManager users={allUsers} onRefresh={handleGetAllUsers} isLoading={isLoading} />
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
      {
        showUserEdit && selectedUser && (
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
                      const isReadOnly = ['createdAt', 'deviceName', 'deviceId', 'userId', 'premiumUpgradedAt', 'premiumDowngradedAt', 'avatarKey', 'avatar'].includes(key);
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
                          ) : key === 'premiumExpirationDate' ? (
                            <div>
                              <input
                                type="date"
                                value={value ? new Date(value).toISOString().split('T')[0] : ''}
                                onChange={(e) => {
                                  const newDate = e.target.value ? new Date(e.target.value + 'T23:59:59').getTime() : null;
                                  setSelectedUser({ ...selectedUser, premiumExpirationDate: newDate });
                                }}
                              />
                              {value && (
                                <div className="field-hint">{new Date(value).toLocaleDateString('tr-TR')} - Kullanıcının premium hesabının bişacağı tarih</div>
                              )}
                            </div>
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
                    // premiumExpirationDate artık doğrudan modal içindeki date picker'dan geliyor.
                    // isPremium false ise expiration'u temizle
                    if (!updates.isPremium) {
                      updates.premiumExpirationDate = null;
                    }
                    handleUpdateUser(key, updates);
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Güncelleniyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        selectedDetailUser && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px' }}>
              <div className="modal-header" style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: 'white' }}>
                <h3 style={{ color: 'white' }}>📊 Detaylar: {selectedDetailUser.username}</h3>
                <button className="close-button" onClick={() => setSelectedDetailUser(null)}>✕</button>
              </div>
              <div className="modal-body">
                {/* Game Metrics visual view */}
                <div className="detail-section">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    🎮 Oyun İstatistikleri
                  </h4>

                  {selectedDetailUser.gameMetrics?.gamePlayCounts ? (
                    <div className="metrics-grid">
                      {Object.entries(selectedDetailUser.gameMetrics.gamePlayCounts).map(([game, count]) => (
                        <div className="metric-card" key={game}>
                          <div className="metric-icon">
                            {game === 'snake' ? '🐍' :
                              game === 'chess' ? '♟️' :
                                game === 'memory' ? '🧠' :
                                  game === 'antosyn' ? '🐜' :
                                    game === 'comparison' ? '⚖️' :
                                      game === 'multiply' ? '✖️' :
                                        game === 'divide' ? '➗' :
                                          game === 'sum' ? '➕' :
                                            game === 'subtract' ? '➖' : '🎮'}
                          </div>
                          <div className="metric-info">
                            <span className="metric-name">{game.charAt(0).toUpperCase() + game.slice(1)}</span>
                            <span className="metric-value">{count as number} <small>Oyun</small></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-data-alert">
                      Henüz oyun verisi bulunmuyor.
                    </div>
                  )}

                  <h4 style={{ marginTop: '24px', marginBottom: '16px' }}>📋 Ham Veriler (JSON)</h4>
                  <pre style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', fontSize: '11px', border: '1px solid #e2e8f0', maxHeight: '300px', overflow: 'auto' }}>
                    {JSON.stringify(selectedDetailUser, (key, value) =>
                      ['password', 'uid'].includes(key) ? undefined : value
                      , 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Kullanıcı Oluşturma Modal */}
      {
        showCreateUser && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <div className="modal-header" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>
                <h3 style={{ color: 'white' }}>➕ Yeni Kullanıcı Oluştur</h3>
                <button className="close-button" onClick={() => setShowCreateUser(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Kullanıcı Adı (Benzersiz):</label>
                  <input
                    type="text"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    placeholder="Örn: testuser123"
                  />
                </div>
                <div className="form-group">
                  <label>Email (Opsiyonel):</label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    placeholder="Örn: test@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Seviye (Level):</label>
                  <input
                    type="number"
                    value={newUserForm.level}
                    onChange={(e) => setNewUserForm({ ...newUserForm, level: parseInt(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Puan (Score):</label>
                  <input
                    type="number"
                    value={newUserForm.score}
                    onChange={(e) => setNewUserForm({ ...newUserForm, score: parseInt(e.target.value) })}
                  />
                </div>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={newUserForm.isSystemUser}
                      onChange={(e) => setNewUserForm({ ...newUserForm, isSystemUser: e.target.checked })}
                    />
                    Sistem Kullanıcısı (Bot)
                  </label>
                </div>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={newUserForm.isPremium}
                      onChange={(e) => setNewUserForm({ ...newUserForm, isPremium: e.target.checked })}
                    />
                    Premium Üyelik
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button className="cancel-button" onClick={() => setShowCreateUser(false)}>İptal</button>
                <button className="save-button" onClick={handleCreateUser} disabled={isLoading}>
                  {isLoading ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Hızlı Bildirim Modal */}
      {
        showQuickNotify && (quickTargetUser || selectedUserKeys.length > 0) && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <div className="modal-header" style={{ background: 'linear-gradient(135deg, #3498db, #2980b9)', color: 'white' }}>
                <h3 style={{ color: 'white' }}>
                  🔔 {quickTargetUser ? `Bildirim: ${quickTargetUser.username}` : `Toplu Bildirim (${selectedUserKeys.length})`}
                </h3>
                <button className="close-button" onClick={() => setShowQuickNotify(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>📋 Şablon Uygula:</label>
                  <select
                    onChange={(e) => applyQuickTemplate(e.target.value)}
                    defaultValue="custom"
                    style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}
                  >
                    <option value="custom">✨ Özel (Temiz)</option>
                    <option value="new_story">📚 Yeni Hikaye</option>
                    <option value="congrats">✋ Beşlik Çakma</option>
                    <option value="achievement">🏆 Başarı</option>
                  </select>
                </div>

                <div className="sidebar-divider"></div>

                <div className="form-group">
                  <label>🇹🇷 Başlık (TR):</label>
                  <input
                    type="text"
                    value={quickNotifyData.titleTr}
                    onChange={(e) => setQuickNotifyData({ ...quickNotifyData, titleTr: e.target.value })}
                    placeholder="Bildirim başlığı..."
                  />
                </div>
                <div className="form-group">
                  <label>🇹🇷 Mesaj (TR):</label>
                  <textarea
                    value={quickNotifyData.messageTr}
                    onChange={(e) => setQuickNotifyData({ ...quickNotifyData, messageTr: e.target.value })}
                    placeholder="Bildirim içeriği..."
                    rows={2}
                  />
                </div>

                <div className="form-group">
                  <label>🇺🇸 Title (EN):</label>
                  <input
                    type="text"
                    value={quickNotifyData.titleEn}
                    onChange={(e) => setQuickNotifyData({ ...quickNotifyData, titleEn: e.target.value })}
                    placeholder="Notification title..."
                  />
                </div>
                <div className="form-group">
                  <label>🇺🇸 Message (EN):</label>
                  <textarea
                    value={quickNotifyData.messageEn}
                    onChange={(e) => setQuickNotifyData({ ...quickNotifyData, messageEn: e.target.value })}
                    placeholder="Notification message..."
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="cancel-button" onClick={() => setShowQuickNotify(false)}>İptal</button>
                <button className="save-button" onClick={handleSendQuickNotify} disabled={isLoading || !quickNotifyData.titleTr || !quickNotifyData.messageTr}>
                  {isLoading ? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Hızlı Mesaj Modal */}
      {
        showQuickMsg && (quickTargetUser || selectedUserKeys.length > 0) && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <div className="modal-header" style={{ background: 'linear-gradient(135deg, #9b59b6, #8e44ad)', color: 'white' }}>
                <h3 style={{ color: 'white' }}>
                  💬 {quickTargetUser ? `Mesaj: ${quickTargetUser.username}` : `Toplu Mesaj (${selectedUserKeys.length})`}
                </h3>
                <button className="close-button" onClick={() => setShowQuickMsg(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Mesajınız:</label>
                  <textarea
                    value={quickMsgText}
                    onChange={(e) => setQuickMsgText(e.target.value)}
                    placeholder="Kullanıcıya/Kullanıcılara mesajınızı yazın..."
                    rows={5}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="cancel-button" onClick={() => setShowQuickMsg(false)}>İptal</button>
                <button className="save-button" onClick={handleSendQuickMsg} disabled={isLoading || !quickMsgText.trim()}>
                  {isLoading ? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>İşlem yapılıyor...</p>
          </div>
        )
      }
    </div >
  );
};

export default AdminPanel;
