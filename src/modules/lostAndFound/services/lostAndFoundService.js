import { ref, set, update, remove, onValue, query, orderByChild, equalTo, get } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../firebaseConfig';

/**
 * إضافة عنصر معثور عليه جديد (بواسطة المرافقة/الإدارة)
 * @param {string} schoolId - معرف المدرسة
 * @param {object} itemData - بيانات العنصر المعثور عليه
 * @param {string} itemData.itemName - اسم العنصر
 * @param {string} itemData.itemDescription - وصف العنصر
 * @param {string} itemData.busId - معرف السائق (username) للباص الذي وجد فيه العنصر
 * @param {string} itemData.foundBy - اسم المستخدم للمرافقة التي وجدت العنصر
 * @param {string} itemData.foundByName - الاسم الكامل للمرافقة
 * @param {string} itemImageURL - رابط الصورة (يتم رفعها بشكل منفصل)
 * @returns {Promise<string>} معرف العنصر المضاف
 */
export const addFoundItem = async (schoolId, itemData, itemImageURL = null) => {
  try {
    const lostItemId = `found_${Date.now()}`;
    const itemRef = ref(db, `schools/${schoolId}/lostAndFound/${lostItemId}`);

    const itemToSave = {
      schoolId,
      type: 'found',
      itemName: itemData.itemName,
      itemDescription: itemData.itemDescription,
      busId: itemData.busId,
      foundBy: itemData.foundBy,
      foundByName: itemData.foundByName,
      itemImageURL: itemImageURL || '',
      foundAt: new Date().toISOString(),
      status: 'active', // 'active' (found, waiting to be claimed) or 'resolved' (returned)
      claimedByParentUsername: null,
      claimedByParentName: null,
      claimedAt: null,
      returnedToParentUsername: null,
      returnedAt: null,
      returnConfirmedByStaff: false,
      returnConfirmedByParent: false,
    };

    await set(itemRef, itemToSave);
    return lostItemId;
  } catch (error) {
    console.error('Error adding found item:', error);
    throw error;
  }
};

/**
 * تبليغ ولي أمر عن عنصر مفقود
 * @param {string} schoolId - معرف المدرسة
 * @param {object} itemData - بيانات العنصر المفقود
 * @param {string} itemData.itemName - اسم العنصر
 * @param {string} itemData.itemDescription - وصف العنصر
 * @param {string} itemData.reportedByParentUsername - اسم المستخدم لولي الأمر المبلغ
 * @param {string} itemData.reportedByParentName - الاسم الكامل لولي الأمر المبلغ
 * @param {string} itemData.studentId - معرف الطالب الذي فقد العنصر
 * @param {string} itemData.studentName - اسم الطالب الذي فقد العنصر
 * @param {string} itemData.busId - معرف السائق (username) للباص الذي يركبه الطالب
 * @param {string} itemImageURL - رابط الصورة (يتم رفعها بشكل منفصل)
 * @returns {Promise<string>} معرف العنصر المضاف
 */
export const reportLostItem = async (schoolId, itemData, itemImageURL = null) => {
  try {
    const lostItemId = `lost_${Date.now()}`;
    const itemRef = ref(db, `schools/${schoolId}/lostAndFound/${lostItemId}`);

    const itemToSave = {
      schoolId,
      type: 'lost',
      itemName: itemData.itemName,
      itemDescription: itemData.itemDescription,
      itemImageURL: itemImageURL || '',
      reportedByParentUsername: itemData.reportedByParentUsername,
      reportedByParentName: itemData.reportedByParentName,
      reportedAt: new Date().toISOString(),
      studentId: itemData.studentId,
      studentName: itemData.studentName,
      busId: itemData.busId, // Bus ID of the student who lost the item
      status: 'active', // 'active' (lost, waiting to be found) or 'resolved' (found and returned)
      foundByStaffAfterLostReport: null,
      returnedToParentUsername: null,
      returnedAt: null,
      returnConfirmedByStaff: false,
      returnConfirmedByParent: false,
    };

    await set(itemRef, itemToSave);
    return lostItemId;
  } catch (error) {
    console.error('Error reporting lost item:', error);
    throw error;
  }
};

/**
 * رفع صورة العنصر المفقود إلى Firebase Storage
 * @param {string} schoolId - معرف المدرسة
 * @param {string} lostItemId - معرف العنصر المفقود
 * @param {object} imageData - بيانات الصورة (uri, type, name)
 * @returns {Promise<string>} رابط الصورة المرفوعة
 */
