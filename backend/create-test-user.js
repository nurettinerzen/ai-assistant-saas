/**
 * Test User Creation Script
 * Creates a test user for local development
 *
 * Usage:
 *   node create-test-user.js
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('🔄 Creating test user...\n');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'test@test.com' }
    });

    if (existingUser) {
      console.log('⚠️  User test@test.com already exists!');
      console.log('   User ID:', existingUser.id);
      console.log('   Business ID:', existingUser.businessId);
      console.log('\n💡 Use this to login:');
      console.log('   Email: test@test.com');
      console.log('   Password: test123\n');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('test123', 10);

    // Create business with user and subscription
    const business = await prisma.business.create({
      data: {
        name: 'Test Business',
        chatEmbedKey: 'emb_' + crypto.randomBytes(16).toString('hex'),
        businessType: 'OTHER',
        country: 'TR',
        currency: 'TRY',
        language: 'TR',
        timezone: 'Europe/Istanbul',
        users: {
          create: {
            email: 'test@test.com',
            password: hashedPassword,
            role: 'OWNER',
            emailVerified: true,
            onboardingCompleted: true
          }
        },
        subscription: {
          create: {
            plan: 'TRIAL',
            status: 'TRIAL',
            balance: 0,
            trialMinutesUsed: 0,
            includedMinutesUsed: 0,
            concurrentLimit: 1,
            activeCalls: 0
          }
        }
      },
      include: {
        users: true,
        subscription: true
      }
    });

    console.log('✅ Test user created successfully!\n');
    console.log('📧 Email: test@test.com');
    console.log('🔑 Password: test123');
    console.log('🏢 Business:', business.name);
    console.log('👤 User ID:', business.users[0].id);
    console.log('🏪 Business ID:', business.id);
    console.log('💳 Plan:', business.subscription.plan);
    console.log('\n🚀 You can now login with these credentials!\n');

  } catch (error) {
    console.error('❌ Error creating test user:', error);

    if (error.code === 'P2002') {
      console.log('\n💡 User might already exist. Try:');
      console.log('   Email: test@test.com');
      console.log('   Password: test123\n');
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
