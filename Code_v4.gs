// =====================================================
// Code_v4.gs — الحسام للمحاماة   (مكتب حسام محمد ابراهيم )
// النسخة 4.0 — إنشاء جدول البيانات تلقائياً عند أول تشغيل
// =====================================================
// ⚠️ عدّل فقط السطور المُعلَّمة بـ ← هنا
// =====================================================

const LAWYER_EMAIL       = 'hossammohamedlawyer@gmail.com'; // ← بريدك الإلكتروني
const SPREADSHEET_NAME   = 'نظام الحسام للمحاماة';    // ← اسم جدول البيانات (اختياري)
const CALENDAR_NAME      = 'جلسات المحامي';
const DRIVE_FOLDER       = 'نسخ احتياطي — نظام المحامي';
const DOCS_FOLDER        = 'مستندات القضايا';
const NOTIFY_DAYS_BEFORE = 2;
const BACKUP_ENABLED     = true;
const PORTAL_SECRET_SALT = 'MADY_LAW_2025_HOSSAM'; // ← غيّر هذا لإبطال كل QR القديمة
const SCRIPT_VERSION     = '4.0';

// =====================================================
// مفتاح تخزين ID الشيت في خصائص السكريبت
// =====================================================
const PROP_SHEET_ID = 'SPREADSHEET_ID';

// =====================================================
// الحصول على ID الشيت (من الخصائص أو إنشاء جديد)
// =====================================================
function getSpreadsheetId() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_SHEET_ID);
  if (id) {
    // تحقق أن الشيت لا يزال موجوداً
    try {
      SpreadsheetApp.openById(id);
      return id;
    } catch(e) {
      Logger.log('⚠️ الشيت المحفوظ غير موجود — سيتم إنشاء جديد');
      props.deleteProperty(PROP_SHEET_ID);
    }
  }
  // إنشاء شيت جديد
  return createNewSpreadsheet();
}

// =====================================================
// إنشاء جدول البيانات الجديد
// =====================================================
function createNewSpreadsheet() {
  Logger.log('🆕 إنشاء جدول بيانات جديد...');
  const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  const id = ss.getId();

  // حفظ الـ ID في خصائص السكريبت
  PropertiesService.getScriptProperties().setProperty(PROP_SHEET_ID, id);

  // نقل الشيت إلى مجلد Drive الخاص بالنظام
  try {
    const folder = getOrCreateDriveFolder();
    DriveApp.getFileById(id).moveTo(folder);
  } catch(e) {
    Logger.log('⚠️ لم يتم نقل الشيت إلى المجلد: ' + e);
  }

  Logger.log('✅ تم إنشاء الشيت: ' + ss.getUrl());
  return id;
}

// =====================================================
// تعريف أوراق العمل والأعمدة
// =====================================================
const SHEET_DEFS = [
  {
    name: 'القضايا',
    headers: [
      'رقم_القضية','نوع_الدعوى','عنوان_القضية','المحكمة','رقم_الدعوى',
      'الحالة','تاريخ_القيد','تاريخ_الجلسة_القادمة','آخر_تحديث',
      'نوع_الموكل','اسم_الموكل','رقم_قومي_الموكل','هاتف_الموكل',
      'عنوان_الموكل','عمل_الموكل','جهة_عمل_الموكل',
      'اسم_الخصم','رقم_قومي_الخصم','هاتف_الخصم',
      'عنوان_الخصم','عمل_الخصم','جهة_عمل_الخصم',
      'تاريخ_عقد_الزواج','رقم_وثيقة_الزواج','مكتب_التوثيق',
      'وجود_قائمة_منقولات','وجود_أطفال','أطفال_القضية',
      'الطلبات_القانونية','الدفوع_القانونية','إجراءات_الدعوى',
      'قرارات_المحكمة',
      'تاريخ_الحكم','رقم_التنفيذ','إجراءات_التنفيذ','نتائج_التنفيذ',
      'أتعاب_المحاماة','المبلغ_المحصّل','ملاحظات_الأتعاب',
      'الملاحظات','تاريخ_الإنشاء'
    ],
    color: '#1a3a5c'
  },
  {
    name: 'الجلسات',
    headers: [
      'رقم_الجلسة','رقم_القضية','عنوان_القضية','نوع_الدعوى',
      'التاريخ','الوقت','المحكمة','القاضي',
      'ما_تم_في_الجلسة','القرار','التأجيل_إلى',
      'الحالة','الملاحظات','تاريخ_الإنشاء','calendar_event_id'
    ],
    color: '#1a4a3a'
  },
  {
    name: 'الموكلين',
    headers: [
      'رقم_الموكل','الاسم','النوع',
      'الرقم_القومي','رقم_التوكيل','الهاتف','البريد','العنوان',
      'الوظيفة','جهة_العمل','الحالة_الاجتماعية',
      'ملاحظات','portal_token','تاريخ_الإنشاء'
    ],
    color: '#3a1a5c'
  },
  {
    name: 'المستندات',
    headers: [
      'رقم_المستند','رقم_القضية','اسم_المستند','نوع_المستند',
      'تاريخ_الإيداع','رابط_Drive','الملاحظات','تاريخ_الإنشاء'
    ],
    color: '#3a2a1a'
  },
  {
    name: 'المهام',
    headers: [
      'رقم_المهمة','العنوان','رقم_القضية','الأولوية',
      'الموعد_النهائي','الحالة','الملاحظات','تاريخ_الإنشاء',
      'سبب_الإنجاز','تاريخ_الإنجاز','وقت_الإنجاز',
      'سبب_إعادة_الفتح','تاريخ_إعادة_الفتح','وقت_إعادة_الفتح'
    ],
    color: '#1a3a1a'
  },
  {
    name: 'الأتعاب',
    headers: [
      'رقم_العملية','رقم_القضية','اسم_الموكل','نوع_الأتعاب',
      'المبلغ','تاريخ_الاستلام','طريقة_الدفع','الملاحظات','تاريخ_الإنشاء'
    ],
    color: '#1a2a3a'
  },
  {
    name: 'المكتبة',
    headers: ['id','العنوان','النوع','القسم','الرابط','الوصف','تاريخ_الإنشاء'],
    color: '#2a1a3a'
  },
  {
    name: 'الصيغ',
    headers: ['id','العنوان','النوع','القسم','الرابط','الوصف','تاريخ_الإنشاء'],
    color: '#3a1a2a'
  }
];

