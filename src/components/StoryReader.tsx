import React, { useState } from 'react';
import { StoryData, getAgeRange } from '../utils/storyHelpers';
import './StoryReader.css';

interface StoryReaderProps {
  story: StoryData;
  onClose: () => void;
}

const StoryReader: React.FC<StoryReaderProps> = ({ story, onClose }) => {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');

  const currentPage = story.pages[currentPageIndex];
  const totalPages = story.pages.length;

  const nextPage = () => {
    if (currentPageIndex < totalPages - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const prevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const goToPage = (pageIndex: number) => {
    setCurrentPageIndex(pageIndex);
  };

  if (!currentPage) {
    return (
      <div className="story-reader">
        <div className="story-reader-header">
          <button className="close-button" onClick={onClose}>
            ✕ Kapat
          </button>
        </div>
        <div className="story-error">
          <h2>Hikaye bulunamadı</h2>
          <p>Bu hikayede sayfa bulunmuyor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="story-reader">
      {/* Header */}
      <div className="story-reader-header" style={{ backgroundColor: story.color }}>
        <button className="close-button" onClick={onClose}>
          ✕ Kapat
        </button>
        <h1 className="story-title">{story.title[language]}</h1>
        <div className="language-toggle">
          <button
            className={`lang-btn ${language === 'tr' ? 'active' : ''}`}
            onClick={() => setLanguage('tr')}
          >
            🇹🇷
          </button>
          <button
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            🇺🇸
          </button>
        </div>
      </div>

      {/* Page Content */}
      <div className="story-content">
        <div className="page-container">
          {/* Page Image */}
          <div className="page-image">
            {currentPage.imageUrl ? (
              <img
                src={currentPage.imageUrl}
                alt={`Sayfa ${currentPageIndex + 1}`}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  // Backward compatibility için coverImageUrl kontrolü
                  const fallbackUrl = story.imageUrl || (story as any).coverImageUrl || '/images/placeholder.png';
                  target.src = fallbackUrl;
                }}
              />
            ) : story.imageUrl || (story as any).coverImageUrl ? (
              <img
                src={story.imageUrl || (story as any).coverImageUrl}
                alt={`Kapak - ${story.title[language]}`}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`image-placeholder ${currentPage.imageUrl || story.imageUrl || (story as any).coverImageUrl ? 'hidden' : ''}`}>
              <span className="story-icon" style={{ color: story.color }}>
                {story.icon}
              </span>
            </div>
          </div>

          {/* Page Text */}
          <div className="page-text">
            <div className="page-number">
              Sayfa {currentPageIndex + 1} / {totalPages}
            </div>
            <p className="page-content-text">
              {language === 'tr' 
                ? (currentPage.text?.tr || (currentPage as any).textTr || '') 
                : (currentPage.text?.en || (currentPage as any).textEn || '')}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="story-navigation">
        <div className="nav-buttons">
          <button
            className="nav-btn prev"
            onClick={prevPage}
            disabled={currentPageIndex === 0}
          >
            ← Önceki
          </button>

          <div className="page-indicators">
            {story.pages.map((_, index) => (
              <button
                key={index}
                className={`page-dot ${index === currentPageIndex ? 'active' : ''}`}
                onClick={() => goToPage(index)}
                title={`Sayfa ${index + 1}`}
              />
            ))}
          </div>

          <button
            className="nav-btn next"
            onClick={nextPage}
            disabled={currentPageIndex === totalPages - 1}
          >
            Sonraki →
          </button>
        </div>

        {/* Story Info */}
        <div className="story-info">
          <span className="story-category">🏷️ {story.category[language]}</span>
          <span className="story-age">👶 {(() => {
            const { minAge, maxAge } = getAgeRange(story);
            return `${minAge}-${maxAge} ${language === 'tr' ? 'yaş' : 'years'}`;
          })()}</span>
          <span className="story-time">⏱️ {story.readingTime}</span>
          {story.authorName && (
            <span className="story-author">✍️ {story.authorName}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryReader;

