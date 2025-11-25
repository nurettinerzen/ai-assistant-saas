import express from 'express';

const router = express.Router();

// GET /api/cost-calculator/calculate
router.post('/calculate', async (req, res) => {
  try {
    const { callsPerMonth, avgDuration } = req.body;
    
    // Validate inputs
    const calls = Math.max(0, Math.min(10000, parseInt(callsPerMonth) || 0));
    const duration = Math.max(1, Math.min(30, parseInt(avgDuration) || 5));
    
    // Pricing: $0.10 per minute + $29 base fee
    const baseFee = 29;
    const perMinuteRate = 0.10;
    const totalMinutes = calls * duration;
    const usageCost = totalMinutes * perMinuteRate;
    const totalCost = baseFee + usageCost;
    
    // Employee comparison
    const employeeCost = 2500; // Average cost per month for a receptionist
    const savings = employeeCost - totalCost;
    const savingsPercentage = Math.round((savings / employeeCost) * 100);
    
    res.json({
      input: {
        callsPerMonth: calls,
        avgDuration: duration,
        totalMinutes
      },
      breakdown: {
        baseFee,
        perMinuteRate,
        usageCost: Math.round(usageCost * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100
      },
      comparison: {
        employeeCost,
        savings: Math.max(0, Math.round(savings * 100) / 100),
        savingsPercentage: Math.max(0, savingsPercentage)
      }
    });
  } catch (error) {
    console.error('Cost calculator error:', error);
    res.status(500).json({ error: 'Failed to calculate cost' });
  }
});

// GET /api/cost-calculator/pricing
router.get('/pricing', async (req, res) => {
  try {
    res.json({
      baseFee: 29,
      perMinuteRate: 0.10,
      currency: 'USD',
      plans: [
        {
          name: 'Starter',
          price: 29,
          minutes: 300,
          calls: 50,
          assistants: 1,
          phoneNumbers: 1
        },
        {
          name: 'Professional',
          price: 77,
          minutes: 1500,
          calls: -1, // unlimited
          assistants: 2,
          phoneNumbers: 3
        },
        {
          name: 'Enterprise',
          price: 199,
          minutes: -1, // unlimited
          calls: -1,
          assistants: 5,
          phoneNumbers: 10
        }
      ]
    });
  } catch (error) {
    console.error('Pricing error:', error);
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

export default router;
