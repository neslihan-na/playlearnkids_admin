import { database, ref, get, set, remove } from '../firebase';
import { 
  StoryData, 
  StoryFormData, 
  formatStoryData, 
  validateStoryData, 
  generateStoryId
} from './storyHelpers';

// Firebase'de hikayeler için ana yol
const STORIES_PATH = 'stories';

// Tüm hikayeleri getir
export const getAllStories = async (): Promise<{
  success: boolean;
  stories?: StoryData[];
  error?: string;
}> => {
  try {
    const storiesRef = ref(database, STORIES_PATH);
    const snapshot = await get(storiesRef);
    
    if (!snapshot.exists()) {
      return { success: true, stories: [] };
    }
    
    const storiesData = snapshot.val();
    const stories = Object.entries(storiesData).map(([key, data]: [string, any]) => ({
      id: key,
      ...data
    }));
    
    // En yeni hikayeler önce gelecek şekilde sırala
    stories.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    console.log(`✅ ${stories.length} hikaye getirildi`);
    return { success: true, stories };
  } catch (error) {
    console.error('❌ Hikayeler getirilemedi:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Yeni hikaye oluştur
export const createStory = async (formData: StoryFormData): Promise<{
  success: boolean;
  message: string;
  storyId?: string;
  error?: string;
}> => {
  try {
    // Verileri doğrula
    const validation = validateStoryData(formData);
    if (!validation.isValid) {
      return {
        success: false,
        message: `Doğrulama hatası: ${validation.errors.join(', ')}`,
        error: validation.errors.join(', ')
      };
    }
    
    // StoryData formatına çevir (formatStoryData içinde zaten temizlik yapılıyor)
    const storyData = formatStoryData(formData, false);
    
    // Benzersiz ID oluştur
    const storyId = generateStoryId(storyData.title.tr);
    
    // Firebase'e kaydet
    const storyRef = ref(database, `${STORIES_PATH}/${storyId}`);
    await set(storyRef, storyData);
    
    console.log(`✅ Hikaye oluşturuldu: ${storyId}`);
    return {
      success: true,
      message: `Hikaye "${storyData.title.tr}" başarıyla oluşturuldu`,
      storyId
    };
  } catch (error) {
    console.error('❌ Hikaye oluşturma hatası:', error);
    return {
      success: false,
      message: `Hikaye oluşturulamadı: ${(error as Error).message}`,
      error: (error as Error).message
    };
  }
};

// Hikayeyi güncelle
export const updateStory = async (storyId: string, formData: StoryFormData): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    // Verileri doğrula
    const validation = validateStoryData(formData);
    if (!validation.isValid) {
      return {
        success: false,
        message: `Doğrulama hatası: ${validation.errors.join(', ')}`,
        error: validation.errors.join(', ')
      };
    }
    
    // Mevcut hikayeyi kontrol et
    const storyRef = ref(database, `${STORIES_PATH}/${storyId}`);
    const snapshot = await get(storyRef);
    
    if (!snapshot.exists()) {
      return {
        success: false,
        message: 'Hikaye bulunamadı',
        error: 'Hikaye bulunamadı'
      };
    }
    
    const existingStory = snapshot.val();
    
    // StoryData formatına çevir (edit modu - formatStoryData içinde zaten temizlik yapılıyor)
    const updatedStoryData = formatStoryData(formData, true);
    
    // createdAt'ı koru
    updatedStoryData.createdAt = existingStory.createdAt || Date.now();
    
    // Firebase'de güncelle
    await set(storyRef, updatedStoryData);
    
    console.log(`✅ Hikaye güncellendi: ${storyId}`);
    return {
      success: true,
      message: `Hikaye "${updatedStoryData.title.tr}" başarıyla güncellendi`
    };
  } catch (error) {
    console.error('❌ Hikaye güncelleme hatası:', error);
    return {
      success: false,
      message: `Hikaye güncellenemedi: ${(error as Error).message}`,
      error: (error as Error).message
    };
  }
};

// Hikayeyi sil
export const deleteStory = async (storyId: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    // Mevcut hikayeyi kontrol et
    const storyRef = ref(database, `${STORIES_PATH}/${storyId}`);
    const snapshot = await get(storyRef);
    
    if (!snapshot.exists()) {
      return {
        success: false,
        message: 'Hikaye bulunamadı',
        error: 'Hikaye bulunamadı'
      };
    }
    
    const storyData = snapshot.val();
    const storyTitle = storyData.title?.tr || storyId;
    
    // Hikayeyi sil
    await remove(storyRef);
    
    console.log(`✅ Hikaye silindi: ${storyId}`);
    return {
      success: true,
      message: `Hikaye "${storyTitle}" başarıyla silindi`
    };
  } catch (error) {
    console.error('❌ Hikaye silme hatası:', error);
    return {
      success: false,
      message: `Hikaye silinemedi: ${(error as Error).message}`,
      error: (error as Error).message
    };
  }
};