// =====================================================
// مساعد: رأس الأوراق
// =====================================================
function getSheetHeaders(sheetName) {
  const def = SHEET_DEFS.find(d => d.name === sheetName);
  return def ? def.headers : null;
}

// =====================================================
// إعداد الأوراق — يُنشئ ويُحدّث الأعمدة تلقائياً
// =====================================================
function setupSheets() {
  const id = getSpreadsheetId();
  const ss = SpreadsheetApp.openById(id);

  // احذف الورقة الافتراضية "Sheet1" إن وُجدت ولم تُعدَّل
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  SHEET_DEFS.forEach(def => {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      Logger.log('🆕 إنشاء ورقة: ' + def.name);
    }

    const lastCol = sheet.getLastColumn();
    let existing  = [];

    if (lastCol > 0) {
      existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
                      .map(h => String(h).trim()).filter(Boolean);
    }

    if (existing.length === 0) {
      // ورقة جديدة — اكتب جميع الأعمدة
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      Logger.log('✅ أعمدة ' + def.name + ': ' + def.headers.length);
    } else {
      // أضف الأعمدة الناقصة فقط (للتحديث)
      const missing = def.headers.filter(h => !existing.includes(h));
      if (missing.length > 0) {
        sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
        Logger.log('✅ أعمدة جديدة في ' + def.name + ': ' + missing.join(', '));
      }
    }

    // تنسيق الرأس
    const totalCols = Math.max(def.headers.length, sheet.getLastColumn());
    if (totalCols > 0) {
      const headerRange = sheet.getRange(1, 1, 1, totalCols);
      headerRange
        .setBackground('#0D1B2A')
        .setFontColor('#C9A84C')
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setFontSize(10)
        .setWrap(false);
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, totalCols, 160);

      // تلوين التبويب
      if (def.color) sheet.setTabColor(def.color);

      // تجميد الشاشة على الصف الثاني
      sheet.setFrozenRows(1);
    }
  });

  // تعيين ورقة القضايا كأولى
  try {
    const casesSheet = ss.getSheetByName('القضايا');
    if (casesSheet) ss.setActiveSheet(casesSheet);
  } catch(e) {}

  Logger.log('✅ إعداد الأوراق اكتمل — ' + id);
  return jsonResponse({
    status: 'ok',
    message: 'تم إعداد ' + SHEET_DEFS.length + ' أوراق',
    spreadsheet_id: id,
    spreadsheet_url: ss.getUrl()
  });
}

// =====================================================
// إعداد كامل — يُشغَّل مرة واحدة من Run
// أو تلقائياً عند أول طلب
// =====================================================
function setupAll() {
  const result = setupSheets();
  setupTriggers();
  try { getOrCreateCalendar();    } catch(e) { Logger.log('⚠️ Calendar: ' + e); }
  try { getOrCreateDriveFolder(); } catch(e) { Logger.log('⚠️ Drive: ' + e); }
  try { getOrCreateDocsFolder();  } catch(e) { Logger.log('⚠️ Docs: ' + e); }

  const id  = getSpreadsheetId();
  const url = SpreadsheetApp.openById(id).getUrl();
  Logger.log('✅ الإعداد الكامل — v' + SCRIPT_VERSION);
  Logger.log('📊 رابط جدول البيانات: ' + url);

  try {
    SpreadsheetApp.getUi().alert(
      '✅ تم الإعداد بنجاح!\n\n' +
      '📊 جدول البيانات:\n' + url + '\n\n' +
      'يمكنك الآن:\nDeploy → New Deployment → Web App\n' +
      'Execute as: Me | Access: Anyone'
    );
  } catch(e) {}

  return result;
}

// =====================================================
// التحقق من الإعداد الأولي — يُستدعى تلقائياً
// =====================================================
function ensureSetup() {
  const props = PropertiesService.getScriptProperties();
  const id    = props.getProperty(PROP_SHEET_ID);
  if (!id) {
    Logger.log('🔧 إعداد أولي تلقائي...');
    setupSheets();
  }
}

