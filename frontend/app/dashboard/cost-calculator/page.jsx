'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { DollarSign, Calculator, TrendingDown, Phone, Clock, Users, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

// Pricing constants
const USD_TO_TRY = 35;
const PRICING = {
  USD: {
    baseFee: 29,
    perMinuteRate: 0.10,
    employeeCost: 2500,
    symbol: '$'
  },
  TRY: {
    baseFee: 299,
    perMinuteRate: 3.50,
    employeeCost: 50000,
    symbol: '₺'
  }
};

export default function CostCalculatorPage() {
  const { t } = useLanguage();
  const [callsPerMonth, setCallsPerMonth] = useState(500);
  const [avgDuration, setAvgDuration] = useState(5);
  const [calculation, setCalculation] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [userCountry, setUserCountry] = useState('US');

  // Determine currency based on user's country
  const isTurkishUser = userCountry === 'TR';
  const currency = isTurkishUser ? 'TRY' : 'USD';
  const pricing = PRICING[currency];
  const currencySymbol = pricing.symbol;

  useEffect(() => {
    loadUserCountry();
  }, []);

  useEffect(() => {
    calculateCost();
  }, [callsPerMonth, avgDuration, currency]);

  const loadUserCountry = async () => {
    try {
      const res = await apiClient.settings.getProfile();
      const country = res.data?.business?.country || 'US';
      setUserCountry(country);
    } catch (error) {
      console.error('Failed to load user country:', error);
    }
  };

  const calculateCost = async () => {
    setIsCalculating(true);
    try {
      // Local calculation with currency-specific pricing
      const totalMinutes = callsPerMonth * avgDuration;
      const usageCost = totalMinutes * pricing.perMinuteRate;
      const totalCost = pricing.baseFee + usageCost;
      const savings = pricing.employeeCost - totalCost;

      setCalculation({
        input: { callsPerMonth, avgDuration, totalMinutes },
        breakdown: {
          baseFee: pricing.baseFee,
          perMinuteRate: pricing.perMinuteRate,
          usageCost,
          totalCost
        },
        comparison: {
          employeeCost: pricing.employeeCost,
          savings: Math.max(0, savings),
          savingsPercentage: Math.max(0, Math.round((savings / pricing.employeeCost) * 100))
        }
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Format currency
  const formatMoney = (amount) => {
    if (amount === undefined || amount === null) return `${currencySymbol}0`;
    return `${currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-8 w-8 text-primary" />
          {t('dashboard.costCalculatorPage.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('dashboard.costCalculatorPage.description')}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Calculator Inputs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              {t('dashboard.costCalculatorPage.expectedCalls')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Calls Per Month Slider */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">
                  {t('dashboard.costCalculatorPage.expectedCalls')}
                </label>
                <span className="text-2xl font-bold text-primary">
                  {callsPerMonth.toLocaleString()}
                </span>
              </div>
              <Slider
                value={[callsPerMonth]}
                onValueChange={(value) => setCallsPerMonth(value[0])}
                max={10000}
                min={0}
                step={50}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>5,000</span>
                <span>10,000</span>
              </div>
            </div>

            {/* Average Duration Slider */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t('dashboard.costCalculatorPage.avgCallDurationLabel')}
                </label>
                <span className="text-2xl font-bold text-primary">
                  {avgDuration} {t('dashboard.costCalculatorPage.minutesLabel')}
                </span>
              </div>
              <Slider
                value={[avgDuration]}
                onValueChange={(value) => setAvgDuration(value[0])}
                max={30}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 min</span>
                <span>15 min</span>
                <span>30 min</span>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">
                {t('dashboard.costCalculatorPage.costBreakdown')}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>{t('dashboard.costCalculatorPage.baseFee')}</span>
                  <span>{formatMoney(pricing.baseFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{calculation?.input?.totalMinutes?.toLocaleString() || 0} min × {currencySymbol}{pricing.perMinuteRate.toFixed(2)}</span>
                  <span>{formatMoney(calculation?.breakdown?.usageCost)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-6">
          {/* Your Cost Card */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {t('dashboard.costCalculatorPage.yourEstimatedCost')}
                </p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-primary">
                    {formatMoney(calculation?.breakdown?.totalCost)}
                  </span>
                  <span className="text-muted-foreground">{t('dashboard.subscriptionPage.perMonth')}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {callsPerMonth.toLocaleString()} {t('dashboard.costCalculatorPage.callsPerMonth')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                {t('dashboard.costCalculatorPage.vsHiringEmployee')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <span className="text-red-600 dark:text-red-400">
                    {t('dashboard.costCalculatorPage.employeeCost')}
                  </span>
                  <span className="text-xl font-bold text-red-600 dark:text-red-400">
                    {formatMoney(pricing.employeeCost)}/{t('dashboard.costCalculatorPage.perMonthShort')}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <span className="text-green-600 dark:text-green-400">
                    {t('dashboard.costCalculatorPage.youSave')}
                  </span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatMoney(calculation?.comparison?.savings)}/{t('dashboard.costCalculatorPage.perMonthShort')}
                  </span>
                </div>

                <div className="text-center pt-2">
                  <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                    <TrendingDown className="h-4 w-4" />
                    {calculation?.comparison?.savingsPercentage || 0}% {t('dashboard.costCalculatorPage.cheaper')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Button
            className="w-full h-14 text-lg gap-2"
            onClick={() => {
              window.location.href = '/dashboard/subscription';
            }}
          >
            {t('dashboard.costCalculatorPage.startFreeTrial')}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
