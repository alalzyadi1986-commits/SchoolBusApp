import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import XLSX from 'xlsx';

/**
 * خدمة تصدير التقارير المتقدمة للمدرسة
 */

// دالة مساعدة لتنسيق التاريخ والوقت بشكل مقروء
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

    // تجهيز البيانات وترجمة الرؤوس
    const formattedData = data.map(item => {
      const newItem = {};
      Object.keys(item).forEach(key => {
        if (!['id', 'schoolId', 'permissions', 'password', 'fcmToken', 'profileImage'].includes(key)) {
          newItem[translateHeader(key)] = item[key] || '-';
        }
      });
      return newItem;
    });

    // إنشاء كتاب عمل Excel باستخدام مصفوفة من المصفوفات (AOA) لتنسيق الترويسة
    const wb = XLSX.utils.book_new();
    
    // الترويسة العلوية
    const headerInfo = [
      [`المدرسة: ${schoolName}`],
      [`نوع التقرير: ${type}`],
      [`بواسطة: ${userName}`],
      [`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`],
      [], // سطر فارغ
    ];

    const ws = XLSX.utils.aoa_to_sheet(headerInfo);
    
    // إضافة بيانات الجدول بعد الترويسة
    XLSX.utils.sheet_add_json(ws, formattedData, { origin: 'A6', skipHeader: false });

    XLSX.utils.book_append_sheet(wb, ws, "Report");

    // إنشاء اسم ملف احترافي ومنسق
    const safeSchoolName = schoolName.replace(/[<>:"/\\|?*]/g, '');
    const fileName = `${safeSchoolName} - ${type} - ${userName} - ${getFormattedDateTime()}.xlsx`;
    
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const uri = FileSystem.cacheDirectory + fileName;

    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: FileSystem.EncodingType.Base64
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `تصدير ${type}`,
        UTI: 'com.microsoft.excel.xlsx'
      });
    } else {
      Alert.alert("خطأ", "المشاركة غير متاحة على هذا الجهاز.");
    }
  } catch (error) {
    console.error("Excel Export Error:", error);
    Alert.alert("خطأ", "حدث خطأ أثناء تصدير ملف Excel.");
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

    // إنشاء اسم ملف احترافي
    const safeSchoolName = schoolName.replace(/[<>:"/\\|?*]/g, '');
    const fileName = `${safeSchoolName} - ${type} - ${userName} - ${getFormattedDateTime()}.pdf`;
    
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    // نقل الملف ليكون بالاسم الصحيح قبل المشاركة لضمان ظهور الاسم في الواتساب وغيره
    const newUri = FileSystem.cacheDirectory + fileName;
    await FileSystem.moveAsync({ from: uri, to: newUri });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(newUri, {
        mimeType: 'application/pdf',
        dialogTitle: `تصدير ${type}`,
        UTI: 'com.adobe.pdf'
      });
    } else {
      Alert.alert("خطأ", "المشاركة غير متاحة على هذا الجهاز.");
    }
  } catch (error) {
    console.error("PDF Export Error:", error);
    Alert.alert("خطأ", "حدث خطأ أثناء تصدير ملف PDF.");
  }
};