// Hikayenin yayın durumunu değiştir
export const toggleStoryPublishStatus = async (storyId: string): Promise<{
  success: boolean;
  message: string;
  isPublished?: boolean;
  error?: string;
}> => {
  try {
    const storyRef = ref(database, `${STORIES_PATH}/${storyId}`);
    const snapshot = await get(storyRef);
    
    if (!snapshot.exists()) {
      return {
        success: false,
        message: 'Hikaye bulunamadı',
        error: 'Hikaye bulunamadı'
      };
    }
    
    const storyData = snapshot.val();
    const newPublishStatus = !storyData.isPublished;
    
    // Sadece yayın durumunu güncelle
    await set(storyRef, {
      ...storyData,
      isPublished: newPublishStatus,
      updatedAt: Date.now()
    });
    
    const storyTitle = storyData.title?.tr || storyId;
    const statusText = newPublishStatus ? 'yayınlandı' : 'yayından kaldırıldı';
    
    console.log(`✅ Hikaye ${statusText}: ${storyId}`);
    return {
      success: true,
      message: `Hikaye "${storyTitle}" ${statusText}`,
      isPublished: newPublishStatus
    };
  } catch (error) {
    console.error('❌ Hikaye yayın durumu değiştirme hatası:', error);
    return {
      success: false,
      message: `Hikaye durumu değiştirilemedi: ${(error as Error).message}`,
      error: (error as Error).message
    };
  }
};

// Hikaye istatistikleri
export const getStoryStats = async (): Promise<{
  success: boolean;
  stats?: {
    total: number;
    published: number;
    draft: number;
    byCategory: { [category: string]: number };
    byAgeGroup: { [ageGroup: string]: number };
  };
  error?: string;
}> => {
  try {
    const result = await getAllStories();
    
    if (!result.success || !result.stories) {
      return { success: false, error: 'Hikayeler getirilemedi' };
    }
    
    const stories = result.stories;
    const stats = {
      total: stories.length,
      published: stories.filter(s => s.isPublished).length,
      draft: stories.filter(s => !s.isPublished).length,
      byCategory: {} as { [category: string]: number },
      byAgeGroup: {} as { [ageGroup: string]: number }
    };
    
    // Kategori istatistikleri
    stories.forEach(story => {
      const category = story.category?.tr || 'Diğer';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });
    
    // Yaş grubu istatistikleri
    stories.forEach(story => {
      let ageGroup = 'Belirsiz';
      
      // Yeni format
      if (story.minAge && story.maxAge) {
        ageGroup = `${story.minAge}-${story.maxAge} yaş`;
      } 
      // Eski format
      else if (story.ageGroup?.tr) {
        ageGroup = story.ageGroup.tr;
      }
      
      stats.byAgeGroup[ageGroup] = (stats.byAgeGroup[ageGroup] || 0) + 1;
    });
    
    return { success: true, stats };
  } catch (error) {
    console.error('❌ Hikaye istatistikleri hatası:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

// Hikaye arama
export const searchStories = async (searchTerm: string): Promise<{
  success: boolean;
  stories?: StoryData[];
  error?: string;
}> => {
  try {
    const result = await getAllStories();
    
    if (!result.success || !result.stories) {
      return { success: false, error: 'Hikayeler getirilemedi' };
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    const filteredStories = result.stories.filter(story => {
      // Başlık ve kategori araması
      const titleMatch = story.title.tr.toLowerCase().includes(searchTermLower) ||
                         story.title.en.toLowerCase().includes(searchTermLower);
      const categoryMatch = story.category.tr.toLowerCase().includes(searchTermLower) ||
                           story.category.en.toLowerCase().includes(searchTermLower);
      
      // Sayfa içeriklerinde arama (backward compatibility ile)
      const pageMatch = story.pages?.some(page => {
        const textTr = page.text?.tr || (page as any).textTr || '';
        const textEn = page.text?.en || (page as any).textEn || '';
        return textTr.toLowerCase().includes(searchTermLower) ||
               textEn.toLowerCase().includes(searchTermLower);
      }) || false;
      
      return titleMatch || categoryMatch || pageMatch;
    });
    
    return { success: true, stories: filteredStories };
  } catch (error) {
    console.error('❌ Hikaye arama hatası:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};
