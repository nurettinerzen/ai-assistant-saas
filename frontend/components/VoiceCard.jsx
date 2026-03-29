/**
 * VoiceCard Component
 * Voice selection card with play button for 11Labs voices
 */

import React, { useState, useRef, useCallback } from 'react';
import { Play, Pause, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

export default function VoiceCard({ voice, onSelect, isSelected, compact = false }) {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);

  const handlePlayPause = useCallback(async (e) => {
    e.stopPropagation();

    if (!voice.sampleUrl) return;

    // If playing, just pause
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    // If loading, ignore
    if (isLoading) return;

    // Pause all other audio elements on page
    document.querySelectorAll('audio').forEach(audio => {
      if (audio !== audioRef.current) {
        audio.pause();
      }
    });

    // If we already have a blob URL cached, play directly
    if (blobUrlRef.current && audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Audio play failed:', err);
      }
      return;
    }

    // Fetch audio as blob (handles slow TTS endpoints properly)
    setIsLoading(true);
    try {
      const response = await fetch(voice.sampleUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Failed to load voice preview:', err);
    } finally {
      setIsLoading(false);
    }
  }, [voice.sampleUrl, isPlaying, isLoading]);

  const handleAudioEnd = () => {
    setIsPlaying(false);
  };

  return (
    <div
      className={`relative bg-white dark:bg-neutral-900 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
        compact ? 'p-3' : 'p-6'
      } ${
        isSelected ? 'border-primary-600 ring-2 ring-primary-100 dark:ring-primary-900' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
      }`}
      onClick={() => onSelect(voice)}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className={`absolute ${compact ? 'top-2 right-2' : 'top-4 right-4'} bg-primary-600 rounded-full p-1`}>
          <Check className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Voice info */}
      <div className={compact ? 'mb-2' : 'mb-4'}>
        <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-neutral-900 dark:text-white ${compact ? 'mb-1' : 'mb-2'}`}>{voice.name}</h3>

        <div className="flex flex-wrap gap-1.5 mb-2">
          <Badge variant="secondary" className="text-xs">
            {t(`dashboard.voicesPage.genders.${voice.gender?.toLowerCase()}`) || voice.gender}
          </Badge>
          {!compact && (
            <Badge variant="outline" className="text-xs">
              {t(`dashboard.voicesPage.accents.${voice.accent}`) || voice.accent}
            </Badge>
          )}
          {!compact && voice.language && (
            <Badge variant="outline" className="text-xs">
              {voice.language}
            </Badge>
          )}
        </div>

        {voice.description && !compact && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">{voice.description}</p>
        )}
        {voice.description && compact && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">{voice.description}</p>
        )}
      </div>

      {/* Play button */}
      {voice.sampleUrl ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayPause}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('dashboard.voicesPage.loadingSample')}
              </>
            ) : isPlaying ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                {t('dashboard.voicesPage.pauseSample')}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {t('dashboard.voicesPage.playSample')}
              </>
            )}
          </Button>

          <audio
            ref={audioRef}
            onEnded={handleAudioEnd}
            className="hidden"
          />
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled
          className="w-full opacity-50"
        >
          <Play className="h-4 w-4 mr-2" />
          {t('dashboard.voicesPage.sampleNotAvailable')}
        </Button>
      )}
    </div>
  );
}
