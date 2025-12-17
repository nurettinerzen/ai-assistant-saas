/**
 * VoiceCard Component
 * Voice selection card with play button for 11Labs voices
 */

import React, { useState, useRef } from 'react';
import { Play, Pause, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

export default function VoiceCard({ voice, onSelect, isSelected }) {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const handlePlayPause = (e) => {
    e.stopPropagation();
    
    if (!voice.sampleUrl) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      // Pause all other audio elements
      document.querySelectorAll('audio').forEach(audio => {
        if (audio !== audioRef.current) {
          audio.pause();
        }
      });
      
      audioRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnd = () => {
    setIsPlaying(false);
  };

  return (
    <div
      className={`relative bg-white rounded-xl border-2 p-6 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'border-primary-600 ring-2 ring-primary-100' : 'border-neutral-200 hover:border-neutral-300'
      }`}
      onClick={() => onSelect(voice)}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-4 right-4 bg-primary-600 rounded-full p-1">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Voice info */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">{voice.name}</h3>
        
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary" className="text-xs">
            {t(`dashboard.voicesPage.genders.${voice.gender?.toLowerCase()}`) || voice.gender}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {t(`dashboard.voicesPage.accents.${voice.accent}`) || voice.accent}
          </Badge>
          {voice.language && (
            <Badge variant="outline" className="text-xs">
              {voice.language}
            </Badge>
          )}
        </div>
        
        {voice.description && (
          <p className="text-sm text-neutral-600 line-clamp-2">{voice.description}</p>
        )}
      </div>

      {/* Play button */}
      {voice.sampleUrl ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayPause}
            className="w-full"
          >
            {isPlaying ? (
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
            src={voice.sampleUrl}
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
