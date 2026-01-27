/**
 * Fix Email Styles - Convert CSS classes to inline styles
 * This ensures email templates render correctly across all email clients
 */

import fs from 'fs';

const filePath = './src/services/emailService.js';
let content = fs.readFileSync(filePath, 'utf8');

// Define style mappings from class to inline style
const styleMap = {
  'class="container"': 'style="max-width: 600px; margin: 0 auto; padding: 20px;"',
  'class="header"': 'style="background-color: #667eea; color: #ffffff; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;"',
  'class="content"': 'style="background-color: #ffffff; padding: 40px 30px; border-radius: 0 0 12px 12px;"',
  'class="button"': 'style="display: inline-block; padding: 16px 48px; background-color: #667eea; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;"',
  'class="footer"': 'style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;"',
  'class="link"': 'style="color: #667eea; word-break: break-all;"',
  'class="warning"': 'style="background-color: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 24px 0;"',
  'class="tip"': 'style="background-color: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 24px 0;"',
  'class="steps"': 'style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0;"',
  'class="balance-box"': 'style="background-color: #fef3c7; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0;"',
  'class="balance"': 'style="font-size: 32px; font-weight: bold; color: #d97706;"',
  'class="invoice-box"': 'style="background-color: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0;"',
  'class="phone-box"': 'style="background-color: #ecfdf5; padding: 24px; border-radius: 8px; text-align: center; margin: 24px 0; border: 2px solid: #10b981;"',
  'class="phone"': 'style="font-size: 32px; font-weight: bold; color: #059669;"',
  'class="usage-box"': 'style="background-color: #fef3c7; padding: 24px; border-radius: 8px; margin: 24px 0;"',
  'class="warning-box"': 'style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 24px 0;"',
  'class="limits-box"': 'style="background-color: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e5e7eb;"',
  'class="stats-box"': 'style="background-color: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0;"',
  'class="insight-box"': 'style="background-color: #ecfdf5; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; margin: 24px 0;"',
  'class="step"': 'style="padding: 8px 0; color: #333333;"',
  'class="invoice-row"': 'style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb;"',
  'class="progress-bar"': 'style="background-color: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden; margin: 16px 0;"',
  'class="progress-fill"': 'style="background-color: #667eea; height: 100%; transition: width 0.3s ease;"',
  'class="stat-row"': 'style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb;"',
  'class="stat-value"': 'style="font-weight: bold; color: #10b981;"'
};

// Also need to fix body and h1 tags
content = content.replace(
  /<body>/g,
  '<body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f4f4f5;">'
);

// Fix h1 tags in header
content = content.replace(
  /<h1 style="margin: 0; font-size: 24px; font-weight: 600;">/g,
  '<h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">'
);

// Replace all class-based styling with inline styles
Object.entries(styleMap).forEach(([className, inlineStyle]) => {
  const regex = new RegExp(className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, inlineStyle);
});

// Remove <style> tags and their content
content = content.replace(/<style>[\s\S]*?<\/style>/g, '');

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Email styles fixed!');
console.log('📧 All class-based styles converted to inline styles');
console.log('🎨 Email templates should now render correctly in all email clients');
