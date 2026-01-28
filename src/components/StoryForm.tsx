import React, { useState, useEffect } from 'react';
import {
  StoryFormData,
  StoryData,
  StoryPage,
  STORY_CATEGORIES,
  AGE_OPTIONS,
  BADGE_OPTIONS,
  COLOR_PALETTE,
  EMOJI_ICONS,
  validateStoryData,
  createNewPage,
  getAgeRange
} from '../utils/storyHelpers';
import './StoryForm.css';

interface StoryFormProps {
  storyToEdit?: StoryData;
  onSave: (formData: StoryFormData) => void;
  onCancel: () => void;
  loading: boolean;
}

const StoryForm: React.FC<StoryFormProps> = ({ storyToEdit, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState<StoryFormData>({
    titleTr: '',
    titleEn: '',
    categoryTr: '',
    categoryEn: '',
    color: '#FF9800',
    icon: '📖',
    imageUrl: '',
    readingTime: '',
    minAge: 3,
    maxAge: 6,
    authorId: '',
    authorName: '',
    badgeTr: '',
    badgeEn: '',
    isPublished: false,
    isPremium: false,
    pages: [createNewPage()]
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [users, setUsers] = useState<any[]>([]);

  // Kullanıcıları yükle
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { getAllUsers } = await import('../utils/adminFunctions');
        const result = await getAllUsers();
        if (result.success && result.users) {
          setUsers(result.users);
        }
      } catch (error) {
        console.error('Kullanıcılar yüklenemedi:', error);
      }
    };
    loadUsers();
  }, []);

  // Edit modunda formu doldur
  useEffect(() => {
    if (storyToEdit) {
      const { minAge, maxAge } = getAgeRange(storyToEdit);

      // Eski hikayeler için backward compatibility
      const imageUrl = storyToEdit.imageUrl || storyToEdit.coverImageUrl || '';

      // Sayfaları yeni formata çevir (backward compatibility)
      const convertedPages = storyToEdit.pages.length > 0
        ? storyToEdit.pages.map(page => {
          // Eski format kontrolü
          if ('textTr' in page || 'textEn' in page) {
            return {
              pageNumber: page.pageNumber,
              text: {
                tr: (page as any).textTr || page.text?.tr || '',
                en: (page as any).textEn || page.text?.en || ''
              },
              imageUrl: page.imageUrl || (page as any).imageFileName || ''
            };
          }
          return page;
        })
        : [createNewPage()];

      setFormData({
        titleTr: storyToEdit.title.tr,
        titleEn: storyToEdit.title.en,
        categoryTr: storyToEdit.category.tr,
        categoryEn: storyToEdit.category.en,
        color: storyToEdit.color,
        icon: storyToEdit.icon,
        imageUrl,
        readingTime: storyToEdit.readingTime,
        minAge,
        maxAge,
        authorId: storyToEdit.authorId || '',
        authorName: storyToEdit.authorName || '',
        badgeTr: storyToEdit.badge?.tr || '',
        badgeEn: storyToEdit.badge?.en || '',
        isPublished: storyToEdit.isPublished,
        isPremium: storyToEdit.isPremium || false,
        pages: convertedPages
      });
    }
  }, [storyToEdit]);

  const handleInputChange = (field: keyof StoryFormData, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Kategoriler eşleştirilsin
    if (field === 'categoryTr') {
      const index = STORY_CATEGORIES.tr.indexOf(value as string);
      if (index !== -1) {
        setFormData(prev => ({ ...prev, categoryEn: STORY_CATEGORIES.en[index] }));
      }
    }
    if (field === 'categoryEn') {
      const index = STORY_CATEGORIES.en.indexOf(value as string);
      if (index !== -1) {
        setFormData(prev => ({ ...prev, categoryTr: STORY_CATEGORIES.tr[index] }));
      }
    }

    // Rozetler eşleştirilsin
    if (field === 'badgeTr') {
      const index = BADGE_OPTIONS.tr.indexOf(value as string);
      if (index !== -1) {
        setFormData(prev => ({ ...prev, badgeEn: BADGE_OPTIONS.en[index] }));
      }
    }
    if (field === 'badgeEn') {
      const index = BADGE_OPTIONS.en.indexOf(value as string);
      if (index !== -1) {
        setFormData(prev => ({ ...prev, badgeTr: BADGE_OPTIONS.tr[index] }));
      }
    }
  };

  // Yazar seçimi
  const handleAuthorChange = (authorKey: string) => {
    if (authorKey === '') {
      setFormData(prev => ({ ...prev, authorId: '', authorName: '' }));
    } else {
      const selectedUser = users.find(u => u.key === authorKey);
      if (selectedUser) {
        setFormData(prev => ({
          ...prev,
          authorId: authorKey,
          authorName: selectedUser.username || selectedUser.name || authorKey
        }));
      }
    }
  };

  // Sayfa işlemleri
  const addPage = () => {
    const newPage = createNewPage();
    setFormData(prev => ({
      ...prev,
      pages: [...prev.pages, newPage]
    }));
    setSelectedPageIndex(formData.pages.length);
  };

  const removePage = (pageIndex: number) => {
    if (formData.pages.length <= 1) {
      alert('En az bir sayfa olmalıdır!');
      return;
    }

    const newPages = formData.pages.filter((_, index) => index !== pageIndex);
    setFormData(prev => ({ ...prev, pages: newPages }));

    // Seçili sayfa indexini ayarla
    if (selectedPageIndex >= newPages.length) {
      setSelectedPageIndex(newPages.length - 1);
    }
  };

  const updatePage = (pageIndex: number, field: keyof StoryPage, value: string) => {
    const newPages = [...formData.pages];
    if (field === 'imageUrl') {
      newPages[pageIndex] = { ...newPages[pageIndex], imageUrl: value };
    } else if (field === 'text') {
      // Bu durumda doğrudan text objesi güncellenmeli, bu fonksiyon kullanılmamalı
      // Ama yine de güvenlik için ekleyelim
      newPages[pageIndex] = {
        ...newPages[pageIndex],
        text: {
          tr: newPages[pageIndex].text?.tr || '',
          en: newPages[pageIndex].text?.en || ''
        }
      };
    }
    setFormData(prev => ({ ...prev, pages: newPages }));
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= formData.pages.length) return;

    const newPages = [...formData.pages];
    const [movedPage] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, movedPage);

    setFormData(prev => ({ ...prev, pages: newPages }));
    setSelectedPageIndex(toIndex);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateStoryData(formData);
    setErrors(validation.errors);

    if (validation.isValid) {
      onSave(formData);
    }
  };

  return (
    <div className="story-form-page">
      <div className="story-form-header">
        <div className="header-left">
          <button
            type="button"
            className="back-button"
            onClick={onCancel}
            disabled={loading}
          >
            ← Geri
          </button>
          <h1>{storyToEdit ? '✏️ Hikaye Düzenle' : '📝 Yeni Hikaye Ekle'}</h1>
        </div>
        <div className="header-right">
          <button
            type="submit"
            form="story-form"
            className="save-button-header"
            disabled={loading}
          >
            {loading ? '💾 Kaydediliyor...' : (storyToEdit ? '✏️ Güncelle' : '💾 Kaydet')}
          </button>
        </div>
      </div>

      <div className="story-form-container">
        <form id="story-form" onSubmit={handleSubmit} className="story-form">
          <div className="form-content">
            {/* Basit Form - Sadece Türkçe */}
            <div className="simple-form">
              <h3>📝 Hikaye Bilgileri</h3>

              {/* Başlık - Yan Yana */}
              <div className="form-row">
                <div className="form-group">
                  <label>📝 Türkçe Başlık:</label>
                  <input
                    type="text"
                    value={formData.titleTr}
                    onChange={(e) => handleInputChange('titleTr', e.target.value)}
                    placeholder="Türkçe başlığı girin"
                    className="title-input"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label>📝 İngilizce Başlık:</label>
                  <input
                    type="text"
                    value={formData.titleEn}
                    onChange={(e) => handleInputChange('titleEn', e.target.value)}
                    placeholder="İngilizce başlığı girin"
                    className="title-input"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Kapak Görseli - Başlıktan hemen sonra */}
              <div className="form-group main-image-group">
                <label>🖼️ Kapak Görseli URL:</label>
                <div className="image-input-container">
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                    placeholder="https://storage.googleapis.com/playlearnkids/stories/images/cover.jpg"
                    disabled={loading}
                  />
                  {formData.imageUrl && (
                    <div className="main-image-preview">
                      <img
                        src={formData.imageUrl}
                        alt="Kapak Önizleme"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
                <small className="form-help">
                  Hikayenin ana kapak görseli. Lütfen direkt görsel URL'i girin.
                </small>
              </div>

              {/* Sadece Türkçe Seçenekler */}
              <div className="form-row">
                <div className="form-group">
                  <label>🏷️ Kategori:</label>
                  <select
                    value={formData.categoryTr}
                    onChange={(e) => handleInputChange('categoryTr', e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Kategori seçin</option>
                    {STORY_CATEGORIES.tr.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>⏱️ Okuma Süresi:</label>
                  <input
                    type="text"
                    value={formData.readingTime}
                    onChange={(e) => handleInputChange('readingTime', e.target.value)}
                    placeholder="Örn: 5 dk"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>👶 Yaş Aralığı (Alt):</label>
                  <select
                    value={formData.minAge}
                    onChange={(e) => handleInputChange('minAge', parseInt(e.target.value))}
                    disabled={loading}
                  >
                    {AGE_OPTIONS.map(age => (
                      <option key={age} value={age}>{age} yaş</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>👶 Yaş Aralığı (Üst):</label>
                  <select
                    value={formData.maxAge}
                    onChange={(e) => handleInputChange('maxAge', parseInt(e.target.value))}
                    disabled={loading}
                  >
                    {AGE_OPTIONS.map(age => (
                      <option key={age} value={age}>{age} yaş</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>🏆 Rozet:</label>
                  <select
                    value={formData.badgeTr}
                    onChange={(e) => handleInputChange('badgeTr', e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Rozet seçin (opsiyonel)</option>
                    {BADGE_OPTIONS.tr.map(badge => (
                      <option key={badge} value={badge}>{badge}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>✍️ Yazar:</label>
                  <select
                    value={formData.authorId || ''}
                    onChange={(e) => handleAuthorChange(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Yazar seçin (opsiyonel)</option>
                    {users.map(user => (
                      <option key={user.key} value={user.key}>
                        {user.username || user.name || user.key}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sayfa Yönetimi */}
            <div className="page-management">
              <h3>📄 Sayfa Yönetimi</h3>

              {/* Sayfa sekmeleri */}
              <div className="page-tabs">
                {formData.pages.map((page, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`page-tab ${selectedPageIndex === index ? 'active' : ''}`}
                    onClick={() => setSelectedPageIndex(index)}
                    disabled={loading}
                  >
                    📄 Sayfa {index + 1}
                  </button>
                ))}
                <button
                  type="button"
                  className="add-page-button"
                  onClick={addPage}
                  disabled={loading}
                >
                  ➕ Sayfa Ekle
                </button>
              </div>

              {/* Seçili sayfa editörü */}
              {formData.pages[selectedPageIndex] && (
                <div className="page-editor">
                  <div className="page-editor-header">
                    <h4>📄 Sayfa {selectedPageIndex + 1} İçeriği</h4>
                    <div className="page-actions">
                      <button
                        type="button"
                        className="move-button"
                        onClick={() => movePage(selectedPageIndex, selectedPageIndex - 1)}
                        disabled={selectedPageIndex === 0 || loading}
                        title="Yukarı Taşı"
                      >
                        ⬆️
                      </button>
                      <button
                        type="button"
                        className="move-button"
                        onClick={() => movePage(selectedPageIndex, selectedPageIndex + 1)}
                        disabled={selectedPageIndex === formData.pages.length - 1 || loading}
                        title="Aşağı Taşı"
                      >
                        ⬇️
                      </button>
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => removePage(selectedPageIndex)}
                        disabled={formData.pages.length <= 1 || loading}
                        title="Sayfa Sil"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="page-content">
                    {/* Görsel */}
                    <div className="form-group page-image-group">
                      <label>🖼️ Bu Sayfanın Görseli (URL):</label>
                      <div className="image-input-container">
                        <input
                          type="url"
                          value={formData.pages[selectedPageIndex].imageUrl}
                          onChange={(e) => updatePage(selectedPageIndex, 'imageUrl', e.target.value)}
                          placeholder="https://storage.googleapis.com/playlearnkids/stories/images/page_1.jpg"
                          disabled={loading}
                        />
                        {formData.pages[selectedPageIndex].imageUrl && (
                          <div className="page-image-preview">
                            <img
                              src={formData.pages[selectedPageIndex].imageUrl}
                              alt="Sayfa Önizleme"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Çift dil metin editörü */}
                    <div className="dual-language-editor">
                      <div className="language-column">
                        <label>🇹🇷 Türkçe Metin:</label>
                        <textarea
                          value={formData.pages[selectedPageIndex].text?.tr || ''}
                          onChange={(e) => {
                            const newPages = [...formData.pages];
                            newPages[selectedPageIndex] = {
                              ...newPages[selectedPageIndex],
                              text: {
                                ...newPages[selectedPageIndex].text,
                                tr: e.target.value
                              }
                            };
                            setFormData(prev => ({ ...prev, pages: newPages }));
                          }}
                          placeholder="Bu sayfanın Türkçe metnini yazın..."
                          rows={6}
                          disabled={loading}
                        />
                      </div>

                      <div className="language-column">
                        <label>🇺🇸 İngilizce Metin:</label>
                        <textarea
                          value={formData.pages[selectedPageIndex].text?.en || ''}
                          onChange={(e) => {
                            const newPages = [...formData.pages];
                            newPages[selectedPageIndex] = {
                              ...newPages[selectedPageIndex],
                              text: {
                                ...newPages[selectedPageIndex].text,
                                en: e.target.value
                              }
                            };
                            setFormData(prev => ({ ...prev, pages: newPages }));
                          }}
                          placeholder="Write the English text for this page..."
                          rows={6}
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* General Settings */}
            <div className="general-settings">
              <h3>⚙️ Görünüm Ayarları</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>🎨 Tema Rengi:</label>
                  <div className="color-palette">
                    {COLOR_PALETTE.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`color-option ${formData.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => handleInputChange('color', color)}
                        disabled={loading}
                        title={color}
                      />
                    ))}
                  </div>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => handleInputChange('color', e.target.value)}
                    placeholder="#FF9800"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>📱 Uygulama İkonu:</label>
                  <div className="emoji-palette">
                    {EMOJI_ICONS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={`emoji-option ${formData.icon === emoji ? 'selected' : ''}`}
                        onClick={() => handleInputChange('icon', emoji)}
                        disabled={loading}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => handleInputChange('icon', e.target.value)}
                    placeholder="📖"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isPublished}
                    onChange={(e) => handleInputChange('isPublished', e.target.checked)}
                    disabled={loading}
                  />
                  <span>🌟 Hikayeyi hemen yayınla</span>
                </label>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isPremium}
                    onChange={(e) => handleInputChange('isPremium', e.target.checked)}
                    disabled={loading}
                  />
                  <span>💎 Premium İçerik</span>
                </label>
              </div>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="form-errors">
                <h4>❌ Hata(lar):</h4>
                <ul>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Loading Overlay */}
            {loading && (
              <div className="form-loading-overlay">
                <div className="loading-spinner"></div>
                <p>İşlem yapılıyor...</p>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoryForm;
