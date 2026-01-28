import { database, ref, get, set, remove, getDatabasePath } from '../firebase';

// Type definitions for admin functions - DatabaseUser removed as not used

// Type for admin panel display
export interface AdminPanelUser {
  key: string;
  username: string;
  email: string;
  level: number;
  avatar: string;
  isPremium: boolean;
  isAdmin: boolean;
  score: number;
  birthYear: number;
  [key: string]: any;
}

// Admin interface
export interface Admin {
  key: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: number;
  lastLogin?: number;
}

// Get all users function
export const getAllUsers = async (): Promise<{
  success: boolean;
  users?: AdminPanelUser[];
  error?: string;
}> => {
  try {
    // Use getDatabasePath('') to get the correct root based on environment (users or test_users)
    const usersRef = ref(database, getDatabasePath('').replace(/\/$/, ''));
    const snapshot = await get(usersRef);

    if (!snapshot.exists()) {
      return { success: true, users: [] };
    }

    const usersData = snapshot.val();
    const users = Object.entries(usersData).map(([key, data]: [string, any]) => ({
      key,
      username: data.name || key,
      email: data.email || 'Email yok',
      level: data.level || 1,
      avatar: data.avatarKey || 'Boy_1',
      isPremium: data.isPremium || false,
      isAdmin: data.isAdmin || false,
      score: data.score || 0,
      birthYear: data.birthYear || 2010,
      ...data
    }));

    console.log(`✅ Retrieved ${users.length} users`);
    return { success: true, users };
  } catch (error) {
    console.error('Get all users error:', error);
    return { success: false, error: 'Failed to get users' };
  }
};

// Update user data function
export const updateUserData = async (username: string, updates: any): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    // First try with the exact key provided
    let userRef = ref(database, getDatabasePath(username));
    let snapshot = await get(userRef);

    // If not found, try with the cleaned version (backward compatibility)
    if (!snapshot.exists()) {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
      userRef = ref(database, getDatabasePath(cleanUsername));
      snapshot = await get(userRef);
    }

    if (!snapshot.exists()) {
      return { success: false, message: 'User not found', error: 'User not found' };
    }

    const userData = snapshot.val();
    const updatedData = { ...userData, ...updates, lastUpdated: Date.now() };

    await set(userRef, updatedData);

    console.log(`✅ User data updated: ${username}`);
    return { success: true, message: `User '${username}' updated successfully` };
  } catch (error) {
    console.error('Update user data error:', error);
    return { success: false, message: 'Failed to update user data', error: 'Failed to update user data' };
  }
};

// Delete user function
export const deleteUser = async (userKey: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    // getDatabasePath ensures we use 'test_users' or 'users' correctly
    const userRef = ref(database, getDatabasePath(userKey));
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return { success: false, message: 'User not found', error: 'User not found' };
    }

    await remove(userRef);

    console.log(`✅ User deleted: ${userKey}`);
    return { success: true, message: `User '${userKey}' deleted successfully` };
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, message: 'Failed to delete user', error: (error as Error).message };
  }
};

// User senkronizasyon durumunu check et
export const checkUserSyncStatus = async (): Promise<{
  success: boolean;
  authUsers: any[];
  dbUsers: any[];
  orphans: any[];
  duplicates: any[];
  syncNeeded: boolean;
}> => {
  try {
    console.log('🔍 User senkronizasyon durumu check ediliyor...');

    // Realtime Database userları
    const dbUsersRef = ref(database, getDatabasePath('').replace(/\/$/, ''));
    const dbSnapshot = await get(dbUsersRef);
    const dbUsers = dbSnapshot.exists() ? Object.entries(dbSnapshot.val() || {}).map(([key, data]: [string, any]) => ({
      key,
      name: data.name || key,
      email: data.email || `${key}@playlearnkids.com`,
      userId: data.userId,
      dataCount: Object.keys(data).length
    })) : [];

    console.log(`📊 Database'de ${dbUsers.length} user bulundu`);

    // Authentication userları
    const authUsers = dbUsers.map((dbUser: any) => ({
      uid: dbUser.userId || dbUser.key,
      email: dbUser.email || '',
      displayName: dbUser.name || '',
      createdAt: Date.now()
    }));

    // Orphan userları tespit et
    const orphans = dbUsers.filter(dbUser =>
      !authUsers.some(authUser => authUser.uid === dbUser.userId)
    );

    // Duplicate email'leri tespit et
    const emailGroups: { [email: string]: any[] } = {};
    dbUsers.forEach((user: any) => {
      const email = user.email.toLowerCase();
      if (!emailGroups[email]) emailGroups[email] = [];
      emailGroups[email].push(user);
    });

    const duplicates = Object.entries(emailGroups)
      .filter(([_, users]) => users.length > 1)
      .map(([email, users]) => ({ email, users }));

    const syncNeeded = orphans.length > 0 || duplicates.length > 0;

    return {
      success: true,
      authUsers,
      dbUsers,
      orphans,
      duplicates,
      syncNeeded
    };

  } catch (error) {
    console.error('❌ Senkronizasyon durumu check error:', error);
    return {
      success: false,
      authUsers: [],
      dbUsers: [],
      orphans: [],
      duplicates: [],
      syncNeeded: false
    };
  }
};

