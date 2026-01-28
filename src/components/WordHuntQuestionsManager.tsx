import React, { useState, useEffect, useCallback } from 'react';
import './WordHuntQuestionsManager.css';
import {
  WordHuntQuestion,
  getAllWordHuntQuestions,
  addWordHuntQuestion,
  updateWordHuntQuestion,
  deleteWordHuntQuestion,
  validateWordHuntQuestion
} from '../utils/wordHuntFunctions';

const WordHuntQuestionsManager: React.FC = () => {
  const [questions, setQuestions] = useState<WordHuntQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'tr' | 'en'>('tr');
  const [selectedQuestion, setSelectedQuestion] = useState<WordHuntQuestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<WordHuntQuestion>>({
    soru: '',
    cevap: '',
    hint1: '',
    hint2: '',
    harfSayisi: 0,
    zorluk: 1
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredQuestions = questions.filter(q => {
    const query = searchQuery.toLowerCase();
    return (
      q.soru.toLowerCase().includes(query) ||
      q.cevap.toLowerCase().includes(query) ||
      q.hint1.toLowerCase().includes(query) ||
      q.hint2.toLowerCase().includes(query)
    );
  });

  // Load questions
  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllWordHuntQuestions(selectedLanguage);
      if (result.success && result.questions) {
        setQuestions(result.questions);
      } else {
        setError(result.message || 'Sorular yüklenemedi');
      }
    } catch (err: any) {
      setError(`Hata: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedLanguage]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions, selectedLanguage]);

  // Form handlers
  const handleInputChange = (field: keyof WordHuntQuestion, value: any) => {
    if (field === 'cevap') {
      const upperValue = value.toUpperCase();
      setFormData(prev => ({
        ...prev,
        [field]: upperValue,
        harfSayisi: upperValue.length
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const closeModals = () => {
    setIsAdding(false);
    setIsEditing(false);
    setSelectedQuestion(null);
    setFormData({
      soru: '',
      cevap: '',
      hint1: '',
      hint2: '',
      harfSayisi: 0,
      zorluk: 1
    });
    setErrors([]);
  };

  const startAdding = () => {
    setIsAdding(true);
    setIsEditing(false);
    setSelectedQuestion(null);
    setFormData({
      soru: '',
      cevap: '',
      hint1: '',
      hint2: '',
      harfSayisi: 0,
      zorluk: 1
    });
    setErrors([]);
  };

  const startEditing = () => {
    if (selectedQuestion) {
      setFormData({
        soru: selectedQuestion.soru,
        cevap: selectedQuestion.cevap,
        hint1: selectedQuestion.hint1,
        hint2: selectedQuestion.hint2,
        harfSayisi: selectedQuestion.harfSayisi,
        zorluk: selectedQuestion.zorluk
      });
      setIsEditing(true);
      setIsAdding(false);
      setErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateWordHuntQuestion(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const questionData: WordHuntQuestion = {
        ...formData as WordHuntQuestion,
        language: selectedLanguage
      };

      let result;
      if (isEditing && selectedQuestion) {
        result = await updateWordHuntQuestion(selectedQuestion.id!.toString(), questionData, selectedLanguage);
      } else {
        result = await addWordHuntQuestion(questionData);
      }

      if (result.success) {
        setSuccess(result.message);
        closeModals();
        loadQuestions();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(`Hata: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId: string | number) => {
    if (!window.confirm('Bu soruyu silmek istediğinizden emin misiniz?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await deleteWordHuntQuestion(questionId.toString(), selectedLanguage);
      if (result.success) {
        setSuccess(result.message);
        setSelectedQuestion(null);
        loadQuestions();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(`Hata: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <div className="form-content">
      {errors.length > 0 && (
        <div className="error-messages">
          {errors.map((error, index) => (
            <div key={index} className="error-message">{error}</div>
          ))}
        </div>
      )}

      <div className="form-group">
        <label>Soru:</label>
        <textarea
          value={formData.soru || ''}
          onChange={(e) => handleInputChange('soru', e.target.value)}
          placeholder="Soru metnini girin..."
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>Doğru Cevap:</label>
        <input
          type="text"
          value={formData.cevap || ''}
          onChange={(e) => handleInputChange('cevap', e.target.value)}
          placeholder="Cevabı girin..."
        />
        {formData.harfSayisi ? <small>Harf Sayısı: {formData.harfSayisi}</small> : null}
      </div>

      <div className="form-group">
        <label>İpucu 1:</label>
        <input
          type="text"
          value={formData.hint1 || ''}
          onChange={(e) => handleInputChange('hint1', e.target.value)}
          placeholder="Birinci ipucunu girin..."
        />
      </div>

      <div className="form-group">
        <label>İpucu 2:</label>
        <input
          type="text"
          value={formData.hint2 || ''}
          onChange={(e) => handleInputChange('hint2', e.target.value)}
          placeholder="İkinci ipucunu girin..."
        />
      </div>

      <div className="form-group">
        <label>Zorluk:</label>
        <select
          value={formData.zorluk || 1}
          onChange={(e) => handleInputChange('zorluk', parseInt(e.target.value))}
        >
          <option value={1}>Kolay</option>
          <option value={2}>Orta</option>
          <option value={3}>Zor</option>
        </select>
      </div>

      <div className="form-footer">
        <button className="cancel-button" onClick={closeModals}>İptal</button>
        <button className="save-button" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Kaydediliyor...' : (isEditing ? 'Güncelle' : 'Kaydet')}
        </button>
      </div>
    </div>
  );

  const renderQuestionDetail = () => (
    <div className="question-detail-content">
      <div className="detail-section">
        <h4>Soru</h4>
        <p>{selectedQuestion?.soru}</p>
      </div>

      <div className="detail-section">
        <h4>Cevap</h4>
        <div className="option-detail correct">
          <span className="option-text">{selectedQuestion?.cevap}</span>
          <span className="correct-indicator">✓</span>
        </div>
        <small>Harf Sayısı: {selectedQuestion?.harfSayisi}</small>
      </div>

      <div className="detail-section">
        <h4>İpuçları</h4>
        <div className="options-detail">
          <div className="option-detail">
            <span className="option-number">1.</span>
            <span className="option-text">{selectedQuestion?.hint1}</span>
          </div>
          <div className="option-detail">
            <span className="option-number">2.</span>
            <span className="option-text">{selectedQuestion?.hint2}</span>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h4>Zorluk</h4>
        <span className={`difficulty-badge difficulty-${selectedQuestion?.zorluk}`}>
          {selectedQuestion?.zorluk === 1 ? 'Kolay' : selectedQuestion?.zorluk === 2 ? 'Orta' : 'Zor'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="word-hunt-questions-manager">
      <div className="manager-header">
        <h2>🎯 Word Hunt Soruları Yönetimi</h2>
        <div className="header-controls">
          <button className="add-button" onClick={startAdding} disabled={loading}>
            ➕ Yeni Soru Ekle
          </button>
        </div>
      </div>

      <div className="language-bar">
        <div
          className={`lang-option ${selectedLanguage === 'tr' ? 'active' : ''}`}
          onClick={() => setSelectedLanguage('tr')}
        >
          🇹🇷 Türkçe
        </div>
        <div
          className={`lang-option ${selectedLanguage === 'en' ? 'active' : ''}`}
          onClick={() => setSelectedLanguage('en')}
        >
          🇺🇸 English
        </div>
      </div>

      {(error || success) && (
        <div className={`status-message ${error ? 'error' : 'success'}`}>
          <p>{error || success}</p>
        </div>
      )}

      <div className="main-content">
        <div className="questions-sidebar">
          <div className="list-header">
            <h3>Sorular ({questions.length})</h3>
            <button className="refresh-button" onClick={loadQuestions} disabled={loading}>
              🔄
            </button>
          </div>

          <div className="search-bar" style={{ padding: '0 10px 10px 10px' }}>
            <input
              type="text"
              placeholder="Soru veya cevap ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            />
          </div>

          <div className="questions-list">
            {loading && questions.length === 0 ? (
              <div className="loading"><div className="loading-spinner"></div></div>
            ) : filteredQuestions.length === 0 ? (
              <div className="empty-state">
                {searchQuery ? 'Arama sonucu bulunamadı.' : 'Henüz soru bulunmuyor.'}
              </div>
            ) : (
              filteredQuestions.map((q, index) => (
                <div
                  key={q.id || index}
                  className={`question-item ${selectedQuestion?.id === q.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedQuestion(q);
                    setIsEditing(false);
                    setIsAdding(false);
                  }}
                >
                  <div className="question-item-header">
                    <span className={`difficulty-badge difficulty-${q.zorluk}`}>{q.zorluk}</span>
                    <span className="question-number">#{q.id}</span>
                  </div>
                  <div className="question-item-text">
                    <span className="question-text">{q.soru}</span>
                  </div>
                  <div className="question-options-preview">
                    <span className="option-preview correct">{q.cevap}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="question-detail">
          {isAdding || isEditing ? (
            <div className="detail-form">
              <div className="form-header">
                <h3>{isEditing ? '✏️ Soruyu Düzenle' : '➕ Yeni Soru Ekle'}</h3>
                <button className="cancel-button" onClick={closeModals}>✕</button>
              </div>
              {renderForm()}
            </div>
          ) : selectedQuestion ? (
            <div className="question-view">
              <div className="question-header">
                <h3>Soru Detayları</h3>
                <div className="question-actions">
                  <button className="edit-button" onClick={startEditing}>✏️ Düzenle</button>
                  <button className="delete-button" onClick={() => handleDelete(selectedQuestion.id!)}>🗑️ Sil</button>
                </div>
              </div>
              {renderQuestionDetail()}
            </div>
          ) : (
            <div className="no-selection">
              <p>Bir soru seçin veya yeni soru ekleyin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordHuntQuestionsManager;
