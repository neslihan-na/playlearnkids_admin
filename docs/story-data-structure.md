## Hikaye Veri Yapısı - Admin Rehberi

### Genel Bakış

Firebase Realtime Database'de hikaye kayıtları için aşağıdaki yapı kullanılmalıdır. **ÖNEMLİ:** `imageFileName`, `coverImage`, `textTr`, `textEn` gibi alanlar artık desteklenmiyor. Tüm görsel alanları için yalnızca direkt `imageUrl`, metin alanları için de `text: { tr: '...', en: '...' }` yapısı kullanılmalıdır.

---

### Firebase Key Yapısı

- Hikayeler `stories` node'u altında tutulur.
- Tavsiye edilen ID formatı: `01`, `02`, `03` gibi sıralı kimlikler.
- Alternatif olarak Firebase'in otomatik ürettiği key'ler de kullanılabilir.

```
stories/
  ├── 01/
  ├── 02/
  └── 03/
```

---

### Hikaye Veri Şeması

```json
{
  "id": "01",
  "isPublished": true,
  "title": {
    "tr": "Hikaye Başlığı Türkçe",
    "en": "Story Title English"
  },
  "category": {
    "tr": "Kategori Türkçe",
    "en": "Category English"
  },
  "color": "#4CAF50",
  "icon": "📚",
  "imageUrl": "https://storage.googleapis.com/playlearnkids/stories/images/01_cover.jpg",
  "readingTime": "5 dk",
  "ageGroup": {
    "tr": "5-7 yaş",
    "en": "Ages 5-7"
  },
  "badge": {
    "tr": "Rozet Açıklaması TR",
    "en": "Badge Description EN"
  },
  "pages": [
    {
      "pageNumber": 1,
      "text": {
        "tr": "Sayfa 1 metni Türkçe",
        "en": "Page 1 text English"
      },
      "imageUrl": "https://storage.googleapis.com/playlearnkids/stories/images/01_page_1.jpg"
    },
    {
      "pageNumber": 2,
      "text": {
        "tr": "Sayfa 2 metni Türkçe",
        "en": "Page 2 text English"
      },
      "imageUrl": "https://storage.googleapis.com/playlearnkids/stories/images/01_page_2.jpg"
    }
  ],
  "totalPages": 2,
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

`content` alanı yalnızca geçmişe dönük uyumluluk için tutulur; yeni hikayelerde zorunlu değildir.

---

### Kullanılmayan Alanlar

1. `imageFileName`
2. `coverImage` / `coverImageUrl`
3. `textTr` / `textEn`

Bu alanlar hem formda hem Firebase kayıtlarında yer almamalıdır.

---

### Zorunlu Yeni Alanlar / Yapılar

1. **`imageUrl`**  
   - Kapak için `imageUrl`.  
   - Her sayfa için `pages[].imageUrl`.  
   - Tümü direkt, herkese açık erişilebilir URL olmalı.

2. **`text: { tr: '...', en: '...' }`**  
   - Sayfa metinleri iki dilde tutulur.  
   - Eski `textTr` / `textEn` alanları kullanılmaz.

3. **`pages` dizisi**  
   - Yeni hikayeler sayfa bazlı tutulur.  
   - `content` yalnızca eski hikayeler için fallback olarak kalır.

---

### Görsel URL Formatı (Önerilen)

```
https://storage.googleapis.com/playlearnkids/stories/images/{storyId}_{type}.{ext}
```

Örnekler:

- Kapak: `https://storage.googleapis.com/playlearnkids/stories/images/01_cover.jpg`
- Sayfa 1: `https://storage.googleapis.com/playlearnkids/stories/images/01_page_1.jpg`
- Sayfa 2: `https://storage.googleapis.com/playlearnkids/stories/images/01_page_2.jpg`

---

### Tam Örnek

```json
{
  "01": {
    "isPublished": true,
    "title": {
      "tr": "Küçük Prenses",
      "en": "Little Princess"
    },
    "category": {
      "tr": "Macera",
      "en": "Adventure"
    },
    "color": "#FF6B9D",
    "icon": "👸",
    "imageUrl": "https://storage.googleapis.com/playlearnkids/stories/images/01_cover.jpg",
    "readingTime": "8 dk",
    "ageGroup": {
      "tr": "6-8 yaş",
      "en": "Ages 6-8"
    },
    "pages": [
      {
        "pageNumber": 1,
        "text": {
          "tr": "Bir zamanlar küçük bir prenses varmış...",
          "en": "Once upon a time there was a little princess..."
        },
        "imageUrl": "https://storage.googleapis.com/playlearnkids/stories/images/01_page_1.jpg"
      },
      {
        "pageNumber": 2,
        "text": {
          "tr": "Prenses her gün bahçede oynardı...",
          "en": "The princess played in the garden every day..."
        },
        "imageUrl": "https://storage.googleapis.com/playlearnkids/stories/images/01_page_2.jpg"
      }
    ],
    "totalPages": 2,
    "createdAt": 1704067200000,
    "updatedAt": 1704067200000
  }
}
```

---

### Kontrol Listesi

- [ ] `isPublished` işaretli mi?
- [ ] `title`, `category`, `ageGroup`, `badge` alanlarında hem `tr` hem `en` değerleri var mı?
- [ ] Kapak `imageUrl` alanı dolu mu ve geçerli URL mi?
- [ ] Her sayfada `text.tr`, `text.en` ve `imageUrl` alanları mevcut mu?
- [ ] `totalPages` değeri sayfa sayısıyla eşleşiyor mu?
- [ ] `pageNumber` değerleri 1,2,3... şeklinde sıralı mı?
- [ ] `createdAt`/`updatedAt` timestamp'leri güncel mi?

---

### Hata Kontrolü

Bir hikaye görünmüyorsa şu maddeleri kontrol edin:

1. `isPublished` alanı `true` mu?
2. Kapak `imageUrl` veya sayfa `imageUrl` alanları boş/geçersiz mi?
3. `pages` dizisi doğru formatta mı?
4. `text` objeleri iki dilde metin içeriyor mu?

---

### Notlar

- Artık sistem otomatik dosya adı/URL üretmez. Tüm URL'ler kaydetmeden önce manuel olarak girilmelidir.
- Çoklu dil zorunludur; tek dilde girişler validasyondan geçmez.
- `content` alanı sadece eski hikayelerin geriye dönük desteklenmesi içindir, yeni kayıtlar `pages` dizisini kullanmalıdır.

