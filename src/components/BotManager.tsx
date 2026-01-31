
import React, { useState } from 'react';
import { database } from '../firebase';
import { ref, update } from 'firebase/database';
import { AdminPanelUser } from '../utils/adminFunctions';
import './AdminPanel.css'; // Reuse styles

interface BotManagerProps {
    users: AdminPanelUser[];
    onRefresh: () => void;
    isLoading: boolean;
}

const ALL_GAME_TYPES = [
    'sum', 'subtract', 'multiply', 'divide', 'tiger_hunt',
    'wordhunt', 'wordsdance', 'comparison', 'similarity',
    'antosyn', 'snake', 'memory', 'chess', 'tetris'
];

const avatars = [
    'animal_1', 'animal_2', 'animal_3', 'animal_4', 'animal_5',
    'animal_6', 'animal_7', 'animal_8', 'animal_9', 'animal_10',
    'Boy_1', 'Boy_2', 'Boy_3', 'Boy_4', 'Boy_5', 'Boy_6', 'Boy_7',
    'Boy_8', 'Boy_9', 'Boy_10', 'Boy_11', 'Boy_12', 'Boy_13', 'Boy_14', 'Boy_15',
    'Girl_1', 'Girl_2', 'Girl_3', 'Girl_4', 'Girl_5', 'Girl_6', 'Girl_7', 'Girl_8',
    'Girl_9', 'Girl_10', 'Girl_11', 'Girl_12', 'Girl_13', 'Girl_14',
    'Sausage', 'FlyingGirl', 'FoxFace', 'Ninja'
];

const BotManager: React.FC<BotManagerProps> = ({ users, onRefresh, isLoading }) => {
    const bots = users.filter(u => u.isSystemUser === true);
    const [isUpdating, setIsUpdating] = useState(false);

    const randomizeScores = async (bot: AdminPanelUser) => {
        setIsUpdating(true);
        try {
            const gameScores: Record<string, number> = {};
            const gamePlayCounts: Record<string, number> = {};

            ALL_GAME_TYPES.forEach(game => {
                if (Math.random() > 0.3) {
                    const plays = Math.floor(Math.random() * 50) + 10;
                    const avgScore = Math.floor(Math.random() * 200) + 50;
                    gameScores[game] = plays * avgScore;
                    gamePlayCounts[game] = plays;
                } else {
                    gameScores[game] = 0;
                    gamePlayCounts[game] = 0;
                }
            });

            const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

            const botRef = ref(database, `users/${bot.key}`);
            await update(botRef, {
                'gameMetrics/gameScores': gameScores,
                'gameMetrics/gamePlayCounts': gamePlayCounts,
                avatarKey: randomAvatar,
                updatedAt: Date.now()
            });

            alert(`${bot.username} güncellendi!`);
            onRefresh();
        } catch (error) {
            console.error('Error randomizing scores:', error);
            alert('Hata oluştu!');
        } finally {
            setIsUpdating(false);
        }
    };

    const randomizeAll = async () => {
        if (!window.confirm('Tüm botların puanlarını ve AVATARLARINI randomize etmek istediğinize emin misiniz?')) return;

        setIsUpdating(true);
        try {
            const updates: Record<string, any> = {};

            bots.forEach(bot => {
                const gameScores: Record<string, number> = {};
                const gamePlayCounts: Record<string, number> = {};

                ALL_GAME_TYPES.forEach(game => {
                    if (Math.random() > 0.3) {
                        const plays = Math.floor(Math.random() * 50) + 10;
                        const avgScore = Math.floor(Math.random() * 200) + 50;
                        gameScores[game] = plays * avgScore;
                        gamePlayCounts[game] = plays;
                    } else {
                        gameScores[game] = 0;
                        gamePlayCounts[game] = 0;
                    }
                });

                const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

                updates[`users/${bot.key}/gameMetrics/gameScores`] = gameScores;
                updates[`users/${bot.key}/gameMetrics/gamePlayCounts`] = gamePlayCounts;
                updates[`users/${bot.key}/avatarKey`] = randomAvatar;
                updates[`users/${bot.key}/updatedAt`] = Date.now();
            });

            await update(ref(database), updates);
            alert('Tüm botlar güncellendi!');
            onRefresh();
        } catch (error) {
            console.error('Error randomizing all scores:', error);
            alert('Hata oluştu!');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="admin-section">
            <div className="section-header">
                <h2>🤖 Bot Yönetimi ({bots.length})</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="admin-button warning" onClick={randomizeAll} disabled={isUpdating || isLoading}>
                        🎲 Tümünü Randomize Et
                    </button>
                    <button className="admin-button primary" onClick={onRefresh} disabled={isUpdating || isLoading}>
                        🔄 Yenile
                    </button>
                </div>
            </div>

            <div className="user-table-container">
                <table className="user-sql-table">
                    <thead>
                        <tr>
                            <th>Bot Adı</th>
                            <th>Avatar</th>
                            <th>Toplam Puan</th>
                            <th>Oynanan Oyunlar</th>
                            <th>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bots.map((bot) => {
                            const gameScores = bot.gameMetrics?.gameScores || {};
                            const totalScore = Object.values(gameScores).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                            const playedCount = Object.values(bot.gameMetrics?.gamePlayCounts || {}).filter((v: any) => v > 0).length;

                            return (
                                <tr key={bot.key}>
                                    <td>
                                        <strong>{bot.username}</strong>
                                        <br />
                                        <span className="user-key-hint">{bot.key}</span>
                                    </td>
                                    <td>{bot.avatarKey || 'Bilinmiyor'}</td>
                                    <td className="text-center">{totalScore}</td>
                                    <td className="text-center">{playedCount} Oyun</td>
                                    <td className="col-actions">
                                        <button
                                            className="action-btn edit"
                                            onClick={() => randomizeScores(bot)}
                                            disabled={isUpdating || isLoading}
                                            title="Puanları Randomize Et"
                                        >
                                            🎲
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {(isUpdating || isLoading) && (
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Botlar güncelleniyor...</p>
                </div>
            )}
        </div>
    );
};

export default BotManager;
