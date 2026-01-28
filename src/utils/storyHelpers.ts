// Hikaye yönetimi için yardımcı fonksiyonlar

// Sayfa yapısı - her sayfa için ayrı görsel ve metin
export interface StoryPage {
  pageNumber: number;
  text: {
    tr: string;
    en: string;
  };
  imageUrl: string; // ZORUNLU: Direkt URL
}

export interface StoryFormData {
  titleTr: string;
  titleEn: string;
  categoryTr: string;
  categoryEn: string;
  color: string;
  icon: string;
  imageUrl: string; // Kapak görseli - ZORUNLU: Direkt URL
  readingTime: string;
  minAge?: number; // Opsiyonel
  maxAge?: number; // Opsiyonel
  authorId?: string; // Yazar ID'si (opsiyonel)
  authorName?: string; // Yazar adı (opsiyonel)
  badgeTr?: string; // Opsiyonel
  badgeEn?: string; // Opsiyonel
  isPublished: boolean;
  isPremium: boolean;
  pages: StoryPage[];
}

export interface StoryData {
  id?: string;
  title: {
    tr: string;
    en: string;
  };
  category: {
    tr: string;
    en: string;
  };
  color: string;
  icon: string;
  imageUrl: string; // Kapak görseli - ZORUNLU: Direkt URL
  readingTime: string;
  minAge?: number; // Opsiyonel - eski hikayeler için
  maxAge?: number; // Opsiyonel - eski hikayeler için
  // Eski hikayeler için backward compatibility
  ageGroup?: {
    tr: string;
    en: string;
  };
  authorId?: string; // Yazar ID'si (opsiyonel)
  authorName?: string; // Yazar adı (opsiyonel)
  badge?: {
    tr: string;
    en: string;
  };
  isPublished: boolean;
  isPremium: boolean;
  pages: StoryPage[];
  totalPages: number;
  createdAt: number;
  updatedAt: number;
  // Eski hikayeler için backward compatibility (deprecated)
  content?: {
    tr: string;
    en: string;
  };
  // Eski alanlar (deprecated - backward compatibility için)
  coverImage?: string;
  coverImageUrl?: string;
}

