
import React, { useState } from 'react';
import { database, db, getDatabasePath } from '../firebase';
import { ref, update, push, set, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';
import './AdminPanel.css'; // Re-use admin styles

interface AdminPanelUser {
    key: string;
    username: string;
    email?: string;
    name?: string;
    // Add other fields if necessary
}

interface HighFiveManagerProps {
    users: AdminPanelUser[];
}

const HighFiveManager: React.FC<HighFiveManagerProps> = ({ users }) => {
    const [senderId, setSenderId] = useState<string>('');
    const [receiverId, setReceiverId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleSendHighFive = async () => {
        if (!senderId || !receiverId) {
            setStatus({ type: 'error', message: 'Lütfen hem gönderici hem de alıcı seçin.' });
            return;
        }

        if (senderId === receiverId) {
            setStatus({ type: 'error', message: 'Kullanıcı kendine beşlik gönderemez.' });
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const sender = users.find(u => u.key === senderId);
            const receiver = users.find(u => u.key === receiverId);

            if (!sender || !receiver) {
                throw new Error('Kullanıcı bulunamadı.');
            }

            // 1. Update High Five Data in Realtime Database
            // Use getDatabasePath to automatically handle environment (test vs regular users)
            const receiverPath = getDatabasePath(receiverId);
            const receiverHighFivesRef = ref(database, `${receiverPath}/highFives/${senderId}`);

            // Get current count if exists
            const snapshot = await get(receiverHighFivesRef);
            let currentCount = 0;
            if (snapshot.exists()) {
                const data = snapshot.val();
                currentCount = data.count || 0;
            }

            const highFiveData = {
                timestamp: Date.now(),
                senderName: sender.name || sender.username || 'Bir Dost',
                senderId: senderId,
                count: currentCount + 1,
                viewed: false
            };

            await update(receiverHighFivesRef, highFiveData);

            // 2. Send Notification
            // Reuse logic similar to NotificationManager
            const notificationsRef = ref(database, 'notifications');
            const newNotificationRef = push(notificationsRef);

            const notification = {
                userId: receiverId,
                type: 'congrats', // Mapping to existing types
                title: {
                    tr: '✋ Çak Bir Beşlik!',
                    en: '✋ High Five!',
                },
                message: {
                    tr: `${sender.username} sana bir beşlik çaktı!`,
                    en: `${sender.username} sent you a high five!`,
                },
                read: false,
                createdAt: new Date().toISOString(),
                data: {
                    type: 'high_five',
                    senderId: senderId,
                    route: '/profile'
                },
            };

            await set(newNotificationRef, notification);

            // 3. Send Push Notification (if token exists)
            try {
                const tokenRef = doc(db, 'pushTokens', receiverId);
                const tokenSnap = await getDoc(tokenRef);

                if (tokenSnap.exists()) {
                    const tokenData = tokenSnap.data();
                    const expoPushToken = tokenData.token;

                    if (expoPushToken) {
                        await fetch('https://exp.host/--/api/v2/push/send', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Accept-encoding': 'gzip, deflate',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                to: expoPushToken,
                                sound: 'default',
                                title: notification.title.tr,
                                body: notification.message.tr,
                                data: notification.data,
                                priority: 'high',
                                channelId: 'default',
                                _displayInForeground: true
                            }),
                        });
                    }
                }
            } catch (pushError) {
                console.warn('Push notification error:', pushError);
            }

            setStatus({ type: 'success', message: `${sender.username} adına ${receiver.username} kullanıcısına beşlik gönderildi!` });

            // Reset selection optional? Maybe keep for bulk sending.
            // setSenderId('');
            // setReceiverId('');

        } catch (error: any) {
            console.error('High Five error:', error);
            setStatus({ type: 'error', message: 'Hata oluştu: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    // Sort users alphabetically
    const sortedUsers = [...users].sort((a, b) => a.username.localeCompare(b.username));

    return (
        <div className="admin-section">
            <div className="section-header">
                <h2>✋ High Five Yöneticisi</h2>
                <p className="section-subtitle">Bir kullanıcı adına başka bir kullanıcıya "Çak Bir Beşlik" gönder.</p>
            </div>

            <div className="admin-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                {status && (
                    <div className={`status-message ${status.type}`}>
                        {status.type === 'success' ? '✅' : '❌'} {status.message}
                    </div>
                )}

                <div className="form-group">
                    <label>Gönderen Kullanıcı (Kimden):</label>
                    <select
                        value={senderId}
                        onChange={(e) => setSenderId(e.target.value)}
                        className="admin-select"
                    >
                        <option value="">Seçiniz...</option>
                        {sortedUsers.map(user => (
                            <option key={`sender-${user.key}`} value={user.key}>
                                {user.username} ({user.key.substring(0, 6)}...)
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Alıcı Kullanıcı (Kime):</label>
                    <select
                        value={receiverId}
                        onChange={(e) => setReceiverId(e.target.value)}
                        className="admin-select"
                    >
                        <option value="">Seçiniz...</option>
                        {sortedUsers.map(user => (
                            <option key={`receiver-${user.key}`} value={user.key}>
                                {user.username} ({user.key.substring(0, 6)}...)
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group" style={{ marginTop: '20px' }}>
                    <div className="info-box">
                        <p>ℹ️ Bu işlem alıcının profilindeki "High Five" sayısını artırır ve bildirim gönderir.</p>
                        {senderId && receiverId && senderId !== receiverId && (
                            <p className="preview-text">
                                <strong>{users.find(u => u.key === senderId)?.username}</strong> ➡️ <strong>{users.find(u => u.key === receiverId)?.username}</strong>
                            </p>
                        )}
                    </div>
                </div>

                <button
                    className="admin-button primary full-width"
                    onClick={handleSendHighFive}
                    disabled={loading || !senderId || !receiverId || senderId === receiverId}
                >
                    {loading ? 'Gönderiliyor...' : '✋ Beşlik Gönder'}
                </button>
            </div>
        </div>
    );
};

export default HighFiveManager;
