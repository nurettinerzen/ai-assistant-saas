/**
 * TranscriptModal Component
 * Enhanced modal for displaying call transcript with audio player, search, and analysis
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Phone,
  Clock,
  Calendar,
  Download,
  Search,
  Play,
  Pause,
  Volume2,
  FileText,
  Lightbulb,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { formatDate, formatDuration } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export default function TranscriptModal({ callId, isOpen, onClose }) {
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    if (isOpen && callId) {
      loadCallDetails();
    }
  }, [isOpen, callId]);

  const loadCallDetails = async () => {
    setLoading(true);
    try {
      const response = await apiClient.calls.getById(callId);
      setCall(response.data);
    } catch (error) {
      toast.error('Failed to load call details');
      console.error('Load call details error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleDownloadRecording = () => {
    if (call?.recordingUrl) {
      window.open(call.recordingUrl, '_blank');
      toast.success('Opening recording...');
    }
  };

  const handleDownloadTranscript = () => {
    if (!call) return;

    let transcriptText = '';

    if (call.transcript && Array.isArray(call.transcript)) {
      // Format structured transcript
      transcriptText = `Arama Transkripti - ${formatDate(call.createdAt, 'long')}\n`;
      transcriptText += `Telefon: ${call.phoneNumber || call.callerId || 'Bilinmiyor'}\n`;
      transcriptText += `Süre: ${formatDuration(call.duration)}\n`;
      transcriptText += `\n${'='.repeat(60)}\n\n`;

      call.transcript.forEach((msg) => {
        // Handle both formats: speaker/role and text/message
        const speaker = msg.speaker || (msg.role === 'agent' ? 'assistant' : 'user');
        const isAssistant = speaker === 'assistant' || speaker === 'agent';
        const speakerName = isAssistant ? 'Asistan' : 'Müşteri';
        const messageText = msg.text || msg.message || '';

        // Format time - handle both timestamp and time_in_call_secs
        let timeStr = '';
        if (msg.time_in_call_secs !== undefined && msg.time_in_call_secs !== null) {
          const secs = Number(msg.time_in_call_secs) || 0;
          const minutes = Math.floor(secs / 60);
          const seconds = Math.floor(secs % 60);
          timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
        } else if (msg.timestamp) {
          const date = new Date(msg.timestamp);
          if (!isNaN(date.getTime())) {
            timeStr = date.toLocaleTimeString();
          }
        }

        transcriptText += `[${timeStr}] ${speakerName}:\n${messageText}\n\n`;
      });
    } else if (call.transcriptText) {
      transcriptText = call.transcriptText;
    } else {
      toast.error('Transkript bulunamadı');
      return;
    }

    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-transcript-${call.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript downloaded');
  };

  const highlightText = (text) => {
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-neutral-900">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const filteredMessages = call?.transcript?.filter((msg) =>
    searchQuery ? msg.text.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const sentimentColors = {
    positive: 'bg-green-100 text-green-800 border-green-200',
    neutral: 'bg-gray-100 text-gray-800 border-gray-200',
    negative: 'bg-red-100 text-red-800 border-red-200',
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary-600" />
            Call Details & Transcript
          </DialogTitle>
          <DialogDescription>
            {call?.phoneNumber || call?.callerId || 'Bilinmiyor'} • {formatDate(call?.createdAt, 'long')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : !call ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-neutral-500">Call not found</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Audio Player */}
            {call.recordingUrl && (
              <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-neutral-600" />
                    <h4 className="text-sm font-semibold text-neutral-900">Call Recording</h4>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadRecording}
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Download
                  </Button>
                </div>

                <audio
                  ref={audioRef}
                  src={call.recordingUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePlayPause}
                      className="w-20"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="h-3 w-3 mr-1" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Play
                        </>
                      )}
                    </Button>

                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                    />

                    <div className="text-xs text-neutral-600 w-28 text-right">
                      {formatDuration(Math.floor(currentTime))} /{' '}
                      {formatDuration(Math.floor(duration))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-600">Speed:</span>
                    {[0.5, 1, 1.5, 2].map((speed) => (
                      <Button
                        key={speed}
                        variant={playbackSpeed === speed ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleSpeedChange(speed)}
                        className="h-7 px-2 text-xs"
                      >
                        {speed}x
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Call Summary */}
            {call.summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">Call Summary</h4>
                    <p className="text-sm text-blue-800">{call.summary}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Analysis Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sentiment */}
              {call.sentiment && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-neutral-600" />
                    <h4 className="text-xs font-medium text-neutral-500">Sentiment</h4>
                  </div>
                  <Badge className={sentimentColors[call.sentiment] || sentimentColors.neutral}>
                    {call.sentiment.charAt(0).toUpperCase() + call.sentiment.slice(1)}
                  </Badge>
                  {call.sentimentScore !== null && (
                    <p className="text-xs text-neutral-500 mt-2">
                      Score: {(call.sentimentScore * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              )}

              {/* Key Topics */}
              {call.keyTopics && call.keyTopics.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-neutral-600" />
                    <h4 className="text-xs font-medium text-neutral-500">Key Topics</h4>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {call.keyTopics.map((topic, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items */}
              {call.actionItems && call.actionItems.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-neutral-600" />
                    <h4 className="text-xs font-medium text-neutral-500">Action Items</h4>
                  </div>
                  <ul className="space-y-1">
                    {call.actionItems.map((item, index) => (
                      <li key={index} className="text-xs text-neutral-700 flex items-start gap-1">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Separator />

            {/* Transcript Section */}
            {(call.transcript || call.transcriptText) && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-neutral-600" />
                    <h4 className="text-sm font-semibold text-neutral-900">Transcript</h4>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTranscript}
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Download
                  </Button>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="Search within transcript..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Messages */}
                <div className="space-y-3 max-h-96 overflow-y-auto bg-neutral-50 rounded-lg p-4">
                  {call.transcript && Array.isArray(call.transcript) ? (
                    filteredMessages && filteredMessages.length > 0 ? (
                      filteredMessages.map((msg, index) => {
                        // Format time - handle both timestamp and time_in_call_secs
                        const formatMsgTime = () => {
                          // 11Labs format: time_in_call_secs (number of seconds into the call)
                          if (msg.time_in_call_secs !== undefined && msg.time_in_call_secs !== null) {
                            const secs = Number(msg.time_in_call_secs) || 0;
                            const minutes = Math.floor(secs / 60);
                            const seconds = Math.floor(secs % 60);
                            return `${minutes}:${String(seconds).padStart(2, '0')}`;
                          }
                          // Standard timestamp format
                          if (msg.timestamp) {
                            const date = new Date(msg.timestamp);
                            if (!isNaN(date.getTime())) {
                              return date.toLocaleTimeString();
                            }
                          }
                          return '';
                        };

                        // Determine speaker - handle both formats
                        const speaker = msg.speaker || (msg.role === 'agent' ? 'assistant' : 'user');
                        const isAssistant = speaker === 'assistant' || speaker === 'agent';
                        const messageText = msg.text || msg.message || '';

                        return (
                          <div
                            key={index}
                            className={`flex ${isAssistant ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg p-3 ${
                                isAssistant
                                  ? 'bg-blue-100 text-blue-900'
                                  : 'bg-white text-neutral-900 border border-neutral-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">
                                  {isAssistant ? 'Asistan' : 'Müşteri'}
                                </span>
                                {formatMsgTime() && (
                                  <span className="text-xs text-neutral-500">
                                    {formatMsgTime()}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm">{highlightText(messageText)}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center text-neutral-500 py-4">
                        No messages match your search
                      </p>
                    )
                  ) : call.transcriptText ? (
                    <pre className="text-sm text-neutral-700 whitespace-pre-wrap font-sans">
                      {highlightText(call.transcriptText)}
                    </pre>
                  ) : (
                    <p className="text-center text-neutral-500 py-4">
                      No transcript available
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Call Info */}
            <div className="grid grid-cols-2 gap-4 bg-neutral-50 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-neutral-600" />
                <div>
                  <p className="text-xs text-neutral-500">Date & Time</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {formatDate(call.createdAt, 'long')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-neutral-600" />
                <div>
                  <p className="text-xs text-neutral-500">Duration</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {formatDuration(call.duration)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
