import { database, auth } from '../firebase';
import { ref, get, set, push, remove } from 'firebase/database';

// Benzerlik sorusu interface'i
export interface SimilarityQuestion {
  id?: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: number;
  language: 'tr' | 'en';
  createdAt?: number;
  updatedAt?: number;
}

// Yeni soru ekleme
export const addSimilarityQuestion = async (question: SimilarityQuestion): Promise<{ success: boolean; message: string; questionId?: string }> => {
  try {
    const language = question.language || 'en';
    const questionsRef = ref(database, `game_data/similarity_questions/${language}`);

    // Yeni soru için benzersiz ID oluştur
    const newQuestionRef = push(questionsRef);
    const questionId = newQuestionRef.key;

    if (!questionId) {
      return { success: false, message: 'Soru ID oluşturulamadı' };
    }

    const questionData = {
      ...question,
      id: questionId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(newQuestionRef, questionData);

    return {
      success: true,
      message: 'Soru başarıyla eklendi',
      questionId
    };
  } catch (error: any) {
    console.error('Soru ekleme hatası:', error);
    return { success: false, message: `Soru eklenemedi: ${error.message}` };
  }
};

// Tüm soruları getir
export const getAllSimilarityQuestions = async (language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; questions?: SimilarityQuestion[]; message?: string }> => {
  try {
    console.log(`🔍 Getting questions for language: ${language}`);
    console.log('🔍 Current user:', auth.currentUser?.email);

    // Environment kontrolü
    const currentEnv = process.env.NODE_ENV === 'development' ? 'test' : 'live';
    console.log(`🔍 Current environment: ${currentEnv}`);

    // İstenen dilin path'i
    const path = `game_data/similarity_questions/${language}`;
    console.log('🔍 Path:', path);

    try {
      const questionsRef = ref(database, path);
      const snapshot = await get(questionsRef);

      console.log(`📊 Path "${path}" exists:`, snapshot.exists());

      if (snapshot.exists()) {
        const questionsData = snapshot.val();
        console.log(`📊 Data from "${path}":`, questionsData);
        console.log(`📊 Data type:`, typeof questionsData);
        console.log(`📊 Is array:`, Array.isArray(questionsData));

        if (questionsData && typeof questionsData === 'object') {
          let questions: SimilarityQuestion[] = [];

          if (Array.isArray(questionsData)) {
            console.log(`📊 Processing array with ${questionsData.length} items`);
            questions = questionsData
              .filter(q => q !== null && q !== undefined)
              .map((q: any, index: number) => ({
                id: q.id || `question_${index}`,
                question: q.question || q.soru || 'Soru bulunamadı',
                options: q.options || [q.hint1 || 'Seçenek 1', q.hint2 || 'Seçenek 2', 'Seçenek 3', 'Seçenek 4'],
                answer: q.answer || q.hint1 || 'Cevap bulunamadı',
                explanation: q.explanation || q.aciklama || 'Açıklama bulunamadı',
                difficulty: q.difficulty || q.zorluk || 1,
                language: language,
                createdAt: q.createdAt,
                updatedAt: q.updatedAt
              }));
          } else {
            const keys = Object.keys(questionsData);
            console.log(`📊 Processing object with ${keys.length} keys:`, keys.slice(0, 5));

            if (keys.includes('similarity_questions')) {
              console.log(`📊 Found similarity_questions in path: ${path}`);
              const similarityData = questionsData.similarity_questions;
              if (similarityData && similarityData[language]) {
                const langData = similarityData[language];
                questions = Object.entries(langData).map(([key, value]: [string, any]) => ({
                  id: key,
                  question: value.question || value.soru || 'Soru bulunamadı',
                  options: value.options || [value.hint1 || 'Seçenek 1', value.hint2 || 'Seçenek 2', 'Seçenek 3', 'Seçenek 4'],
                  answer: value.answer || value.hint1 || 'Cevap bulunamadı',
                  explanation: value.explanation || value.aciklama || 'Açıklama bulunamadı',
                  difficulty: value.difficulty || value.zorluk || 1,
                  language: language,
                  createdAt: value.createdAt,
                  updatedAt: value.updatedAt
                }));
              } else {
                // Requested language not found in sub-node, return empty instead of all languages
                console.log(`⚠️ Requested language "${language}" not found in similarityData`);
                questions = [];
              }
            } else {
              questions = Object.entries(questionsData).map(([key, value]: [string, any]) => {
                return {
                  id: key,
                  question: value.question || value.soru || 'Soru bulunamadı',
                  options: value.options || [value.hint1 || 'Seçenek 1', value.hint2 || 'Seçenek 2', 'Seçenek 3', 'Seçenek 4'],
                  answer: value.answer || value.hint1 || 'Cevap bulunamadı',
                  explanation: value.explanation || value.aciklama || 'Açıklama bulunamadı',
                  difficulty: value.difficulty || value.zorluk || 1,
                  language: language,
                  createdAt: value.createdAt,
                  updatedAt: value.updatedAt
                };
              });
            }
          }

          console.log(`✅ Found ${questions.length} questions from path: ${path}`);
          console.log(`📋 First few questions:`, questions.slice(0, 3));
          console.log(`📋 All question IDs:`, questions.map(q => q.id));
          console.log(`📋 Raw data sample:`, questionsData);
          return { success: true, questions };
        }
      }
    } catch (pathError) {
      console.log(`❌ Error with path "${path}":`, pathError);
    }

    // Hiç veri bulunamadıysa
    console.log('⚠️ No questions found in any paths');
    return { success: true, questions: [] };
  } catch (error: any) {
    console.error('Sorular getirme hatası:', error);
    return { success: false, message: `Sorular getirilemedi: ${error.message}` };
  }
};

// Soru güncelleme
export const updateSimilarityQuestion = async (questionId: string, updates: Partial<SimilarityQuestion>, language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; message: string }> => {
  try {
    const questionRef = ref(database, `game_data/similarity_questions/${language}/${questionId}`);

    // Mevcut soruyu getir
    const snapshot = await get(questionRef);
    if (!snapshot.exists()) {
      return { success: false, message: 'Soru bulunamadı' };
    }

    const existingData = snapshot.val();
    const updatedData = {
      ...existingData,
      ...updates,
      updatedAt: Date.now()
    };

    await set(questionRef, updatedData);

    return { success: true, message: 'Soru başarıyla güncellendi' };
  } catch (error: any) {
    console.error('Soru güncelleme hatası:', error);
    return { success: false, message: `Soru güncellenemedi: ${error.message}` };
  }
};

// Soru silme
export const deleteSimilarityQuestion = async (questionId: string, language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; message: string }> => {
  try {
    const questionRef = ref(database, `game_data/similarity_questions/${language}/${questionId}`);

    await remove(questionRef);

    return { success: true, message: 'Soru başarıyla silindi' };
  } catch (error: any) {
    console.error('Soru silme hatası:', error);
    return { success: false, message: `Soru silinemedi: ${error.message}` };
  }
};

// Tek soru getir
export const getSimilarityQuestion = async (questionId: string, language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; question?: SimilarityQuestion; message?: string }> => {
  try {
    const questionRef = ref(database, `game_data/similarity_questions/${language}/${questionId}`);
    const snapshot = await get(questionRef);

    if (!snapshot.exists()) {
      return { success: false, message: 'Soru bulunamadı' };
    }

    const questionData = snapshot.val();
    const question: SimilarityQuestion = {
      ...questionData,
      id: questionId
    };

    return { success: true, question };
  } catch (error: any) {
    console.error('Soru getirme hatası:', error);
    return { success: false, message: `Soru getirilemedi: ${error.message}` };
  }
};

// Firebase'deki mevcut soruları test et
export const testFirebaseConnection = async (language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; data?: any; message?: string }> => {
  try {
    console.log(`🔍 Testing Firebase connection for language: ${language}`);
    console.log('🔍 Database instance:', database);
    console.log('🔍 Auth instance:', auth);
    console.log('🔍 Current user:', auth.currentUser);
    console.log('🔍 User email:', auth.currentUser?.email);

    // Authentication kontrolü
    if (!auth.currentUser) {
      console.log('❌ No authenticated user found');
      return { success: false, message: 'No authenticated user found' };
    }

    // Farklı path'leri test et
    const pathsToTest = [
      `game_data/similarity_questions/${language}`,
      `similarity_questions/${language}`,
      `game_data/similarity_questions/en`,
      `similarity_questions/en`,
      `game_data`,
      `similarity_questions`
    ];

    for (const testPath of pathsToTest) {
      try {
        console.log(`🔍 Testing path: ${testPath}`);
        const testRef = ref(database, testPath);
        const snapshot = await get(testRef);

        console.log(`📊 Path "${testPath}" exists:`, snapshot.exists());
        if (snapshot.exists()) {
          console.log(`📊 Path "${testPath}" value:`, snapshot.val());
          const data = snapshot.val();
          if (data && typeof data === 'object') {
            const questions = Object.values(data);
            console.log(`✅ Found ${questions.length} items in path "${testPath}"`);
            return { success: true, data: questions, message: `Found data in path: ${testPath}` };
          }
        }
      } catch (pathError) {
        console.log(`❌ Error testing path "${testPath}":`, pathError);
      }
    }

    console.log('⚠️ No questions found in any tested paths');
    return { success: true, data: [], message: 'No questions found in any paths' };
  } catch (error: any) {
    console.error('❌ Firebase test error:', error);
    return { success: false, message: error.message };
  }
};

// Test soruları ekle (geliştirme amaçlı)
export const addTestQuestions = async (language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; message: string }> => {
  try {
    const testQuestions: SimilarityQuestion[] = [
      {
        question: language === 'tr' ? 'Hangisi farklı?' : 'Which one is different?',
        options: language === 'tr' ? ['Kalem', 'Defter', 'Cetvel', 'Ördek'] : ['Pencil', 'Notebook', 'Ruler', 'Duck'],
        answer: language === 'tr' ? 'Ördek' : 'Duck',
        explanation: language === 'tr' ? 'Üçü okul malzemesi, biri hayvan.' : 'Three are school supplies, one is an animal.',
        difficulty: 1,
        language: language
      },
      {
        question: language === 'tr' ? 'Hangisi farklı?' : 'Which one is different?',
        options: language === 'tr' ? ['Elma', 'Armut', 'Muz', 'Havuç'] : ['Apple', 'Pear', 'Banana', 'Carrot'],
        answer: language === 'tr' ? 'Havuç' : 'Carrot',
        explanation: language === 'tr' ? 'Üçü meyve, biri sebze.' : 'Three are fruits, one is a vegetable.',
        difficulty: 1,
        language: language
      }
    ];

    let successCount = 0;
    for (const question of testQuestions) {
      const result = await addSimilarityQuestion(question);
      if (result.success) {
        successCount++;
      }
    }

    return {
      success: true,
      message: `${successCount}/${testQuestions.length} test sorusu eklendi`
    };
  } catch (error: any) {
    console.error('❌ Test questions error:', error);
    return { success: false, message: `Test soruları eklenemedi: ${error.message}` };
  }
};

// Debug fonksiyonu - Firebase'deki tüm veriyi kontrol et
export const debugFirebaseData = async (): Promise<{ success: boolean; data?: any; message?: string }> => {
  try {
    console.log('🔍 Debug: Checking all Firebase data structure');
    console.log('🔍 Current user:', auth.currentUser?.email);

    // Root level'ı kontrol et
    const rootRef = ref(database, '/');
    const rootSnapshot = await get(rootRef);

    if (rootSnapshot.exists()) {
      const rootData = rootSnapshot.val();
      console.log('📊 Root data keys:', Object.keys(rootData));

      // Her key için detaylı kontrol
      for (const key of Object.keys(rootData)) {
        console.log(`📊 Key "${key}":`, typeof rootData[key]);
        if (typeof rootData[key] === 'object' && rootData[key] !== null) {
          console.log(`📊 Key "${key}" subkeys:`, Object.keys(rootData[key]));

          // similarity_questions içeriyor mu kontrol et
          if (rootData[key].similarity_questions) {
            console.log(`📊 Found similarity_questions in "${key}"`);
            console.log(`📊 Similarity questions languages:`, Object.keys(rootData[key].similarity_questions));

            // Her dil için soru sayısını kontrol et
            for (const lang of Object.keys(rootData[key].similarity_questions)) {
              const langData = rootData[key].similarity_questions[lang];
              if (langData && typeof langData === 'object') {
                const questionCount = Object.keys(langData).length;
                console.log(`📊 Language "${lang}" has ${questionCount} questions`);
                console.log(`📊 Sample questions:`, Object.keys(langData).slice(0, 3));
              }
            }
          }
        }
      }

      return { success: true, data: rootData, message: 'Root data structure analyzed' };
    }

    return { success: false, message: 'No root data found' };
  } catch (error: any) {
    console.error('❌ Debug error:', error);
    return { success: false, message: error.message };
  }
};

// Soru doğrulama
export const validateSimilarityQuestion = (question: Partial<SimilarityQuestion>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!question.question || question.question.trim().length === 0) {
    errors.push('Soru metni gereklidir');
  }

  if (!question.options || question.options.length !== 4) {
    errors.push('Tam 4 seçenek gereklidir');
  }

  if (question.options) {
    question.options.forEach((option, index) => {
      if (!option || option.trim().length === 0) {
        errors.push(`${index + 1}. seçenek boş olamaz`);
      }
    });
  }

  if (!question.answer || question.answer.trim().length === 0) {
    errors.push('Doğru cevap gereklidir');
  }

  if (question.answer && question.options && !question.options.includes(question.answer)) {
    errors.push('Doğru cevap seçenekler arasında olmalıdır');
  }

  if (!question.explanation || question.explanation.trim().length === 0) {
    errors.push('Açıklama gereklidir');
  }

  if (!question.difficulty || question.difficulty < 1 || question.difficulty > 3) {
    errors.push('Zorluk seviyesi 1-3 arasında olmalıdır');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