// Hikaye verilerini doğrula
export const validateStoryData = (data: StoryFormData): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.titleTr.trim()) errors.push('Türkçe başlık gereklidir');
  if (!data.titleEn.trim()) errors.push('İngilizce başlık gereklidir');
  if (!data.categoryTr.trim()) errors.push('Türkçe kategori gereklidir');
  if (!data.categoryEn.trim()) errors.push('İngilizce kategori gereklidir');
  if (!data.imageUrl.trim()) errors.push('Kapak görseli URL gereklidir');
  if (!data.readingTime.trim()) errors.push('Okuma süresi gereklidir');

  // URL formatını kontrol et
  if (data.imageUrl.trim() && !isValidUrl(data.imageUrl.trim())) {
    errors.push('Kapak görseli geçerli bir URL olmalıdır');
  }

  // Yaş kontrolleri - eğer girilmişse kontrol et
  if (data.minAge !== undefined) {
    if (data.minAge < 1) errors.push('Alt yaş en az 1 olmalıdır');
  }
  if (data.maxAge !== undefined) {
    if (data.maxAge < 1) errors.push('Üst yaş en az 1 olmalıdır');
  }
  if (data.minAge !== undefined && data.maxAge !== undefined && data.minAge > data.maxAge) {
    errors.push('Alt yaş, üst yaştan büyük olamaz');
  }

  // Sayfa kontrolü
  if (!data.pages || data.pages.length === 0) {
    errors.push('En az bir sayfa eklenmeli');
  } else {
    data.pages.forEach((page, index) => {
      if (!page.text?.tr?.trim()) {
        errors.push(`Sayfa ${index + 1}: Türkçe metin gereklidir`);
      }
      if (!page.text?.en?.trim()) {
        errors.push(`Sayfa ${index + 1}: İngilizce metin gereklidir`);
      }
      if (!page.imageUrl?.trim()) {
        errors.push(`Sayfa ${index + 1}: Görsel URL gereklidir`);
      } else if (!isValidUrl(page.imageUrl.trim())) {
        errors.push(`Sayfa ${index + 1}: Görsel geçerli bir URL olmalıdır`);
      }
    });
  }

  // Renk formatını kontrol et
  if (data.color && !data.color.match(/^#[0-9A-Fa-f]{6}$/)) {
    errors.push('Renk formatı geçersiz (örn: #FF9800)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// URL doğrulama yardımcı fonksiyonu
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Form verilerini StoryData formatına çevir
// Form verilerini StoryData formatına çevir
export const formatStoryData = (formData: StoryFormData, isEdit: boolean = false): StoryData => {
  const now = Date.now();

  // Sayfaları sıralayıp temizle
  const cleanPages = formData.pages
    .map((page, index) => ({
      pageNumber: index + 1,
      text: {
        tr: (page.text?.tr || '').trim(),
        en: (page.text?.en || '').trim()
      },
      imageUrl: (page.imageUrl || '').trim() // Direkt URL kullan
    }))
    .filter(page => page.text.tr || page.text.en || page.imageUrl); // Boş sayfaları çıkar

  // Temel veri objesi
  const storyData: any = {
    title: {
      tr: formData.titleTr.trim(),
      en: formData.titleEn.trim()
    },
    category: {
      tr: formData.categoryTr.trim(),
      en: formData.categoryEn.trim()
    },
    color: formData.color || '#FF9800',
    icon: formData.icon || '📖',
    imageUrl: formData.imageUrl.trim(), // Direkt URL kullan
    readingTime: formData.readingTime.trim(),
    minAge: formData.minAge || 3,
    maxAge: formData.maxAge || 6,
    isPublished: formData.isPublished,
    isPremium: formData.isPremium || false,
    pages: cleanPages,
    totalPages: cleanPages.length,
    createdAt: isEdit ? 0 : now, // Edit durumunda createdAt korunur
    updatedAt: now
  };

  // Opsiyonel alanları sadece değer varsa ekle (undefined hatasını önlemek için)
  if (formData.authorId) {
    storyData.authorId = formData.authorId;
  }

  if (formData.authorName) {
    storyData.authorName = formData.authorName;
  }

  if (formData.badgeTr || formData.badgeEn) {
    storyData.badge = {
      tr: formData.badgeTr?.trim() || '',
      en: formData.badgeEn?.trim() || ''
    };
  }

  return storyData as StoryData;
};

// Yeni sayfa oluştur
export const createNewPage = (): StoryPage => ({
  pageNumber: 0, // Bu daha sonra ayarlanacak
  text: {
    tr: '',
    en: ''
  },
  imageUrl: '' // Direkt URL - boş string olarak başlat
});

// Resim dosya adını temizle ve standartlaştır
// Direct URL kullanıldığından otomatik dosya adı/URL üretimi kaldırıldı.

// Hikaye için benzersiz ID oluştur
// Hikaye için benzersiz ID oluştur
export const generateStoryId = (title: string): string => {
  const timestamp = Date.now();

  // Türkçe karakter dönüşümü
  const trMap: { [key: string]: string } = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u',
    'Ç': 'c', 'Ğ': 'g', 'I': 'i', 'İ': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u'
  };

  let cleanTitle = title;
  for (const key in trMap) {
    cleanTitle = cleanTitle.replace(new RegExp(key, 'g'), trMap[key]);
  }

  const finalTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
  // Birden fazla alt çizgiyi teke indir ve baştaki/sondaki alt çizgileri kaldır
  const formattedTitle = finalTitle.replace(/_+/g, '_').replace(/^_|_$/g, '');

  return `story_${formattedTitle}_${timestamp}`;
};

// Hikaye kategorileri (önceden tanımlı)
export const STORY_CATEGORIES = {
  tr: [
    'Motivasyon',
    'Cesaret',
    'Paylaşım',
    'Dostluk',
    'Hayal Gücü',
    'Macera',
    'Eğitim',
    'Aile',
    'Doğa',
    'Bilim'
  ],
  en: [
    'Motivation',
    'Courage',
    'Sharing',
    'Friendship',
    'Imagination',
    'Adventure',
    'Education',
    'Family',
    'Nature',
    'Science'
  ]
};

// Yaş seçenekleri (1-12 yaş arası)
export const AGE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Yaş grubu gösterimi için yardımcı fonksiyon (backward compatible)
export const formatAgeGroup = (minAge: number, maxAge: number, language: 'tr' | 'en'): string => {
  if (language === 'tr') {
    return `${minAge}-${maxAge} yaş`;
  }
  return `${minAge}-${maxAge} years`;
};

// Eski hikayelerden yaş bilgisini al (backward compatibility)
export const getAgeRange = (story: StoryData): { minAge: number; maxAge: number } => {
  // Yeni format varsa onu kullan
  if (story.minAge && story.maxAge) {
    return { minAge: story.minAge, maxAge: story.maxAge };
  }

  // Eski format varsa parse et
  if (story.ageGroup?.tr) {
    const match = story.ageGroup.tr.match(/(\d+)-(\d+)/);
    if (match) {
      return {
        minAge: parseInt(match[1]),
        maxAge: parseInt(match[2])
      };
    }
  }

  // Hiçbiri yoksa default değer
  return { minAge: 3, maxAge: 6 };
};

// Rozet seçenekleri
export const BADGE_OPTIONS = {
  tr: [
    'Yeni',
    'Popüler',
    'Önerilen',
    'Özel',
    'Klasik',
    'Eğitici'
  ],
  en: [
    'New',
    'Popular',
    'Recommended',
    'Special',
    'Classic',
    'Educational'
  ]
};

// Renk paleti
export const COLOR_PALETTE = [
  '#FF9800', // Turuncu
  '#4CAF50', // Yeşil
  '#2196F3', // Mavi
  '#9C27B0', // Mor
  '#F44336', // Kırmızı
  '#FF5722', // Derin turuncu
  '#795548', // Kahverengi
  '#607D8B', // Mavi-gri
  '#E91E63', // Pembe
  '#3F51B5'  // İndigo
];

// Emoji ikonları
export const EMOJI_ICONS = [
  '📖', '📚', '🌟', '⭐', '🎭', '🎪', '🎨', '🎵', '🎯', '🎲',
  '🐰', '🐻', '🐸', '🐙', '🦋', '🐝', '🦄', '🐺', '🐨', '🐼',
  '🚀', '🏰', '🌈', '☀️', '🌙', '💫', '✨', '🎉'
];
