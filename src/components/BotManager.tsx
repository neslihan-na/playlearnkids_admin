
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
    const [options, setOptions] = useState({
        avatar: true,
        score: true,
        metrics: true
    });
    const [config, setConfig] = useState({
        minScore: 100,
        maxScore: 1500,
        minGames: 3,
        maxGames: 10
    });

    const randomizeScores = async (bot: AdminPanelUser) => {
        if (!options.avatar && !options.score && !options.metrics) {
            alert('Lütfen en az bir özellik seçin!');
            return;
        }
        setIsUpdating(true);
        try {
            const updates: Record<string, any> = {};

            if (options.metrics) {
                const gameScores: Record<string, number> = {};
                const gamePlayCounts: Record<string, number> = {};

                // Random within configured range
                const totalBotScore = Math.floor(Math.random() * (config.maxScore - config.minScore + 1)) + config.minScore;

                // Select random subset of games based on configured count
                const shuffledGames = [...ALL_GAME_TYPES].sort(() => 0.5 - Math.random());
                const targetGameCount = Math.floor(Math.random() * (config.maxGames - config.minGames + 1)) + config.minGames;
                const playedGames = shuffledGames.slice(0, Math.min(targetGameCount, ALL_GAME_TYPES.length));

                const baseScorePerGame = Math.floor(totalBotScore / (playedGames.length || 1));

                ALL_GAME_TYPES.forEach(game => {
                    if (playedGames.includes(game)) {
                        // Add some randomness to distribution per game
                        const variation = Math.floor(Math.random() * (baseScorePerGame * 0.4)) - (baseScorePerGame * 0.2);
                        const gameScore = Math.max(10, Math.round(baseScorePerGame + variation));
                        const plays = Math.floor(Math.random() * 15) + 5;
                        gameScores[game] = gameScore;
                        gamePlayCounts[game] = plays;
                    } else {
                        gameScores[game] = 0;
                        gamePlayCounts[game] = 0;
                    }
                });
                updates['gameMetrics/gameScores'] = gameScores;
                updates['gameMetrics/gamePlayCounts'] = gamePlayCounts;
                if (options.score) {
                    updates['score'] = Math.round(Object.values(gameScores).reduce((a: number, b) => a + (Number(b) || 0), 0));
                }
            } else if (options.score) {
                updates['score'] = Math.floor(Math.random() * (config.maxScore - config.minScore + 1)) + config.minScore;
            }

            if (options.avatar) {
                updates['avatarKey'] = avatars[Math.floor(Math.random() * avatars.length)];
            }

            updates['updatedAt'] = Date.now();
            const botRef = ref(database, `users/${bot.key}`);
            await update(botRef, updates);

            alert(`${bot.username} başarıyla güncellendi!`);
            onRefresh();
        } catch (error) {
            console.error('Error randomizing scores:', error);
            alert('Hata oluştu!');
        } finally {
            setIsUpdating(false);
        }
    };

    const randomizeAll = async () => {
        if (!options.avatar && !options.score && !options.metrics) {
            alert('Lütfen en az bir özellik seçin!');
            return;
        }
        if (!window.confirm('Seçili özellikleri tüm botlar için randomize etmek istiyor musunuz?')) return;

        setIsUpdating(true);
        try {
            const allUpdates: Record<string, any> = {};

            bots.forEach(bot => {
                if (options.metrics) {
                    const gameScores: Record<string, number> = {};
                    const gamePlayCounts: Record<string, number> = {};

                    const totalBotScore = Math.floor(Math.random() * (config.maxScore - config.minScore + 1)) + config.minScore;

                    const shuffledGames = [...ALL_GAME_TYPES].sort(() => 0.5 - Math.random());
                    const targetGameCount = Math.floor(Math.random() * (config.maxGames - config.minGames + 1)) + config.minGames;
                    const playedGames = shuffledGames.slice(0, Math.min(targetGameCount, ALL_GAME_TYPES.length));

                    const baseScorePerGame = Math.floor(totalBotScore / (playedGames.length || 1));

                    ALL_GAME_TYPES.forEach(game => {
                        if (playedGames.includes(game)) {
                            const variation = Math.floor(Math.random() * (baseScorePerGame * 0.4)) - (baseScorePerGame * 0.2);
                            const gameScore = Math.max(10, Math.round(baseScorePerGame + variation));
                            const plays = Math.floor(Math.random() * 15) + 5;
                            gameScores[game] = gameScore;
                            gamePlayCounts[game] = plays;
                        } else {
                            gameScores[game] = 0;
                            gamePlayCounts[game] = 0;
                        }
                    });
                    allUpdates[`users/${bot.key}/gameMetrics/gameScores`] = gameScores;
                    allUpdates[`users/${bot.key}/gameMetrics/gamePlayCounts`] = gamePlayCounts;
                    if (options.score) {
                        allUpdates[`users/${bot.key}/score`] = Math.round(Object.values(gameScores).reduce((a: number, b) => a + (Number(b) || 0), 0));
                    }
                } else if (options.score) {
                    allUpdates[`users/${bot.key}/score`] = Math.floor(Math.random() * (config.maxScore - config.minScore + 1)) + config.minScore;
                }

                if (options.avatar) {
                    allUpdates[`users/${bot.key}/avatarKey`] = avatars[Math.floor(Math.random() * avatars.length)];
                }

                allUpdates[`users/${bot.key}/updatedAt`] = Date.now();
            });

            await update(ref(database), allUpdates);
            alert('Tüm botlar başarıyla güncellendi!');
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
                        🎲 Seçilenleri Randomize Et
                    </button>
                    <button className="admin-button primary" onClick={onRefresh} disabled={isUpdating || isLoading}>
                        🔄 Yenile
                    </button>
                </div>
            </div>

            <div className="admin-card" style={{ marginBottom: '20px', padding: '15px' }}>
                <h4 style={{ marginTop: 0, marginBottom: '10px' }}>🎲 Randomize Edilecek Özellikler</h4>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={options.avatar}
                            onChange={e => setOptions({ ...options, avatar: e.target.checked })}
                        />
                        Avatarları Değiştir
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={options.score}
                            onChange={e => setOptions({ ...options, score: e.target.checked })}
                        />
                        Toplam Puanı Güncelle
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={options.metrics}
                            onChange={e => setOptions({ ...options, metrics: e.target.checked })}
                        />
                        Oyun Kırılımlarını (Kaçar puan/kaç oyun) Güncelle
                    </label>
                </div>

                <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>⚙️ Puan ve Oyun Ayarları</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
                    <div className="form-group">
                        <label>Min Toplam Puan:</label>
                        <input
                            type="number"
                            value={config.minScore}
                            onChange={(e) => setConfig({ ...config, minScore: parseInt(e.target.value) || 0 })}
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </div>
                    <div className="form-group">
                        <label>Max Toplam Puan:</label>
                        <input
                            type="number"
                            value={config.maxScore}
                            onChange={(e) => setConfig({ ...config, maxScore: parseInt(e.target.value) || 0 })}
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </div>
                    <div className="form-group">
                        <label>Min Oyun Çeşidi:</label>
                        <input
                            type="number"
                            value={config.minGames}
                            min="1"
                            max={ALL_GAME_TYPES.length}
                            onChange={(e) => setConfig({ ...config, minGames: Math.min(ALL_GAME_TYPES.length, Math.max(1, parseInt(e.target.value) || 1)) })}
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </div>
                    <div className="form-group">
                        <label>Max Oyun Çeşidi:</label>
                        <input
                            type="number"
                            value={config.maxGames}
                            min="1"
                            max={ALL_GAME_TYPES.length}
                            onChange={(e) => setConfig({ ...config, maxGames: Math.min(ALL_GAME_TYPES.length, Math.max(1, parseInt(e.target.value) || 1)) })}
                            style={{ width: '100%', padding: '8px' }}
                        />
                    </div>
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
                            const totalScore = Math.round(Object.values(gameScores).reduce((a: number, b: any) => a + (Number(b) || 0), 0));
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
