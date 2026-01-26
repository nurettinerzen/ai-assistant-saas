/**
 * Test Team Invitation Email
 * Run: node tests/test-invitation-email.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { sendTeamInvitationEmail } from '../src/services/emailService.js';

console.log('\n🧪 TESTING TEAM INVITATION EMAIL\n');

const testData = {
  email: 'test@example.com',
  inviterName: 'John Doe',
  businessName: 'Telyx.AI Demo',
  role: 'MANAGER',
  invitationUrl: 'http://localhost:3001/invitation/abc123def456'
};

console.log('📧 Sending test invitation email...');
console.log('Test data:', JSON.stringify(testData, null, 2));

try {
  const result = await sendTeamInvitationEmail(testData);

  if (result.sent) {
    console.log(`\n✅ Email sent successfully! ID: ${result.id}`);
  } else {
    console.log(`\n⚠️ Email not sent (reason: ${result.reason})`);
    console.log('Email would be displayed in console logs above.');
  }

  console.log('\n🎉 Test completed successfully!\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error);
  process.exit(1);
}
