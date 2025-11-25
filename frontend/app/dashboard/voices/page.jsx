/**
 * Voices Page
 * Browse and select 11Labs voices for assistants
 * CREATE NEW FILE: frontend/app/dashboard/voices/page.jsx
 */

'use client';

import React, { useState, useEffect } from 'react';
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
import { toast } from '@/lib/toast';

export default function VoicesPage() {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [selectedVoice, setSelectedVoice] = useState(null);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    setLoading(true);
    try {
      const response = await apiClient.voices.getAll();
      setVoices(response.data.voices || []);
    } catch (error) {
      toast.error('Failed to load voices');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVoice = (voice) => {
    setSelectedVoice(voice);
    toast.success(`Selected: ${voice.name}`);
    // In a real implementation, you might navigate to assistant creation
    // or save this preference
  };

  const filteredVoices = voices.filter((voice) => {
    const matchesSearch =
      voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'all' || voice.gender === genderFilter;
    const matchesLanguage = languageFilter === 'all' || voice.language === languageFilter;
    return matchesSearch && matchesGender && matchesLanguage;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Voices</h1>
        <p className="text-neutral-600 mt-1">
          Choose from premium 11Labs voices for your AI assistants
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search voices..."
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
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="MALE">Male</SelectItem>
            <SelectItem value="FEMALE">Female</SelectItem>
          </SelectContent>
        </Select>
        <Select value={languageFilter} onValueChange={setLanguageFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            <SelectItem value="EN">English</SelectItem>
            <SelectItem value="ES">Spanish</SelectItem>
            <SelectItem value="FR">French</SelectItem>
            <SelectItem value="TR">Turkish</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Voices grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                onSelect={handleSelectVoice}
                isSelected={selectedVoice?.id === voice.id}
              />
            ))}
          </div>
          <div className="text-center text-sm text-neutral-500">
            Showing {filteredVoices.length} of {voices.length} voices
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 p-8">
          <EmptyState
            icon={Mic}
            title="No voices found"
            description="Try adjusting your search or filters"
          />
        </div>
      )}

      {/* Info banner */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-primary-900 mb-2">
          About Voice Selection
        </h3>
        <p className="text-sm text-primary-700">
          All voices are powered by 11Labs, providing natural-sounding AI speech. Each voice has
          been optimized for phone conversations. You can select a voice when creating or editing
          an assistant.
        </p>
      </div>
    </div>
  );
}
