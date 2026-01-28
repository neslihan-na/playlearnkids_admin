import { database, ref, get, set, remove, update, auth } from '../firebase';

export interface LocalizedValue {
  tr?: string;
  en?: string;
}

export interface Video {
  id: string;
  title: string | LocalizedValue;
  subtitle?: string | LocalizedValue;
  category?: string | LocalizedValue;
  badge?: string | LocalizedValue;
  duration: string;
  views: string;
  icon: string;
  color: string;
  backgroundColor: string;
  videoType: 'local' | 'youtube';
  videoUrl: string | LocalizedValue;
  thumbnailUrl: string | LocalizedValue;
  videoFileName?: string | LocalizedValue;
  thumbnailFileName?: string | LocalizedValue;
  isActive: boolean;
  isPremium?: boolean;
  createdAt: number;
  lastUpdated?: number;
}

// Get all videos
const ensureLocalizedField = (value: any): string | LocalizedValue => {
  if (value === null || value === undefined) {
    return { tr: '', en: '' };
  }
  if (typeof value === 'string') {
    return value;
  }
  return {
    tr: value?.tr ?? '',
    en: value?.en ?? ''
  };
};

const ensureViewsString = (value: any): string => {
  if (value === null || value === undefined) return '0';
  return String(value);
};

const resolveVideoUrl = (
  data: any,
  videoType: 'local' | 'youtube'
): string | LocalizedValue => {
  const primary = data.videoUrl;
  const legacyLocalized = data.videoUrls || data.videoFileName;
  const legacyYoutube = data.youtubeUrl;

  if (videoType === 'youtube') {
    const candidate = primary ?? legacyYoutube;
    if (typeof candidate === 'string') return candidate;
    if (candidate && typeof candidate === 'object') {
      return candidate.en || candidate.tr || '';
    }
    return '';
  }

  const candidate = primary ?? legacyLocalized;
  if (typeof candidate === 'string') {
    return {
      tr: candidate,
      en: candidate
    };
  }
  return {
    tr: candidate?.tr ?? '',
    en: candidate?.en ?? ''
  };
};

const resolveThumbnailUrl = (data: any, videoType: 'local' | 'youtube'): string | LocalizedValue => {
  const primary = data.thumbnailUrl;
  const legacyLocalized = data.thumbnailUrls || data.thumbnailFileName;

  if (videoType === 'youtube') {
    if (typeof primary === 'string') return primary;
    if (primary && typeof primary === 'object') {
      return primary.en || primary.tr || '';
    }
    return '';
  }

  const candidate = primary ?? legacyLocalized;
  if (typeof candidate === 'string') {
    return {
      tr: candidate,
      en: candidate
    };
  }
  return {
    tr: candidate?.tr ?? '',
    en: candidate?.en ?? ''
  };
};

const getLocalizedTextValue = (value: string | LocalizedValue | undefined): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.tr || value.en || '';
};

export const getAllVideos = async (): Promise<{
  success: boolean;
  videos?: Video[];
  error?: string;
}> => {
  try {
    console.log(`🔍 Getting all videos`);

    // Farklı path'leri dene
    const possiblePaths = [
      `videos`,
      `atnegame_data/videos`,
      `game_data/videos`,
      `videos/matematik`,
      `videos/kelime`,
      `videos/eglence`,
      `videos/addition`,
      `videos/multiplication`,
      `videos/division`,
      `videos/words`,
      `atnegame_data/videos/matematik`,
      `atnegame_data/videos/kelime`,
      `atnegame_data/videos/eglence`,
      `atnegame_data/videos/addition`,
      `atnegame_data/videos/multiplication`,
      `atnegame_data/videos/division`,
      `atnegame_data/videos/words`
    ];

    for (const path of possiblePaths) {
      try {
        console.log(`🔍 Trying path: ${path}`);
        const videosRef = ref(database, path);
        const snapshot = await get(videosRef);

        console.log(`📊 Path "${path}" exists:`, snapshot.exists());

        if (snapshot.exists()) {
          const videosData = snapshot.val();
          console.log(`📊 Data from "${path}":`, videosData);

          if (videosData && typeof videosData === 'object') {
            const videos = Object.entries(videosData).map(([key, data]: [string, any]) => {
              const videoType: 'local' | 'youtube' = data.videoType === 'local' ? 'local' : 'youtube';
              return {
                id: key,
                title: ensureLocalizedField(data.title),
                subtitle: ensureLocalizedField(data.subtitle),
                category: ensureLocalizedField(data.category),
                badge: data.badge ? ensureLocalizedField(data.badge) : undefined,
                duration: data.duration || '',
                views: ensureViewsString(data.views),
                backgroundColor: data.backgroundColor || '#FFF1F2',
                color: data.color || '#FF6B6B',
                icon: data.icon || '🎵',
                videoType,
                videoUrl: resolveVideoUrl(data, videoType),
                thumbnailUrl: resolveThumbnailUrl(data, videoType),
                videoFileName: data.videoFileName,
                thumbnailFileName: data.thumbnailFileName,
                isActive: data.isActive !== false,
                isPremium: data.isPremium || false,
                createdAt: data.createdAt || Date.now(),
                lastUpdated: data.lastUpdated
              } as Video;
            });

            console.log(`✅ Found ${videos.length} videos from path: ${path}`);
            console.log(`📋 Sample video data:`, videos[0]);
            return { success: true, videos };
          }
        }
      } catch (pathError) {
        console.log(`❌ Error with path "${path}":`, pathError);
      }
    }

    console.log('⚠️ No videos found in any paths');
    return { success: true, videos: [] };
  } catch (error: any) {
    console.error('Videolar getirme hatası:', error);
    return { success: false, error: error.message };
  }
};

