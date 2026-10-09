// ============================================================
//  src/whatsapp.js — رابط حقيقي لـ WhatsApp Cloud API (Meta)
//
//  هذا الملف يستخدم واجهة Meta الرسمية:
//    1) رفع ملف الـPDF إلى وسائط واتساب  →  POST /{id}/media
//    2) إرسال الملف كرسالة مستند          →  POST /{id}/messages
//
//  المتطلبات (في ملف .env):
//    WHATSAPP_ACCESS_TOKEN     توكن الوصول من Meta Business
//    WHATSAPP_PHONE_NUMBER_ID  معرّف رقم واتساب الأعمال
//    WHATSAPP_API_VERSION      إصدار الواجهة (افتراضي: v21.0)
//
//  إذا لم يتم ضبط الإعدادات، تُرجع الدالة خطأ واضحًا
//  ولا تستخدم أي طريقة وهمية للإرسال.
// ============================================================

const GRAPH_BASE = 'https://graph.facebook.com';

/** هل القيمة مجرد نص بديل (لم يتم استبدالها بعد)؟ */
function isPlaceholder(value) {
  const v = String(value || '').trim();
  return (
    !v ||
    v.includes('ضع ') ||
    v.includes('ضع_') ||
    v.toUpperCase().includes('PUT_') ||
    v.toUpperCase().includes('YOUR_')
  );
}

/** إعدادات واتساب الحالية */
function getConfig() {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  };
}

/** هل الإعدادات جاهزة للإرسال الفعلي؟ */
function isConfigured() {
  const { token, phoneNumberId } = getConfig();
  return !isPlaceholder(token) && !isPlaceholder(phoneNumberId);
}

/** توليد معرّف المستلم من رقم واتساب */
function normalizeRecipient(overrideNumber) {
  const configured = process.env.WHATSAPP_ADMIN_NUMBER;
  const raw = isPlaceholder(overrideNumber) ? configured : overrideNumber || configured;
  if (isPlaceholder(raw)) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.replace(/^0+/, '') || null;
}

/** قراءة خطأ Meta وإلقاء رسالة مفهومة */
async function metaError(res, context) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || JSON.stringify(body);
  } catch {
    detail = await res.text().catch(() => '');
  }
  const err = new Error(`${context} — خطأ من واتساب (${res.status}): ${detail || 'غير معروف'}`);
  err.status = res.status;
  return err;
}

/**
 * رفع مستند PDF إلى وسائط واتساب وإرجاع معرّف الوسيط (media id)
 * @param {Buffer} buffer محتوى الملف
 * @param {string} filename اسم الملف
 * @param {string} mimeType نوع الملف (application/pdf)
 */
async function uploadDocument(buffer, filename, mimeType = 'application/pdf') {
  const { token, phoneNumberId, apiVersion } = getConfig();
  if (!isConfigured()) {
    const err = new Error(
      'لم يتم ربط واتساب بعد: أضف WHATSAPP_ACCESS_TOKEN و WHATSAPP_PHONE_NUMBER_ID في ملف .env (راجع README).'
    );
    err.status = 503;
    throw err;
  }

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', new Blob([buffer], { type: mimeType }), filename);

  const url = `${GRAPH_BASE}/${apiVersion}/${phoneNumberId}/media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) throw await metaError(res, 'فشل رفع ملف الـPDF إلى واتساب');

  const data = await res.json();
  if (!data.id) throw new Error('لم يُرجع واتساب معرّف الوسيط بعد الرفع.');
  return data.id;
}

/**
 * إرسال مستند PDF إلى رقم واتساب
 * @param {object} options
 * @param {Buffer} options.buffer  محتوى ملف الـPDF
 * @param {string} options.filename اسم الملف الظاهر للمستلم
 * @param {string} [options.caption] تعليق الرسالة
 * @param {string} [options.to] رقم المستلم (اختياري: يُستخدم رقم الإدارية من الإعدادات)
 */
async function sendDocument({ buffer, filename, caption, to }) {
  const { token, phoneNumberId, apiVersion } = getConfig();
  if (!isConfigured()) {
    const err = new Error(
      'لم يتم ربط واتساب بعد: أضف WHATSAPP_ACCESS_TOKEN و WHATSAPP_PHONE_NUMBER_ID في ملف .env (راجع README).'
    );
    err.status = 503;
    throw err;
  }

  const recipient = normalizeRecipient(to);
  if (!recipient) {
    const err = new Error(
      'لم يتم ضبط رقم واتساب الإدارية بعد: استبدل القيمة في ملف .env (WHATSAPP_ADMIN_NUMBER) وفي public/js/config.js.'
    );
    err.status = 503;
    throw err;
  }

  // 1) رفع الوسائط
  const mediaId = await uploadDocument(buffer, filename);

  // 2) إرسال الرسالة من نوع document
  const url = `${GRAPH_BASE}/${apiVersion}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'document',
      document: {
        id: mediaId,
        filename,
        ...(caption ? { caption } : {}),
      },
    }),
  });

  if (!res.ok) throw await metaError(res, 'فشل إرسال ملف الـPDF عبر واتساب');

  const data = await res.json();
  return { ok: true, to: recipient, messageId: data?.messages?.[0]?.id || null };
}

module.exports = { sendDocument, uploadDocument, isConfigured, isPlaceholder, normalizeRecipient, getConfig };
