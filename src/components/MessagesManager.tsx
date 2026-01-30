import React, { useState, useEffect, useRef } from 'react';
import { database } from '../firebase';
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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (selectedUserId) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [conversations, selectedUserId]);

    useEffect(() => {
        const messagesRef = ref(database, 'user_messages');
        const usersRef = ref(database, 'users');

        // Listen to all messages
        const messageListener = onValue(messagesRef, async (snapshot) => {
            if (!snapshot.exists()) {
                setConversations([]);
                setLoading(false);
                return;
            }

            const allMessagesData = snapshot.val();
            const userIds = Object.keys(allMessagesData);

            // Fetch user info for names (snapshot for one-time fetch, or listener if names change often - one-time is enough here)
            const usersSnapshot = await get(usersRef);
            const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};

            const newConversations: Conversation[] = userIds.map((userId) => {
                const userMessagesObj = allMessagesData[userId];
                const messagesList: Message[] = Object.entries(userMessagesObj).map(([key, value]: [string, any]) => ({
                    id: key,
                    ...value,
                }));

                // Sort messages by date
                messagesList.sort((a, b) => a.createdAt - b.createdAt);

                const unreadCount = messagesList.filter((m) => m.sender === 'user' && !m.read).length;
                const lastMessage = messagesList.length > 0 ? messagesList[messagesList.length - 1] : null;

                // Try to find username safely
                let username = 'Bilinmeyen Kullanıcı';
                if (usersData[userId] && usersData[userId].username) {
                    username = usersData[userId].username;
                } else if (usersData[userId] && usersData[userId].name) {
                    username = usersData[userId].name;
                }

                return {
                    userId,
                    username,
                    messages: messagesList,
                    unreadCount,
                    lastMessage,
                };
            });

            // Sort conversations by last message date (newest first)
            newConversations.sort((a, b) => {
                const timeA = a.lastMessage?.createdAt || 0;
                const timeB = b.lastMessage?.createdAt || 0;
                return timeB - timeA;
            });

            setConversations(newConversations);
            setLoading(false);
        });

        return () => {
            off(messagesRef, 'value', messageListener);
        };
    }, []);

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
            const newMessageRef = push(messagesRef);

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