// =====================================================
// GET Handler الرئيسي
// =====================================================
function doGet(e) {
  try {
    // إعداد تلقائي عند أول استدعاء
    ensureSetup();

    const action    = (e.parameter.action || 'read').trim();
    const sheetName = (e.parameter.sheet  || '').trim();
    const token     = (e.parameter.token  || '').trim();

    // ---- بوابة الموكل (HTML مباشر) ----
    if (action === 'portal') {
      return serveClientPortal(token);
    }

    // ---- اختبار الاتصال ----
    if (action === 'ping') {
      const id = getSpreadsheetId();
      return jsonResponse({
        status: 'ok',
        version: SCRIPT_VERSION,
        email: LAWYER_EMAIL,
        spreadsheet_id: id,
        spreadsheet_url: SpreadsheetApp.openById(id).getUrl()
      });
    }

    // ---- إعداد الأوراق ----
    if (action === 'setup') return setupSheets();

    // ---- الحصول على رابط الشيت ----
    if (action === 'get_sheet_url') {
      const id = getSpreadsheetId();
      return jsonResponse({
        status: 'ok',
        spreadsheet_id: id,
        spreadsheet_url: SpreadsheetApp.openById(id).getUrl()
      });
    }

    // ---- إحصائيات ----
    if (action === 'stats') return getStats();

    // ---- نسخ احتياطي ----
    if (action === 'backup') {
      backupToGoogleDrive();
      return jsonResponse({ status: 'ok', message: 'تم حفظ النسخة الاحتياطية' });
    }

    // ---- تنبيهات تجريبية ----
    if (action === 'test_notify') {
      sendDailyNotifications();
      return jsonResponse({ status: 'ok', message: 'تم إرسال التنبيهات' });
    }

    // ---- رابط Drive ----
    if (action === 'get_folder') return getDriveFolderUrl();

    // ---- قراءة ورقة ----
    if (!sheetName) return jsonResponse({ error: 'يرجى تحديد sheet' });

    const id    = getSpreadsheetId();
    const ss    = SpreadsheetApp.openById(id);
    let   sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      setupSheets();
      sheet = ss.getSheetByName(sheetName);
      if (!sheet) return jsonResponse([]);
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1 || lastCol < 1) return jsonResponse([]);

    const allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = allData[0].map(h => String(h).trim());

    const rows = allData.slice(1)
      .filter(row => row.some(c => c !== '' && c !== null && c !== undefined))
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          if (!h) return;
          let val = row[i];
          if (val instanceof Date) {
            if (h === 'الوقت') {
              val = String(val.getHours()).padStart(2,'0') + ':' + String(val.getMinutes()).padStart(2,'0');
            } else if (h === 'أطفال_القضية') {
              val = String(val);
            } else {
              const yr = val.getFullYear();
              val = yr > 1900
                ? yr + '-' + String(val.getMonth()+1).padStart(2,'0') + '-' + String(val.getDate()).padStart(2,'0')
                : '';
            }
          }
          obj[h] = (val !== undefined && val !== null) ? String(val) : '';
        });
        return obj;
      });

    return jsonResponse(rows);

  } catch(err) {
    Logger.log('❌ doGet: ' + err + '\n' + err.stack);
    return jsonResponse({ error: err.toString() });
  }
}

// =====================================================
// POST Handler — الكتابة في الشيت
// =====================================================
function doPost(e) {
  try {
    ensureSetup();

    const raw  = (e.postData && e.postData.contents) ? e.postData.contents : '{}';
    let body;
    try { body = JSON.parse(raw); }
    catch(pe) { return jsonResponse({ error: 'JSON غير صالح: ' + pe }); }

    const action    = body.action || 'add';
    const sheetName = body.sheet;

    if (!sheetName) return jsonResponse({ error: 'يرجى تحديد sheet' });

    const id = getSpreadsheetId();
    const ss = SpreadsheetApp.openById(id);

    let sheet = ss.getSheetByName(sheetName);
    const knownHeaders = getSheetHeaders(sheetName);

    if (!sheet) { setupSheets(); sheet = ss.getSheetByName(sheetName); }
    if (!sheet) return jsonResponse({ error: 'فشل إنشاء: ' + sheetName });

    // تأكد من وجود الأعمدة
    const lastCol = sheet.getLastColumn();
    let sheetHeaders = [];
    if (lastCol > 0) {
      sheetHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
                         .map(h => String(h).trim()).filter(Boolean);
    }
    if (sheetHeaders.length === 0 && knownHeaders) {
      sheet.getRange(1, 1, 1, knownHeaders.length).setValues([knownHeaders]);
      sheet.getRange(1, 1, 1, knownHeaders.length)
           .setBackground('#0D1B2A').setFontColor('#C9A84C')
           .setFontWeight('bold').setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
      sheetHeaders = knownHeaders;
    }

    // ---- إضافة ----
    if (action === 'add') {
      if (!body.data) return jsonResponse({ error: 'لا توجد بيانات' });
      const row = sheetHeaders.map(h => {
        const v = body.data[h];
        return (v !== undefined && v !== null) ? v : '';
      });
      sheet.appendRow(row);

      let calEventId = '';
      if (sheetName === 'الجلسات') {
        try { calEventId = addToCalendar(body.data); } catch(ce) {}
        if (calEventId) {
          const calCol = sheetHeaders.indexOf('calendar_event_id') + 1;
          if (calCol > 0) sheet.getRange(sheet.getLastRow(), calCol).setValue(calEventId);
        }
      }
      return jsonResponse({ status: 'ok', message: 'تمت الإضافة', calEventId });
    }

    // ---- تحديث ----
    if (action === 'update') {
      const actualRow = (parseInt(body.rowIndex) || 1) + 1;
      const row = sheetHeaders.map(h => {
        const v = body.data[h];
        return (v !== undefined && v !== null) ? v : '';
      });
      sheet.getRange(actualRow, 1, 1, row.length).setValues([row]);
      if (sheetName === 'الجلسات') {
        try {
          const ci = sheetHeaders.indexOf('calendar_event_id');
          const oldId = ci >= 0 ? String(sheet.getRange(actualRow, ci+1).getValue()) : '';
          updateCalendarEvent(oldId, body.data);
        } catch(ce) {}
      }
      return jsonResponse({ status: 'ok', message: 'تم التحديث' });
    }

    // ---- حذف ----
    if (action === 'delete') {
      const actualRow = (parseInt(body.rowIndex) || 1) + 1;
      if (sheetName === 'الجلسات') {
        try {
          const ci = sheetHeaders.indexOf('calendar_event_id');
          if (ci >= 0) {
            const id2 = String(sheet.getRange(actualRow, ci+1).getValue());
            if (id2) deleteCalendarEvent(id2);
          }
        } catch(ce) {}
      }
      sheet.deleteRow(actualRow);
      return jsonResponse({ status: 'ok', message: 'تم الحذف' });
    }

    return jsonResponse({ error: 'إجراء غير معروف: ' + action });

  } catch(err) {
    Logger.log('❌ doPost: ' + err + '\n' + err.stack);
    return jsonResponse({ error: err.toString() });
  }
}

