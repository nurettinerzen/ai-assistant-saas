/**
 * Migration Script: Add Multi-Region Fields
 *
 * This script updates existing businesses to have proper
 * country, language, currency, and timezone defaults.
 *
 * Run with: node scripts/addMultiRegionFields.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default values for existing businesses (Turkey)
const TR_DEFAULTS = {
  country: 'TR',
  language: 'TR',
  currency: 'TRY',
  timezone: 'Europe/Istanbul'
};

async function migrate() {
  console.log('🔄 Starting multi-region migration...\n');

  try {
    // Get all businesses that need updating
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        country: true,
        language: true,
        currency: true,
        timezone: true
      }
    });

    console.log(`📊 Found ${businesses.length} businesses to check\n`);

    let updated = 0;
    let skipped = 0;

    for (const business of businesses) {
      const updates = {};

      // Check and set defaults for missing fields
      if (!business.country || business.country === '') {
        updates.country = TR_DEFAULTS.country;
      }

      if (!business.language || business.language === '') {
        updates.language = TR_DEFAULTS.language;
      }

      if (!business.currency || business.currency === '') {
        updates.currency = TR_DEFAULTS.currency;
      }

      if (!business.timezone || business.timezone === '') {
        updates.timezone = TR_DEFAULTS.timezone;
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await prisma.business.update({
          where: { id: business.id },
          data: updates
        });

        console.log(`✅ Updated business ${business.id} (${business.name}):`, updates);
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`\n📈 Migration complete!`);
    console.log(`   Updated: ${updated} businesses`);
    console.log(`   Skipped: ${skipped} businesses (already had values)`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrate();
