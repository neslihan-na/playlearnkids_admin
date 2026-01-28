import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  toggleVideoStatus,
  type Video,
  type LocalizedValue
} from '../utils/videoFunctions';
import { auth } from '../firebase';
import './VideoManager.css';

type VideoFormState = {
  title: LocalizedValue;
  subtitle: LocalizedValue;
  category: LocalizedValue;
  badge: LocalizedValue;
  duration: string;
  views: string;
  icon: string;
  color: string;
  backgroundColor: string;
  youtubeUrl: string;
  youtubeThumbnailUrl: string;
  isActive: boolean;
  isPremium: boolean;
};


const EMPTY_LOCALIZED: LocalizedValue = { tr: '', en: '' };

const toLocalized = (value: string | LocalizedValue | undefined): LocalizedValue => {
  if (!value) return { ...EMPTY_LOCALIZED };
  if (typeof value === 'string') {
    return { tr: value, en: value };
  }
  return {
    tr: value.tr || '',
    en: value.en || ''
  };
};

const toSingleValue = (value: string | LocalizedValue | undefined): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.en || value.tr || '';
};

const getLocalizedText = (value?: string | LocalizedValue): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.tr || value.en || '';
};

const videoToFormState = (video: Video): VideoFormState => {
  return {
    title: toLocalized(video.title),
    subtitle: toLocalized(video.subtitle),
    category: toLocalized(video.category),
    badge: toLocalized(video.badge),
    duration: video.duration || '',
    views: video.views || '0',
    icon: toSingleValue(video.icon),
    color: video.color || '#FF6B6B',
    backgroundColor: video.backgroundColor || '#FFF1F2',
    youtubeUrl: toSingleValue(video.videoUrl),
    youtubeThumbnailUrl: toSingleValue(video.thumbnailUrl),
    isActive: video.isActive !== false,
    isPremium: video.isPremium || false
  };
};

const formStateToVideoPayload = (form: VideoFormState): Omit<Video, 'id' | 'createdAt'> => {
  const payload: any = {
    title: { ...form.title },
    subtitle: { ...form.subtitle },
    category: { ...form.category },
    duration: form.duration || '',
    views: form.views || '0',
    icon: form.icon,
    color: form.color,
    backgroundColor: form.backgroundColor,
    videoType: 'youtube', // Always youtube
    videoUrl: form.youtubeUrl,
    thumbnailUrl: form.youtubeThumbnailUrl,
    isActive: form.isActive,
    isPremium: form.isPremium
  };

  // Only include badge if it has content
  if (form.badge?.tr || form.badge?.en) {
    payload.badge = { ...form.badge };
  }

  return payload;
};

const createEmptyFormState = (): VideoFormState => ({
  title: { ...EMPTY_LOCALIZED },
  subtitle: { ...EMPTY_LOCALIZED },
  category: { ...EMPTY_LOCALIZED },
  badge: { ...EMPTY_LOCALIZED },
  duration: '',
  views: '0',
  icon: '🎵',
  color: '#FF6B6B',
  backgroundColor: '#FFF1F2',
  youtubeUrl: '',
  youtubeThumbnailUrl: '',
  isActive: true,
  isPremium: false
});

const isFormInvalid = (form: VideoFormState): boolean => {
  const baseFields = [
    (form.title?.tr || '').trim(),
    (form.title?.en || '').trim(),
    (form.subtitle?.tr || '').trim(),
    (form.subtitle?.en || '').trim(),
    (form.category?.tr || '').trim(),
    (form.category?.en || '').trim(),
    form.duration.trim(),
    form.views.trim()
  ];
  const hasBase = baseFields.every(Boolean);
  if (!hasBase) return true;

  if (!hasBase) return true;

  return !(form.youtubeUrl.trim() && form.youtubeThumbnailUrl.trim());
};

