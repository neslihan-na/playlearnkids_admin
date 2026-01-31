
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
    highFives?: Record<string, any>;
    high_fives?: Record<string, any>;
    highFive?: Record<string, any>;
    // Add other fields if necessary
}

interface HighFiveManagerProps {
    users: AdminPanelUser[];
    onRefresh?: () => void;
}

const HighFiveManager: React.FC<HighFiveManagerProps> = ({ users, onRefresh }) => {
    const [senderId, setSenderId] = useState<string>('');
    const [receiverId, setReceiverId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [interactions, setInteractions] = useState<any[]>([]);

    React.useEffect(() => {
        const allInteractions: any[] = [];
        users.forEach(user => {
            // Check multiple possible keys
            const hfData = user.highFives || user.high_fives || user.highFive;
            if (hfData && typeof hfData === 'object') {
                Object.entries(hfData).forEach(([sId, data]: [string, any]) => {
                    const sender = users.find(u => u.key === sId);
                    allInteractions.push({
                        receiverId: user.key,
                        receiverName: user.username,
                        senderId: sId,
                        senderName: sender?.username || data.senderName || 'Bilinmeyen',
                        count: data.count || 1,
                        timestamp: data.timestamp || 0,
                        viewed: data.viewed || false
                    });
                });
            }
        });
        // Sort by timestamp descending
        allInteractions.sort((a, b) => b.timestamp - a.timestamp);
        setInteractions(allInteractions);
    }, [users]);

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
            const receiverHighFivesLegacyRef = ref(database, `${receiverPath}/high_fives/${senderId}`);

            // Get current count if exists (check both)
            const snapshot = await get(receiverHighFivesRef);
            const snapshotLegacy = await get(receiverHighFivesLegacyRef);

            let currentCount = 0;
            if (snapshot.exists()) {
                currentCount = snapshot.val().count || 0;
            } else if (snapshotLegacy.exists()) {
                currentCount = snapshotLegacy.val().count || 0;
            }

            const highFiveData = {
                timestamp: Date.now(),
                senderName: sender.name || sender.username || 'Bir Dost',
                senderId: senderId,
                count: currentCount + 1,
                viewed: false
            };

            // Write to BOTH paths to ensure compatibility (Receiver side)
            const updates: Record<string, any> = {};
            updates[`${receiverPath}/highFives/${senderId}`] = highFiveData;
            updates[`${receiverPath}/high_fives/${senderId}`] = highFiveData;

            // Write to SENDER's "Sent" nodes as requested (Sender side)
            const senderPath = getDatabasePath(senderId);
            const sentData = {
                ...highFiveData,
                receiverId: receiverId,
                receiverName: receiver.username || 'Kullanıcı'
            };
            updates[`${senderPath}/highFiveSent/${receiverId}`] = sentData;
            updates[`${senderPath}/highFivesSent/${receiverId}`] = sentData; // Backup plural

            await update(ref(database), updates);

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

            // Trigger refresh
            if (onRefresh) onRefresh();

        } catch (error: any) {
            console.error('High Five error:', error);
            setStatus({ type: 'error', message: 'Hata oluştu: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteInteraction = async (rId: string, sId: string, mutual: boolean = true) => {
        if (!window.confirm('Bu beşlik kaydını silmek istediğinize emin misiniz?')) return;

        setLoading(true);
        setStatus(null);

        try {
            // 1. Delete from receiver (both paths)
            const receiverPath = getDatabasePath(rId);
            const updates: Record<string, any> = {};
            updates[`${receiverPath}/highFives/${sId}`] = null;
            updates[`${receiverPath}/high_fives/${sId}`] = null;
            updates[`${receiverPath}/highFiveSent/${sId}`] = null;
            updates[`${receiverPath}/highFivesSent/${sId}`] = null;

            // 2. If mutual, delete from sender too
            if (mutual) {
                const senderPath = getDatabasePath(sId);
                updates[`${senderPath}/highFives/${rId}`] = null;
                updates[`${senderPath}/high_fives/${rId}`] = null;

                // Also remove "Sent" records from sender
                updates[`${senderPath}/highFiveSent/${rId}`] = null;
                updates[`${senderPath}/highFivesSent/${rId}`] = null;
            }

            await update(ref(database), updates);

            setStatus({ type: 'success', message: 'Beşlik(ler) başarıyla silindi.' });

            // Trigger parent refresh
            if (onRefresh) onRefresh();

            // Local update for immediate feedback
            setInteractions(prev => prev.filter(i => !(i.receiverId === rId && i.senderId === sId) && !(mutual && i.receiverId === sId && i.senderId === rId)));

        } catch (error: any) {
            console.error('Delete High Five error:', error);
            setStatus({ type: 'error', message: 'Silme hatası: ' + error.message });
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

            <div className="section-header" style={{ marginTop: '40px' }}>
                <h2>📋 Mevcut High Fives (Beşlikler) ({interactions.length})</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="admin-button success small" onClick={onRefresh} disabled={loading}>
                        🔄 Listeyi Yenile
                    </button>
                    <p className="section-subtitle">Sistemdeki tüm beşlik etkileşimlerini görüntüle.</p>
                </div>
            </div>

            <div className="admin-card">
                {interactions.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '20px' }}>Henüz hiç beşlik etkileşimi bulunmuyor.</p>
                ) : (
                    <div className="table-container">
                        <table className="user-sql-table">
                            <thead>
                                <tr>
                                    <th>Gönderen</th>
                                    <th></th>
                                    <th>Alıcı</th>
                                    <th>Sayı</th>
                                    <th>Tarih</th>
                                    <th>İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {interactions.map((interaction, index) => (
                                    <tr key={`${interaction.senderId}-${interaction.receiverId}-${index}`}>
                                        <td>
                                            <div className="user-info">
                                                <span className="username">{interaction.senderName}</span>
                                                <span className="user-id">{interaction.senderId.substring(0, 6)}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>➡️</td>
                                        <td>
                                            <div className="user-info">
                                                <span className="username">{interaction.receiverName}</span>
                                                <span className="user-id">{interaction.receiverId.substring(0, 6)}</span>
                                            </div>
                                        </td>
                                        <td>{interaction.count}</td>
                                        <td>{interaction.timestamp ? new Date(interaction.timestamp).toLocaleString('tr-TR') : '-'}</td>
                                        <td>
                                            <button
                                                className="admin-button danger small"
                                                onClick={() => handleDeleteInteraction(interaction.receiverId, interaction.senderId)}
                                                disabled={loading}
                                            >
                                                Sil
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HighFiveManager;
