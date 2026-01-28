import { database, ref, set, get } from '../firebase';

// İlk admin kullanıcısını oluşturmak için kullanılan yardımcı fonksiyon
export const createFirstAdmin = async () => {
  try {
    // Önce var mı kontrol et
    const adminRef = ref(database, 'admins/admin');
    const snapshot = await get(adminRef);
    
    if (snapshot.exists()) {
      console.log('✅ Admin zaten mevcut:', snapshot.val());
      return { success: true, admin: snapshot.val(), alreadyExists: true };
    }

    const adminData = {
      key: "admin",
      name: "Admin User", 
      email: "admin@playlearnkids.com",
      isActive: true,
      createdAt: Date.now(),
      lastLogin: null
    };

    await set(adminRef, adminData);
    
    console.log('✅ İlk admin kullanıcısı oluşturuldu!');
    console.log('📧 Email: admin@playlearnkids.com');
    console.log('🔐 Şimdi Authentication\'da aynı email ile kullanıcı oluşturun');
    console.log('🔗 Firebase Authentication: https://console.firebase.google.com/project/playlearnkids/authentication/users');
    
    return { success: true, admin: adminData };
  } catch (error) {
    console.error('❌ Admin oluşturma hatası:', error);
    return { success: false, error };
  }
};

// Bu fonksiyonu browser console'da çağırabilirsiniz:
// import { createFirstAdmin } from './utils/createFirstAdmin'; 
// createFirstAdmin();

// Global olarak erişilebilir hale getir
if (typeof window !== 'undefined') {
  (window as any).createFirstAdmin = createFirstAdmin;
}