// =====================================================
// بوابة الموكل — HTML مباشر عبر QR
// =====================================================
function serveClientPortal(token) {
  if (!token) {
    return HtmlService.createHtmlOutput(
      '<div dir="rtl" style="font-family:Arial;text-align:center;padding:60px;">' +
      '<h2 style="color:#c0392b;">⚠️ رمز غير صالح</h2>' +
      '<p style="color:#666;">تواصل مع مكتب الحسام للمحاماة واتس01016000360  للحصول على رمز جديد</p></div>'
    ).setTitle('بوابة الموكل').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const id          = getSpreadsheetId();
  const ss          = SpreadsheetApp.openById(id);
  const clientSheet = ss.getSheetByName('الموكلين');

  if (!clientSheet || clientSheet.getLastRow() <= 1) {
    return HtmlService.createHtmlOutput(
      '<h2 dir="rtl" style="text-align:center;color:red;margin:40px">لا توجد بيانات</h2>'
    ).setTitle('بوابة الموكل');
  }

  const vals     = clientSheet.getDataRange().getValues();
  const hdr      = vals[0].map(h => String(h).trim());
  const tokenIdx = hdr.indexOf('portal_token');
  const nameIdx  = hdr.indexOf('الاسم');
  const typeIdx  = hdr.indexOf('النوع');
  const phoneIdx = hdr.indexOf('الهاتف');
  const powerIdx = hdr.indexOf('رقم_التوكيل');

  let clientRow = null;
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][tokenIdx]).trim() === token) {
      clientRow = vals[i];
      break;
    }
  }

  if (!clientRow) {
    return HtmlService.createHtmlOutput(
      '<div dir="rtl" style="font-family:Arial;text-align:center;padding:60px;">' +
      '<h2 style="color:#c0392b;">⚠️ رمز الوصول غير صالح أو تم إلغاؤه</h2>' +
      '<p style="color:#666;">تواصل مع مكتب الحسام للمحاماة واتس 01016000360 للحصول على رمز جديد</p></div>'
    ).setTitle('بوابة الموكل');
  }

  const clientName  = String(clientRow[nameIdx]  || '');
  const clientType  = String(clientRow[typeIdx]  || '');
  const clientPhone = String(clientRow[phoneIdx] || '');
  const clientPower = String(clientRow[powerIdx] || '');

  const casesSheet = ss.getSheetByName('القضايا');
  const sessSheet  = ss.getSheetByName('الجلسات');
  const cases      = [];
  const tz         = Session.getScriptTimeZone();
  const today      = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  if (casesSheet && casesSheet.getLastRow() > 1) {
    const cv   = casesSheet.getDataRange().getValues();
    const chdr = cv[0].map(h => String(h).trim());
    const ciName = chdr.indexOf('اسم_الموكل');

    cv.slice(1).forEach(row => {
      if (String(row[ciName] || '').trim() !== clientName.trim()) return;
      const caseObj = {};
      chdr.forEach((h, i) => {
        if (!h) return;
        let v = row[i];
        if (v instanceof Date) {
          const yr = v.getFullYear();
          caseObj[h] = yr > 1900
            ? yr+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0')
            : '';
        } else {
          caseObj[h] = String(v !== null && v !== undefined ? v : '');
        }
      });

      const caseNum  = caseObj['رقم_القضية'] || '';
      const sessions = [];
      if (sessSheet && sessSheet.getLastRow() > 1) {
        const sv   = sessSheet.getDataRange().getValues();
        const shdr = sv[0].map(h => String(h).trim());
        const snIdx = shdr.indexOf('رقم_القضية');

        sv.slice(1).forEach(sr => {
          if (String(sr[snIdx] || '').trim() !== caseNum.trim()) return;
          const sObj = {};
          shdr.forEach((h, i) => {
            if (!h) return;
            let v = sr[i];
            if (v instanceof Date) {
              if (h === 'الوقت') {
                v = String(v.getHours()).padStart(2,'0')+':'+String(v.getMinutes()).padStart(2,'0');
              } else {
                const yr = v.getFullYear();
                v = yr > 1900 ? yr+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0') : '';
              }
            }
            sObj[h] = String(v !== null && v !== undefined ? v : '');
          });
          sessions.push(sObj);
        });
        sessions.sort((a, b) => (a['التاريخ'] || '').localeCompare(b['التاريخ'] || ''));
      }

      caseObj['_sessions'] = sessions;
      cases.push(caseObj);
    });
  }

  const html = buildPortalHTML(clientName, clientType, clientPhone, clientPower, cases, today);
  return HtmlService.createHtmlOutput(html)
    .setTitle('بوابة الموكل — ' + clientName)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// =====================================================