// Create new video
export const createVideo = async (videoData: Omit<Video, 'id' | 'createdAt'>): Promise<{
  success: boolean;
  message: string;
  video?: Video;
  error?: string;
}> => {
  try {
    // Auth kontrolü
    if (!auth.currentUser) {
      console.error('❌ Create video: No authenticated user');
      return {
        success: false,
        message: 'Lütfen önce giriş yapın',
        error: 'No authenticated user'
      };
    }

    // Auth token'ı yenile (bazen token expire olabilir)
    try {
      await auth.currentUser.getIdToken(true);
      console.log('✅ Auth token refreshed');
    } catch (tokenError) {
      console.warn('⚠️ Token refresh failed:', tokenError);
    }

    console.log('🔐 Create video - User:', auth.currentUser.email);
    console.log('🔐 Create video - User ID:', auth.currentUser.uid);
    console.log('🔐 Auth state:', auth.currentUser ? 'Authenticated' : 'Not authenticated');

    const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const videoRef = ref(database, `videos/${videoId}`);

    console.log('📝 Creating video at path:', `videos/${videoId}`);
    console.log('📝 Full database path:', videoRef.toString());

    const newVideo: Video = {
      id: videoId,
      ...videoData,
      views: ensureViewsString(videoData.views),
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    // Undefined değerleri temizle
    const cleanVideo = JSON.parse(JSON.stringify(newVideo));

    console.log('📦 Video data to save:', cleanVideo);
    console.log('📦 Video data keys:', Object.keys(cleanVideo));

    // Test: Önce read yaparak path'in erişilebilir olduğunu kontrol et
    try {
      const testRef = ref(database, 'videos');
      await get(testRef);
      console.log('✅ Videos path is readable');
    } catch (readError) {
      console.error('❌ Cannot read videos path:', readError);
      return {
        success: false,
        message: 'Videos path\'ine erişilemiyor. Firebase kurallarını kontrol edin.',
        error: (readError as Error).message
      };
    }

    // Önce set ile deneyelim
    try {
      await set(videoRef, cleanVideo);
      console.log(`✅ Video created with set: ${videoId}`);
    } catch (setError: any) {
      // Eğer set başarısız olursa, update ile deneyelim
      if (setError.code === 'PERMISSION_DENIED' || setError.message?.includes('permission_denied')) {
        console.warn('⚠️ Set failed, trying update method...');
        // Önce boş bir obje oluştur
        await set(videoRef, {});
        // Sonra update ile doldur
        await update(videoRef, cleanVideo);
        console.log(`✅ Video created with update: ${videoId}`);
      } else {
        throw setError;
      }
    }

    console.log(`✅ Video created: ${videoId}`);
    const titleText = getLocalizedTextValue(videoData.title) || videoId;
    return {
      success: true,
      message: `Video '${titleText}' created successfully`,
      video: newVideo
    };
  } catch (error) {
    console.error('Create video error:', error);
    return {
      success: false,
      message: 'Failed to create video',
      error: (error as Error).message
    };
  }
};

// Update video
export const updateVideo = async (videoId: string, updates: Partial<Video>): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    const videoRef = ref(database, `videos/${videoId}`);
    const snapshot = await get(videoRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        message: 'Video not found',
        error: 'Video not found'
      };
    }

    const currentData = snapshot.val();
    const updatedData = {
      ...currentData,
      ...updates,
      lastUpdated: Date.now()
    };

    await set(videoRef, updatedData);

    console.log(`✅ Video updated: ${videoId}`);
    const videoTitle = updates.title || currentData.title;
    const finalTitle = typeof videoTitle === 'string'
      ? videoTitle
      : (videoTitle?.tr || videoTitle?.en || 'Video');
    return {
      success: true,
      message: `Video '${finalTitle}' updated successfully`
    };
  } catch (error) {
    console.error('Update video error:', error);
    return {
      success: false,
      message: 'Failed to update video',
      error: (error as Error).message
    };
  }
};

