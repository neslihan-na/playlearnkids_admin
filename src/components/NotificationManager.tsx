import React, { useState, useEffect } from 'react';
import { ref, push, set, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import { database, db } from '../firebase';
import './NotificationManager.css';

interface User {
    userId: string;
    name: string;
    email?: string;
}

interface NotificationFormData {
    userId: string;
    type: 'new_story' | 'achievement' | 'score_update' | 'special_event' | 'congrats' | 'premium_feature' | 'custom' | 'custom_redirect';
    titleTr: string;
    titleEn: string;
    messageTr: string;
    messageEn: string;
    data?: any;
}

const NotificationManager: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<NotificationFormData>({
        userId: '',
        type: 'new_story',
        titleTr: '',
        titleEn: '',
        messageTr: '',
        messageEn: '',
        data: {},
    });
    const [sendToAll, setSendToAll] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Kullanıcıları yükle
    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const usersRef = ref(database, 'users');
            const snapshot = await get(usersRef);

            if (snapshot.exists()) {
                const usersData: User[] = [];
                snapshot.forEach((childSnapshot) => {
                    const userData = childSnapshot.val();
                    usersData.push({
                        userId: childSnapshot.key!,
                        name: userData.name || 'İsimsiz Kullanıcı',
                        email: userData.email,
                    });
                });
                setUsers(usersData);
            }
        } catch (error) {
            console.error('Kullanıcılar yüklenirken hata:', error);
            setErrorMessage('Kullanıcılar yüklenemedi');
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleDataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        try {
            const dataObj = JSON.parse(e.target.value);
            setFormData(prev => ({
                ...prev,
                data: dataObj,
            }));
        } catch (error) {
            // Invalid JSON, ignore
        }
    };

    const sendNotification = async (userId: string) => {
        try {
            console.log('🔥 sendNotification başladı:', { userId, database });
            const notificationsRef = ref(database, 'notifications');
            console.log('🔥 notificationsRef oluşturuldu:', notificationsRef);

            const newNotificationRef = push(notificationsRef);
            console.log('🔥 newNotificationRef oluşturuldu:', newNotificationRef.key);

            const notification = {
                userId,
                type: formData.type,
                title: {
                    tr: formData.titleTr,
                    en: formData.titleEn || formData.titleTr, // Fallback to Turkish if English is empty
                },
                message: {
                    tr: formData.messageTr,
                    en: formData.messageEn || formData.messageTr, // Fallback to Turkish if English is empty
                },
                read: false,
                createdAt: new Date().toISOString(),
                data: formData.data || {},
            };

            console.log('🔥 Notification objesi:', notification);
            await set(newNotificationRef, notification);
            console.log('✅ Bildirim başarıyla kaydedildi!');

            // 📲 Push Notification Gönder (Kilit ekranı için)
            try {
                const tokenRef = doc(db, 'pushTokens', userId);
                const tokenSnap = await getDoc(tokenRef);

                if (tokenSnap.exists()) {
                    const tokenData = tokenSnap.data();
                    const expoPushToken = tokenData.token;

                    if (expoPushToken) {
                        console.log(`📲 Push Token bulundu: ${expoPushToken}. Expo API çağrılıyor...`);

                        const title = formData.titleTr; // Default to TR for push
                        const body = formData.messageTr;

                        fetch('https://exp.host/--/api/v2/push/send', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Accept-encoding': 'gzip, deflate',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                to: expoPushToken,
                                sound: 'default',
                                title: title,
                                body: body,
                                data: formData.data || {},
                                priority: 'high',
                                channelId: 'default',
                                _displayInForeground: true // Expo standard for foreground display
                            }),
                        }).then(() => {
                            console.log('✅ Push notification servisi başarılı.');
                        }).catch(err => {
                            console.warn('⚠️ Push notification servisi hatası:', err);
                        });
                    }
                } else {
                    console.log(`ℹ️ Kullanıcı (${userId}) için Push Token bulunamadı. Sadece uygulama içi bildirimi kaydedildi.`);
                }
            } catch (pushError) {
                console.error('⚠️ Push notification gönderme hatası (Bildirim kilit ekranına düşmeyebilir):', pushError);
            }
        } catch (error) {
            console.error('❌ sendNotification hatası:', error);
            throw error;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            console.log('📤 Bildirim gönderiliyor...', { sendToAll, formData });

            if (sendToAll) {
                // Tüm kullanıcılara gönder
                console.log(`📤 ${users.length} kullanıcıya gönderiliyor...`);
                for (const user of users) {
                    console.log(`📤 Gönderiliyor: ${user.name} (${user.userId})`);
                    await sendNotification(user.userId);
                }
                setSuccessMessage(`${users.length} kullanıcıya bildirim gönderildi!`);
            } else {
                // Seçili kullanıcıya gönder
                if (!formData.userId) {
                    setErrorMessage('Lütfen bir kullanıcı seçin');
                    setLoading(false);
                    return;
                }
                console.log(`📤 Tek kullanıcıya gönderiliyor: ${formData.userId}`);
                await sendNotification(formData.userId);
                setSuccessMessage('Bildirim başarıyla gönderildi!');
            }

            // Formu temizle
            setFormData({
                userId: '',
                type: 'new_story',
                titleTr: '',
                titleEn: '',
                messageTr: '',
                messageEn: '',
                data: {},
            });
            setSendToAll(false);
        } catch (error) {
            console.error('❌ Bildirim gönderilirken hata:', error);
            const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
            setErrorMessage(`Bildirim gönderilemedi: ${errorMsg}`);
        } finally {
            setLoading(false);
        }
    };

    const notificationTemplates = {
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
        score_update: {
            titleTr: '⭐ Yeni Rekor!',
            titleEn: '⭐ New Record!',
            messageTr: 'Harika bir başarı! Puanın arttı.',
            messageEn: 'Great achievement! Your score increased.',
            data: { score: 0, rank: 0, route: '/leaderboard' },
        },
        special_event: {
            titleTr: '🎊 Özel Etkinlik!',
            titleEn: '🎊 Special Event!',
            messageTr: 'Bugün özel bir etkinlik var!',
            messageEn: 'There\'s a special event today!',
            data: { eventId: '', eventType: '' },
        },
        congrats: {
            titleTr: '✋ Çak Bir Beşlik!',
            titleEn: '✋ High Five!',
            messageTr: 'Harikasın! Birisi sana beşlik çaktı.',
            messageEn: 'Awesome! Someone sent you a high five.',
            data: { type: 'high_five', route: '/profile' },
        },
        premium_feature: {
            titleTr: '💎 Süper Kahraman!',
            titleEn: '💎 Super Hero!',
            messageTr: 'Premium özelliklere erişim kazandın!',
            messageEn: 'You gained access to premium features!',
            data: { feature: 'premium', route: '/stories' },
        },
        custom: {
            titleTr: '',
            titleEn: '',
            messageTr: '',
            messageEn: '',
            data: {},
        },
        custom_redirect: {
            titleTr: '🔗 Yönlendirme',
            titleEn: '🔗 Redirect',
            messageTr: 'Seni özel bir sayfaya yönlendiriyoruz.',
            messageEn: 'Redirecting you to a special page.',
            data: { url: 'https://', route: '/home' },
        },
    };

    const applyTemplate = () => {
        const template = notificationTemplates[formData.type];
        setFormData(prev => ({
            ...prev,
            titleTr: template.titleTr,
            titleEn: template.titleEn,
            messageTr: template.messageTr,
            messageEn: template.messageEn,
            data: template.data,
        }));
    };

    return (
        <div className="notification-manager">
            <h2>📬 Bildirim Gönder</h2>

            {successMessage && (
                <div className="success-message">
                    ✅ {successMessage}
                </div>
            )}

            {errorMessage && (
                <div className="error-message">
                    ❌ {errorMessage}
                </div>
            )}

            <form onSubmit={handleSubmit} className="notification-form">
                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={sendToAll}
                            onChange={(e) => setSendToAll(e.target.checked)}
                        />
                        Tüm Kullanıcılara Gönder
                    </label>
                </div>

                {!sendToAll && (
                    <div className="form-group">
                        <label>Kullanıcı Seç:</label>
                        <select
                            name="userId"
                            value={formData.userId}
                            onChange={handleInputChange}
                            required={!sendToAll}
                        >
                            <option value="">Kullanıcı seçin...</option>
                            {users.map(user => (
                                <option key={user.userId} value={user.userId}>
                                    {user.name} ({user.userId})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="form-group">
                    <label>Bildirim Tipi:</label>
                    <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        required
                    >
                        <option value="new_story">📚 Yeni Hikaye</option>
                        <option value="achievement">🏆 Başarı</option>
                        <option value="score_update">⭐ Skor Güncellemesi</option>
                        <option value="special_event">🎊 Özel Etkinlik</option>
                        <option value="congrats">✋ Beşlik Çakma</option>
                        <option value="premium_feature">💎 Premium Özellik</option>
                        <option value="custom">💬 Özel Mesaj</option>
                        <option value="custom_redirect">🔗 Özel Yönlendirme</option>
                    </select>
                    <button type="button" onClick={applyTemplate} className="template-btn">
                        Şablon Uygula
                    </button>
                </div>

                <div className="form-group">
                    <label>Başlık (Türkçe):</label>
                    <input
                        type="text"
                        name="titleTr"
                        value={formData.titleTr}
                        onChange={handleInputChange}
                        placeholder="Türkçe bildirim başlığı..."
                        required
                        maxLength={100}
                    />
                </div>

                <div className="form-group">
                    <label>Başlık (English):</label>
                    <input
                        type="text"
                        name="titleEn"
                        value={formData.titleEn}
                        onChange={handleInputChange}
                        placeholder="English notification title..."
                        maxLength={100}
                    />
                    <small>Opsiyonel - Boş bırakılırsa Türkçe başlık kullanılır</small>
                </div>

                <div className="form-group">
                    <label>Mesaj (Türkçe):</label>
                    <textarea
                        name="messageTr"
                        value={formData.messageTr}
                        onChange={handleInputChange}
                        placeholder="Türkçe bildirim mesajı..."
                        required
                        rows={3}
                        maxLength={200}
                    />
                </div>

                <div className="form-group">
                    <label>Mesaj (English):</label>
                    <textarea
                        name="messageEn"
                        value={formData.messageEn}
                        onChange={handleInputChange}
                        placeholder="English notification message..."
                        rows={3}
                        maxLength={200}
                    />
                    <small>Opsiyonel - Boş bırakılırsa Türkçe mesaj kullanılır</small>
                </div>

                <div className="form-group">
                    <label>Ek Veri (JSON):</label>
                    <textarea
                        name="data"
                        value={JSON.stringify(formData.data, null, 2)}
                        onChange={handleDataChange}
                        placeholder='{"storyId": "story_123"}'
                        rows={4}
                    />
                    <small>Opsiyonel - Bildirime eklenecek ek veriler (JSON formatında)</small>
                </div>

                <div className="form-actions">
                    <button type="submit" disabled={loading} className="send-btn">
                        {loading ? '⏳ Gönderiliyor...' : '📤 Bildirim Gönder'}
                    </button>
                </div>
            </form>

            <div className="notification-preview">
                <h3>Önizleme:</h3>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ marginBottom: '8px', color: '#666' }}>🇹🇷 Türkçe</h4>
                        <div className="preview-card">
                            <div className="preview-title">{formData.titleTr || 'Başlık'}</div>
                            <div className="preview-message">{formData.messageTr || 'Mesaj'}</div>
                            <div className="preview-time">Şimdi</div>
                        </div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <h4 style={{ marginBottom: '8px', color: '#666' }}>🇺🇸 English</h4>
                        <div className="preview-card">
                            <div className="preview-title">{formData.titleEn || formData.titleTr || 'Title'}</div>
                            <div className="preview-message">{formData.messageEn || formData.messageTr || 'Message'}</div>
                            <div className="preview-time">Now</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationManager;
