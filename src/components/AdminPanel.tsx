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
import AdventureContentManager from './AdventureContentManager';
import { LAST_UPDATE } from '../utils/version';
import './AdminPanel.css';

interface AdminPanelProps {
  user: {
    name: string;
    isAdmin: boolean;
  };
  onLogout: () => void;
}

type AdminTab = 'users' | 'stories' | 'adventure' | 'similarity' | 'wordhunt' | 'videos' | 'notifications' | 'database' | 'admin-actions' | 'messages' | 'highfive';
type UserManagementTab = 'users' | 'bots';

// User interface kaldırıldı - AdminPanelUser kullanılacak

const AdminPanel: React.FC<AdminPanelProps> = ({ user, onLogout }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');
  const [allUsers, setAllUsers] = useState<AdminPanelUser[]>([]);

  const [selectedUser, setSelectedUser] = useState<AdminPanelUser | null>(null);
  const [selectedDetailUser, setSelectedDetailUser] = useState<AdminPanelUser | null>(null);
  const [showUserEdit, setShowUserEdit] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [userManagementTab, setUserManagementTab] = useState<UserManagementTab>('users');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mediaGroupOpen, setMediaGroupOpen] = useState(true);
  const [gameQuestionsGroupOpen, setGameQuestionsGroupOpen] = useState(true);
  const [interactionGroupOpen, setInteractionGroupOpen] = useState(true);
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
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    source: '',
    level: '',
    role: '',
    membership: '',
    lastLoginFrom: '',
    lastLoginTo: '',
    createdAtFrom: '',
    createdAtTo: ''
  });
  const [openDateFilter, setOpenDateFilter] = useState<'lastLogin' | 'createdAt' | null>(null);

  const clearColumnFilters = () => {
    setColumnFilters({
      source: '',
      level: '',
      role: '',
      membership: '',
      lastLoginFrom: '',
      lastLoginTo: '',
      createdAtFrom: '',
      createdAtTo: ''
    });
  };

  const normalizeSearchText = (value: any) =>
    String(value || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const compactSearchText = (value: string) => value.replace(/\s+/g, '');

  const getDateRangeTime = useCallback((value: string, boundary: 'start' | 'end') => {
    if (!value) return null;
    const suffix = boundary === 'start' ? 'T00:00:00' : 'T23:59:59';
    const time = new Date(`${value}${suffix}`).getTime();
    return Number.isNaN(time) ? null : time;
  }, []);

  const isTimestampInRange = useCallback((timestamp: any, from: string, to: string) => {
    if (!from && !to) return true;
    if (!timestamp) return false;

    const time = Number(timestamp);
    if (Number.isNaN(time)) return false;

    const fromTime = getDateRangeTime(from, 'start');
    const toTime = getDateRangeTime(to, 'end');

    if (fromTime !== null && time < fromTime) return false;
    if (toTime !== null && time > toTime) return false;
    return true;
  }, [getDateRangeTime]);

  const formatDateRangeLabel = (label: string, from: string, to: string) => {
    if (!from && !to) return label;
    const format = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('tr-TR') : '...';
    return `${label}: ${format(from)} - ${format(to)}`;
  };

  const levelOptions = useMemo(() => {
    const levels = new Set<number>();
    allUsers.forEach(user => {
      const level = Number(user.level || 1);
      if (!Number.isNaN(level)) levels.add(level);
    });
    return Array.from(levels).sort((a, b) => a - b);
  }, [allUsers]);

  const getUserSourceMeta = useCallback((user: AdminPanelUser) => {
    const key = String(user.key || user.userId || '').toLowerCase();
    const deviceType = String(user.deviceType || '').toLowerCase();
    const email = String(user.email || '').toLowerCase();

    if (user.isSystemUser || key.startsWith('bot_')) {
      return {
        label: 'Bot',
        className: 'source-bot',
        title: 'Sistem/bot kullanıcısı olarak işaretlenmiş.'
      };
    }

    if (
      key.startsWith('user_android_') ||
      key.startsWith('user_ios_') ||
      key.startsWith('user_email_') ||
      ['android', 'ios'].includes(deviceType) ||
      Boolean(user.deviceId) ||
      user.isGuest === true
    ) {
      return {
        label: 'Mobil/App',
        className: 'source-app',
        title: 'Mobil uygulama akışından gelmiş kullanıcı gibi görünüyor.'
      };
    }

    if (
      !user.authUid &&
      !user.deviceId &&
      !deviceType &&
      (email === 'email yok' || email.endsWith('@playlearnkids.com'))
    ) {
      return {
        label: 'Admin/Test',
        className: 'source-admin-test',
        title: 'Admin panel veya geliştirme/test sırasında oluşturulmuş olabilir.'
      };
    }

    return {
      label: 'Bilinmiyor',
      className: 'source-unknown',
      title: 'Bu kullanıcı için kaynağı kesin gösteren alan bulunamadı.'
    };
  }, []);

  // Process users list: Filter -> Sort
  const filteredAndSortedUsers = useMemo(() => {
    let result = allUsers.filter(user => !user.isSystemUser);

    // 1. Global Filter
    if (searchTerm.trim() !== '') {
      const terms = normalizeSearchText(searchTerm).split(/\s+/).filter(Boolean);
      result = result.filter(user => {
        const searchableParts = [
          user.username,
          user.name,
          user.email,
          user.deviceId,
          user.key,
          user.userId,
          user.uid,
          user.isSystemUser ? 'bot robot system sistem' : 'real gerçek normal user kullanıcı',
          getUserSourceMeta(user).label,
        ];
        const searchableText = normalizeSearchText(searchableParts.join(' '));
        const compactText = compactSearchText(searchableText);

        return terms.every(term => (
          searchableText.includes(term) ||
          compactText.includes(compactSearchText(term))
        ));
      });
    }

    // 2. Column Filters
    Object.keys(columnFilters).forEach(key => {
      const filterValue = columnFilters[key].trim().toLowerCase();
      if (filterValue !== '') {
        result = result.filter(user => {
          let value: any = '';

          if (key === 'role') {
            value = user.isAdmin ? 'admin' : 'user';
          } else if (key === 'membership') {
            value = user.isPremium ? 'premium' : 'normal';
          } else if (key === 'source') {
            value = getUserSourceMeta(user).className;
          } else if (key === 'lastLoginFrom' || key === 'lastLoginTo') {
            return isTimestampInRange(user.lastLogin, columnFilters.lastLoginFrom, columnFilters.lastLoginTo);
          } else if (key === 'createdAtFrom' || key === 'createdAtTo') {
            return isTimestampInRange(user.createdAt, columnFilters.createdAtFrom, columnFilters.createdAtTo);
          } else {
            value = String((user as any)[key] || '').toLowerCase();
          }

          return value === filterValue;
        });
      }
    });

    // 3. Sort
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
  }, [allUsers, searchTerm, columnFilters, sortConfig, isTimestampInRange, getUserSourceMeta]);

  const totalFilteredPages = Math.max(1, Math.ceil(filteredAndSortedUsers.length / usersPerPage));

  useEffect(() => {
    if (currentPage > totalFilteredPages) {
      setCurrentPage(totalFilteredPages);
    }
  }, [currentPage, totalFilteredPages]);

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
          <div className="header-inline">
            <h1>👑 Admin Panel</h1>
            <span className="header-subtitle">Yönetim Paneli</span>
            <span className="current-user">Aktif Admin: {user.name}</span>
            <span className="version-info">
              <span className="info-label">🚀 Son Güncelleme:</span>
              <span className="info-value">{LAST_UPDATE}</span>
            </span>
          </div>
          <button
            className="logout-button"
            onClick={onLogout}
            disabled={isLoading}
          >
            🚪 Çıkış
          </button>
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

          <div className={`sidebar-group ${['stories', 'videos'].includes(activeTab) ? 'active' : ''}`}>
            {!sidebarCollapsed && (
              <button
                type="button"
                className="sidebar-group-title"
                onClick={() => setMediaGroupOpen((isOpen) => !isOpen)}
                aria-expanded={mediaGroupOpen}
              >
                <span>🎞️ Medya Yönetimi</span>
                <span className="sidebar-group-caret">{mediaGroupOpen ? '▾' : '▸'}</span>
              </button>
            )}
            {mediaGroupOpen && (
              <div className="sidebar-submenu">
                <button
                  className={`tab-button submenu ${activeTab === 'stories' ? 'active' : ''}`}
                  onClick={() => setActiveTab('stories')}
                >
                  📚 {!sidebarCollapsed && 'Hikaye Yönetimi'}
                </button>
                <button
                  className={`tab-button submenu ${activeTab === 'videos' ? 'active' : ''}`}
                  onClick={() => setActiveTab('videos')}
                >
                  🎥 {!sidebarCollapsed && 'Video Yönetimi'}
                </button>
              </div>
            )}
          </div>

          <div className={`sidebar-group ${['adventure', 'similarity', 'wordhunt'].includes(activeTab) ? 'active' : ''}`}>
            {!sidebarCollapsed && (
              <button
                type="button"
                className="sidebar-group-title"
                onClick={() => setGameQuestionsGroupOpen((isOpen) => !isOpen)}
                aria-expanded={gameQuestionsGroupOpen}
              >
                <span>🎮 Oyun Soruları</span>
                <span className="sidebar-group-caret">{gameQuestionsGroupOpen ? '▾' : '▸'}</span>
              </button>
            )}
            {gameQuestionsGroupOpen && (
              <div className="sidebar-submenu">
                <button
                  className={`tab-button submenu ${activeTab === 'adventure' ? 'active' : ''}`}
                  onClick={() => setActiveTab('adventure')}
                >
                  🗺️ {!sidebarCollapsed && 'Macera Yönetimi'}
                </button>

                <button
                  className={`tab-button submenu ${activeTab === 'similarity' ? 'active' : ''}`}
                  onClick={() => setActiveTab('similarity')}
                >
                  🎯 {!sidebarCollapsed && 'Benzerlik Soruları'}
                </button>

                <button
                  className={`tab-button submenu ${activeTab === 'wordhunt' ? 'active' : ''}`}
                  onClick={() => setActiveTab('wordhunt')}
                >
                  🔍 {!sidebarCollapsed && 'Word Hunt Soruları'}
                </button>
              </div>
            )}
          </div>

          <div className={`sidebar-group ${['notifications', 'messages', 'highfive'].includes(activeTab) ? 'active' : ''}`}>
            {!sidebarCollapsed && (
              <button
                type="button"
                className="sidebar-group-title"
                onClick={() => setInteractionGroupOpen((isOpen) => !isOpen)}
                aria-expanded={interactionGroupOpen}
              >
                <span>🤝 Etkileşim Yönetimi</span>
                <span className="sidebar-group-caret">{interactionGroupOpen ? '▾' : '▸'}</span>
              </button>
            )}
            {interactionGroupOpen && (
              <div className="sidebar-submenu">
                <button
                  className={`tab-button submenu ${activeTab === 'notifications' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notifications')}
                >
                  📬 {!sidebarCollapsed && 'Bildirim Gönder'}
                </button>

                <button
                  className={`tab-button submenu ${activeTab === 'messages' ? 'active' : ''}`}
                  onClick={() => setActiveTab('messages')}
                >
                  💬 {!sidebarCollapsed && 'Mesajlar'}
                  {unreadMessageCount > 0 && (
                    <span className="notification-badge">{unreadMessageCount}</span>
                  )}
                </button>

                <button
                  className={`tab-button submenu ${activeTab === 'highfive' ? 'active' : ''}`}
                  onClick={() => setActiveTab('highfive')}
                >
                  ✋ {!sidebarCollapsed && 'High Five Gönder'}
                </button>
              </div>
            )}
          </div>

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
                <div className="users-header-left">
                  <div className="management-subtabs" role="tablist" aria-label="Kullanıcı yönetimi bölümleri">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={userManagementTab === 'users'}
                      className={`management-subtab ${userManagementTab === 'users' ? 'active' : ''}`}
                      onClick={() => setUserManagementTab('users')}
                    >
                      👥 Kullanıcılar
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={userManagementTab === 'bots'}
                      className={`management-subtab ${userManagementTab === 'bots' ? 'active' : ''}`}
                      onClick={() => setUserManagementTab('bots')}
                    >
                      🤖 Bot Kullanıcılar
                    </button>
                  </div>
                  <h2>👥 Kullanıcı Listesi ({filteredAndSortedUsers.length})</h2>
                </div>
                <div className="users-header-actions">
                  {userManagementTab === 'users' && (
                    <>
                      <button
                        className="admin-button success"
                        onClick={() => setShowCreateUser(true)}
                      >
                        ➕ Yeni Kullanıcı
                      </button>
                      <div className="search-bar">
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Kullanıcı adı, email, cihaz no veya ID ile ara..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1); // Aramada sayfayı 1 yap
                          }}
                        />
                      </div>
                    </>
                  )}
                  <button
                    className="admin-button secondary"
                    onClick={handleGetAllUsers}
                    disabled={isLoading}
                  >
                    🔄 Yenile
                  </button>
                  {userManagementTab === 'users' && selectedUserKeys.length > 0 && (
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

              {userManagementTab === 'users' ? (
                <>
              <div className="user-filter-panel compact-filter-panel">
                <div className="filter-fields-row">
                    <div className="filter-field">
                      <select
                        className="column-filter-select"
                        aria-label="Kaynak"
                        value={columnFilters.source}
                        onChange={(e) => {
                          setColumnFilters(prev => ({ ...prev, source: e.target.value }));
                          setCurrentPage(1);
                        }}
                      >
                        <option value="">Kaynak: Hepsi</option>
                        <option value="source-app">Mobil/App</option>
                        <option value="source-admin-test">Admin/Test</option>
                        <option value="source-unknown">Bilinmiyor</option>
                        <option value="source-bot">Bot</option>
                      </select>
                    </div>
                    <div className="filter-field">
                      <select
                        className="column-filter-select"
                        aria-label="Yetki"
                        value={columnFilters.role}
                        onChange={(e) => {
                          setColumnFilters(prev => ({ ...prev, role: e.target.value }));
                          setCurrentPage(1);
                        }}
                      >
                        <option value="">Yetki: Hepsi</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                      </select>
                    </div>
                    <div className="filter-field">
                      <select
                        className="column-filter-select"
                        aria-label="Üyelik"
                        value={columnFilters.membership}
                        onChange={(e) => {
                          setColumnFilters(prev => ({ ...prev, membership: e.target.value }));
                          setCurrentPage(1);
                        }}
                      >
                        <option value="">Üyelik: Hepsi</option>
                        <option value="premium">Premium</option>
                        <option value="normal">Normal</option>
                      </select>
                    </div>
                    <div className="filter-field">
                      <select
                        className="column-filter-select"
                        aria-label="Level"
                        value={columnFilters.level}
                        onChange={(e) => {
                          setColumnFilters(prev => ({ ...prev, level: e.target.value }));
                          setCurrentPage(1);
                        }}
                      >
                        <option value="">Level: Hepsi</option>
                        {levelOptions.map(level => (
                          <option key={level} value={String(level)}>Level {level}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-field date-range-menu">
                      <button
                        type="button"
                        className="date-range-trigger"
                        onClick={() => setOpenDateFilter(openDateFilter === 'lastLogin' ? null : 'lastLogin')}
                      >
                        {formatDateRangeLabel('Son Giriş', columnFilters.lastLoginFrom, columnFilters.lastLoginTo)}
                      </button>
                      {openDateFilter === 'lastLogin' && (
                        <div className="date-range-popover">
                          <input
                            type="date"
                            className="column-filter-input"
                            value={columnFilters.lastLoginFrom}
                            onChange={(e) => {
                              setColumnFilters(prev => ({ ...prev, lastLoginFrom: e.target.value }));
                              setCurrentPage(1);
                            }}
                          />
                          <input
                            type="date"
                            className="column-filter-input"
                            value={columnFilters.lastLoginTo}
                            onChange={(e) => {
                              setColumnFilters(prev => ({ ...prev, lastLoginTo: e.target.value }));
                              setCurrentPage(1);
                            }}
                          />
                          <div className="date-range-actions">
                            <button type="button" onClick={() => setColumnFilters(prev => ({ ...prev, lastLoginFrom: '', lastLoginTo: '' }))}>Temizle</button>
                            <button type="button" onClick={() => setOpenDateFilter(null)}>Tamam</button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="filter-field date-range-menu">
                      <button
                        type="button"
                        className="date-range-trigger"
                        onClick={() => setOpenDateFilter(openDateFilter === 'createdAt' ? null : 'createdAt')}
                      >
                        {formatDateRangeLabel('Kayıt Tarihi', columnFilters.createdAtFrom, columnFilters.createdAtTo)}
                      </button>
                      {openDateFilter === 'createdAt' && (
                        <div className="date-range-popover align-right">
                          <input
                            type="date"
                            className="column-filter-input"
                            value={columnFilters.createdAtFrom}
                            onChange={(e) => {
                              setColumnFilters(prev => ({ ...prev, createdAtFrom: e.target.value }));
                              setCurrentPage(1);
                            }}
                          />
                          <input
                            type="date"
                            className="column-filter-input"
                            value={columnFilters.createdAtTo}
                            onChange={(e) => {
                              setColumnFilters(prev => ({ ...prev, createdAtTo: e.target.value }));
                              setCurrentPage(1);
                            }}
                          />
                          <div className="date-range-actions">
                            <button type="button" onClick={() => setColumnFilters(prev => ({ ...prev, createdAtFrom: '', createdAtTo: '' }))}>Temizle</button>
                            <button type="button" onClick={() => setOpenDateFilter(null)}>Tamam</button>
                          </div>
                        </div>
                      )}
                    </div>
                    {(Object.values(columnFilters).some(v => v !== '') || searchTerm !== '') && (
                      <button
                        type="button"
                        className="clear-filters-btn"
                        onClick={() => {
                          clearColumnFilters();
                          setSearchTerm('');
                          setOpenDateFilter(null);
                          setCurrentPage(1);
                        }}
                        title="Tüm Filtreleri Temizle"
                      >
                        Temizle
                      </button>
                    )}
                      </div>
              </div>

              <div className="user-table-container">
                <table className="user-sql-table">
                  <thead>
                    <tr>
                      <th className="col-row-number">ID</th>
                      <th className="col-index">
                        <input
                          type="checkbox"
                          checked={selectedUserKeys.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                          onChange={handleToggleSelectAll}
                        />
                      </th>
                      <th className="sortable-header" onClick={() => requestSort('username')}>
                        <div className="header-content">
                          Kullanıcı Adı {sortConfig?.key === 'username' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                        </div>
                      </th>
                      <th>Kullanıcı ID</th>
                      <th>Kaynak</th>
                      <th>Email</th>
                      <th className="sortable-header" onClick={() => requestSort('deviceId')}>
                        <div className="header-content">
                          Cihaz No {sortConfig?.key === 'deviceId' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                        </div>
                      </th>
                      <th className="sortable-header" onClick={() => requestSort('level')}>
                        <div className="header-content">
                          Level {sortConfig?.key === 'level' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                        </div>
                      </th>
                      <th className="sortable-header" onClick={() => requestSort('score')}>
                        <div className="header-content">
                          Puan {sortConfig?.key === 'score' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                        </div>
                      </th>
                      <th>Yetki</th>
                      <th>Üyelik</th>
                      <th className="sortable-header" onClick={() => requestSort('lastLogin')}>
                        <div className="header-content">
                          Son Giriş {sortConfig?.key === 'lastLogin' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                        </div>
                      </th>
                      <th className="sortable-header" onClick={() => requestSort('createdAt')}>
                        <div className="header-content">
                          Kayıt Tarihi {sortConfig?.key === 'createdAt' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
                        </div>
                      </th>
                      <th className="col-actions">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const indexOfLastUser = currentPage * usersPerPage;
                      const indexOfFirstUser = indexOfLastUser - usersPerPage;
                      const currentUsers = filteredAndSortedUsers.slice(indexOfFirstUser, indexOfLastUser);

                      return currentUsers.map((user, index) => {
                        const sourceMeta = getUserSourceMeta(user);

                        return (
                          <tr key={user.key || index} className={selectedUserKeys.includes(user.key) ? 'selected-row' : ''}>
                            <td className="col-row-number text-center">{indexOfFirstUser + index + 1}</td>
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
                                </div>
                              </div>
                            </td>
                            <td className="user-id-cell">{user.key}</td>
                            <td>
                              <span className={`source-badge ${sourceMeta.className}`} title={sourceMeta.title}>
                                {sourceMeta.label}
                              </span>
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
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('tr-TR') : '-'}
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
                        );
                      });
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
                      const totalPages = totalFilteredPages;
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
                      disabled={currentPage === totalFilteredPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      className="page-btn nav"
                    >
                      Sonraki
                    </button>
                  </div>
                </div>
              </div>
                </>
              ) : (
                <BotManager users={allUsers} onRefresh={handleGetAllUsers} isLoading={isLoading} />
              )}
            </div>
          ) : activeTab === 'stories' ? (
            <StoryManager />
          ) : activeTab === 'adventure' ? (
            <AdventureContentManager />
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