// Delete video
export const deleteVideo = async (videoId: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    const videoRef = ref(database, `videos/${videoId}`);
    const snapshot = await get(videoRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        message: 'Video not found',
        error: 'Video not found'
      };
    }

    const videoData = snapshot.val();

    // Delete video data from database
    await remove(videoRef);

    console.log(`✅ Video deleted: ${videoId}`);
    const videoTitle = typeof videoData.title === 'string'
      ? videoData.title
      : (videoData.title?.tr || videoData.title?.en || 'Video');
    return {
      success: true,
      message: `Video '${videoTitle}' deleted successfully`
    };
  } catch (error) {
    console.error('Delete video error:', error);
    return {
      success: false,
      message: 'Failed to delete video',
      error: (error as Error).message
    };
  }
};

// Upload video file to Google Cloud Storage
export const uploadVideoFile = async (file: File, videoId: string): Promise<{
  success: boolean;
  fileName?: string;
  url?: string;
  error?: string;
}> => {
  try {
    const fileName = `video_${videoId}_${Date.now()}.${file.name.split('.').pop()}`;

    console.log(`📁 Uploading video: ${fileName} (${file.size} bytes)`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);
    formData.append('folder', 'videos');

    const response = await fetch('/api/upload-video', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    console.log(`✅ Video file uploaded: ${fileName}`);
    return {
      success: true,
      fileName,
      url: result.url
    };
  } catch (error) {
    console.error('Upload video file error:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

// Upload thumbnail file to Google Cloud Storage
export const uploadThumbnailFile = async (file: File, videoId: string): Promise<{
  success: boolean;
  fileName?: string;
  url?: string;
  error?: string;
}> => {
  try {
    const fileName = `thumb_${videoId}_${Date.now()}.${file.name.split('.').pop()}`;

    console.log(`📁 Uploading thumbnail: ${fileName} (${file.size} bytes)`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', fileName);
    formData.append('folder', 'thumbnails');

    const response = await fetch('/api/upload-thumbnail', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    console.log(`✅ Thumbnail file uploaded: ${fileName}`);
    return {
      success: true,
      fileName,
      url: result.url
    };
  } catch (error) {
    console.error('Upload thumbnail file error:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

// Get videos by category
export const getVideosByCategory = async (categoryKey: string): Promise<{
  success: boolean;
  videos?: Video[];
  error?: string;
}> => {
  try {
    const videosRef = ref(database, 'videos');
    const snapshot = await get(videosRef);

    if (!snapshot.exists()) {
      return { success: true, videos: [] };
    }

    const videosData = snapshot.val();
    if (!videosData || typeof videosData !== 'object') {
      return { success: true, videos: [] };
    }

    const results: Video[] = [];
    Object.entries(videosData).forEach(([key, data]: [string, any]) => {
      const videoType: 'local' | 'youtube' = data.videoType === 'local' ? 'local' : 'youtube';
      const videoCategory = ensureLocalizedField(data.category);
      const categoryMatches = typeof videoCategory === 'string'
        ? videoCategory === categoryKey
        : (videoCategory.tr === categoryKey || videoCategory.en === categoryKey);

      if (!categoryMatches) return;

      results.push({
        id: key,
        title: ensureLocalizedField(data.title),
        subtitle: ensureLocalizedField(data.subtitle),
        category: videoCategory,
        badge: data.badge ? ensureLocalizedField(data.badge) : undefined,
        duration: data.duration || '0:00',
        views: ensureViewsString(data.views),
        backgroundColor: data.backgroundColor || '#FFF1F2',
        color: data.color || '#FF6B6B',
        icon: data.icon || '🎵',
        videoType,
        videoUrl: resolveVideoUrl(data, videoType),
        thumbnailUrl: resolveThumbnailUrl(data, videoType),
        videoFileName: data.videoFileName,
        thumbnailFileName: data.thumbnailFileName,
        isActive: data.isActive !== false,
        createdAt: data.createdAt || Date.now(),
        lastUpdated: data.lastUpdated
      });
    });

    console.log(`✅ Retrieved ${results.length} videos for category: ${categoryKey}`);
    return { success: true, videos: results };
  } catch (error) {
    console.error('Get videos by category error:', error);
    return { success: false, error: 'Failed to get videos by category' };
  }
};

// Toggle video active status
export const toggleVideoStatus = async (videoId: string, isActive: boolean): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    const result = await updateVideo(videoId, { isActive });

    if (result.success) {
      return {
        success: true,
        message: `Video ${isActive ? 'activated' : 'deactivated'} successfully`
      };
    } else {
      return result;
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to toggle video status',
      error: (error as Error).message
    };
  }
};

// Increment video views
export const incrementVideoViews = async (videoId: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    const videoRef = ref(database, `videos/${videoId}`);
    const snapshot = await get(videoRef);

    if (!snapshot.exists()) {
      return {
        success: false,
        message: 'Video not found',
        error: 'Video not found'
      };
    }

    const currentData = snapshot.val();
    const currentViews = Number(currentData.views || 0);
    const newViews = currentViews + 1;

    await set(videoRef, {
      ...currentData,
      views: String(newViews),
      lastUpdated: Date.now()
    });

    return {
      success: true,
      message: 'Video views incremented'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to increment video views',
      error: (error as Error).message
    };
  }
};
