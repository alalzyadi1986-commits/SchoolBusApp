import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import XLSX from 'xlsx';

/**
 * خدمة تصدير التقارير المتقدمة للمدرسة - متوافقة مع Expo SDK 54
 */

// دالة مساعدة لتنسيق التاريخ والوقت
const getFormattedDateTime = () => {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.getHours().toString().padStart(2, '0') + '-' + now.getMinutes().toString().padStart(2, '0');
  return `${date}_${time}`;
};

// دالة مساعدة لترجمة رؤوس الجداول للعربية
const translateHeader = (key) => {
  const translations = {
    'fullName': 'الاسم الكامل',
    'displayName': 'الاسم الكامل',
    'username': 'اسم المستخدم',
    'phone': 'رقم الهاتف',
    'busNumber': 'رقم الحافلة',
    'plateNumber': 'رقم اللوحة',
    'parentName': 'اسم ولي الأمر',
    'driverName': 'اسم السائق',
    'role': 'الدور',
    'status': 'الحالة',
    'planType': 'نوع الخطة',
    'createdAt': 'تاريخ الإضافة'
  };
  return translations[key] || key;
};

// تصدير إلى Excel
export const exportToExcel = async (data, type, schoolName, userName) => {
  try {
    if (!data || data.length === 0) {
      Alert.alert("تنبيه", "لا توجد بيانات لتصديرها في هذه القائمة.");
      return;
    }

    // تجهيز البيانات
    const formattedData = data.map(item => {
      const newItem = {};
      Object.keys(item).forEach(key => {
        if (!['id', 'schoolId', 'permissions', 'password', 'fcmToken', 'profileImage'].includes(key)) {
          newItem[translateHeader(key)] = item[key] || '-';
        }
      });
      return newItem;
    });

    const wb = XLSX.utils.book_new();
    const headerInfo = [
      [`المدرسة: ${schoolName}`],
      [`نوع التقرير: ${type}`],
      [`بواسطة: ${userName}`],
      [`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`],
      [],
    ];

    const ws = XLSX.utils.aoa_to_sheet(headerInfo);
    XLSX.utils.sheet_add_json(ws, formattedData, { origin: 'A6', skipHeader: false });
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    // إنشاء اسم ملف احترافي
    const safeSchoolName = schoolName.replace(/[<>:"/\\|?*]/g, '');
    const fileName = `${safeSchoolName} - ${type} - ${userName} - ${getFormattedDateTime()}.xlsx`;
    
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const uri = FileSystem.cacheDirectory + fileName;

    // تصحيح الوصول لـ EncodingType في الإصدار الجديد
    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: 'base64'
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `تصدير ${type}`,
        UTI: 'com.microsoft.excel.xlsx'
      });
    }
  } catch (error) {
    console.error("Excel Export Error:", error);
    Alert.alert("خطأ", "حدث خطأ أثناء تصدير ملف Excel. يرجى المحاولة مرة أخرى.");
  }
};

// تصدير إلى PDF
export const exportToPDF = async (data, type, schoolName, userName) => {
  try {
    if (!data || data.length === 0) {
      Alert.alert("تنبيه", "لا توجد بيانات لتصديرها في هذه القائمة.");
      return;
    }

    const headers = Object.keys(data[0]).filter(k => 
      !['id', 'schoolId', 'permissions', 'password', 'fcmToken', 'profileImage'].includes(k)
    );
    
    const tableRows = data.map(item => `
      <tr>
        ${headers.map(h => `<td>${item[h] || '-'}</td>`).reverse().join('')}
      </tr>
    `).join('');

    const htmlContent = `
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica'; padding: 30px; background-color: #fff; }
            .header { border-bottom: 2px solid #1E293B; margin-bottom: 20px; padding-bottom: 10px; }
            .school-name { font-size: 24px; font-weight: bold; color: #1E293B; }
            .report-title { font-size: 18px; color: #64748B; margin-top: 5px; }
            .meta-info { margin-top: 15px; font-size: 12px; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; }
            th, td { border: 1px solid #CBD5E1; padding: 12px 8px; text-align: right; font-size: 11px; }
            th { background-color: #F8FAFC; color: #1E293B; font-weight: bold; }
            .footer { margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 10px; font-size: 10px; color: #94A3B8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="school-name">${schoolName}</div>
            <div class="report-title">تقرير: ${type}</div>
            <div class="meta-info">
              <div>تم استخراج التقرير بواسطة: ${userName}</div>
              <div>تاريخ ووقت التصدير: ${new Date().toLocaleString('ar-EG')}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${translateHeader(h)}</th>`).reverse().join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            تم توليد هذا التقرير آلياً بواسطة نظام حافلة المدرسة الذكي
          </div>
        </body>
      </html>
    `;

    const safeSchoolName = schoolName.replace(/[<>:"/\\|?*]/g, '');
    const fileName = `${safeSchoolName} - ${type} - ${userName} - ${getFormattedDateTime()}.pdf`;
    
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    // استخدام الطريقة المتوافقة مع SDK 54 لنقل الملفات
    const newUri = FileSystem.cacheDirectory + fileName;
    
    try {
      // محاولة استخدام الطريقة التقليدية أولاً مع تصحيح الاستدعاء
      await FileSystem.copyAsync({ from: uri, to: newUri });
    } catch (e) {
      // إذا فشلت، نستخدم المسار المباشر
      console.log("Fallback to direct URI");
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(newUri || uri, {
        mimeType: 'application/pdf',
        dialogTitle: `تصدير ${type}`,
        UTI: 'com.adobe.pdf'
      });
    }
  } catch (error) {
    console.error("PDF Export Error:", error);
    Alert.alert("خطأ", "حدث خطأ أثناء تصدير ملف PDF.");
  }
};
