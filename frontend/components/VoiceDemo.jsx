'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useRef, useEffect } from 'react';

// 11Labs Conversational AI Web SDK
// Uses WebSocket connection for voice calls
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function VoiceDemo({ assistantId, onClose }) {
  const { t } = useLanguage();
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const conversationRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (conversationRef.current) {
        endCall();
      }
    };
  }, []);

  const startCall = async () => {
    try {
      console.log('🎯 Starting 11Labs call with assistantId:', assistantId);
      setIsConnecting(true);
      setCallStatus(t('onboarding.voiceDemo.callStatus.starting'));

      // Get signed URL from backend
      const response = await fetch(`${BACKEND_URL}/api/elevenlabs/signed-url/${assistantId}`);

      if (!response.ok) {
        throw new Error('Failed to get signed URL');
      }

      const { signedUrl } = await response.json();
      console.log('✅ Got signed URL for 11Labs conversation');

      // Initialize audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

      // Connect to 11Labs WebSocket
      const ws = new WebSocket(signedUrl);
      conversationRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsCallActive(true);
        setIsConnecting(false);
        setCallStatus(t('onboarding.voiceDemo.callStatus.started'));

        // Start sending audio from microphone
        startMicrophoneCapture(ws);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'audio') {
            // Play received audio
            await playAudio(data.audio);
            setCallStatus(t('onboarding.voiceDemo.callStatus.speaking'));
          } else if (data.type === 'transcript') {
            console.log('📝 Transcript:', data.text);
          } else if (data.type === 'end') {
            console.log('🔴 Conversation ended by server');
            endCall();
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setCallStatus('Error: Connection failed');
        setIsCallActive(false);
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log('🔴 WebSocket closed');
        setIsCallActive(false);
        setCallStatus(t('onboarding.voiceDemo.callStatus.ended'));
      };

    } catch (error) {
      console.error('Start call error:', error);
      setCallStatus('Failed to start call: ' + error.message);
      setIsCallActive(false);
      setIsConnecting(false);
    }
  };

  const startMicrophoneCapture = async (ws) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          // Convert to base64 and send
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            ws.send(JSON.stringify({
              type: 'audio',
              audio: base64
            }));
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorder.start(100); // Send audio chunks every 100ms

      // Store for cleanup
      conversationRef.current.mediaRecorder = mediaRecorder;
      conversationRef.current.stream = stream;

      setCallStatus(t('onboarding.voiceDemo.callStatus.listening'));
    } catch (error) {
      console.error('Microphone error:', error);
      setCallStatus('Microphone access denied');
    }
  };

  const playAudio = async (base64Audio) => {
    try {
      if (!audioContextRef.current) return;

      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const endCall = () => {
    if (conversationRef.current) {
      // Stop media recorder
      if (conversationRef.current.mediaRecorder) {
        conversationRef.current.mediaRecorder.stop();
      }

      // Stop microphone stream
      if (conversationRef.current.stream) {
        conversationRef.current.stream.getTracks().forEach(track => track.stop());
      }

      // Close WebSocket
      if (conversationRef.current.readyState === WebSocket.OPEN) {
        conversationRef.current.close();
      }

      conversationRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsCallActive(false);
    setCallStatus(t('onboarding.voiceDemo.callStatus.ended'));
  };

  const handleClose = () => {
    if (isCallActive) {
      endCall();
    }
    if (onClose) {
      onClose();
    }
  };

  console.log('VoiceDemo rendered with assistantId:', assistantId);

  return (
    <div style={{
      padding: '30px',
      background: '#f0f4ff',
      borderRadius: '10px',
      border: '2px solid #4f46e5',
      textAlign: 'center',
      position: 'relative'
    }}>
      {/* Close Button */}
      {onClose && (
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          x
        </button>
      )}

      <h3 style={{ marginBottom: '15px' }}>🎤 {t('onboarding.voiceDemo.title')}</h3>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
        {assistantId
          ? t('onboarding.voiceDemo.description')
          : t('onboarding.voiceDemo.createAssistantFirst')}
      </p>

      {callStatus && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          background: isCallActive ? '#d4edda' : '#fff3cd',
          borderRadius: '5px',
          fontSize: '14px'
        }}>
          {callStatus}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        {!isCallActive ? (
          <button
            onClick={startCall}
            disabled={!assistantId || isConnecting}
            style={{
              padding: '15px 30px',
              background: assistantId && !isConnecting ? '#4f46e5' : '#e5e7eb',
              color: assistantId && !isConnecting ? 'white' : '#999',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: assistantId && !isConnecting ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {isConnecting ? 'Connecting...' : t('onboarding.voiceDemo.startVoiceTest')}
          </button>
        ) : (
          <button
            onClick={endCall}
            style={{
              padding: '15px 30px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            🔴 {t('onboarding.voiceDemo.endCall')}
          </button>
        )}
      </div>

      <p style={{ fontSize: '12px', color: '#999', marginTop: '15px' }}>
        {t('onboarding.voiceDemo.allowMicrophone')}
      </p>
    </div>
  );
}
