/**
 * Stripe Price Setup Script
 * Creates products and prices for active subscription plans
 * Current rollout scope: TRY only, Starter + Pro
 *
 * YENİ FİYATLAR - Mart 2026
 *
 * Kullanım:
 *   node backend/scripts/setup-stripe-prices.js
 *
 * NOT: Bu script yeni ürünler ve fiyatlar oluşturur.
 * Oluşturulan price ID'leri .env dosyasına eklemeniz gerekir.
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// YENİ FİYATLAR - Mart 2026
// Aktif satış kapsamı: sadece TRY recurring fiyatlar
// STARTER: ₺2.499/ay
// PRO: ₺7.499/ay
const PLANS = {
  STARTER: {
    name: 'Starter Plan - Telyx.AI',
    description: 'Starter aylık plan (TRY), 150 dakika dahil, 3 asistan',
    prices: {
      try: 249900
    },
    interval: 'month'
  },
  PRO: {
    name: 'Pro Plan - Telyx.AI',
    description: 'Pro aylık plan (TRY), 500 dakika dahil, 10 asistan',
    prices: {
      try: 749900
    },
    interval: 'month'
  }
};

// Para birimi format yardımcıları
const CURRENCY_SYMBOLS = {
  try: '₺'
};

function formatAmount(amount, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency.toUpperCase();
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

async function setupStripePrices() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('              STRIPE PRICE SETUP - TELYX.AI                 ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('🚀 Setting up Stripe products and prices...\n');

  const envUpdates = [];
  const createdPrices = [];

  for (const [planId, planConfig] of Object.entries(PLANS)) {
    try {
      console.log(`📦 Creating product for ${planId}...`);

      // Create product
      const product = await stripe.products.create({
        name: planConfig.name,
        description: planConfig.description,
        metadata: {
          plan_id: planId,
          app: 'telyx-ai',
          version: '2026-01'
        }
      });

      console.log(`✅ Product created: ${product.id}`);

      // Create prices for each currency
      for (const [currency, amount] of Object.entries(planConfig.prices)) {
        if (amount === null) {
          console.log(`⏭️  Skipping ${currency.toUpperCase()} price for ${planId} (contact sales)`);
          continue;
        }

        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: amount,
          currency: currency,
          recurring: {
            interval: planConfig.interval
          },
          metadata: {
            plan_id: planId,
            currency: currency,
            version: '2026-01'
          }
        });

        const formattedAmount = formatAmount(amount, currency);

        console.log(`💰 Price created: ${price.id}`);
        console.log(`   Amount: ${formattedAmount} ${currency.toUpperCase()}/month`);

        // Add to env updates
        const envKey = currency === 'usd'
          ? `STRIPE_${planId}_PRICE_ID`
          : `STRIPE_${planId}_PRICE_ID_${currency.toUpperCase()}`;
        envUpdates.push(`${envKey}=${price.id}`);

        createdPrices.push({
          plan: planId,
          currency: currency.toUpperCase(),
          amount: formattedAmount,
          priceId: price.id
        });
      }

      console.log('');

    } catch (error) {
      console.error(`❌ Error creating ${planId}:`, error.message);
    }
  }

  // Print summary table
  console.log('\n' + '═'.repeat(60));
  console.log('📊 CREATED PRICES SUMMARY:');
  console.log('─'.repeat(60));
  console.log('Plan'.padEnd(12) + 'Currency'.padEnd(10) + 'Amount'.padEnd(15) + 'Price ID');
  console.log('─'.repeat(60));
  createdPrices.forEach(p => {
    console.log(
      p.plan.padEnd(12) +
      p.currency.padEnd(10) +
      p.amount.padEnd(15) +
      p.priceId
    );
  });
  console.log('─'.repeat(60));

  // Print .env updates
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Setup complete! Add these to your .env file:\n');
  envUpdates.forEach(update => console.log(update));
  console.log('\n' + '═'.repeat(60));

  console.log('\n⚠️  IMPORTANT: Update your panel to use these new price IDs!');
  console.log('   Eski price ID\'leri artık kullanılmamalıdır.\n');
}

setupStripePrices().catch(console.error);