// Duplicate userları temizle
export const cleanupDuplicateUsers = async (): Promise<{
  success: boolean;
  cleanedCount: number;
  error?: string;
}> => {
  try {
    console.log('🧹 Duplicate user temizleme başlatılıyor...');

    const allUsersRef = ref(database, getDatabasePath('').replace(/\/$/, ''));
    const allUsersSnapshot = await get(allUsersRef);

    if (!allUsersSnapshot.exists()) {
      console.log('📊 Firebase\'de user not found');
      return { success: true, cleanedCount: 0 };
    }

    const allUsers = allUsersSnapshot.val();
    const userKeys = Object.keys(allUsers);
    console.log(`📋 Toplam ${userKeys.length} user check ediliyor...`);

    // Case-insensitive gruplama
    const userGroups: { [key: string]: string[] } = {};

    userKeys.forEach(key => {
      const userName = allUsers[key].name || key;
      const normalizedName = userName.toLowerCase();

      if (!userGroups[normalizedName]) {
        userGroups[normalizedName] = [];
      }
      userGroups[normalizedName].push(key);
    });

    // Duplicate grupları bul
    const duplicateGroups = Object.entries(userGroups).filter(([_, keys]) => keys.length > 1);

    if (duplicateGroups.length === 0) {
      console.log('✅ Duplicate user not found');
      return { success: true, cleanedCount: 0 };
    }

    let cleanedCount = 0;

    for (const [normalizedName, duplicateKeys] of duplicateGroups) {
      // Ana user'ı belirle (en çok data olan)
      let mainUserKey = duplicateKeys[0];
      let maxDataCount = 0;
      let mainUserData = null;

      duplicateKeys.forEach(key => {
        const userData = allUsers[key];
        const dataCount = Object.keys(userData).length;
        if (dataCount > maxDataCount) {
          maxDataCount = dataCount;
          mainUserKey = key;
          mainUserData = userData;
        }
      });

      // Diğer duplicate userları sil
      for (const duplicateKey of duplicateKeys) {
        if (duplicateKey !== mainUserKey) {
          await remove(ref(database, getDatabasePath(duplicateKey)));
          cleanedCount++;
        }
      }

      // Ana user'ın datalerini güncelle
      if (mainUserData && typeof mainUserData === 'object') {
        const updatedData = {
          ...(mainUserData as Record<string, any>),
          name: normalizedName,
          lastUpdated: Date.now(),
          duplicateCleaned: true
        };

        await set(ref(database, getDatabasePath(mainUserKey)), updatedData);
      }
    }

    console.log(`✅ Duplicate temizleme completed: ${cleanedCount} user deleted`);
    return { success: true, cleanedCount };

  } catch (error) {
    console.error('❌ Duplicate temizleme error:', error);
    return { success: false, cleanedCount: 0, error: (error as Error).message };
  }
};

// Otomatik user senkronizasyonu
export const autoSyncUsers = async (): Promise<{
  success: boolean;
  syncedCount: number;
  cleanedCount: number;
  errors: string[];
}> => {
  try {
    console.log('🔄 Otomatik user senkronizasyonu başlatılıyor...');

    const syncStatus = await checkUserSyncStatus();
    if (!syncStatus.success) {
      throw new Error('Senkronizasyon durumu check edilemedi');
    }

    let syncedCount = 0;
    let cleanedCount = 0;
    const errors: string[] = [];

    // Orphan userları temizle
    for (const orphan of syncStatus.orphans) {
      try {
        await remove(ref(database, getDatabasePath(orphan.key)));
        cleanedCount++;
      } catch (error) {
        const errorMsg = `Orphan silme error: ${orphan.key}`;
        errors.push(errorMsg);
      }
    }

    // Duplicate email'leri düzelt
    for (const duplicate of syncStatus.duplicates) {
      try {
        // Ana user'ı belirle
        const mainUser = duplicate.users.reduce((prev: any, current: any) =>
          prev.dataCount > current.dataCount ? prev : current
        );

        // Diğerlerini sil
        for (const user of duplicate.users) {
          if (user.key !== mainUser.key) {
            await remove(ref(database, getDatabasePath(user.key)));
            cleanedCount++;
          }
        }

        // Ana user'ın email'ini düzelt
        const mainUserRef = ref(database, getDatabasePath(mainUser.key));
        const mainUserData = (await get(mainUserRef)).val();
        await set(mainUserRef, {
          ...mainUserData,
          email: `${mainUser.name}${Date.now()}@playlearnkids.com`,
          lastUpdated: Date.now(),
          duplicateFixed: true
        });

        syncedCount++;
      } catch (error) {
        const errorMsg = `Duplicate düzeltme error: ${duplicate.email}`;
        errors.push(errorMsg);
      }
    }

    return {
      success: true,
      syncedCount,
      cleanedCount,
      errors
    };

  } catch (error) {
    console.error('❌ Otomatik senkronizasyon error:', error);
    return {
      success: false,
      syncedCount: 0,
      cleanedCount: 0,
      errors: [(error as Error).message]
    };
  }
};

