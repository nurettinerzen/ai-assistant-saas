/**
 * Payment Provider Selection Service
 * Determines which payment provider to use based on country
 *
 * TR (Turkey) -> iyzico
 * Other countries -> Stripe
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Countries that should use iyzico
const IYZICO_COUNTRIES = ['TR'];

// Plan price mapping for both providers
export const PLAN_PRICES = {
  STARTER: {
    stripe: {
      priceId: process.env.STRIPE_STARTER_PRICE_ID,
      amount: 27,
      currency: 'USD'
    },
    iyzico: {
      pricingPlanRef: process.env.IYZICO_STARTER_PLAN_REF,
      amount: 899,
      currency: 'TRY'
    }
  },
  PROFESSIONAL: {
    stripe: {
      priceId: process.env.STRIPE_PRO_PRICE_ID,
      amount: 77,
      currency: 'USD'
    },
    iyzico: {
      pricingPlanRef: process.env.IYZICO_PROFESSIONAL_PLAN_REF,
      amount: 2599,
      currency: 'TRY'
    }
  },
  ENTERPRISE: {
    stripe: {
      priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
      amount: 199,
      currency: 'USD'
    },
    iyzico: {
      pricingPlanRef: process.env.IYZICO_ENTERPRISE_PLAN_REF,
      amount: 6799,
      currency: 'TRY'
    }
  }
};

class PaymentProviderService {
  /**
   * Determine payment provider based on business country
   * @param {number} businessId - Business ID
   * @returns {Promise<string>} Provider name: 'stripe' or 'iyzico'
   */
  async getProviderForBusiness(businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { country: true }
    });

    if (!business) {
      return 'stripe'; // Default to Stripe
    }

    return this.getProviderForCountry(business.country);
  }

  /**
   * Determine payment provider based on country code
   * @param {string} country - Country code (e.g., 'TR', 'US')
   * @returns {string} Provider name: 'stripe' or 'iyzico'
   */
  getProviderForCountry(country) {
    if (IYZICO_COUNTRIES.includes(country?.toUpperCase())) {
      return 'iyzico';
    }
    return 'stripe';
  }

  /**
   * Get plan pricing for a specific provider
   * @param {string} planId - Plan ID (STARTER, PROFESSIONAL, ENTERPRISE)
   * @param {string} provider - Provider name ('stripe' or 'iyzico')
   * @returns {Object} Price details
   */
  getPlanPricing(planId, provider) {
    const plan = PLAN_PRICES[planId];
    if (!plan) {
      return null;
    }
    return plan[provider] || null;
  }

  /**
   * Get all available plans with pricing for a provider
   * @param {string} provider - Provider name
   * @returns {Array} List of plans with pricing
   */
  getPlansForProvider(provider) {
    return Object.entries(PLAN_PRICES).map(([planId, prices]) => ({
      id: planId,
      ...prices[provider]
    }));
  }

  /**
   * Check if provider is available and configured
   * @param {string} provider - Provider name
   * @returns {boolean} True if configured
   */
  isProviderConfigured(provider) {
    if (provider === 'stripe') {
      return !!process.env.STRIPE_SECRET_KEY;
    }
    if (provider === 'iyzico') {
      return !!(process.env.IYZICO_API_KEY && process.env.IYZICO_SECRET_KEY);
    }
    return false;
  }

  /**
   * Get subscription info including provider details
   * @param {number} businessId - Business ID
   * @returns {Promise<Object>} Subscription with provider info
   */
  async getSubscriptionWithProvider(businessId) {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      include: {
        business: {
          select: { country: true }
        }
      }
    });

    if (!subscription) {
      return null;
    }

    const expectedProvider = this.getProviderForCountry(subscription.business.country);

    return {
      ...subscription,
      expectedProvider,
      currentProvider: subscription.paymentProvider || 'stripe',
      providerMismatch: expectedProvider !== (subscription.paymentProvider || 'stripe')
    };
  }
}

export default new PaymentProviderService();
