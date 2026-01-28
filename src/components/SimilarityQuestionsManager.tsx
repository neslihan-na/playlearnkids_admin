import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllSimilarityQuestions,
  addSimilarityQuestion,
  updateSimilarityQuestion,
  deleteSimilarityQuestion,
  validateSimilarityQuestion,
  debugFirebaseData,
  type SimilarityQuestion
} from '../utils/similarityFunctions';
import './SimilarityQuestionsManager.css';

const SimilarityQuestionsManager: React.FC = () => {
  const [questions, setQuestions] = useState<SimilarityQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<SimilarityQuestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'tr' | 'en'>('tr');
  const [formData, setFormData] = useState<Partial<SimilarityQuestion>>({
    question: '',
    options: ['', '', '', ''],
    answer: '',
    explanation: '',
    difficulty: 1,
    language: 'tr'
  });
  const [lastAction, setLastAction] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const t = {
    tr: {
      title: '🎯 Benzerlik Soruları Yönetimi',
      addNew: '➕ Yeni Soru Ekle',
      debug: '🔍 Debug Firebase',
      questions: 'Sorular',
      refresh: 'Yenile',
      loading: 'Yükleniyor...',
      noQuestions: 'Henüz soru bulunmuyor.',
      noSelection: 'Bir soru seçin veya yeni soru ekleyin',
      edit: '✏️ Düzenle',
      delete: '🗑️ Sil',
      cancel: 'İptal',
      save: 'Kaydet',
      updating: 'Güncelleniyor...',
      update: 'Güncelle',
      saveSuccess: 'Soru başarıyla kaydedildi',
      deleteConfirm: 'Bu soruyu silmek istediğinizden emin misiniz?',
      detailTitle: 'Soru Detayları',
      formTitleAdd: '➕ Yeni Soru Ekle',
      formTitleEdit: '✏️ Soru Düzenle',
      searchPlaceholder: 'Soru ara...',
      labels: {
        question: 'Soru:',
        options: 'Seçenekler:',
        correctAnswer: 'Doğru Cevap:',
        explanation: 'Açıklama:',
        difficulty: 'Zorluk Seviyesi:',
        selectOption: 'Seçenek seçin'
      },
      difficulties: ['Kolay', 'Orta', 'Zor']
    },
    en: {
      title: '🎯 Similarity Questions Management',
      addNew: '➕ Add New Question',
      debug: '🔍 Debug Firebase',
      questions: 'Questions',
      refresh: 'Refresh',
      loading: 'Loading...',
      noQuestions: 'No questions found.',
      noSelection: 'Select a question or add a new one',
      edit: '✏️ Edit',
      delete: '🗑️ Delete',
      cancel: 'Cancel',
      save: 'Save',
      updating: 'Updating...',
      update: 'Update',
      saveSuccess: 'Question saved successfully',
      deleteConfirm: 'Are you sure you want to delete this question?',
      detailTitle: 'Question Details',
      formTitleAdd: '➕ Add New Question',
      formTitleEdit: '✏️ Edit Question',
      searchPlaceholder: 'Search questions...',
      labels: {
        question: 'Question:',
        options: 'Options:',
        correctAnswer: 'Correct Answer:',
        explanation: 'Explanation:',
        difficulty: 'Difficulty Level:',
        selectOption: 'Select an option'
      },
      difficulties: ['Easy', 'Medium', 'Hard']
    }
  }[selectedLanguage];


  const filteredQuestions = questions.filter(q => {
    const query = searchQuery.toLowerCase();
    return (
      q.question.toLowerCase().includes(query) ||
      q.explanation.toLowerCase().includes(query) ||
      q.options.some(opt => opt.toLowerCase().includes(query))
    );
  });

  // Soruları yükle
  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log(`🔄 Loading all questions for: ${selectedLanguage}`);
      const result = await getAllSimilarityQuestions(selectedLanguage);
      console.log('📊 Load result:', result);
      console.log('📊 Questions count:', result.questions?.length);
      console.log('📊 First question:', result.questions?.[0]);

      if (result.success && result.questions) {
        // Ekstra güvenlik için dile göre filtrele
        const filteredQuestions = result.questions.filter(q => q.language === selectedLanguage);
        setQuestions(filteredQuestions);
        setLastAction(`✅ ${filteredQuestions.length} ${t.questions.toLowerCase()} ${selectedLanguage === 'tr' ? 'yüklendi' : 'loaded'}`);
        console.log('✅ Questions loaded:', filteredQuestions);
      } else {
        setLastAction(`❌ ${result.message || (selectedLanguage === 'tr' ? 'Sorular yüklenemedi' : 'Failed to load questions')}`);
        console.log('❌ Load failed:', result);
      }
    } catch (error: any) {
      setLastAction(`❌ Hata: ${error.message}`);
      console.error('❌ Load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedLanguage, t.questions]);

  // Dil değiştiğinde soruları yeniden yükle
  useEffect(() => {
    loadQuestions();
  }, [loadQuestions, selectedLanguage]);

  // Form temizleme
  const clearForm = () => {
    setFormData({
      question: '',
      options: ['', '', '', ''],
      answer: '',
      explanation: '',
      difficulty: 1,
      language: selectedLanguage
    });
    setErrors([]);
  };

  // Modal'ları kapat
  const closeModals = () => {
    setIsAdding(false);
    setIsEditing(false);
    setSelectedQuestion(null);
    clearForm();
  };

  // Soru seçme
  const selectQuestion = (question: SimilarityQuestion) => {
    setSelectedQuestion(question);
    setIsEditing(false);
    setIsAdding(false);
    setErrors([]);
  };

  // Yeni soru ekleme moduna geç
  const startAdding = () => {
    clearForm();
    setSelectedQuestion(null);
    setIsAdding(true);
    setIsEditing(false);
    setErrors([]);
  };

  // Düzenleme moduna geç
  const startEditing = () => {
    if (selectedQuestion) {
      setFormData({
        ...selectedQuestion,
        options: [...selectedQuestion.options]
      });
      setIsEditing(true);
      setIsAdding(false);
      setErrors([]);
    }
  };

  // İptal et
  const cancelEditing = () => {
    closeModals();
  };

  // Form değişiklikleri
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      language: selectedLanguage
    }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(formData.options || ['', '', '', ''])];
    newOptions[index] = value;
    setFormData(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  // Soru ekleme
  const handleAddQuestion = async () => {
    const validation = validateSimilarityQuestion(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      const result = await addSimilarityQuestion(formData as SimilarityQuestion);
      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        await loadQuestions();
        closeModals();
      } else {
        setLastAction(`❌ ${result.message}`);
        setErrors([result.message]);
      }
    } catch (error: any) {
      setLastAction(`❌ Hata: ${error.message}`);
      setErrors([error.message]);
    } finally {
      setIsLoading(false);
    }
  };

  // Soru güncelleme
  const handleUpdateQuestion = async () => {
    if (!selectedQuestion?.id) return;

    const validation = validateSimilarityQuestion(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateSimilarityQuestion(selectedQuestion.id, formData, selectedLanguage);
      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        await loadQuestions();
        closeModals();
        // Güncellenmiş soruyu seçili tut
        const updatedQuestion = { ...selectedQuestion, ...formData };
        setSelectedQuestion(updatedQuestion);
      } else {
        setLastAction(`❌ ${result.message}`);
        setErrors([result.message]);
      }
    } catch (error: any) {
      setLastAction(`❌ Hata: ${error.message}`);
      setErrors([error.message]);
    } finally {
      setIsLoading(false);
    }
  };

  // Soru silme
  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await deleteSimilarityQuestion(questionId, selectedLanguage);
      if (result.success) {
        setLastAction(`✅ ${result.message}`);
        await loadQuestions();
      } else {
        setLastAction(`❌ ${result.message}`);
      }
    } catch (error: any) {
      setLastAction(`❌ Hata: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Debug Firebase veri yapısı
  const handleDebugFirebase = async () => {
    setIsLoading(true);
    try {
      const result = await debugFirebaseData();
      if (result.success) {
        setLastAction(`✅ Debug tamamlandı: ${result.message}`);
        console.log('🔍 Debug sonucu:', result.data);
      } else {
        setLastAction(`❌ Debug hatası: ${result.message}`);
      }
    } catch (error: any) {
      setLastAction(`❌ Debug hatası: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Form render fonksiyonu
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
        <label>{t.labels.question}</label>
        <input
          type="text"
          value={formData.question || ''}
          onChange={(e) => handleInputChange('question', e.target.value)}
          placeholder={selectedLanguage === 'tr' ? 'Soru metnini girin' : 'Enter question text'}
        />
      </div>

      <div className="form-group">
        <label>{t.labels.options}</label>
        {[0, 1, 2, 3].map((index) => (
          <input
            key={index}
            type="text"
            value={formData.options?.[index] || ''}
            onChange={(e) => handleOptionChange(index, e.target.value)}
            placeholder={`${index + 1}. ${selectedLanguage === 'tr' ? 'seçenek' : 'option'}`}
          />
        ))}
      </div>

      <div className="form-group">
        <label>{t.labels.correctAnswer}</label>
        <select
          value={formData.answer || ''}
          onChange={(e) => handleInputChange('answer', e.target.value)}
        >
          <option value="">{t.labels.selectOption}</option>
          {formData.options?.map((option, index) => (
            option && (
              <option key={index} value={option}>
                {index + 1}. {option}
              </option>
            )
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>{t.labels.explanation}</label>
        <textarea
          value={formData.explanation || ''}
          onChange={(e) => handleInputChange('explanation', e.target.value)}
          placeholder={selectedLanguage === 'tr' ? 'Soru açıklamasını girin' : 'Enter question explanation'}
          rows={3}
        />
      </div>

      <div className="form-group">
        <label>{t.labels.difficulty}</label>
        <select
          value={formData.difficulty || 1}
          onChange={(e) => handleInputChange('difficulty', parseInt(e.target.value))}
        >
          <option value={1}>1 - {t.difficulties[0]}</option>
          <option value={2}>2 - {t.difficulties[1]}</option>
          <option value={3}>3 - {t.difficulties[2]}</option>
        </select>
      </div>

      <div className="form-footer">
        <button className="cancel-button" onClick={closeModals}>
          {t.cancel}
        </button>
        {isAdding ? (
          <button className="save-button" onClick={handleAddQuestion} disabled={isLoading}>
            {isLoading ? (selectedLanguage === 'tr' ? 'Kaydediliyor...' : 'Saving...') : t.save}
          </button>
        ) : (
          <button className="save-button" onClick={handleUpdateQuestion} disabled={isLoading}>
            {isLoading ? t.updating : t.update}
          </button>
        )}
      </div>
    </div>
  );

  // Soru detay render fonksiyonu
  const renderQuestionDetail = () => (
    <div className="question-detail-content">
      <div className="detail-section">
        <h4>{t.labels.question}</h4>
        <p>{selectedQuestion?.question}</p>
      </div>

      <div className="detail-section">
        <h4>{t.labels.options}</h4>
        <div className="options-detail">
          {selectedQuestion?.options?.map((option, index) => (
            <div
              key={index}
              className={`option-detail ${option === selectedQuestion.answer ? 'correct' : ''}`}
            >
              <span className="option-number">{index + 1}.</span>
              <span className="option-text">{option}</span>
              {option === selectedQuestion.answer && <span className="correct-indicator">✓</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="detail-section">
        <h4>{t.labels.explanation}</h4>
        <p>{selectedQuestion?.explanation}</p>
      </div>

      <div className="detail-section">
        <h4>{t.labels.difficulty}</h4>
        <span className={`difficulty-badge difficulty-${selectedQuestion?.difficulty}`}>
          {selectedQuestion?.difficulty === 1 ? t.difficulties[0] :
            selectedQuestion?.difficulty === 2 ? t.difficulties[1] : t.difficulties[2]}
        </span>
      </div>
    </div>
  );

  return (
    <div className="similarity-questions-manager">
      {/* Header */}
      <div className="manager-header">
        <h2>{t.title}</h2>
        <div className="header-controls">
          <button
            className="add-button"
            onClick={startAdding}
            disabled={isLoading}
          >
            {t.addNew}
          </button>
          <button
            className="debug-button"
            onClick={handleDebugFirebase}
            disabled={isLoading}
            style={{ marginLeft: '10px', backgroundColor: '#ff9800', color: 'white' }}
          >
            {t.debug}
          </button>
        </div>
      </div>

      {/* Language Selector */}
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

      {/* Son İşlem */}
      {lastAction && (
        <div className="status-message">
          <p>{lastAction}</p>
        </div>
      )}

      {/* Ana İçerik - İki Bölüm */}
      <div className="main-content">
        {/* Sol Bölüm - Soru Listesi */}
        <div className="questions-sidebar">
          <div className="list-header">
            <h3>{t.questions} ({filteredQuestions.length}/{questions.length})</h3>
            <button
              className="refresh-button"
              onClick={loadQuestions}
              disabled={isLoading}
            >
              🔄
            </button>
          </div>

          <div className="search-bar">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search"
                onClick={() => setSearchQuery('')}
                title={selectedLanguage === 'tr' ? 'Temizle' : 'Clear'}
              >
                ✕
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>{t.loading}</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="empty-state">
              <p>{searchQuery ? (selectedLanguage === 'tr' ? 'Arama sonucu bulunamadı.' : 'No search results found.') : t.noQuestions}</p>
            </div>
          ) : (
            <div className="questions-list">
              {filteredQuestions.map((question, index) => (
                <div
                  key={question.id || index}
                  className={`question-item ${selectedQuestion?.id === question.id ? 'selected' : ''}`}
                  onClick={() => selectQuestion(question)}
                >
                  <div className="question-item-header">
                    <span className={`difficulty-badge difficulty-${question.difficulty}`}>
                      {question.difficulty}
                    </span>
                    <span className="question-number">#{index + 1}</span>
                  </div>
                  <div className="question-item-text">
                    <div className="question-content">
                      <span className="question-text">{question.question}</span>
                    </div>
                  </div>
                  <div className="question-options-preview">
                    <div className="options-content">
                      {question.options?.map((option, optionIndex) => (
                        <span
                          key={optionIndex}
                          className={`option-preview ${option === question.answer ? 'correct' : ''}`}
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sağ Bölüm - Detay/Form */}
        <div className="question-detail">
          {isAdding ? (
            <div className="detail-form">
              <div className="form-header">
                <h3>{t.formTitleAdd}</h3>
                <button className="cancel-button" onClick={cancelEditing}>
                  ✕
                </button>
              </div>
              {renderForm()}
            </div>
          ) : selectedQuestion ? (
            isEditing ? (
              <div className="detail-form">
                <div className="form-header">
                  <h3>{t.formTitleEdit}</h3>
                  <button className="cancel-button" onClick={cancelEditing}>
                    ✕
                  </button>
                </div>
                {renderForm()}
              </div>
            ) : (
              <div className="question-view">
                <div className="question-header">
                  <h3>{t.detailTitle}</h3>
                  <div className="question-actions">
                    <button className="edit-button" onClick={startEditing}>
                      {t.edit}
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteQuestion(selectedQuestion.id!)}
                      disabled={isLoading}
                    >
                      {t.delete}
                    </button>
                  </div>
                </div>
                {renderQuestionDetail()}
              </div>
            )
          ) : (
            <div className="no-selection">
              <p>{t.noSelection}</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default SimilarityQuestionsManager;
