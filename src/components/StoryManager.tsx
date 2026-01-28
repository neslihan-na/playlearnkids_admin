import React, { useState, useEffect } from 'react';
import { StoryData, StoryFormData, getAgeRange } from '../utils/storyHelpers';
import {
  getAllStories,
  createStory,
  updateStory,
  deleteStory,
  toggleStoryPublishStatus,
  getStoryStats
} from '../utils/storyFunctions';
import StoryForm from './StoryForm';
import StoryReader from './StoryReader';
import './StoryManager.css';

const StoryManager: React.FC = () => {
  const [stories, setStories] = useState<StoryData[]>([]);
  const [filteredStories, setFilteredStories] = useState<StoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingStory, setEditingStory] = useState<StoryData | undefined>();
  const [readingStory, setReadingStory] = useState<StoryData | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPublished, setFilterPublished] = useState<'all' | 'published' | 'draft'>('all');
  const [lastAction, setLastAction] = useState<string>('');
  const [stats, setStats] = useState<any>(null);

  // Hikayeleri yükle
  const loadStories = async () => {
    try {
      setLoading(true);
      const result = await getAllStories();

      if (result.success && result.stories) {
        setStories(result.stories);
        setFilteredStories(result.stories);
        setLastAction(`✅ ${result.stories.length} hikaye yüklendi`);
      } else {
        setLastAction(`❌ Hikayeler yüklenemedi: ${result.error}`);
      }
    } catch (error) {
      setLastAction(`❌ Hata: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // İstatistikleri yükle
  const loadStats = async () => {
    try {
      const result = await getStoryStats();
      if (result.success && result.stats) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Stats loading error:', error);
    }
  };

  // İlk yükleme
  useEffect(() => {
    loadStories();
    loadStats();
  }, []);

  // Filtreleri uygula
  useEffect(() => {
    let filtered = [...stories];

    // Arama filtresi
    if (searchTerm) {
      filtered = filtered.filter(story =>
        story.title.tr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        story.title.en.toLowerCase().includes(searchTerm.toLowerCase()) ||
        story.category.tr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        story.category.en.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Yayın durumu filtresi
    if (filterPublished === 'published') {
      filtered = filtered.filter(story => story.isPublished);
    } else if (filterPublished === 'draft') {
      filtered = filtered.filter(story => !story.isPublished);
    }

    setFilteredStories(filtered);
  }, [stories, searchTerm, filterPublished]);

  // Yeni hikaye ekleme
  const handleCreateStory = () => {
    setEditingStory(undefined);
    setShowForm(true);
  };

  // Hikaye düzenleme
  const handleEditStory = (story: StoryData) => {
    setEditingStory(story);
    setShowForm(true);
  };

  // Hikaye okuma
  const handleReadStory = (story: StoryData) => {
    setReadingStory(story);
  };

  // Hikaye kaydetme
  const handleSaveStory = async (formData: StoryFormData) => {
    try {
      setFormLoading(true);

      let result;
      if (editingStory) {
        result = await updateStory(editingStory.id!, formData);
      } else {
        result = await createStory(formData);
      }

      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        setShowForm(false);
        setEditingStory(undefined);
        await loadStories();
        await loadStats();
        alert(`Başarılı! ${result.message}`);
      } else {
        setLastAction(`❌ ${result.message}`);
        alert(`Hata! ${result.message}`);
      }
    } catch (error) {
      const errorMsg = `Hikaye kaydedilemedi: ${(error as Error).message}`;
      setLastAction(`❌ ${errorMsg}`);
      alert(`Hata! ${errorMsg}`);
    } finally {
      setFormLoading(false);
    }
  };

  // Hikaye silme
  const handleDeleteStory = async (story: StoryData) => {
    if (!window.confirm(`"${story.title.tr}" adlı hikayeyi silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await deleteStory(story.id!);

      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        await loadStories();
        await loadStats();
        alert(`Başarılı! ${result.message}`);
      } else {
        setLastAction(`❌ ${result.message}`);
        alert(`Hata! ${result.message}`);
      }
    } catch (error) {
      const errorMsg = `Hikaye silinemedi: ${(error as Error).message}`;
      setLastAction(`❌ ${errorMsg}`);
      alert(`Hata! ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Yayın durumu değiştirme
  const handleTogglePublish = async (story: StoryData) => {
    try {
      const result = await toggleStoryPublishStatus(story.id!);

      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        await loadStories();
        await loadStats();
      } else {
        setLastAction(`❌ ${result.message}`);
        alert(`Hata! ${result.message}`);
      }
    } catch (error) {
      const errorMsg = `Durum değiştirilemedi: ${(error as Error).message}`;
      setLastAction(`❌ ${errorMsg}`);
      alert(`Hata! ${errorMsg}`);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="story-manager">
      <div className="story-header">
        <div className="header-top">
          <h2>📚 Hikaye Yönetimi</h2>
          <button
            className="add-story-button"
            onClick={handleCreateStory}
            disabled={loading}
          >
            📝 Yeni Hikaye Ekle
          </button>
        </div>

        {/* İstatistikler */}
        {stats && (
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-number">{stats.total}</span>
              <span className="stat-label">Toplam Hikaye</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.published}</span>
              <span className="stat-label">Yayında</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.draft}</span>
              <span className="stat-label">Taslak</span>
            </div>
          </div>
        )}

        {/* Arama ve Filtreler */}
        <div className="filters-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Hikaye ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterPublished}
            onChange={(e) => setFilterPublished(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">Tüm Hikayeler</option>
            <option value="published">Yayında</option>
            <option value="draft">Taslak</option>
          </select>
          <button
            className="refresh-button"
            onClick={() => {
              loadStories();
              loadStats();
            }}
            disabled={loading}
          >
            🔄 Yenile
          </button>
        </div>

        {/* Son İşlem */}
        {lastAction && (
          <div className="last-action">
            <span>{lastAction}</span>
          </div>
        )}
      </div>

      {/* Hikaye Listesi */}
      <div className="stories-grid">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Hikayeler yükleniyor...</p>
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📚</span>
            <h3>Henüz hikaye yok</h3>
            <p>İlk hikayenizi eklemek için "Yeni Hikaye Ekle" butonuna tıklayın</p>
            <button
              className="add-story-button"
              onClick={handleCreateStory}
            >
              📝 İlk Hikayeyi Ekle
            </button>
          </div>
        ) : (
          filteredStories.map((story) => (
            <div key={story.id} className="story-card">
              <div
                className="story-card-header clickable"
                style={{ backgroundColor: story.color }}
                onClick={() => handleEditStory(story)}
                title="Hikayeyi düzenlemek için tıklayın"
              >
                <div className="story-icon">{story.icon}</div>
                <div className="story-status">
                  <span className={`status-badge ${story.isPublished ? 'published' : 'draft'}`}>
                    {story.isPublished ? '🌟 Yayında' : '📝 Taslak'}
                  </span>
                  {story.isPremium && (
                    <span className="status-badge premium" title="Premium İçerik">
                      💎 Premium
                    </span>
                  )}
                </div>
              </div>

              <div
                className="story-card-content clickable"
                onClick={() => handleReadStory(story)}
                title="Hikayeyi okumak için tıklayın"
              >
                <div className="story-cover">
                  {story.imageUrl || (story as any).coverImageUrl ? (
                    <img
                      src={story.imageUrl || (story as any).coverImageUrl}
                      alt={story.title.tr}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`cover-placeholder ${story.imageUrl || (story as any).coverImageUrl ? 'hidden' : ''}`}>
                    <span className="story-icon" style={{ color: story.color }}>
                      {story.icon}
                    </span>
                  </div>
                </div>

                <div className="story-info">
                  <h3 className="story-title">{story.title.tr}</h3>
                  <p className="story-category">🏷️ {story.category.tr}</p>
                  <p className="story-age-group">👶 {(() => {
                    const { minAge, maxAge } = getAgeRange(story);
                    return `${minAge}-${maxAge} yaş`;
                  })()}</p>
                  <p className="story-reading-time">⏱️ {story.readingTime}</p>
                  <p className="story-pages">📄 {story.totalPages || story.pages?.length || 0} sayfa</p>
                  {story.authorName && (
                    <p className="story-author">✍️ Yazar: {story.authorName}</p>
                  )}
                </div>

                <div className="story-dates">
                  <small>Oluşturma: {formatDate(story.createdAt)}</small>
                  {story.updatedAt !== story.createdAt && (
                    <small>Güncelleme: {formatDate(story.updatedAt)}</small>
                  )}
                </div>
              </div>

              <div className="story-card-actions">
                <button
                  className="edit-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditStory(story);
                  }}
                  title="Düzenle"
                >
                  ✏️
                </button>
                <button
                  className={`publish-button ${story.isPublished ? 'published' : 'draft'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePublish(story);
                  }}
                  title={story.isPublished ? 'Yayından Kaldır' : 'Yayınla'}
                >
                  {story.isPublished ? '👁️' : '🚀'}
                </button>
                <button
                  className="delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStory(story);
                  }}
                  title="Sil"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Hikaye Formu */}
      {
        showForm && (
          <StoryForm
            storyToEdit={editingStory}
            onSave={handleSaveStory}
            onCancel={() => {
              setShowForm(false);
              setEditingStory(undefined);
            }}
            loading={formLoading}
          />
        )
      }

      {/* Hikaye Okuyucu */}
      {
        readingStory && (
          <StoryReader
            story={readingStory}
            onClose={() => setReadingStory(undefined)}
          />
        )
      }
    </div >
  );
};

export default StoryManager;
