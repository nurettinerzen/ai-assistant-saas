// ============================================================================
// EMAIL SERVICE
// ============================================================================
// FILE: backend/src/services/emailService.js
//
// Handles all email notifications using SendGrid
// ============================================================================

import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@telyx.ai';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://telyx.ai';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('⚠️ SENDGRID_API_KEY not set. Email notifications will be logged only.');
}

/**
 * Send email helper
 */
const sendEmail = async (to, subject, html) => {
  if (!SENDGRID_API_KEY) {
    console.log(`📧 [EMAIL PREVIEW] To: ${to}, Subject: ${subject}`);
    console.log(html);
    return { sent: false, reason: 'no_api_key' };
  }

  try {
    await sgMail.send({
      to,
      from: FROM_EMAIL,
      subject,
      html
    });
    console.log(`✅ Email sent to ${to}: ${subject}`);
    return { sent: true };
  } catch (error) {
    console.error('❌ Email send error:', error);
    throw error;
  }
};

/**
 * 1. Welcome Email (on signup)
 */
export const sendWelcomeEmail = async (email, businessName) => {
  const subject = '🎉 Welcome to Telyx!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .steps { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .step { margin: 15px 0; padding-left: 30px; position: relative; }
        .step:before { content: '✓'; position: absolute; left: 0; color: #667eea; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Telyx! 🚀</h1>
        </div>
        <div class="content">
          <p>Hi there,</p>
          <p>Thank you for joining <strong>${businessName}</strong> on Telyx! We're excited to help you build your AI-powered phone assistant.</p>
          
          <div class="steps">
            <h3>Next Steps:</h3>
            <div class="step">Choose your language (English or Turkish)</div>
            <div class="step">Select your AI assistant's voice</div>
            <div class="step">Add your first training</div>
            <div class="step">Test your assistant with web voice demo</div>
            <div class="step">Upgrade to get your phone number!</div>
          </div>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
          </p>

          <p>Need help? Reply to this email and we'll assist you right away.</p>
          
          <p>Best regards,<br><strong>The Telyx Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 2. Assistant Created Email
 */
export const sendAssistantCreatedEmail = async (email, businessName) => {
  const subject = '✨ Your AI Assistant is Ready!';
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>🎤 Your Assistant is Live!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${businessName},</p>
          <p>Great news! Your AI assistant has been created and is ready to test.</p>
          
          <p style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #667eea;">
            <strong>🎯 Try it now:</strong><br>
            Click the "Test Assistant" button in your dashboard to have a conversation with your AI.
          </p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/assistant" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Test Your Assistant</a>
          </p>

          <p><strong>Ready for real calls?</strong><br>
          Upgrade to STARTER plan to get your phone number and start receiving calls 24/7!</p>

          <p>Best,<br><strong>Telyx Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 3. Phone Number Activated Email
 */
export const sendPhoneActivatedEmail = async (email, businessName, phoneNumber) => {
  const subject = '📞 Your Phone Number is Live!';
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>📞 Your Phone Number is Active!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${businessName},</p>
          <p>Congratulations! Your AI assistant is now live and answering calls.</p>
          
          <div style="background: white; padding: 25px; border-radius: 5px; text-align: center; margin: 20px 0; border: 2px solid #11998e;">
            <p style="margin: 0; color: #666; font-size: 14px;">Your Phone Number:</p>
            <h2 style="margin: 10px 0; color: #11998e; font-size: 32px;">${phoneNumber}</h2>
            <p style="margin: 0; color: #666; font-size: 14px;">Share this with your customers!</p>
          </div>

          <p><strong>What happens now?</strong></p>
          <ul>
            <li>Calls to this number will be answered by your AI assistant</li>
            <li>All conversations will be logged in your dashboard</li>
            <li>You'll receive analytics on call performance</li>
            <li>You can update your assistant's training anytime</li>
          </ul>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 30px; background: #11998e; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">View Dashboard</a>
          </p>

          <p><strong>💡 Pro Tip:</strong> Test your assistant by calling this number yourself!</p>

          <p>Best,<br><strong>Telyx Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 4. Limit Warning Email (at 90% usage)
 */
export const sendLimitWarningEmail = async (email, businessName, limitType, usage) => {
  const subject = `⚠️ You're Running Low on ${limitType === 'minutes' ? 'Minutes' : 'Calls'}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #ff9800; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>⚠️ Usage Alert</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${businessName},</p>
          <p>You've used <strong>${usage.percentage}%</strong> of your monthly ${limitType}.</p>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Current Usage:</h3>
            <div style="background: #f0f0f0; border-radius: 10px; height: 30px; position: relative; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #ff9800, #ff5722); height: 100%; width: ${usage.percentage}%; border-radius: 10px;"></div>
            </div>
            <p style="text-align: center; margin: 10px 0;"><strong>${usage.used} / ${usage.limit}</strong> ${limitType}</p>
          </div>

          <p>To avoid service interruption, consider upgrading to a higher plan with more ${limitType}.</p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/settings?tab=billing" style="display: inline-block; padding: 12px 30px; background: #ff9800; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Upgrade Now</a>
          </p>

          <p>Best,<br><strong>Telyx Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 5. Limit Reached Email
 */
export const sendLimitReachedEmail = async (email, businessName, limitType, usage, currentPlan) => {
  const nextPlan = currentPlan === 'STARTER' ? 'PROFESSIONAL' : 'ENTERPRISE';
  const subject = `🚫 ${limitType === 'minutes' ? 'Minute' : 'Call'} Limit Reached`;
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f44336; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>🚫 Limit Reached</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${businessName},</p>
          <p>You've reached your monthly limit of <strong>${usage.limit} ${limitType}</strong> on your ${currentPlan} plan.</p>
          
          <div style="background: #ffebee; padding: 20px; border-radius: 5px; border-left: 4px solid #f44336; margin: 20px 0;">
            <p style="margin: 0;"><strong>⚠️ What this means:</strong><br>
            ${limitType === 'minutes' ? 'New calls will not be answered until next month or you upgrade.' : 'You cannot receive more calls this month unless you upgrade.'}</p>
          </div>

          <p><strong>Upgrade to ${nextPlan} to continue:</strong></p>
          <ul>
            <li>${nextPlan === 'PROFESSIONAL' ? '1500 minutes/month' : 'Unlimited minutes'}</li>
            <li>${nextPlan === 'PROFESSIONAL' ? 'Unlimited calls' : 'Unlimited calls'}</li>
            <li>Advanced analytics</li>
            <li>Priority support</li>
          </ul>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/settings?tab=billing" style="display: inline-block; padding: 12px 30px; background: #f44336; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Upgrade to ${nextPlan}</a>
          </p>

          <p><small>Your usage will reset on the 1st of next month.</small></p>

          <p>Best,<br><strong>Telyx Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 6. Payment Success Email
 */
export const sendPaymentSuccessEmail = async (email, businessName, amount, plan) => {
  const subject = '✅ Payment Received - Thank You!';
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4caf50; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>✅ Payment Successful</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${businessName},</p>
          <p>Thank you! We've successfully processed your payment.</p>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;"><strong>Plan:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">${plan}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;"><strong>Amount:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">$${(amount / 100).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0;"><strong>Status:</strong></td>
                <td style="padding: 10px 0; text-align: right; color: #4caf50;"><strong>PAID</strong></td>
              </tr>
            </table>
          </div>

          <p>Your subscription is now active and your assistant is ready to take calls!</p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 30px; background: #4caf50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Go to Dashboard</a>
          </p>

          <p><small>Need an invoice? You can download it from your billing settings.</small></p>

          <p>Best,<br><strong>Telyx Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 7. Payment Failed Email
 */
export const sendPaymentFailedEmail = async (email, businessName) => {
  const subject = '❌ Payment Failed - Action Required';
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f44336; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>❌ Payment Failed</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${businessName},</p>
          <p>We were unable to process your recent payment. Your service may be interrupted if this isn't resolved.</p>
          
          <div style="background: #ffebee; padding: 20px; border-radius: 5px; border-left: 4px solid #f44336; margin: 20px 0;">
            <p style="margin: 0;"><strong>⚠️ Action Required:</strong><br>
            Please update your payment method to continue using Telyx.</p>
          </div>

          <p><strong>Common reasons for payment failure:</strong></p>
          <ul>
            <li>Insufficient funds</li>
            <li>Expired card</li>
            <li>Incorrect billing information</li>
          </ul>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/settings?tab=billing" style="display: inline-block; padding: 12px 30px; background: #f44336; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Update Payment Method</a>
          </p>

          <p>If you need help, please reply to this email.</p>

          <p>Best,<br><strong>Telyx Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 8. Monthly Reset Email
 */
export const sendMonthlyResetEmail = async (email, businessName, plan) => {
  const subject = '🔄 New Month, Fresh Limits!';
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>🔄 New Month Started!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${businessName},</p>
          <p>Good news! Your monthly usage limits have been reset for your ${plan} plan.</p>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
            <p style="margin: 0;"><strong>✨ Your fresh limits:</strong></p>
            <ul style="margin: 15px 0;">
              ${plan === 'STARTER' ? '<li>300 minutes</li><li>50 calls</li>' : ''}
              ${plan === 'PROFESSIONAL' ? '<li>1500 minutes</li><li>Unlimited calls</li>' : ''}
              ${plan === 'ENTERPRISE' ? '<li>Unlimited everything!</li>' : ''}
            </ul>
          </div>

          <p>Your AI assistant is ready to handle calls for another great month!</p>

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/analytics" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">View Analytics</a>
          </p>

          <p>Best,<br><strong>Telyx Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 9. Weekly Summary Email (PRO+ only)
 */
export const sendWeeklySummaryEmail = async (email, businessName, stats) => {
  const subject = `📊 Your Weekly Summary - ${stats.totalCalls} Calls`;
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1>📊 Weekly Summary</h1>
          <p style="margin: 0; font-size: 14px;">Your AI Assistant Performance</p>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${businessName},</p>
          <p>Here's how your AI assistant performed this week:</p>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; border-bottom: 2px solid #11998e; padding-bottom: 10px;">Key Metrics</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                  <strong>Total Calls:</strong>
                </td>
                <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0; text-align: right; font-size: 24px; color: #11998e;">
                  <strong>${stats.totalCalls}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                  <strong>Avg Duration:</strong>
                </td>
                <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">
                  ${stats.avgDuration}
                </td>
              </tr>
              <tr>
                <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0;">
                  <strong>Customer Satisfaction:</strong>
                </td>
                <td style="padding: 15px 0; border-bottom: 1px solid #f0f0f0; text-align: right;">
                  ${stats.satisfaction}% Positive
                </td>
              </tr>
              <tr>
                <td style="padding: 15px 0;">
                  <strong>Busiest Day:</strong>
                </td>
                <td style="padding: 15px 0; text-align: right;">
                  ${stats.busiestDay}
                </td>
              </tr>
            </table>
          </div>

          ${stats.topIntent ? `
          <div style="background: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4caf50;">
            <p style="margin: 0;"><strong>💡 Top Reason for Calls:</strong><br>
            ${stats.topIntent}</p>
          </div>
          ` : ''}

          <p style="text-align: center;">
            <a href="${FRONTEND_URL}/dashboard/analytics" style="display: inline-block; padding: 12px 30px; background: #11998e; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">View Full Report</a>
          </p>

          <p>Keep up the great work!</p>

          <p>Best,<br><strong>Telyx Team</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 10. Email Verification Email
 */
export const sendVerificationEmail = async (email, verificationUrl, businessName) => {
  const subject = '📧 Email Adresinizi Doğrulayın - Telyx';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 14px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .warning { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 Email Doğrulama</h1>
        </div>
        <div class="content">
          <p>Merhaba${businessName ? ` ${businessName}` : ''},</p>
          <p>Telyx hesabınızı oluşturdunuz! Hesabınızı aktif hale getirmek için lütfen email adresinizi doğrulayın.</p>

          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">Email Adresimi Doğrula</a>
          </p>

          <div class="warning">
            <p style="margin: 0;"><strong>⏰ Önemli:</strong> Bu link 24 saat geçerlidir. Süre dolarsa yeni bir doğrulama linki talep edebilirsiniz.</p>
          </div>

          <p style="font-size: 14px; color: #666;">
            Eğer butona tıklayamıyorsanız, aşağıdaki linki tarayıcınıza kopyalayabilirsiniz:<br>
            <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
          </p>

          <p style="font-size: 14px; color: #666;">
            Bu emaili siz talep etmediyseniz, lütfen dikkate almayın.
          </p>

          <p>Teşekkürler,<br><strong>Telyx Ekibi</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

/**
 * 11. Email Changed Verification Email
 */
export const sendEmailChangeVerification = async (newEmail, verificationUrl) => {
  const subject = '📧 Yeni Email Adresinizi Doğrulayın - Telyx';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 14px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .warning { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 Yeni Email Doğrulama</h1>
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

          <p style="font-size: 14px; color: #666;">
            Bu işlemi siz başlatmadıysanız, lütfen bu emaili dikkate almayın ve hesap güvenliğinizi kontrol edin.
          </p>

          <p>Teşekkürler,<br><strong>Telyx Ekibi</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(newEmail, subject, html);
};

export default {
  sendWelcomeEmail,
  sendAssistantCreatedEmail,
  sendPhoneActivatedEmail,
  sendLimitWarningEmail,
  sendLimitReachedEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendMonthlyResetEmail,
  sendWeeklySummaryEmail,
  sendVerificationEmail,
  sendEmailChangeVerification
};
