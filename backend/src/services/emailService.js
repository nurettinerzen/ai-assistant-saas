// ============================================================================
// EMAIL SERVICE
// ============================================================================
// FILE: backend/src/services/emailService.js
//
// Handles all email notifications using Resend
// ============================================================================

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Telyx.AI <info@telyx.ai>';
const FRONTEND_URL = process.env.FRONTEND_URL;

let resend = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn('⚠️ RESEND_API_KEY not set. Email notifications will be logged only.');
}

/**
 * Send email helper
 */
const sendEmail = async (to, subject, html) => {
  if (!resend) {
    console.log(`📧 [EMAIL PREVIEW] To: ${to}, Subject: ${subject}`);
    console.log(html);
    return { sent: false, reason: 'no_api_key' };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html
    });
    console.log(`✅ Email sent to ${to}: ${subject} (ID: ${result.data?.id})`);
    return { sent: true, id: result.data?.id };
  } catch (error) {
    console.error('❌ Email send error:', error);
    throw error;
  }
};

/**
 * 1. Email Verification Email
 */
export const sendVerificationEmail = async (email, verificationUrl, businessName) => {
  const subject = 'Telyx.AI - Email Adresinizi Doğrulayın';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .warning { background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 24px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Adresinizi Doğrulayın</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` <strong>${businessName}</strong>` : ''},</p>
          <p>Telyx.AI'a kayıt olduğunuz için teşekkürler! Hesabınızı aktif hale getirmek için email adresinizi doğrulamanız gerekmektedir.</p>

          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">Email Adresimi Doğrula</a>
          </p>

          <div class="warning">
            <p style="margin: 0;"><strong>⏰ Önemli:</strong> Bu link 24 saat geçerlidir. Süre dolarsa yeni bir doğrulama linki talep edebilirsiniz.</p>
          </div>

          <p style="font-size: 14px; color: #6b7280;">
            Eğer butona tıklayamıyorsanız, aşağıdaki linki tarayıcınıza kopyalayabilirsiniz:<br>
            <a href="${verificationUrl}" class="link">${verificationUrl}</a>
          </p>

          <p style="font-size: 14px; color: #6b7280;">
            Bu hesabı siz oluşturmadıysanız, bu emaili görmezden gelebilirsiniz.
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 2. Password Reset Email
 */
export const sendPasswordResetEmail = async (email, resetUrl) => {
  const subject = 'Telyx.AI - Şifre Sıfırlama';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .warning { background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 24px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div style="background-color: #667eea; color: #ffffff; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">Şifre Sıfırlama</h1>
        </div>
        <div class="content">
          <p>Merhaba,</p>
          <p>Şifrenizi sıfırlamak için bir talep aldık. Yeni şifre belirlemek için aşağıdaki butona tıklayın:</p>

          <p style="text-align: center;">
            <a href="${resetUrl}" style="display: inline-block; padding: 16px 48px; background-color: #667eea; color: #ffffff !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px;">Şifremi Sıfırla</a>
          </p>

          <div class="warning">
            <p style="margin: 0;"><strong>⏰ Önemli:</strong> Bu link 1 saat geçerlidir.</p>
          </div>

          <p style="font-size: 14px; color: #6b7280;">
            Eğer bu talebi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz. Şifreniz değişmeyecektir.
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 3. Welcome Email (after verification)
 */
export const sendWelcomeEmail = async (email, userName) => {
  const subject = "Telyx.AI'a Hoş Geldiniz!";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .steps { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0; }
        .step { margin: 12px 0; padding-left: 28px; position: relative; }
        .step:before { content: '✓'; position: absolute; left: 0; color: #667eea; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Telyx.AI'a Hoş Geldiniz!</h1>
        </div>
        <div class="content">
          <p>Merhaba${userName ? ` <strong>${userName}</strong>` : ''},</p>
          <p>Telyx.AI ailesine hoş geldiniz! Hesabınız aktif ve kullanıma hazır.</p>

          <div class="steps">
            <h3 style="margin-top: 0;">Başlamanız için birkaç adım:</h3>
            <div class="step">İlk asistanınızı oluşturun</div>
            <div class="step">Kanallarınızı bağlayın (WhatsApp, Telefon, Chat)</div>
            <div class="step">Bilgi bankasına dökümanlarınızı ekleyin</div>
          </div>

          <p style="background: #ecfdf5; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
            <strong>Deneme sürenizde:</strong><br>
            15 dakika telefon görüşmesi ve 7 gün chat/WhatsApp kullanım hakkınız var.
          </p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard" class="button">Dashboard'a Git</a>
          </p>

          <p style="font-size: 14px; color: #6b7280;">
            Sorularınız mı var? <a href="mailto:info@telyx.ai" class="link">info@telyx.ai</a> adresinden bize ulaşabilirsiniz.
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 4. Low Balance Alert (PAYG)
 */
export const sendLowBalanceAlert = async (email, currentBalance) => {
  const subject = 'Telyx.AI - Bakiyeniz Azalıyor';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .balance-box { background: #fef3c7; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0; }
        .balance { font-size: 32px; font-weight: bold; color: #d97706; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
        .tip { background: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 24px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Bakiyeniz Azalıyor</h1>
        </div>
        <div class="content">
          <p>Merhaba,</p>
          <p>Telyx.AI bakiyeniz düşük seviyeye geldi. Kesintisiz hizmet için bakiye yüklemenizi öneririz.</p>

          <div class="balance-box">
            <p style="margin: 0 0 8px 0; color: #6b7280;">Mevcut Bakiye:</p>
            <p class="balance">${currentBalance} TL</p>
          </div>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/billing" class="button">Bakiye Yükle</a>
          </p>

          <div class="tip">
            <p style="margin: 0;"><strong>💡 İpucu:</strong> Otomatik yükleme özelliğini açarak bakiyenizin bitmesini önleyebilirsiniz.</p>
          </div>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 5. Overage Invoice
 */
export const sendOverageInvoice = async (email, overageMinutes, amount, billingPeriod) => {
  const subject = 'Telyx.AI - Aylık Aşım Faturanız';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .invoice-box { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; }
        .invoice-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
        .invoice-row:last-child { border-bottom: none; font-weight: bold; font-size: 18px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Aylık Aşım Faturanız</h1>
        </div>
        <div class="content">
          <p>Merhaba,</p>
          <p>${billingPeriod || 'Bu ay'} dönemi için aşım faturanız oluşturuldu.</p>

          <div class="invoice-box">
            <div class="invoice-row">
              <span>Aşım Dakikası:</span>
              <span>${overageMinutes} dk</span>
            </div>
            <div class="invoice-row">
              <span>Birim Fiyat:</span>
              <span>23 TL/dk</span>
            </div>
            <div class="invoice-row">
              <span>Toplam Tutar:</span>
              <span>${amount} TL</span>
            </div>
          </div>

          <p style="font-size: 14px; color: #6b7280;">
            Bu tutar kayıtlı kartınızdan otomatik olarak tahsil edilecektir.
          </p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/billing" class="button">Fatura Detayları</a>
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 6. Email Change Verification
 */
export const sendEmailChangeVerification = async (newEmail, verificationUrl) => {
  const subject = 'Telyx.AI - Yeni Email Adresinizi Doğrulayın';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .warning { background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 24px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Yeni Email Doğrulama</h1>
        </div>
        <div class="content">
          <p>Merhaba,</p>
          <p>Email adresinizi <strong>${newEmail}</strong> olarak değiştirmek istediğinizi gördük. Bu değişikliği tamamlamak için lütfen yeni email adresinizi doğrulayın.</p>

          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">Yeni Email Adresimi Doğrula</a>
          </p>

          <div class="warning">
            <p style="margin: 0;"><strong>⏰ Önemli:</strong> Bu link 24 saat geçerlidir.</p>
          </div>

          <p style="font-size: 14px; color: #6b7280;">
            Bu işlemi siz başlatmadıysanız, lütfen bu emaili dikkate almayın ve hesap güvenliğinizi kontrol edin.
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(newEmail, subject, html);
};

/**
 * 7. Assistant Created Email
 */
export const sendAssistantCreatedEmail = async (email, businessName) => {
  const subject = 'Telyx.AI - AI Asistanınız Hazır!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
        .tip { background: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 24px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎤 AI Asistanınız Hazır!</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>Harika haber! AI asistanınız oluşturuldu ve test etmeye hazır.</p>

          <div class="tip">
            <p style="margin: 0;"><strong>🎯 Şimdi deneyin:</strong><br>
            Dashboard'daki "Asistanı Test Et" butonuna tıklayarak AI'nızla konuşabilirsiniz.</p>
          </div>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/assistant" class="button">Asistanı Test Et</a>
          </p>

          <p><strong>Gerçek aramalar için hazır mısınız?</strong><br>
          STARTER planına geçerek telefon numaranızı alın ve 7/24 arama almaya başlayın!</p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 8. Phone Number Activated Email
 */
export const sendPhoneActivatedEmail = async (email, businessName, phoneNumber) => {
  const subject = 'Telyx.AI - Telefon Numaranız Aktif!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .phone-box { background: #ecfdf5; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0; border: 2px solid #10b981; }
        .phone { font-size: 32px; font-weight: bold; color: #059669; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📞 Telefon Numaranız Aktif!</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>Tebrikler! AI asistanınız artık canlı ve aramaları yanıtlıyor.</p>

          <div class="phone-box">
            <p style="margin: 0 0 8px 0; color: #6b7280;">Telefon Numaranız:</p>
            <p class="phone">${phoneNumber}</p>
            <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">Bu numarayı müşterilerinizle paylaşın!</p>
          </div>

          <p><strong>Bundan sonra ne olacak?</strong></p>
          <ul>
            <li>Bu numaraya yapılan aramalar AI asistanınız tarafından yanıtlanacak</li>
            <li>Tüm konuşmalar dashboard'unuzda kaydedilecek</li>
            <li>Arama performansı analizlerini görebileceksiniz</li>
            <li>Asistan eğitimini istediğiniz zaman güncelleyebilirsiniz</li>
          </ul>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard" class="button">Dashboard'a Git</a>
          </p>

          <p style="background: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <strong>💡 Pro İpucu:</strong> Bu numarayı kendiniz arayarak asistanınızı test edin!
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 9. Limit Warning Email (at 80% usage)
 */
export const sendLimitWarningEmail = async (email, businessName, limitType, usage) => {
  const subject = `Telyx.AI - ${limitType === 'minutes' ? 'Dakika' : 'Arama'} Limitiniz Azalıyor`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .usage-box { background: #fef3c7; padding: 24px; border-radius: 8px; margin: 24px 0; }
        .progress-bar { background: #e5e7eb; border-radius: 10px; height: 24px; position: relative; overflow: hidden; margin: 16px 0; }
        .progress-fill { background: linear-gradient(90deg, #f59e0b, #ef4444); height: 100%; border-radius: 10px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Kullanım Uyarısı</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>Aylık ${limitType === 'minutes' ? 'dakika' : 'arama'} limitinizin <strong>${usage.percentage}%</strong>'ini kullandınız.</p>

          <div class="usage-box">
            <h3 style="margin-top: 0;">Mevcut Kullanım:</h3>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${usage.percentage}%;"></div>
            </div>
            <p style="text-align: center; margin: 0;"><strong>${usage.used} / ${usage.limit}</strong> ${limitType === 'minutes' ? 'dakika' : 'arama'}</p>
          </div>

          <p>Hizmet kesintisini önlemek için planınızı yükseltmeyi veya bakiye yüklemeyi düşünebilirsiniz.</p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/settings?tab=billing" class="button">Şimdi Yükselt</a>
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 10. Limit Reached Email
 */
export const sendLimitReachedEmail = async (email, businessName, limitType, usage, currentPlan) => {
  const nextPlan = currentPlan === 'STARTER' ? 'PRO' : 'ENTERPRISE';
  const subject = `Telyx.AI - ${limitType === 'minutes' ? 'Dakika' : 'Arama'} Limitine Ulaşıldı`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .warning-box { background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 24px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚫 Limite Ulaşıldı</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>${currentPlan} planınızdaki aylık <strong>${usage.limit} ${limitType === 'minutes' ? 'dakika' : 'arama'}</strong> limitine ulaştınız.</p>

          <div class="warning-box">
            <p style="margin: 0;"><strong>⚠️ Bu ne anlama geliyor:</strong><br>
            ${limitType === 'minutes' ? 'Gelecek aya kadar veya yükseltme yapana kadar yeni aramalar yanıtlanmayacak.' : 'Bu ay daha fazla arama alamazsınız.'}</p>
          </div>

          <p><strong>${nextPlan} planına yükselterek devam edin:</strong></p>
          <ul>
            <li>${nextPlan === 'PRO' ? '500 dakika/ay' : 'Sınırsız dakika'}</li>
            <li>Gelişmiş analitikler</li>
            <li>Öncelikli destek</li>
          </ul>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/settings?tab=billing" class="button">${nextPlan}'ya Yükselt</a>
          </p>

          <p style="font-size: 14px; color: #6b7280;">
            Kullanımınız ayın 1'inde sıfırlanacak.
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 11. Payment Success Email
 */
export const sendPaymentSuccessEmail = async (email, businessName, amount, plan) => {
  const subject = 'Telyx.AI - Ödeme Başarılı!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .invoice-box { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb; }
        .invoice-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
        .invoice-row:last-child { border-bottom: none; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Ödeme Başarılı</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>Teşekkürler! Ödemeniz başarıyla işlendi.</p>

          <div class="invoice-box">
            <div class="invoice-row">
              <span><strong>Plan:</strong></span>
              <span>${plan}</span>
            </div>
            <div class="invoice-row">
              <span><strong>Tutar:</strong></span>
              <span>${amount} TL</span>
            </div>
            <div class="invoice-row">
              <span><strong>Durum:</strong></span>
              <span style="color: #10b981;"><strong>ÖDENDİ</strong></span>
            </div>
          </div>

          <p>Aboneliğiniz aktif ve asistanınız arama almaya hazır!</p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard" class="button">Dashboard'a Git</a>
          </p>

          <p style="font-size: 14px; color: #6b7280;">
            Faturanıza ödeme ayarlarından ulaşabilirsiniz.
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 12. Payment Failed Email
 */
export const sendPaymentFailedEmail = async (email, businessName) => {
  const subject = 'Telyx.AI - Ödeme Başarısız';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .warning-box { background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 24px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>❌ Ödeme Başarısız</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>Son ödemenizi işleyemedik. Bu çözülmezse hizmetiniz kesintiye uğrayabilir.</p>

          <div class="warning-box">
            <p style="margin: 0;"><strong>⚠️ İşlem Gerekli:</strong><br>
            Telyx kullanmaya devam etmek için lütfen ödeme yönteminizi güncelleyin.</p>
          </div>

          <p><strong>Ödeme başarısızlığının yaygın nedenleri:</strong></p>
          <ul>
            <li>Yetersiz bakiye</li>
            <li>Kartın süresi dolmuş</li>
            <li>Yanlış fatura bilgileri</li>
          </ul>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/settings?tab=billing" class="button">Ödeme Yöntemini Güncelle</a>
          </p>

          <p style="font-size: 14px; color: #6b7280;">
            Yardıma ihtiyacınız varsa bu emaile cevap verebilirsiniz.
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 13. Monthly Reset Email
 */
export const sendMonthlyResetEmail = async (email, businessName, plan) => {
  const subject = 'Telyx.AI - Yeni Ay, Yeni Limitler!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .limits-box { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔄 Yeni Ay Başladı!</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>Harika haber! ${plan} planınız için aylık kullanım limitleri sıfırlandı.</p>

          <div class="limits-box">
            <p style="margin: 0;"><strong>✨ Yeni limitler:</strong></p>
            <ul style="margin: 15px 0;">
              ${plan === 'STARTER' ? '<li>150 dakika</li>' : ''}
              ${plan === 'PRO' ? '<li>500 dakika</li>' : ''}
              ${plan === 'ENTERPRISE' ? '<li>Sınırsız!</li>' : ''}
            </ul>
          </div>

          <p>AI asistanınız harika bir ay daha için arama almaya hazır!</p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/analytics" class="button">Analizleri Görüntüle</a>
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 14. Weekly Summary Email (PRO+ only)
 */
export const sendWeeklySummaryEmail = async (email, businessName, stats) => {
  const subject = `Telyx.AI - Haftalık Özet: ${stats.totalCalls} Arama`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .stats-box { background: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; }
        .stat-row { display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #e5e7eb; }
        .stat-row:last-child { border-bottom: none; }
        .stat-value { font-size: 24px; font-weight: bold; color: #10b981; }
        .insight-box { background: #ecfdf5; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; margin: 24px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Haftalık Özet</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">AI Asistan Performansınız</p>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>AI asistanınızın bu haftaki performansı:</p>

          <div class="stats-box">
            <h3 style="margin-top: 0; border-bottom: 2px solid #10b981; padding-bottom: 12px;">Temel Metrikler</h3>
            <div class="stat-row">
              <span><strong>Toplam Arama:</strong></span>
              <span class="stat-value">${stats.totalCalls}</span>
            </div>
            <div class="stat-row">
              <span><strong>Ortalama Süre:</strong></span>
              <span>${stats.avgDuration}</span>
            </div>
            <div class="stat-row">
              <span><strong>Müşteri Memnuniyeti:</strong></span>
              <span>${stats.satisfaction}% Olumlu</span>
            </div>
            <div class="stat-row">
              <span><strong>En Yoğun Gün:</strong></span>
              <span>${stats.busiestDay}</span>
            </div>
          </div>

          ${stats.topIntent ? `
          <div class="insight-box">
            <p style="margin: 0;"><strong>💡 En Sık Arama Nedeni:</strong><br>
            ${stats.topIntent}</p>
          </div>
          ` : ''}

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/analytics" class="button">Tam Raporu Görüntüle</a>
          </p>

          <p>Harika iş çıkarıyorsunuz!</p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 15. Low Balance Warning Email (Alias for sendLowBalanceAlert)
 */
export const sendLowBalanceWarningEmail = async (email, data) => {
  return sendLowBalanceAlert(email, data?.balance || data?.remainingMinutes || 0);
};

/**
 * 16. Trial Expired Notification
 */
export const sendTrialExpiredNotification = async ({ email, businessName }) => {
  const subject = 'Telyx.AI - Deneme Süreniz Doldu';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Deneme Süreniz Doldu</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>7 günlük deneme süreniz sona erdi. Telyx.AI'ı kullanmaya devam etmek için bir plan seçmeniz gerekiyor.</p>

          <p><strong>Size özel fırsatlar:</strong></p>
          <ul>
            <li><strong>PAYG (Kullandıkça Öde):</strong> Taahhütsüz, sadece kullandığınız kadar ödeyin</li>
            <li><strong>STARTER:</strong> 2.499 TL/ay, 150 dakika dahil</li>
            <li><strong>PRO:</strong> 7.499 TL/ay, 500 dakika dahil</li>
          </ul>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/subscription" class="button">Plan Seç</a>
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 17. Overage Bill Notification
 */
export const sendOverageBillNotification = async ({ email, businessName, overageMinutes, totalAmount }) => {
  return sendOverageInvoice(email, overageMinutes, totalAmount);
};

/**
 * 18. Overage Limit Reached Email
 */
export const sendOverageLimitReachedEmail = async (email, businessName, overageMinutes, maxOverageLimit) => {
  const subject = 'Telyx.AI - Aşım Limitine Ulaşıldı';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .warning-box { background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 24px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Aşım Limitine Ulaşıldı</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>Bu ay için belirlenen maksimum aşım limitinize (${maxOverageLimit} dakika) ulaştınız.</p>

          <div class="warning-box">
            <p style="margin: 0;"><strong>⚠️ Önemli:</strong><br>
            Hizmet kesintisini önlemek için bakiye yükleyin veya planınızı yükseltin.</p>
          </div>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/billing" class="button">Bakiye Yükle</a>
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 19. Auto Reload Failed Email
 */
export const sendAutoReloadFailedEmail = async (email, businessName, amount) => {
  const subject = 'Telyx.AI - Otomatik Yükleme Başarısız';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: 600; font-size: 16px; }
        .warning-box { background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 24px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .link { color: #667eea; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Otomatik Yükleme Başarısız</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>Otomatik bakiye yükleme işleminiz (${amount} TL) başarısız oldu.</p>

          <div class="warning-box">
            <p style="margin: 0;"><strong>⚠️ Olası Nedenler:</strong></p>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Yetersiz bakiye</li>
              <li>Kartın süresi dolmuş</li>
              <li>Kart limiti aşılmış</li>
            </ul>
          </div>

          <p>Hizmet kesintisini önlemek için lütfen ödeme yönteminizi kontrol edin veya manuel yükleme yapın.</p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/billing" class="button">Ödeme Yöntemini Güncelle</a>
          </p>
        </div>
        <div class="footer">
          <p>Telyx.AI Ekibi<br>
          <a href="https://telyx.ai" class="link">https://telyx.ai</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 20. Low Balance Warning (with data object)
 */
export const sendLowBalanceWarning = async ({ email, businessName, balance, threshold }) => {
  return sendLowBalanceAlert(email, balance);
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendLowBalanceAlert,
  sendOverageInvoice,
  sendEmailChangeVerification,
  sendAssistantCreatedEmail,
  sendPhoneActivatedEmail,
  sendLimitWarningEmail,
  sendLimitReachedEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendMonthlyResetEmail,
  sendWeeklySummaryEmail,
  sendLowBalanceWarningEmail,
  sendTrialExpiredNotification,
  sendOverageBillNotification,
  sendOverageLimitReachedEmail,
  sendAutoReloadFailedEmail,
  sendLowBalanceWarning
};
