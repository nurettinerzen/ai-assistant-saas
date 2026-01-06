/**
 * Stripe Price Setup Script
 * Creates products and prices for all subscription plans
 * Supports multiple currencies (USD, TRY, EUR, GBP, BRL)
 *
 * YENİ FİYATLAR - Ocak 2026
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

// YENİ FİYATLAR - Ocak 2026
// plans.js ile uyumlu güncel fiyatlar
// STARTER: ₺2.499/ay, 150 dk dahil, 3 asistan
// PRO: ₺7.499/ay, 500 dk dahil, 10 asistan
const PLANS = {
  STARTER: {
    name: 'Starter Plan - Telyx.AI',
    description: '150 dakika dahil, sınırsız arama, 3 asistan, sınırsız telefon numarası, aşım: 23₺/dk',
    prices: {
      try: 249900,  // ₺2,499.00 in kuruş
      usd: 5500,    // $55.00 in cents
      eur: 5000,    // €50.00 in cents
      gbp: 4300,    // £43.00 in pence
      brl: 50000    // R$500.00 in centavos
    },
    interval: 'month'
  },
  PRO: {
    name: 'Pro Plan - Telyx.AI',
    description: '500 dakika dahil, sınırsız arama, 10 asistan, sınırsız telefon numarası, aşım: 23₺/dk',
    prices: {
      try: 749900,  // ₺7,499.00 in kuruş
      usd: 16700,   // $167.00 in cents
      eur: 15000,   // €150.00 in cents
      gbp: 13000,   // £130.00 in pence
      brl: 150000   // R$1,500.00 in centavos
    },
    interval: 'month'
  },
  ENTERPRISE: {
    name: 'Enterprise Plan - Telyx.AI',
    description: 'Özel dakika, sınırsız arama, sınırsız asistan - Satışa ulaşın',
    prices: {
      try: null,    // Satış ile iletişim
      usd: null,    // Contact sales
      eur: null,
      gbp: null,
      brl: null
    },
    interval: 'month'
  }
};

// Para birimi format yardımcıları
const CURRENCY_SYMBOLS = {
  try: '₺',
  usd: '$',
  eur: '€',
  gbp: '£',
  brl: 'R$'
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
