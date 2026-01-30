import React, { useState, useEffect, useRef } from 'react';
import { database, getDatabasePath } from '../firebase';
import { ref, onValue, push, update, off, get } from 'firebase/database';
import './MessagesManager.css';

interface Message {
    id: string;
    userId: string;
    text: string;
    sender: 'user' | 'admin';
    createdAt: number;
    read: boolean;
    adminId?: string;
}

interface Conversation {
    userId: string;
    username: string;
    messages: Message[];
    unreadCount: number;
    lastMessage: Message | null;
}

const MessagesManager: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [loading, setLoading] = useState(true);
    const [debugInfo, setDebugInfo] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (selectedUserId) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [conversations, selectedUserId]);

    // Load conversations by iterating users (workaround for permission denied on root)
    useEffect(() => {
        let isMounted = true;
        const usersPath = getDatabasePath('').replace(/\/$/, '');
        const usersRef = ref(database, usersPath);

        const loadAllData = async () => {
            try {
                let info = `Env Path: ${usersPath}\n`;

                // 1. Get all users first
                const usersSnapshot = await get(usersRef);
                let usersData: any = {};
                let userIds: string[] = [];

                if (usersSnapshot.exists()) {
                    usersData = usersSnapshot.val();
                    userIds = Object.keys(usersData);
                    info += `Users Found: ${userIds.length}\n`;
                } else {
                    info += `Users Found: 0 (Snapshot empty)\n`;
                }

                // FORCE CHECK: Add the specific user ID if missing
                const targetId = "user_ios_28012026_vw7j4p";
                if (!userIds.includes(targetId)) {
                    userIds.push(targetId);
                    info += `Force Added: ${targetId}\n`;
                }

                // 2. Fetch messages for each user individually
                const conversationsData: Conversation[] = [];
                let msgFoundCount = 0;

                await Promise.all(userIds.map(async (userId) => {
                    try {
                        const userMessagesRef = ref(database, `user_messages/${userId}`);
                        const messagesSnapshot = await get(userMessagesRef);

                        if (messagesSnapshot.exists()) {
                            msgFoundCount++;
                            const userMessagesObj = messagesSnapshot.val();
                            const messagesList: Message[] = Object.entries(userMessagesObj).map(([key, value]: [string, any]) => ({
                                id: key,
                                ...value,
                            }));

                            // Sort messages
                            messagesList.sort((a, b) => a.createdAt - b.createdAt);

                            const unreadCount = messagesList.filter((m) => m.sender === 'user' && !m.read).length;
                            const lastMessage = messagesList.length > 0 ? messagesList[messagesList.length - 1] : null;

                            // Get username
                            let username = 'Bilinmeyen Kullanıcı';
                            if (usersData[userId]) {
                                if (usersData[userId].username) username = usersData[userId].username;
                                else if (usersData[userId].name) username = usersData[userId].name;
                            } else if (userId === targetId) {
                                username = "Debug Hedef User";
                            } else if (userId.length < 20 && !userId.includes('-')) {
                                username = userId;
                            }

                            conversationsData.push({
                                userId,
                                username,
                                messages: messagesList,
                                unreadCount,
                                lastMessage
                            });
                        }
                    } catch (e: any) {
                        info += `Err ${userId.substring(0, 10)}: ${e.code || e.message}\n`;
                    }
                }));

                // 3. Sort conversations
                conversationsData.sort((a, b) => {
                    const timeA = a.lastMessage?.createdAt || 0;
                    const timeB = b.lastMessage?.createdAt || 0;
                    return timeB - timeA;
                });

                if (isMounted) {
                    setConversations(conversationsData);
                    setLoading(false);
                    info += `Msgs Found For: ${msgFoundCount} users\n`;
                    setDebugInfo(info);
                }

            } catch (error: any) {
                console.error("Error loading messages:", error);
                if (isMounted) {
                    setLoading(false);
                    setDebugInfo(`Error: ${error.message}`);
                    alert("Mesajlar yüklenirken bir sorun oluştu: " + error.message);
                }
            }
        };

        loadAllData();

        // Refresh every 30 seconds to simulate realtime for sidebar
        const intervalId = setInterval(loadAllData, 30000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    // Listen to real-time updates ONLY for the selected conversation
    useEffect(() => {
        if (!selectedUserId) return;

        const handleRealtimeUpdate = (snapshot: any) => {
            if (snapshot.exists()) {
                const userMessagesObj = snapshot.val();
                const messagesList: Message[] = Object.entries(userMessagesObj).map(([key, value]: [string, any]) => ({
                    id: key,
                    ...value,
                }));
                messagesList.sort((a, b) => a.createdAt - b.createdAt);

                setConversations(prev => prev.map(conv => {
                    if (conv.userId === selectedUserId) {
                        return {
                            ...conv,
                            messages: messagesList,
                            lastMessage: messagesList[messagesList.length - 1],
                            unreadCount: 0 // We're viewing it, so count is 0 locally (actual read status updated by other effect)
                        };
                    }
                    return conv;
                }));
            }
        };

        const activeChatRef = ref(database, `user_messages/${selectedUserId}`);
        const listener = onValue(activeChatRef, handleRealtimeUpdate);

        return () => {
            off(activeChatRef, 'value', listener);
        };
    }, [selectedUserId]);

    // Mark messages as read when a conversation is selected
    useEffect(() => {
        if (selectedUserId) {
            const conversation = conversations.find(c => c.userId === selectedUserId);
            if (conversation) {
                const unreadMessages = conversation.messages.filter(m => m.sender === 'user' && !m.read);

                unreadMessages.forEach(msg => {
                    const messageRef = ref(database, `user_messages/${selectedUserId}/${msg.id}`);
                    update(messageRef, { read: true });
                });
            }
        }
    }, [selectedUserId, conversations]);

    const handleSendMessage = async () => {
        if (!replyText.trim() || !selectedUserId) return;

        try {
            const messagesRef = ref(database, `user_messages/${selectedUserId}`);


            await push(messagesRef, {
                userId: selectedUserId,
                text: replyText,
                sender: 'admin',
                createdAt: Date.now(),
                read: false,
                adminId: 'admin' // Simple ID for now
            });

            setReplyText('');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Mesaj gönderilemedi.');
        }
    };

    const getSelectedConversation = () => {
        return conversations.find(c => c.userId === selectedUserId);
    };

    if (loading) {
        return <div className="loading-spinner">Yükleniyor...</div>;
    }

    const selectedConversation = getSelectedConversation();

    return (
        <div className="messages-manager">
            <div className="messages-sidebar">
                <div className="sidebar-header">
                    <h3>Mesajlar</h3>
                </div>
                <div className="users-list">
                    {conversations.length === 0 ? (
                        <div className="empty-state">Mesaj bulunamadı.</div>
                    ) : (
                        conversations.map((conv) => (
                            <div
                                key={conv.userId}
                                className={`user-item ${selectedUserId === conv.userId ? 'active' : ''}`}
                                onClick={() => setSelectedUserId(conv.userId)}
                            >
                                <div className="user-info">
                                    <div className="user-name">{conv.username}</div>
                                    <div className="last-message">
                                        {conv.lastMessage ? (
                                            <>
                                                {conv.lastMessage.sender === 'admin' && 'Siz: '}
                                                {conv.lastMessage.text}
                                            </>
                                        ) : (
                                            'Mesaj yok'
                                        )}
                                    </div>
                                </div>
                                {conv.unreadCount > 0 && (
                                    <div className="unread-badge">{conv.unreadCount}</div>
                                )}
                            </div>
                        ))
                    )}
                </div>
                <div style={{ padding: '10px', fontSize: '10px', color: '#666', borderTop: '1px solid #eee' }}>
                    <p>Debug Info:</p>
                    <pre>{debugInfo}</pre>
                </div>
            </div>

            <div className="messages-main">
                {selectedConversation ? (
                    <>
                        <div className="chat-header">
                            <div className="chat-user-info">
                                <h3>{selectedConversation.username}</h3>
                                <span>ID: {selectedConversation.userId}</span>
                            </div>
                        </div>

                        <div className="messages-list">
                            {selectedConversation.messages.map((msg) => (
                                <div key={msg.id} className={`message ${msg.sender}`}>
                                    <div className="message-text">{msg.text}</div>
                                    <span className="message-time">
                                        {new Date(msg.createdAt).toLocaleString('tr-TR')}
                                        {msg.sender === 'admin' && (
                                            <span style={{ marginLeft: 5 }}>
                                                {msg.read ? '✓✓' : '✓'}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-area">
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Mesaj yazın..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                            />
                            <button
                                className="send-button"
                                onClick={handleSendMessage}
                                disabled={!replyText.trim()}
                            >
                                Gönder
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="no-chat-selected">
                        <span>💬</span>
                        <p>Bir sohbet seçin</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesManager;
