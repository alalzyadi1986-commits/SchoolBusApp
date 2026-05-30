import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import XLSX from 'xlsx';

/**
 * خدمة تصدير التقارير للمدرسة
 */

// تصدير إلى Excel (بصيغة CSV لضمان التوافق وسهولة الفتح)
export const exportToExcel = async (data, fileName) => {
  try {
    if (!data || data.length === 0) return;

    // تجهيز البيانات: إزالة المعرفات التقنية وتنظيف الأسماء
    const cleanData = data.map(({ id, schoolId, permissions, ...rest }) => rest);

    // إنشاء كتاب عمل Excel
    const ws = XLSX.utils.json_to_sheet(cleanData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    // تحويل إلى Base64
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const uri = FileSystem.cacheDirectory + `${fileName}.xlsx`;

    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: FileSystem.EncodingType.Base64
    });

    await Sharing.shareAsync(uri);
  } catch (error) {
    console.error("Excel Export Error:", error);
    throw error;
  }
};

// تصدير إلى PDF (بصيغة جدول منظم)
export const exportToPDF = async (data, title, schoolName) => {
  try {
    if (!data || data.length === 0) return;

    // بناء محتوى HTML للجدول
    const headers = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'schoolId' && k !== 'permissions');
    
    const tableRows = data.map(item => `
      <tr>
        ${headers.map(h => `<td>${item[h] || '-'}</td>`).reverse().join('')}
      </tr>
    `).join('');

    const htmlContent = `
      <html dir="rtl">
        <head>
          <style>
            body { font-family: 'Helvetica'; padding: 20px; }
            h1 { text-align: center; color: #1E293B; }
            h3 { text-align: center; color: #64748B; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #CBD5E1; padding: 10px; text-align: right; }
            th { backgroundColor: #F1F5F9; color: #1E293B; }
          </style>
        </head>
        <body>
          <h1>${schoolName}</h1>
          <h3>تقرير: ${title}</h3>
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).reverse().join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <p style="margin-top: 30px; font-size: 12px; color: #94A3B8; text-align: center;">تم التوليد بواسطة نظام حافلة المدرسة الذكي</p>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri);
  } catch (error) {
    console.error("PDF Export Error:", error);
    throw error;
  }
};
