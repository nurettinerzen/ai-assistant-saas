'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import VoiceCard from '@/components/VoiceCard';
import EmptyState from '@/components/EmptyState';
import { Mic, Search } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

// Language code to accent name mapping
const LANGUAGE_TO_ACCENT = {
  'TR': 'Turkish',
  'EN': 'American',
  'DE': 'German',
  'FR': 'French',
  'ES': 'Spanish',
  'IT': 'Italian',
  'PT': 'Portuguese',
  'RU': 'Russian',
  'AR': 'Arabic',
  'JA': 'Japanese',
  'KO': 'Korean',
  'ZH': 'Chinese',
  'HI': 'Hindi',
  'NL': 'Dutch',
  'PL': 'Polish',
  'SV': 'Swedish',
};

export default function VoicesPage() {
  const { t, locale } = useLanguage();
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [businessLanguage, setBusinessLanguage] = useState('TR');

  // Prevent multiple API calls
  const hasFetchedRef = useRef(false);

  // Load business language - memoized to prevent recreation
  const loadBusinessLanguage = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.businessId) {
        const response = await apiClient.business.get(user.businessId);
        const language = response.data.language || response.data.business?.language || 'TR';
        setBusinessLanguage(language);
      }
    } catch (error) {
      console.error('Failed to load business language:', error);
    }
  }, []);

  // Single useEffect for initial data loading - runs only once
  useEffect(() => {
    // Prevent duplicate calls in strict mode or hot reload
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load business language
        await loadBusinessLanguage();

        // Load voices
        const response = await apiClient.voices.getAll({ withSamples: 'true' });
        const voicesData = response.data.voices || {};
        const allVoices = [];

        Object.keys(voicesData).forEach(lang => {
          if (Array.isArray(voicesData[lang])) {
            allVoices.push(...voicesData[lang].map(v => ({ ...v, language: lang })));
          }
        });

        console.log('🎤 Loaded voices:', allVoices.length, 'from', Object.keys(voicesData).length, 'languages');
        setVoices(allVoices);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load voices');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [loadBusinessLanguage]);

  const handleSelectVoice = (voice) => {
    setSelectedVoice(voice);
    toast.success(`${t('selected')}: ${voice.name}`);
  };

  // Get the preferred accent based on business language
  const preferredAccent = LANGUAGE_TO_ACCENT[businessLanguage] || 'Turkish';

  // Filter voices - ONLY show voices matching business language
  const filteredVoices = voices.filter((voice) => {
    // Always filter by business language - no "all" option for language
    const matchesLanguage = voice.accent === preferredAccent;
    const matchesSearch =
      voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'all' || voice.gender.toLowerCase() === genderFilter;
    return matchesLanguage && matchesSearch && matchesGender;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t('voices')}</h1>
        <p className="text-neutral-600 mt-1">
          {t('voicesDescription')}
        </p>
        {/* 🔧 Business language indicator */}
        {businessLanguage && (
          <p className="text-sm text-primary-600 mt-2">
            📌 {t('businessLanguage')}: {businessLanguage === 'TR' ? 'Türkçe' : 'English'}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder={t('searchVoices')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allGenders')}</SelectItem>
            <SelectItem value="male">{t('male')}</SelectItem>
            <SelectItem value="female">{t('female')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Voices grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-neutral-200 p-6 animate-pulse"
            >
              <div className="h-6 w-32 bg-neutral-200 rounded mb-3"></div>
              <div className="h-4 w-full bg-neutral-200 rounded mb-2"></div>
              <div className="h-4 w-2/3 bg-neutral-200 rounded mb-4"></div>
              <div className="h-10 w-full bg-neutral-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredVoices.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                onSelect={handleSelectVoice}
                isSelected={selectedVoice?.id === voice.id}
                locale={locale}
              />
            ))}
          </div>

          <div className="text-center text-sm text-neutral-500">
            {t('showing')} {filteredVoices.length} {preferredAccent} {t('voices')}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 p-8">
          <EmptyState
            icon={Mic}
            title={t('noVoicesFound')}
            description={t('tryAdjustingFilters')}
          />
        </div>
      )}

      {/* Info banner */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-primary-900 mb-2">
          {t('aboutVoiceSelection')}
        </h3>
        <p className="text-sm text-primary-700">
          {t('voiceSelectionInfo')}
        </p>
      </div>
    </div>
  );
}