export const uploadLostItemImage = async (schoolId, lostItemId, imageData) => {
  try {
    const imagePath = `schools/${schoolId}/lostAndFound/${lostItemId}/image`;
    const imageRef = storageRef(storage, imagePath);

    // تحويل الصورة إلى blob
    const response = await fetch(imageData.uri);
    const blob = await response.blob();

    // رفع الصورة
    await uploadBytes(imageRef, blob);

    // الحصول على رابط الصورة
    const downloadURL = await getDownloadURL(imageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading lost item image:', error);
    throw error;
  }
};

/**
 * الحصول على جميع العناصر المفقودة والمعثور عليها لمدرسة معينة
 * @param {string} schoolId - معرف المدرسة
 * @param {function} callback - دالة callback لتحديث البيانات
 * @returns {function} دالة إلغاء الاشتراك
 */
export const subscribeLostAndFoundItems = (schoolId, callback) => {
  try {
    const lostItemsRef = ref(db, `schools/${schoolId}/lostAndFound`);
    
    const unsubscribe = onValue(lostItemsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const itemsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        }));
        callback(itemsArray);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Error subscribing to lost and found items:', error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error in subscribeLostAndFoundItems:', error);
    return () => {};
  }
};

/**
 * الحصول على العناصر المعثور عليها لباص معين (للأهل للمطالبة)
 * @param {string} schoolId - معرف المدرسة
 * @param {string} busId - معرف السائق (username)
 * @param {function} callback - دالة callback لتحديث البيانات
 * @returns {function} دالة إلغاء الاشتراك
 */
export const subscribeFoundItemsForParent = (schoolId, busId, callback) => {
  try {
    const lostItemsRef = ref(db, `schools/${schoolId}/lostAndFound`);
    
    const unsubscribe = onValue(lostItemsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const itemsArray = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key],
          }))
          .filter(item => item.busId === busId && item.type === 'found' && item.status === 'active');
        callback(itemsArray);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Error subscribing to found items for parent:', error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error in subscribeFoundItemsForParent:', error);
    return () => {};
  }
};

/**
 * الحصول على العناصر المفقودة المبلغ عنها من ولي أمر معين
 * @param {string} schoolId - معرف المدرسة
 * @param {string} parentUsername - اسم المستخدم لولي الأمر
 * @param {function} callback - دالة callback لتحديث البيانات
 * @returns {function} دالة إلغاء الاشتراك
 */
export const subscribeLostItemsByParent = (schoolId, parentUsername, callback) => {
  try {
    const lostItemsRef = ref(db, `schools/${schoolId}/lostAndFound`);
    
    const unsubscribe = onValue(lostItemsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const itemsArray = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key],
          }))
          .filter(item => item.reportedByParentUsername === parentUsername && item.type === 'lost');
        callback(itemsArray);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Error subscribing to lost items by parent:', error);
      callback([]);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error in subscribeLostItemsByParent:', error);
    return () => {};
  }
};

/**
 * المطالبة بعنصر معثور عليه (من ولي الأمر)
 * @param {string} schoolId - معرف المدرسة
 * @param {string} lostItemId - معرف العنصر المفقود
 * @param {string} parentUsername - اسم المستخدم لولي الأمر
 * @param {string} parentName - الاسم الكامل لولي الأمر
 * @returns {Promise<void>}
 */
