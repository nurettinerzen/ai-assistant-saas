/**
 * Stripe Price Setup Script
 * Creates products and prices for all subscription plans
 * Supports multiple currencies (USD, TRY)
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  STARTER: {
    name: 'Starter Plan',
    description: '300 minutes, 50 calls per month, 1 assistant',
    prices: {
      usd: 2700, // $27.00 in cents
      try: 79900 // ₺799.00 in kuruş
    },
    interval: 'month'
  },
  PROFESSIONAL: {
    name: 'Professional Plan',
    description: '1500 minutes, unlimited calls, 2 assistants',
    prices: {
      usd: 7700, // $77.00 in cents
      try: 349900 // ₺3499.00 in kuruş
    },
    interval: 'month'
  },
  ENTERPRISE: {
    name: 'Enterprise Plan',
    description: 'Unlimited minutes and calls, 5 assistants - Contact sales',
    prices: {
      usd: null, // Contact sales
      try: null // İletişime geçin
    },
    interval: 'month'
  }
};

async function setupStripePrices() {
  console.log('🚀 Setting up Stripe products and prices...\n');

  const envUpdates = [];

  for (const [planId, planConfig] of Object.entries(PLANS)) {
    try {
      console.log(`📦 Creating product for ${planId}...`);

      // Create product
      const product = await stripe.products.create({
        name: planConfig.name,
        description: planConfig.description,
        metadata: {
          plan_id: planId,
          app: 'telyx-ai'
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
            currency: currency
          }
        });

        const formattedAmount = currency === 'usd'
          ? `$${amount / 100}`
          : `₺${amount / 100}`;

        console.log(`💰 Price created: ${price.id}`);
        console.log(`   Amount: ${formattedAmount} ${currency.toUpperCase()}/month`);

        // Add to env updates
        const envKey = currency === 'usd'
          ? `STRIPE_${planId}_PRICE_ID`
          : `STRIPE_${planId}_PRICE_ID_${currency.toUpperCase()}`;
        envUpdates.push(`${envKey}=${price.id}`);
      }

      console.log('');

    } catch (error) {
      console.error(`❌ Error creating ${planId}:`, error.message);
    }
  }

  // Print .env updates
  console.log('\n' + '='.repeat(60));
  console.log('✅ Setup complete! Add these to your .env file:\n');
  envUpdates.forEach(update => console.log(update));
  console.log('='.repeat(60) + '\n');
}

setupStripePrices().catch(console.error);
