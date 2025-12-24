#!/usr/bin/env node

/**
 * Migration Script: Add Multi-Region Fields to Business Model
 *
 * This script adds the 'currency' field to all existing businesses
 * based on their country code.
 *
 * Usage:
 *   node scripts/add-multi-region-fields.js
 *   node scripts/add-multi-region-fields.js --dry-run
 *
 * What it does:
 * 1. Finds all businesses without a currency field
 * 2. Sets currency based on country:
 *    - TR -> TRY
 *    - BR -> BRL
 *    - US -> USD
 *    - etc.
 * 3. Ensures country field has a default value (TR if empty)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Country to currency mapping
const COUNTRY_CURRENCY_MAP = {
  TR: 'TRY',
  BR: 'BRL',
  US: 'USD',
  GB: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  IT: 'EUR',
  AE: 'AED'
};

// Default timezone by country
const COUNTRY_TIMEZONE_MAP = {
  TR: 'Europe/Istanbul',
  BR: 'America/Sao_Paulo',
  US: 'America/New_York',
  GB: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  ES: 'Europe/Madrid',
  NL: 'Europe/Amsterdam',
  IT: 'Europe/Rome',
  AE: 'Asia/Dubai'
};

async function migrate() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Multi-Region Migration Script');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\n[DRY RUN] No changes will be made.\n');
  }

  try {
    // Get all businesses
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        country: true,
        currency: true,
        timezone: true,
        language: true
      }
    });

    console.log(`Found ${businesses.length} businesses to check.\n`);

    let updated = 0;
    let skipped = 0;

    for (const business of businesses) {
      const updates = {};
      let needsUpdate = false;

      // Check country - default to TR if empty/null
      if (!business.country) {
        updates.country = 'TR';
        needsUpdate = true;
      }

      const country = updates.country || business.country || 'TR';

      // Check currency - set based on country
      if (!business.currency) {
        updates.currency = COUNTRY_CURRENCY_MAP[country] || 'USD';
        needsUpdate = true;
      }

      // Check timezone - set based on country if empty
      if (!business.timezone) {
        updates.timezone = COUNTRY_TIMEZONE_MAP[country] || 'Europe/Istanbul';
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`Business ID ${business.id}: "${business.name}"`);
        console.log(`  Current: country=${business.country || 'null'}, currency=${business.currency || 'null'}, timezone=${business.timezone || 'null'}`);
        console.log(`  Updates: ${JSON.stringify(updates)}`);

        if (!isDryRun) {
          await prisma.business.update({
            where: { id: business.id },
            data: updates
          });
          console.log('  Status: Updated');
        } else {
          console.log('  Status: Would update (dry run)');
        }

        updated++;
      } else {
        skipped++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total businesses: ${businesses.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (already had values): ${skipped}`);

    if (isDryRun) {
      console.log('\n[DRY RUN] Run without --dry-run to apply changes.');
    } else {
      console.log('\nMigration completed successfully!');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrate();