// Manuel admin check'i
export const adminUserManagement = async (action: 'check' | 'sync' | 'cleanup'): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log(`👑 Admin işlemi başlatılıyor: ${action}`);

    switch (action) {
      case 'check':
        const syncStatus = await checkUserSyncStatus();
        return {
          success: true,
          message: `Senkronizasyon durumu check edildi`,
          details: syncStatus
        };

      case 'sync':
        const syncResult = await autoSyncUsers();
        return {
          success: syncResult.success,
          message: `Senkronizasyon completed: ${syncResult.syncedCount} user, ${syncResult.cleanedCount} temizlendi`,
          details: syncResult
        };

      case 'cleanup':
        const cleanupResult = await cleanupDuplicateUsers();
        return {
          success: cleanupResult.success,
          message: `Temizlik completed: ${cleanupResult.cleanedCount} user deleted`,
          details: cleanupResult
        };

      default:
        return {
          success: false,
          message: 'Geçersiz admin işlemi'
        };
    }

  } catch (error) {
    console.error('❌ Admin işlemi error:', error);
    return {
      success: false,
      message: `Admin işlemi failed: ${(error as Error).message}`
    };
  }
};

// Admin upgrade to premium
export const adminUpgradeToPremium = async (username: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    const updates = {
      isPremium: true,
      premiumUpgradedAt: Date.now(),
      lastUpdated: Date.now()
    };

    const result = await updateUserData(username, updates);

    if (result.success) {
      return {
        success: true,
        message: `User '${username}' successfully upgraded to premium! 👑`
      };
    } else {
      return {
        success: false,
        message: `Failed to upgrade user to premium: ${result.message}`,
        error: result.error
      };
    }

  } catch (error) {
    return {
      success: false,
      message: `Failed to upgrade user to premium: ${(error as Error).message}`,
      error: (error as Error).message
    };
  }
};

// Admin downgrade from premium
export const adminDowngradeFromPremium = async (username: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> => {
  try {
    const updates = {
      isPremium: false,
      premiumDowngradedAt: Date.now(),
      lastUpdated: Date.now()
    };

    const result = await updateUserData(username, updates);

    if (result.success) {
      return {
        success: true,
        message: `User '${username}' successfully downgraded from premium`
      };
    } else {
      return {
        success: false,
        message: `Failed to downgrade user from premium: ${result.message}`,
        error: result.error
      };
    }

  } catch (error) {
    return {
      success: false,
      message: `Failed to downgrade user from premium: ${(error as Error).message}`,
      error: (error as Error).message
    };
  }
};

// ADMIN MANAGEMENT FUNCTIONS
// Create new admin
export const createAdmin = async (email: string, name: string): Promise<{
  success: boolean;
  message: string;
  admin?: Admin;
  error?: string;
}> => {
  try {
    const adminKey = email.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    const adminRef = ref(database, `admins/${adminKey}`);

    // Check if admin already exists
    const snapshot = await get(adminRef);
    if (snapshot.exists()) {
      return {
        success: false,
        message: 'Admin already exists',
        error: 'Admin already exists'
      };
    }

    const adminData: Admin = {
      key: adminKey,
      name,
      email,
      isActive: true,
      createdAt: Date.now()
    };

    await set(adminRef, adminData);

    return {
      success: true,
      message: `Admin '${name}' created successfully`,
      admin: adminData
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create admin: ${(error as Error).message}`,
      error: (error as Error).message
    };
  }
};

// Get admin by email/name
export const getAdmin = async (identifier: string): Promise<{
  success: boolean;
  admin?: Admin;
  error?: string;
}> => {
  try {
    // Try by key first
    let adminKey = identifier.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    if (identifier.includes('@')) {
      adminKey = identifier.split('@')[0].toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    }

    const adminRef = ref(database, `admins/${adminKey}`);
    const snapshot = await get(adminRef);

    if (snapshot.exists()) {
      return {
        success: true,
        admin: snapshot.val()
      };
    }

    // If not found by key, search all admins
    const adminsRef = ref(database, 'admins');
    const allAdminsSnapshot = await get(adminsRef);

    if (allAdminsSnapshot.exists()) {
      const admins = allAdminsSnapshot.val();
      const foundAdmin = Object.values(admins).find((admin: any) =>
        admin.email === identifier || admin.name === identifier
      );

      if (foundAdmin) {
        return {
          success: true,
          admin: foundAdmin as Admin
        };
      }
    }

    return {
      success: false,
      error: 'Admin not found'
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

// Update admin last login
export const updateAdminLastLogin = async (adminKey: string): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    const adminRef = ref(database, `admins/${adminKey}`);
    const snapshot = await get(adminRef);

    if (snapshot.exists()) {
      const adminData = snapshot.val();
      await set(adminRef, {
        ...adminData,
        lastLogin: Date.now()
      });

      return {
        success: true,
        message: 'Admin last login updated'
      };
    }

    return {
      success: false,
      message: 'Admin not found'
    };
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message
    };
  }
};