export const claimFoundItem = async (schoolId, lostItemId, parentUsername, parentName) => {
  try {
    const itemRef = ref(db, `schools/${schoolId}/lostAndFound/${lostItemId}`);
    
    await update(itemRef, {
      claimedByParentUsername: parentUsername,
      claimedByParentName: parentName,
      claimedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error claiming found item:', error);
    throw error;
  }
};

/**
 * تحديث حالة العنصر إلى "تم الحل" (من المرافقة/الإدارة)
 * @param {string} schoolId - معرف المدرسة
 * @param {string} lostItemId - معرف العنصر المفقود
 * @param {string} staffUsername - اسم المستخدم للمرافقة/الإدارة التي قامت بالتسليم
 * @param {string} returnedToParentUsername - اسم المستخدم لولي الأمر الذي استلم العنصر (إذا كان معروفاً)
 * @returns {Promise<void>}
 */
export const resolveLostAndFoundItem = async (schoolId, lostItemId, staffUsername, returnedToParentUsername = null) => {
  try {
    const itemRef = ref(db, `schools/${schoolId}/lostAndFound/${lostItemId}`);
    
    const itemSnapshot = await get(itemRef);
    const itemData = itemSnapshot.val();

    const updates = {
      status: 'resolved',
      returnedAt: new Date().toISOString(),
      returnConfirmedByStaff: true,
    };

    if (itemData.type === 'lost') {
      updates.foundByStaffAfterLostReport = staffUsername;
      updates.returnedToParentUsername = itemData.reportedByParentUsername; // Automatically set for lost reports
    } else if (itemData.type === 'found') {
      updates.returnedToParentUsername = returnedToParentUsername || itemData.claimedByParentUsername;
    }

    await update(itemRef, updates);
  } catch (error) {
    console.error('Error resolving lost and found item:', error);
    throw error;
  }
};

/**
 * تأكيد ولي الأمر على استلام العنصر
 * @param {string} schoolId - معرف المدرسة
 * @param {string} lostItemId - معرف العنصر المفقود
 * @returns {Promise<void>}
 */
export const confirmParentReceipt = async (schoolId, lostItemId) => {
  try {
    const itemRef = ref(db, `schools/${schoolId}/lostAndFound/${lostItemId}`);
    
    await update(itemRef, {
      returnConfirmedByParent: true,
    });
  } catch (error) {
    console.error('Error confirming parent receipt:', error);
    throw error;
  }
};

/**
 * حذف عنصر مفقود/معثور عليه (من الإدارة)
 * @param {string} schoolId - معرف المدرسة
 * @param {string} lostItemId - معرف العنصر
 * @returns {Promise<void>}
 */
export const deleteLostAndFoundItem = async (schoolId, lostItemId) => {
  try {
    const itemRef = ref(db, `schools/${schoolId}/lostAndFound/${lostItemId}`);
    await remove(itemRef);
  } catch (error) {
    console.error('Error deleting lost and found item:', error);
    throw error;
  }
};

/**
 * الحصول على عنصر مفقود/معثور عليه محدد
 * @param {string} schoolId - معرف المدرسة
 * @param {string} lostItemId - معرف العنصر
 * @returns {Promise<object>} بيانات العنصر
 */
export const getLostAndFoundItem = async (schoolId, lostItemId) => {
  try {
    const itemRef = ref(db, `schools/${schoolId}/lostAndFound/${lostItemId}`);
    const snapshot = await get(itemRef);
    
    if (snapshot.exists()) {
      return {
        id: lostItemId,
        ...snapshot.val(),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting lost and found item:', error);
    throw error;
  }
};

/**
 * الحصول على إحصائيات المفقودات والمعثور عليها
 * @param {string} schoolId - معرف المدرسة
 * @returns {Promise<object>} إحصائيات المفقودات والمعثور عليها
 */
export const getLostAndFoundStats = async (schoolId) => {
  try {
    const lostItemsRef = ref(db, `schools/${schoolId}/lostAndFound`);
    const snapshot = await get(lostItemsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const items = Object.values(data);
      
      return {
        total: items.length,
        active: items.filter(item => item.status === 'active').length,
        resolved: items.filter(item => item.status === 'resolved').length,
        foundItems: items.filter(item => item.type === 'found').length,
        lostReports: items.filter(item => item.type === 'lost').length,
      };
    }
    
    return {
      total: 0,
      active: 0,
      resolved: 0,
      foundItems: 0,
      lostReports: 0,
    };
  } catch (error) {
    console.error('Error getting lost and found stats:', error);
    throw error;
  }
};

/**
 * البحث عن عناصر مفقودة/معثور عليها حسب الكلمات المفتاحية
 * @param {string} schoolId - معرف المدرسة
 * @param {string} searchQuery - كلمة البحث
 * @returns {Promise<array>} نتائج البحث
 */
export const searchLostAndFoundItems = async (schoolId, searchQuery) => {
  try {
    const lostItemsRef = ref(db, `schools/${schoolId}/lostAndFound`);
    const snapshot = await get(lostItemsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const itemsArray = Object.keys(data)
        .map(key => ({
          id: key,
          ...data[key],
        }))
        .filter(item => 
          item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.itemDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.foundByName && item.foundByName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.reportedByParentName && item.reportedByParentName.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      return itemsArray;
    }
    
    return [];
  } catch (error) {
    console.error('Error searching lost and found items:', error);
    throw error;
  }
};
