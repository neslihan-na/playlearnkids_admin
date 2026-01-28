import { database, auth } from '../firebase';
import { ref, get, set, remove } from 'firebase/database';

// Word hunt sorusu interface'i
export interface WordHuntQuestion {
  id?: string | number;
  soru: string;
  cevap: string;
  hint1: string;
  hint2: string;
  harfSayisi: number;
  zorluk: number;
  language?: 'tr' | 'en'; // Opsiyonel, path'den geliyor
  createdAt?: number;
  updatedAt?: number;
}

// Yeni soru ekleme
export const addWordHuntQuestion = async (question: WordHuntQuestion): Promise<{ success: boolean; message: string; questionId?: string }> => {
  try {
    const language = question.language || 'en';
    const questionsRef = ref(database, `game_data/wordhunt_questions/${language}`);

    // Mevcut soruları alıp en yüksek ID'yi bulalım (Eğer numeric ID kullanılıyorsa)
    const snapshot = await get(questionsRef);
    let nextId = 0;
    if (snapshot.exists()) {
      const data = snapshot.val();
      const ids = Object.keys(data).map(k => parseInt(k)).filter(n => !isNaN(n));
      if (ids.length > 0) {
        nextId = Math.max(...ids) + 1;
      }
    }

    const questionRef = ref(database, `game_data/wordhunt_questions/${language}/${nextId}`);

    // Veriyi temizle (language'i Firebase'e kaydetmeye gerek yok, path'den biliyoruz)
    const { language: lang, ...saveData } = question;

    const questionData = {
      ...saveData,
      id: nextId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(questionRef, questionData);

    return {
      success: true,
      message: 'Soru başarıyla eklendi',
      questionId: nextId.toString()
    };
  } catch (error: any) {
    console.error('Soru ekleme hatası:', error);
    return { success: false, message: `Soru eklenemedi: ${error.message}` };
  }
};

// Tüm soruları getir
export const getAllWordHuntQuestions = async (language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; questions?: WordHuntQuestion[]; message?: string }> => {
  try {
    const path = `game_data/wordhunt_questions/${language}`;
    const questionsRef = ref(database, path);
    const snapshot = await get(questionsRef);

    if (snapshot.exists()) {
      const questionsData = snapshot.val();

      if (questionsData && typeof questionsData === 'object') {
        let questions: WordHuntQuestion[] = [];

        // Eğer data array ise
        if (Array.isArray(questionsData)) {
          questions = questionsData
            .filter(q => q !== null && q !== undefined)
            .map((q: any, index: number) => ({
              ...q,
              id: q.id !== undefined ? q.id : index,
              language: language
            }));
        } else {
          // Eğer data object ise (key-value pairs)
          questions = Object.entries(questionsData).map(([key, value]: [string, any]) => ({
            ...value,
            id: value.id !== undefined ? value.id : key,
            language: language
          }));
        }

        return { success: true, questions: questions };
      }
    }
    return { success: true, questions: [] };
  } catch (error: any) {
    console.error('Word hunt soruları getirme hatası:', error);
    return { success: false, message: `Sorular getirilemedi: ${error.message}` };
  }
};

// Soru güncelleme
export const updateWordHuntQuestion = async (questionId: string, updates: Partial<WordHuntQuestion>, language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; message: string }> => {
  try {
    const questionRef = ref(database, `game_data/wordhunt_questions/${language}/${questionId}`);

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
export const deleteWordHuntQuestion = async (questionId: string, language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; message: string }> => {
  try {
    const questionRef = ref(database, `game_data/wordhunt_questions/${language}/${questionId}`);

    await remove(questionRef);

    return { success: true, message: 'Soru başarıyla silindi' };
  } catch (error: any) {
    console.error('Soru silme hatası:', error);
    return { success: false, message: `Soru silinemedi: ${error.message}` };
  }
};

// Tek soru getir
export const getWordHuntQuestion = async (questionId: string, language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; question?: WordHuntQuestion; message?: string }> => {
  try {
    const questionRef = ref(database, `game_data/wordhunt_questions/${language}/${questionId}`);
    const snapshot = await get(questionRef);

    if (!snapshot.exists()) {
      return { success: false, message: 'Soru bulunamadı' };
    }

    const questionData = snapshot.val();
    const question: WordHuntQuestion = {
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
export const testWordHuntFirebaseConnection = async (language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; data?: any; message?: string }> => {
  try {
    console.log(`🔍 Testing Firebase connection for word hunt questions language: ${language}`);
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
      `game_data/wordhunt_questions/${language}`,
      `wordhunt_questions/${language}`,
      `game_data/wordhunt_questions/en`,
      `wordhunt_questions/en`,
      `atnegame_data`,
      `wordhunt_questions`
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

    console.log('⚠️ No word hunt questions found in any tested paths');
    return { success: true, data: [], message: 'No word hunt questions found in any paths' };
  } catch (error: any) {
    console.error('❌ Firebase test error:', error);
    return { success: false, message: error.message };
  }
};

// Test soruları ekle (geliştirme amaçlı)
export const addTestWordHuntQuestions = async (language: 'tr' | 'en' = 'en'): Promise<{ success: boolean; message: string }> => {
  try {
    const testQuestions: WordHuntQuestion[] = [
      {
        soru: language === 'tr' ? 'Miyavlayan ve süt içen küçük hayvan nedir?' : 'What is the small animal that meows and drinks milk?',
        cevap: 'CAT',
        hint1: language === 'tr' ? 'Patilerim çok tatlıdır.' : 'My paws are very cute.',
        hint2: language === 'tr' ? 'Fare yakalamayı severim.' : 'I like catching mice.',
        harfSayisi: 3,
        zorluk: 1,
        language: language
      },
      {
        soru: language === 'tr' ? 'Geceleri öten ve uçan hayvan nedir?' : 'What is the flying animal that hoot at night?',
        cevap: 'OWL',
        hint1: language === 'tr' ? 'Kocaman gözlerim var.' : 'I have big eyes.',
        hint2: language === 'tr' ? 'Geceleri uyumam.' : 'I don\'t sleep at night.',
        harfSayisi: 3,
        zorluk: 1,
        language: language
      }
    ];

    let successCount = 0;
    for (const question of testQuestions) {
      const result = await addWordHuntQuestion(question);
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
export const debugWordHuntFirebaseData = async (): Promise<{ success: boolean; data?: any; message?: string }> => {
  try {
    console.log('🔍 Debug: Checking all Firebase data structure for word hunt');
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

          // wordhunt_questions içeriyor mu kontrol et
          if (rootData[key].wordhunt_questions) {
            console.log(`📊 Found wordhunt_questions in "${key}"`);
            console.log(`📊 Word hunt questions languages:`, Object.keys(rootData[key].wordhunt_questions));

            // Her dil için soru sayısını kontrol et
            for (const lang of Object.keys(rootData[key].wordhunt_questions)) {
              const langData = rootData[key].wordhunt_questions[lang];
              if (langData && typeof langData === 'object') {
                const questionCount = Object.keys(langData).length;
                console.log(`📊 Language "${lang}" has ${questionCount} questions`);
                console.log(`📊 Sample questions:`, Object.keys(langData).slice(0, 3));
              }
            }
          }
        }
      }

      return { success: true, data: rootData, message: 'Root data structure analyzed for word hunt' };
    }

    return { success: false, message: 'No root data found' };
  } catch (error: any) {
    console.error('❌ Debug error:', error);
    return { success: false, message: error.message };
  }
};

// Soru doğrulama
export const validateWordHuntQuestion = (question: Partial<WordHuntQuestion>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!question.soru || question.soru.trim().length === 0) {
    errors.push('Soru metni gereklidir');
  }

  if (!question.cevap || question.cevap.trim().length === 0) {
    errors.push('Doğru cevap gereklidir');
  }

  if (!question.hint1 || question.hint1.trim().length === 0) {
    errors.push('İpucu 1 gereklidir');
  }

  if (!question.hint2 || question.hint2.trim().length === 0) {
    errors.push('İpucu 2 gereklidir');
  }

  if (!question.harfSayisi || question.harfSayisi < 1) {
    errors.push('Harf sayısı geçerli olmalıdır');
  }

  if (question.zorluk === undefined || question.zorluk < 1 || question.zorluk > 3) {
    errors.push('Zorluk seviyesi 1-3 arasında olmalıdır');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
