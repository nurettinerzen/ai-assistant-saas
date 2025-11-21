import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  // Subscription planlarını oluştur (bir kere çalıştır)
  async createProducts() {
    try {
      const basicProduct = await stripe.products.create({
        name: 'Basic Plan',
        description: '1 AI Assistant + 1 Phone Number + Unlimited Training'
      });

      const basicPrice = await stripe.prices.create({
        product: basicProduct.id,
        unit_amount: 2900,
        currency: 'usd',
        recurring: { interval: 'month' }
      });

      console.log('✅ Basic Plan created:', basicPrice.id);
      return { basicPrice: basicPrice.id };

    } catch (error) {
      console.error('Create products error:', error);
      throw error;
    }
  }

  // Customer oluştur
  async createCustomer(email, name) {
    try {
      return await stripe.customers.create({ email, name });
    } catch (error) {
      console.error('Create customer error:', error);
      throw error;
    }
  }

  // Checkout session oluştur
  async createCheckoutSession(stripeCustomerId, priceId, successUrl, cancelUrl, businessId) {
    try {
      return await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          businessId
        }
      });

    } catch (error) {
      console.error('Create checkout session error:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId) {
    try {
      return await stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      console.error('Cancel subscription error:', error);
      throw error;
    }
  }

  async getSubscription(subscriptionId) {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Get subscription error:', error);
      throw error;
    }
  }
}

export default new StripeService();
