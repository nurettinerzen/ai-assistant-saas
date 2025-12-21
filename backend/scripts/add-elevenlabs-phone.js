#!/usr/bin/env node
/**
 * Add 11Labs phone number to database
 * Run: node scripts/add-elevenlabs-phone.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 11Labs phone number info (from 11Labs API)
const ELEVENLABS_PHONE = {
  phoneNumber: '+14244843754',
  elevenLabsPhoneId: 'phnum_7201kcyy2zmkf6t898ccv45a4v1m',
  label: 'Vicky',
  countryCode: 'US',
  provider: 'ELEVENLABS'
};

// Business ID to assign (default: 1)
const BUSINESS_ID = 1;

async function main() {
  console.log('='.repeat(60));
  console.log('Adding 11Labs Phone Number to Database');
  console.log('='.repeat(60));

  try {
    // Check if phone already exists
    const existing = await prisma.phoneNumber.findFirst({
      where: {
        OR: [
          { phoneNumber: ELEVENLABS_PHONE.phoneNumber },
          { elevenLabsPhoneId: ELEVENLABS_PHONE.elevenLabsPhoneId }
        ]
      }
    });

    if (existing) {
      console.log('\n⚠️ Phone number already exists in database:');
      console.log('   ID:', existing.id);
      console.log('   Phone:', existing.phoneNumber);
      console.log('   elevenLabsPhoneId:', existing.elevenLabsPhoneId);
      console.log('   assistantId:', existing.assistantId);

      // Update if elevenLabsPhoneId is missing
      if (!existing.elevenLabsPhoneId) {
        console.log('\n🔄 Updating elevenLabsPhoneId...');
        await prisma.phoneNumber.update({
          where: { id: existing.id },
          data: { elevenLabsPhoneId: ELEVENLABS_PHONE.elevenLabsPhoneId }
        });
        console.log('✅ Updated!');
      }

      await prisma.$disconnect();
      return;
    }

    // Find first active assistant with 11Labs agent ID
    const assistant = await prisma.assistant.findFirst({
      where: {
        businessId: BUSINESS_ID,
        isActive: true,
        elevenLabsAgentId: { not: null }
      }
    });

    console.log('\n📱 Creating phone number entry:');
    console.log('   Phone:', ELEVENLABS_PHONE.phoneNumber);
    console.log('   11Labs ID:', ELEVENLABS_PHONE.elevenLabsPhoneId);
    console.log('   Business ID:', BUSINESS_ID);
    console.log('   Assistant:', assistant?.name || 'None');

    const phoneNumber = await prisma.phoneNumber.create({
      data: {
        businessId: BUSINESS_ID,
        phoneNumber: ELEVENLABS_PHONE.phoneNumber,
        countryCode: ELEVENLABS_PHONE.countryCode,
        provider: ELEVENLABS_PHONE.provider,
        elevenLabsPhoneId: ELEVENLABS_PHONE.elevenLabsPhoneId,
        assistantId: assistant?.id || null,
        status: 'ACTIVE',
        monthlyCost: 2.00, // $2/month for US numbers
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    console.log('\n✅ Phone number added successfully!');
    console.log('   DB ID:', phoneNumber.id);
    console.log('   Phone:', phoneNumber.phoneNumber);
    console.log('   elevenLabsPhoneId:', phoneNumber.elevenLabsPhoneId);
    console.log('   assistantId:', phoneNumber.assistantId);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