// تهريب HTML — لبيانات بوابة الموكل القادمة من الشيت فقط
// =====================================================
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =====================================================
// بناء HTML بوابة الموكل
// =====================================================
function buildPortalHTML(name, type, phone, power, cases, today) {
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEEE، d MMMM yyyy');

  let casesHTML = '';
  cases.forEach((c, ci) => {
    const stColor = c['الحالة']==='نشطة'?'#1e8449':c['الحالة']==='منتهية'?'#717d7e':'#a04000';
    const stBg    = c['الحالة']==='نشطة'?'#d5f5e3':c['الحالة']==='منتهية'?'#eaecee':'#fdebd0';
    const sessions = c['_sessions'] || [];
    const future   = sessions.filter(s => s['التاريخ'] >= today);
    const past     = sessions.filter(s => s['التاريخ'] < today && s['القرار']);
    const lastDec  = past.length ? past[past.length-1]['القرار'] : (c['قرارات_المحكمة'] || '');
    const nextD    = future.length ? future[0]['التاريخ'] : (c['تاريخ_الجلسة_القادمة'] || '');

    let sessRows = '';
    sessions.forEach((s, si) => {
      const isFut = s['التاريخ'] >= today;
      const rowBg = isFut ? '#eaf4fc' : '#f9f9f9';
      let dStr = s['التاريخ'] || '';
      if (dStr) {
        const p = dStr.split('-');
        if (p.length === 3) {
          const d = new Date(+p[0], +p[1]-1, +p[2]);
          dStr = d.toLocaleDateString('ar-EG', {weekday:'short',day:'numeric',month:'long',year:'numeric'});
        }
      }
      sessRows += `<div style="background:${rowBg};border:1px solid #e0d8cc;border-radius:8px;padding:12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <strong style="font-size:13px;color:#0D1B2A;">جلسة ${si+1}</strong>
          <span style="font-size:11px;background:${stBg};color:${stColor};padding:2px 8px;border-radius:10px;">${escapeHtml(s['الحالة']||'—')}</span>
        </div>
        <div style="font-size:12px;color:#444;margin-bottom:3px;">📅 ${escapeHtml(dStr)}${s['الوقت']?' &nbsp;⏰ الساعة '+escapeHtml(s['الوقت']):''}</div>
        ${s['المحكمة']?'<div style="font-size:12px;color:#444;margin-bottom:3px;">🏛 '+escapeHtml(s['المحكمة'])+'</div>':''}
        ${s['ما_تم_في_الجلسة']?'<div style="font-size:12px;background:#fff;border-radius:5px;padding:6px;margin-bottom:3px;">📝 '+escapeHtml(s['ما_تم_في_الجلسة'])+'</div>':''}
        ${s['القرار']?'<div style="font-size:12px;font-weight:700;color:#C9A84C;margin-bottom:3px;">⚖️ القرار: '+escapeHtml(s['القرار'])+'</div>':''}
        ${s['التأجيل_إلى']?'<div style="font-size:11px;color:#2980b9;">📅 التأجيل إلى: '+escapeHtml(s['التأجيل_إلى'])+'</div>':''}
      </div>`;
    });

    let nextStr = '—';
    if (nextD) {
      const p = nextD.split('-');
      if (p.length === 3) {
        const d = new Date(+p[0],+p[1]-1,+p[2]);
        nextStr = d.toLocaleDateString('ar-EG',{day:'numeric',month:'short',year:'numeric'});
      }
    }

    casesHTML += `
    <div style="background:#fff;border-radius:14px;box-shadow:0 3px 16px rgba(0,0,0,.08);margin-bottom:22px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0D1B2A,#1E3452);padding:16px 18px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="color:#C9A84C;font-weight:900;font-size:14px;">⚖️ ${escapeHtml(c['رقم_القضية']||'')}</div>
          <div style="color:#F5F0E8;font-size:13px;margin-top:3px;">${escapeHtml(c['عنوان_القضية']||'قضية')}</div>
          <div style="color:#8A9BB0;font-size:11px;margin-top:2px;">${escapeHtml(c['نوع_الدعوى']||'')} ${c['المحكمة']?'| '+escapeHtml(c['المحكمة']):''}</div>
        </div>
        <span style="background:${stBg};color:${stColor};font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap;">${escapeHtml(c['الحالة']||'—')}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #f0ece4;">
        <div style="padding:12px 16px;border-left:1px solid #f0ece4;">
          <div style="font-size:10px;color:#888;margin-bottom:4px;">الجلسة القادمة</div>
          <div style="font-size:14px;font-weight:700;color:#2980b9;">${nextStr}</div>
        </div>
        <div style="padding:12px 16px;">
          <div style="font-size:10px;color:#888;margin-bottom:4px;">آخر قرار</div>
          <div style="font-size:12px;font-weight:700;color:#C9A84C;">${escapeHtml(lastDec||'لا يوجد بعد')}</div>
        </div>
      </div>
      <div style="padding:14px 16px;">
        <div style="font-size:11px;font-weight:700;color:#999;letter-spacing:1px;margin-bottom:10px;">سجل الجلسات (${sessions.length})</div>
        ${sessRows || '<p style="font-size:12px;color:#aaa;text-align:center;padding:10px 0;">لا توجد جلسات مسجلة بعد</p>'}
      </div>
    </div>`;
  });

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>بوابة الموكل — ${escapeHtml(name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Cairo,Arial,sans-serif;background:#f5f0e8;color:#111;direction:rtl;min-height:100vh;padding-bottom:30px;}
.header{background:linear-gradient(135deg,#0D1B2A,#1E3452);padding:20px 16px;text-align:center;}
.logo{color:#C9A84C;font-size:18px;font-weight:900;}
.sub{color:#8A9BB0;font-size:11px;margin-top:3px;}
.client-info{background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.3);border-radius:10px;padding:10px 16px;margin:12px 0 0;display:inline-block;}
.client-name{color:#C9A84C;font-weight:900;font-size:16px;}
.client-type{color:#8A9BB0;font-size:11px;}
.container{max-width:640px;margin:18px auto;padding:0 14px;}
.notice{background:#fdebd0;border:1px solid #e59866;border-radius:8px;padding:10px 14px;font-size:12px;color:#a04000;text-align:center;margin-bottom:16px;}
.print-btn{background:#C9A84C;color:#0D1B2A;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;width:100%;margin-bottom:14px;}
.footer{text-align:center;font-size:10px;color:#bbb;padding:20px;border-top:1px solid #e8e0d0;margin-top:10px;}
@media print{.no-print{display:none!important;}.header{background:#0D1B2A!important;-webkit-print-color-adjust:exact;}}
</style>
</head>
<body>
<div class="header">
  <div class="logo">⚖️ نظام  </div>
  <div class="sub">الحسام للمحاماة واتس 01016000360 متابعة القضايا — للقراءة فقط</div>
  <div class="client-info">
    <div class="client-name">👤 ${escapeHtml(name)}</div>
    <div class="client-type">${escapeHtml(type)}${phone?' &nbsp;|&nbsp; 📱 '+escapeHtml(phone):''}</div>
    ${power?'<div class="client-type">📄 رقم التوكيل: '+escapeHtml(power)+'</div>':''}
  </div>
  <div class="sub" style="margin-top:8px;">📅 ${dateStr}</div>
</div>
<div class="container">
  <button class="print-btn no-print" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  <div class="notice">🔒 هذه الصفحة سرية —واتس 01016000360 _ معدّة لك أنت فقط ولا يمكن تعديلها</div>
  <div style="font-size:12px;font-weight:700;color:#888;letter-spacing:1px;margin-bottom:14px;">القضايا (${cases.length})</div>
  ${casesHTML || '<div style="text-align:center;padding:30px;color:#aaa;">لا توجد قضايا مسجلة بعد</div>'}
  <div class="footer">نظام مكتب الحسام للمحاماة والاستشارات القانونية — المدى
  المستشار حسام محمد ابراهيم رقم واتس اب فقط : 01016000360 <br>هذه الصفحة للعرض الشخصي فقط</div>
</div>
</body>
</html>`;
}

// =====================================================
// إحصائيات لوحة التحكم
// =====================================================
function getStats() {
  const id  = getSpreadsheetId();
  const ss  = SpreadsheetApp.openById(id);
  const tz  = Session.getScriptTimeZone();
  const now = new Date();
  const td  = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const st  = {};

  ['القضايا','الجلسات','الموكلين','المهام','المستندات'].forEach(name => {
    const sh = ss.getSheetByName(name);
    st[name] = sh ? Math.max(0, sh.getLastRow()-1) : 0;
  });

  const cs = ss.getSheetByName('القضايا');
  if (cs && cs.getLastRow() > 1) {
    const v = cs.getDataRange().getValues();
    const h = v[0].map(x=>String(x).trim());
    const si = h.indexOf('الحالة'), ti = h.indexOf('نوع_الموكل');
    const rows = v.slice(1).filter(r=>r.some(c=>c!==''));
    st['قضايا_نشطة']   = rows.filter(r=>['نشطة','active'].includes(String(r[si]).trim())).length;
    st['قضايا_منتهية'] = rows.filter(r=>['منتهية','closed'].includes(String(r[si]).trim())).length;
    st['قضايا_زوجة']   = rows.filter(r=>String(r[ti]).includes('زوجة')).length;
    st['قضايا_زوج']    = rows.filter(r=>String(r[ti]).includes('زوج')&&!String(r[ti]).includes('زوجة')).length;
  }

  const se = ss.getSheetByName('الجلسات');
  if (se && se.getLastRow() > 1) {
    const v = se.getDataRange().getValues();
    const h = v[0].map(x=>String(x).trim());
    const di = h.indexOf('التاريخ');
    const rows = v.slice(1).filter(r=>r[di]);
    st['جلسات_اليوم'] = rows.filter(r=>{
      const d=r[di] instanceof Date?r[di]:new Date(String(r[di]));
      return Utilities.formatDate(d,tz,'yyyy-MM-dd')===td;
    }).length;
    st['جلسات_أسبوع'] = rows.filter(r=>{
      const d=r[di] instanceof Date?r[di]:new Date(String(r[di]));
      return (d-now)/(864e5)>=0&&(d-now)/(864e5)<=7;
    }).length;
  }

  return jsonResponse(st);
}

// =====================================================
// Google Calendar
// =====================================================
function getOrCreateCalendar() {
  const c = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  return c.length ? c[0] : CalendarApp.createCalendar(CALENDAR_NAME, {
    color: CalendarApp.Color.TEAL,
    timeZone: Session.getScriptTimeZone()
  });
}

function addToCalendar(s) {
  try {
    const cal = getOrCreateCalendar();
    const ds  = String(s['التاريخ']||'').slice(0,10);
    if (!ds || ds.length < 8) return '';
    const p  = ds.split('-');
    const tm = String(s['الوقت']||'09:00').match(/(\d{1,2}):(\d{2})/);
    const st = new Date(+p[0],+p[1]-1,+p[2],tm?+tm[1]:9,tm?+tm[2]:0);
    const en = new Date(st.getTime()+3600000);
    const ev = cal.createEvent(
      '⚖️ '+(s['عنوان_القضية']||'جلسة')+(s['رقم_القضية']?' ['+s['رقم_القضية']+']':''),
      st, en,
      { description: 'نوع الدعوى: '+(s['نوع_الدعوى']||'—')+'\nالمحكمة: '+(s['المحكمة']||'—'),
        location: s['المحكمة']||'' }
    );
    ev.addEmailReminder(1440);
    ev.addPopupReminder(60);
    return ev.getId();
  } catch(e) { Logger.log('⚠️ Calendar add: '+e); return ''; }
}

function updateCalendarEvent(id, s) {
  if (!id) { addToCalendar(s); return; }
  try {
    const ev = getOrCreateCalendar().getEventById(id);
    if (!ev) { addToCalendar(s); return; }
    const p  = String(s['التاريخ']||'').slice(0,10).split('-');
    const tm = String(s['الوقت']||'09:00').match(/(\d{1,2}):(\d{2})/);
    const st = new Date(+p[0],+p[1]-1,+p[2],tm?+tm[1]:9,tm?+tm[2]:0);
    ev.setTitle('⚖️ '+(s['عنوان_القضية']||'جلسة'));
    ev.setTime(st, new Date(st.getTime()+3600000));
    ev.setLocation(s['المحكمة']||'');
  } catch(e) { Logger.log('⚠️ Calendar update: '+e); }
}

function deleteCalendarEvent(id) {
  if (!id) return;
  try {
    const ev = getOrCreateCalendar().getEventById(id);
    if (ev) ev.deleteEvent();
  } catch(e) {}
}

// =====================================================
// Google Drive
// =====================================================
function getOrCreateDriveFolder() {
  const f = DriveApp.getFoldersByName(DRIVE_FOLDER);
  return f.hasNext() ? f.next() : DriveApp.createFolder(DRIVE_FOLDER);
}

function getOrCreateDocsFolder() {
  const p = getOrCreateDriveFolder();
  const s = p.getFoldersByName(DOCS_FOLDER);
  return s.hasNext() ? s.next() : p.createFolder(DOCS_FOLDER);
}

function getDriveFolderUrl() {
  try {
    const f = getOrCreateDriveFolder();
    return jsonResponse({ status:'ok', url:f.getUrl(), id:f.getId() });
  } catch(e) {
    return jsonResponse({ error: e.toString() });
  }
}

function backupToGoogleDrive() {
  if (!BACKUP_ENABLED) return;
  try {
    const id     = getSpreadsheetId();
    const ss     = SpreadsheetApp.openById(id);
    const folder = getOrCreateDriveFolder();
    const tz     = Session.getScriptTimeZone();
    const ts     = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd_HH-mm');
    const all    = {};

    SHEET_DEFS.forEach(def => {
      const sh = ss.getSheetByName(def.name);
      if (!sh || sh.getLastRow() <= 1) { all[def.name] = []; return; }
      const v = sh.getDataRange().getValues();
      const h = v[0].map(x => String(x).trim());
      all[def.name] = v.slice(1)
        .filter(r => r.some(c => c !== ''))
        .map(r => {
          const o = {};
          h.forEach((k, i) => { if (k) o[k] = r[i] !== undefined ? String(r[i]) : ''; });
          return o;
        });
    });

    folder.createFile(
      Utilities.newBlob(JSON.stringify(all,null,2), 'application/json', 'backup_'+ts+'.json')
    );

    // احتفظ بآخر 30 نسخة فقط
    const it = folder.getFiles(), fl = [];
    while (it.hasNext()) {
      const f = it.next();
      if (f.getName().startsWith('backup_')) fl.push(f);
    }
    fl.sort((a,b) => b.getDateCreated()-a.getDateCreated());
    fl.slice(30).forEach(f => f.setTrashed(true));

    Logger.log('✅ Backup: backup_'+ts);
  } catch(e) { Logger.log('❌ Backup: '+e); }
}

// =====================================================
// التنبيهات اليومية
// =====================================================
function sendDailyNotifications() {
  try {
    const id  = getSpreadsheetId();
    const ss  = SpreadsheetApp.openById(id);
    const tz  = Session.getScriptTimeZone();
    const now = new Date();
    const upcoming = [], urgentTasks = [];

    const se = ss.getSheetByName('الجلسات');
    if (se && se.getLastRow() > 1) {
      const v  = se.getDataRange().getValues();
      const h  = v[0].map(x => String(x).trim());
      const di = h.indexOf('التاريخ'), ti = h.indexOf('الوقت');
      const ci = h.indexOf('عنوان_القضية'), mi = h.indexOf('المحكمة');
      const ni = h.indexOf('نوع_الدعوى');
      v.slice(1).forEach(r => {
        if (!r[di]) return;
        const d    = r[di] instanceof Date ? r[di] : new Date(String(r[di]));
        const diff = Math.round((d-now)/864e5);
        if (diff < 0 || diff > NOTIFY_DAYS_BEFORE) return;
        let t = r[ti] || '';
        if (t instanceof Date) { t = String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'); }
        else { const m = String(t).match(/(\d{1,2}):(\d{2})/); t = m ? m[1].padStart(2,'0')+':'+m[2] : '—'; }
        upcoming.push({ title:r[ci]||'جلسة', type:r[ni]||'—', date:Utilities.formatDate(d,tz,'yyyy/MM/dd'), time:t, court:r[mi]||'—', days:diff });
      });
    }

    const tk = ss.getSheetByName('المهام');
    if (tk && tk.getLastRow() > 1) {
      const v  = tk.getDataRange().getValues();
      const h  = v[0].map(x => String(x).trim());
      const ti = h.indexOf('العنوان'), di = h.indexOf('الموعد_النهائي'), si = h.indexOf('الحالة');
      v.slice(1).forEach(r => {
        if (!r[di] || r[si] === 'done') return;
        const d    = r[di] instanceof Date ? r[di] : new Date(String(r[di]));
        const diff = Math.round((d-now)/864e5);
        if (diff >= 0 && diff <= 3)
          urgentTasks.push({ title:r[ti]||'مهمة', due:Utilities.formatDate(d,tz,'yyyy/MM/dd'), days:diff });
      });
    }

    if (!upcoming.length && !urgentTasks.length) { Logger.log('لا توجد تنبيهات'); return; }
    const ds = Utilities.formatDate(now, tz, 'EEEE، d MMMM yyyy');
    GmailApp.sendEmail(LAWYER_EMAIL, '⚖️ تنبيه  مكتب الحسام للمحاماة  — '+ds, 'يرجى فتح بتنسيق HTML', {
      htmlBody: buildEmailHtml(upcoming, urgentTasks, ds)
    });
    Logger.log('✅ تنبيهات → '+LAWYER_EMAIL);
  } catch(e) { Logger.log('❌ Notify: '+e); }
}

function buildEmailHtml(sessions, tasks, dateStr) {
  let h = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#f5f5f5;padding:20px;border-radius:12px;">
  <div style="background:linear-gradient(135deg,#0D1B2A,#1E3452);padding:24px;border-radius:12px;text-align:center;margin-bottom:16px;">
    <h2 style="color:#C9A84C;margin:0;">⚖️ مكتب الحسام للمحاماة - واتس
    01016000360</h2>
    <p style="color:#8A9BB0;margin:6px 0 0;font-size:12px;">${dateStr}</p></div>`;
  if (sessions.length) {
    h += `<div style="background:#fff;border-radius:10px;padding:18px;margin-bottom:14px;border-right:4px solid #C9A84C;">
      <h3 style="color:#0D1B2A;font-size:15px;margin:0 0 12px;">📅 جلسات قادمة (${sessions.length})</h3>`;
    sessions.forEach(s => {
      h += `<div style="border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:8px;">
        <strong>${s.title}</strong> ${s.days===0?'🔴 اليوم':s.days===1?'🟡 غداً':'🟢 '+s.days+' أيام'}<br>
        <small style="color:#666;">📋 ${s.type} | 📅 ${s.date} ${s.time} | 🏛 ${s.court}</small></div>`;
    });
    h += `</div>`;
  }
  if (tasks.length) {
    h += `<div style="background:#fff;border-radius:10px;padding:18px;border-right:4px solid #E67E22;">
      <h3 style="color:#0D1B2A;font-size:15px;margin:0 0 12px;">✅ مهام عاجلة (${tasks.length})</h3>`;
    tasks.forEach(t => {
      h += `<div style="border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:8px;">
        <strong>${t.title}</strong> — ${t.days===0?'🔴 اليوم':'🟡 '+t.days+' أيام'}</div>`;
    });
    h += `</div>`;
  }
  h += `<p
  style="text-align:center;font-size:10px;color:#999;margin-top:14px;"> 
  مكتب الحسام للمحاماة — المستشار حسام محمد - واتس 01016000360  | v${SCRIPT_VERSION}</p></div>`;
  return h;
}

// =====================================================
// التريغرات
// =====================================================
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendDailyNotifications').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('backupToGoogleDrive').timeBased().everyDays(1).atHour(2).create();
  Logger.log('✅ Triggers: تنبيهات 7ص | backup 2ص');
}

// =====================================================
// JSON Response
// =====================================================
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
