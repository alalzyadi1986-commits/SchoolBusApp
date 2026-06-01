import * as Notifications from 'expo-notifications';
import { ref, set } from 'firebase/database';
import { db } from '../../../firebaseConfig';

/**
 * خدمة الإشعارات الموحدة لميزة المفقودات والمعثورات
 * تتولى إرسال الإشعارات لجميع الأطراف المعنية
 */

/**
 * إرسال إشعار عند إضافة عنصر معثور عليه جديد
 * @param {string} schoolId - معرف المدرسة
 * @param {string} busId - معرف الباص (username السائق)
 * @param {object} item - بيانات العنصر المعثور عليه
 * @param {array} parentTokens - قائمة رموز الإشعارات للأهل المرتبطين بهذا الباص
 */
export const notifyParentsOfFoundItem = async (schoolId, busId, item, parentTokens = []) => {
  try {
    const notification = {
      title: '✨ عنصر معثور عليه!',
      body: `تم العثور على ${item.itemName} في باص ابنك. تحقق من التطبيق الآن!`,
      data: {
        type: 'found_item',
        itemId: item.id,
        busId: busId,
        schoolId: schoolId
      }
    };

    // إرسال الإشعار للأهل
    if (parentTokens && parentTokens.length > 0) {
      for (const token of parentTokens) {
        await sendPushNotification(token, notification);
      }
    }

    // حفظ الإشعار في Firebase للمتابعة
    await logNotification(schoolId, 'found_item', item.id, `عنصر معثور عليه: ${item.itemName}`, parentTokens.length);
  } catch (error) {
    console.error('Error notifying parents of found item:', error);
  }
};

/**
 * إرسال إشعار عند تبليغ ولي أمر عن عنصر مفقود
 * @param {string} schoolId - معرف المدرسة
 * @param {object} item - بيانات العنصر المفقود المبلغ عنه
 * @param {string} staffToken - رمز الإشعار للمرافقة
 * @param {string} driverToken - رمز الإشعار للسائق
 */
export const notifyStaffAndDriverOfLostReport = async (schoolId, item, staffToken, driverToken) => {
  try {
    const notification = {
      title: '🚨 تبليغ عن مفقود!',
      body: `${item.reportedByParentName} أبلغ عن فقدان ${item.itemName} في باص ${item.studentName}. يرجى البحث عنه.`,
      data: {
        type: 'lost_report',
        itemId: item.id,
        studentName: item.studentName,
        schoolId: schoolId
      }
    };

    // إرسال الإشعار للمرافقة
    if (staffToken) {
      await sendPushNotification(staffToken, notification);
    }

    // إرسال الإشعار للسائق
    if (driverToken) {
      await sendPushNotification(driverToken, notification);
    }

    // حفظ الإشعار في Firebase
    await logNotification(schoolId, 'lost_report', item.id, `تبليغ عن مفقود: ${item.itemName}`, 2);
  } catch (error) {
    console.error('Error notifying staff and driver of lost report:', error);
  }
};

/**
 * إرسال إشعار عند مطالبة ولي أمر بعنصر معثور عليه
 * @param {string} schoolId - معرف المدرسة
 * @param {object} item - بيانات العنصر
 * @param {string} staffToken - رمز الإشعار للمرافقة
 * @param {string} driverToken - رمز الإشعار للسائق
 */
export const notifyStaffAndDriverOfClaim = async (schoolId, item, staffToken, driverToken) => {
  try {
    const notification = {
      title: '✋ مطالبة بعنصر معثور عليه',
      body: `${item.claimedByParentName} يطالب بـ "${item.itemName}". يرجى التنسيق معه لتسليمه.`,
      data: {
        type: 'item_claimed',
        itemId: item.id,
        parentName: item.claimedByParentName,
        schoolId: schoolId
      }
    };

    if (staffToken) await sendPushNotification(staffToken, notification);
    if (driverToken) await sendPushNotification(driverToken, notification);

    await logNotification(schoolId, 'item_claimed', item.id, `مطالبة بـ: ${item.itemName}`, 2);
  } catch (error) {
    console.error('Error notifying of item claim:', error);
  }
};

/**
 * إرسال إشعار عند حل موضوع المفقود/المعثور عليه
 * @param {string} schoolId - معرف المدرسة
 * @param {object} item - بيانات العنصر
 * @param {string} parentToken - رمز الإشعار لولي الأمر
 */
export const notifyParentOfItemResolved = async (schoolId, item, parentToken) => {
  try {
    const notification = {
      title: '✅ تم حل الموضوع',
      body: `تم تسليم "${item.itemName}" بنجاح. شكراً لاستخدام لوحة المفقودات الذكية.`,
      data: {
        type: 'item_resolved',
        itemId: item.id,
        schoolId: schoolId
      }
    };

    if (parentToken) {
      await sendPushNotification(parentToken, notification);
    }

    await logNotification(schoolId, 'item_resolved', item.id, `تم حل: ${item.itemName}`, 1);
  } catch (error) {
    console.error('Error notifying parent of item resolution:', error);
  }
};

/**
 * إرسال إشعار فوري عبر Expo Notifications
 * @param {string} token - رمز الإشعار
 * @param {object} notification - بيانات الإشعار
 */
export const sendPushNotification = async (token, notification) => {
  try {
    if (!token) return;

    await Notifications.scheduleNotificationAsync({
      trigger: null, // إرسال فوري
      content: {
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: 'default',
        badge: 1,
        priority: 'high'
      }
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

/**
 * تسجيل الإشعار في Firebase للمتابعة والإحصائيات
 * @param {string} schoolId - معرف المدرسة
 * @param {string} type - نوع الإشعار
 * @param {string} itemId - معرف العنصر
 * @param {string} message - نص الإشعار
 * @param {number} recipientCount - عدد المستقبلين
 */
export const logNotification = async (schoolId, type, itemId, message, recipientCount = 1) => {
  try {
    const notificationRef = ref(db, `schools/${schoolId}/notifications/${Date.now()}`);
    await set(notificationRef, {
      type: type,
      itemId: itemId,
      message: message,
      recipientCount: recipientCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging notification:', error);
  }
};