export default function VideoManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [lastAction, setLastAction] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'matematik' | 'kelime' | 'eglence'>('all');
  const [newVideoForm, setNewVideoForm] = useState<VideoFormState>(createEmptyFormState());
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleGetAllVideos = useCallback(async () => {
    try {
      setIsLoading(true);
      setLastAction('Videolar getiriliyor...');
      setErrorMessage('');

      const result = await getAllVideos();

      if (result.success) {
        setVideos(result.videos || []);
        setLastAction(`✅ ${result.videos?.length || 0} video getirildi`);
      } else {
        const errorMsg = `Videolar getirilemedi: ${result.error}`;
        setLastAction(`❌ ${errorMsg}`);
        setErrorMessage(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Hata: ${(error as Error).message}`;
      setLastAction(`❌ ${errorMsg}`);
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load videos on component mount
  useEffect(() => {
    handleGetAllVideos();
  }, [handleGetAllVideos]);

  const handleCreateVideo = async () => {
    try {
      // Auth kontrolü
      if (!auth.currentUser) {
        setLastAction('❌ Lütfen önce giriş yapın');
        alert('Lütfen önce giriş yapın!');
        return;
      }

      console.log('🔐 Current user:', auth.currentUser.email);
      console.log('🔐 User ID:', auth.currentUser.uid);

      setIsLoading(true);
      setLastAction('Video oluşturuluyor...');

      const payload = formStateToVideoPayload(newVideoForm);
      const result = await createVideo(payload);

      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        alert(`Başarılı! ${result.message}`);
        setShowVideoForm(false);
        setNewVideoForm(createEmptyFormState());
        await handleGetAllVideos();
      } else {
        const errorMsg = result.error || result.message;
        let userMessage = `Hata! ${errorMsg}`;

        // Permission denied hatası için özel mesaj
        if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('permission_denied')) {
          userMessage = `❌ İzin Hatası!\n\nFirebase Console'da kuralları güncellemeniz gerekiyor:\n\n1. https://console.firebase.google.com adresine gidin\n2. Projenizi seçin\n3. Realtime Database > Rules sekmesine gidin\n4. deployment-guide.md dosyasındaki kuralları ekleyin\n5. "Publish" butonuna tıklayın\n\nDetay: ${errorMsg}`;
        }

        setLastAction(`❌ ${errorMsg}`);
        alert(userMessage);
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      let userMessage = `Hata! Video oluşturulamadı: ${errorMsg}`;

      // Permission denied hatası için özel mesaj
      if (errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('permission_denied')) {
        userMessage = `❌ İzin Hatası!\n\nFirebase Console'da kuralları güncellemeniz gerekiyor:\n\n1. https://console.firebase.google.com adresine gidin\n2. Projenizi seçin\n3. Realtime Database > Rules sekmesine gidin\n4. deployment-guide.md dosyasındaki kuralları ekleyin\n5. "Publish" butonuna tıklayın\n\nDetay: ${errorMsg}`;
      }

      setLastAction(`❌ Hata: ${errorMsg}`);
      alert(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditVideo = (video: Video) => {
    setNewVideoForm(videoToFormState(video));
    setEditingId(video.id);
    setShowVideoForm(true);
  };

  const handleSaveAsVideo = (video: Video) => {
    const formState = videoToFormState(video);
    formState.views = '0';
    formState.isActive = true;
    setNewVideoForm(formState);
    setShowVideoForm(true);
  };

  const handleFormSubmit = async () => {
    if (editingId) {
      // Update existing video
      try {
        setIsLoading(true);
        setLastAction('Video güncelleniyor...');

        const payload = formStateToVideoPayload(newVideoForm);
        const result = await updateVideo(editingId, payload);

        if (result.success) {
          setLastAction(`✅ ${result.message}`);
          alert(`Başarılı! ${result.message}`);
          setShowVideoForm(false);
          setNewVideoForm(createEmptyFormState());
          setEditingId(null);
          await handleGetAllVideos();
        } else {
          setLastAction(`❌ ${result.message}`);
          alert(`Hata! ${result.message}`);
        }
      } catch (error) {
        setLastAction(`❌ Hata: ${(error as Error).message}`);
        alert(`Hata! Video güncellenemedi: ${(error as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Create new video
      await handleCreateVideo();
    }
  };

  const handleDeleteVideo = async (video: Video) => {
    const videoTitle = getDisplayValue(video.title) || 'Video';
    if (!window.confirm(`"${videoTitle}" videosunu silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      setIsLoading(true);
      setLastAction(`${videoTitle} siliniyor...`);

      const result = await deleteVideo(video.id);

      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        alert(`Başarılı! ${result.message}`);
        await handleGetAllVideos();
      } else {
        setLastAction(`❌ ${result.message}`);
        alert(`Hata! ${result.message}`);
      }
    } catch (error) {
      setLastAction(`❌ Hata: ${(error as Error).message}`);
      alert(`Hata! Video silinemedi: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleVideoStatus = async (video: Video) => {
    try {
      setIsLoading(true);
      const result = await toggleVideoStatus(video.id, !video.isActive);

      if (result.success) {
        setLastAction(result.message);
        await handleGetAllVideos();
        alert(`Başarılı! ${result.message}`);
      } else {
        alert(`Hata! ${result.message}`);
      }
    } catch (error) {
      alert('Hata! Video durumu güncellenemedi');
    } finally {
      setIsLoading(false);
    }
  };


  // Filter videos by category
  const filteredVideos = filterCategory === 'all'
    ? videos
    : videos.filter(video => video.category === filterCategory);

  // Helper function to get display value from string or LocalizedValue
  const getDisplayValue = (value: string | LocalizedValue | undefined): string => {
    return getLocalizedText(value);
  };

  return (
    <div className="video-manager">
      {/* Header */}
      <div className="video-header">
        <h2>🎥 Video Yönetimi</h2>
        <div className="header-actions">
          <button
            className="add-video-button"
            onClick={() => setShowVideoForm(true)}
            disabled={isLoading}
          >
            ➕ Yeni Video Ekle
          </button>
          <button
            className="refresh-button"
            onClick={handleGetAllVideos}
            disabled={isLoading}
          >
            🔄 Yenile
          </button>
        </div>
      </div>

      {/* Last Action */}
      {lastAction && (
        <div className="action-status">
          <p>{lastAction}</p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="error-message">
          <p>❌ {errorMessage}</p>
          <button onClick={() => setErrorMessage('')}>✕</button>
        </div>
      )}

      {/* Category Filter */}
      <div className="category-filter">
        <label>Kategori Filtresi:</label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as any)}
          disabled={isLoading}
        >
          <option value="all">Tüm Kategoriler</option>
          <option value="matematik">Matematik (🔢)</option>
          <option value="kelime">Kelime (📝)</option>
          <option value="eglence">Eğlence (🎮)</option>
        </select>
      </div>

      {/* Unified Add/Edit Video Form - Inline */}
      {showVideoForm && (
        <div className="video-form-container">
          <div className="video-form-header">
            <h3>{editingId ? '✏️ Video Düzenle' : '➕ Yeni Video Ekle'}</h3>
            <button
              className="close-button"
              onClick={() => {
                setShowVideoForm(false);
                setNewVideoForm(createEmptyFormState());
                setEditingId(null);
              }}
            >
              ✕
            </button>
          </div>

          <div className="video-form-body">
            <div className="form-columns">
              {/* Sol Kolon - Türkçe */}
              <div className="form-column form-column-tr">
                <h4>🇹🇷 Türkçe İçerik</h4>

                <div className="form-group">
                  <label>Başlık (Türkçe):</label>
                  <input
                    type="text"
                    value={newVideoForm.title.tr || ''}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, title: { ...newVideoForm.title, tr: e.target.value } })}
                    placeholder="Video başlığı (Türkçe)"
                  />
                </div>

                <div className="form-group">
                  <label>Alt Başlık (Türkçe):</label>
                  <input
                    type="text"
                    value={newVideoForm.subtitle.tr || ''}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, subtitle: { ...newVideoForm.subtitle, tr: e.target.value } })}
                    placeholder="Video alt başlığı (Türkçe)"
                  />
                </div>

                <div className="form-group">
                  <label>Kategori (Türkçe):</label>
                  <input
                    type="text"
                    value={newVideoForm.category.tr || ''}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, category: { ...newVideoForm.category, tr: e.target.value } })}
                    placeholder="Matematik"
                  />
                </div>

              </div>

              {/* Sağ Kolon - İngilizce */}
              <div className="form-column form-column-en">
                <h4>🇬🇧 İngilizce İçerik</h4>

                <div className="form-group">
                  <label>Başlık (İngilizce):</label>
                  <input
                    type="text"
                    value={newVideoForm.title.en || ''}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, title: { ...newVideoForm.title, en: e.target.value } })}
                    placeholder="Video başlığı (İngilizce)"
                  />
                </div>

                <div className="form-group">
                  <label>Alt Başlık (İngilizce):</label>
                  <input
                    type="text"
                    value={newVideoForm.subtitle.en || ''}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, subtitle: { ...newVideoForm.subtitle, en: e.target.value } })}
                    placeholder="Video alt başlığı (İngilizce)"
                  />
                </div>

                <div className="form-group">
                  <label>Kategori (İngilizce):</label>
                  <input
                    type="text"
                    value={newVideoForm.category.en || ''}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, category: { ...newVideoForm.category, en: e.target.value } })}
                    placeholder="Math"
                  />
                </div>

              </div>
            </div>

            {/* Ortak Alanlar */}
            <div className="form-common-fields">
              <div className="form-group">
                <label>YouTube Video URL:</label>
                <input
                  type="url"
                  value={newVideoForm.youtubeUrl || ''}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, youtubeUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              <div className="form-group">
                <label>YouTube Thumbnail URL:</label>
                <input
                  type="url"
                  value={newVideoForm.youtubeThumbnailUrl || ''}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, youtubeThumbnailUrl: e.target.value })}
                  placeholder="https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg"
                />
              </div>

              <div className="form-group">
                <label>Süre:</label>
                <input
                  type="text"
                  value={newVideoForm.duration}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, duration: e.target.value })}
                  placeholder="0:26"
                />
              </div>

              <div className="form-group">
                <label>İkon:</label>
                <input
                  type="text"
                  value={newVideoForm.icon}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, icon: e.target.value })}
                  placeholder="➕"
                />
              </div>

              <div className="form-group">
                <label>Arka Plan Rengi:</label>
                <input
                  type="color"
                  value={newVideoForm.backgroundColor}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, backgroundColor: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Renk:</label>
                <input
                  type="color"
                  value={newVideoForm.color || ''}
                  onChange={(e) => setNewVideoForm({ ...newVideoForm, color: e.target.value })}
                />
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newVideoForm.isActive}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, isActive: e.target.checked })}
                  />
                  Aktif Video
                </label>
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newVideoForm.isPremium}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, isPremium: e.target.checked })}
                  />
                  💎 Premium Video
                </label>
              </div>

            </div>

            <div className="form-footer">
              <button
                className="cancel-button"
                onClick={() => {
                  setShowVideoForm(false);
                  setNewVideoForm(createEmptyFormState());
                  setEditingId(null);
                }}
              >
                İptal
              </button>

              <button
                className="save-button"
                onClick={handleFormSubmit}
                disabled={isLoading || isFormInvalid(newVideoForm)}
              >
                {editingId ? 'Değişiklikleri Kaydet' : 'Video Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video List */}
      <div className="video-list">
        <div className="video-grid">
          {filteredVideos.map((video) => (
            <div key={video.id} className={`video-card ${!video.isActive ? 'inactive' : ''}`}>
              <div className="video-header-card">
                <div className="video-icon" style={{ backgroundColor: typeof video.backgroundColor === 'string' ? video.backgroundColor : '#4F46E5' }}>
                  {getDisplayValue(video.icon)}
                </div>
                <div className="video-info">
                  <h4>{getDisplayValue(video.title)}</h4>
                  {video.subtitle && <p className="video-subtitle">{getDisplayValue(video.subtitle as string)}</p>}
                  <div className="video-meta">
                    <span className="category-badge">{getDisplayValue(video.category as string || '')}</span>
                    <span className="duration">{getDisplayValue(video.duration)}</span>
                    <span className="views">{typeof video.views === 'number' ? video.views : 0} görüntüleme</span>
                    {video.isPremium && (
                      <span className="premium-badge-v" title="Premium İçerik" style={{ marginLeft: '8px' }}>💎</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="video-actions">
                <button
                  className={`status-button ${video.isActive ? 'active' : 'inactive'}`}
                  onClick={() => handleToggleVideoStatus(video)}
                  disabled={isLoading}
                  title={video.isActive ? 'Pasif Yap' : 'Aktif Yap'}
                >
                  {video.isActive ? '✅' : '❌'}
                </button>
                <button
                  className="edit-button"
                  onClick={() => handleEditVideo(video)}
                  disabled={isLoading}
                  title="Düzenle"
                >
                  ✏️
                </button>
                <button
                  className="save-as-button"
                  onClick={() => handleSaveAsVideo(video)}
                  disabled={isLoading}
                  title="Farklı Kaydet (Kopyala)"
                >
                  📋
                </button>
                <button
                  className="delete-button"
                  onClick={() => handleDeleteVideo(video)}
                  disabled={isLoading}
                  title="Sil"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredVideos.length === 0 && (
          <div className="no-videos">
            <p>Bu kategoride video bulunamadı.</p>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
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
}




