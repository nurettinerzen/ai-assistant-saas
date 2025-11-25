'use client';

import { useState } from 'react';
import Vapi from '@vapi-ai/web';

const VAPI_PUBLIC_KEY = '7f454254-027f-4679-8ced-9cd0e5035f8b'; // Senin public key

export default function VoiceDemo({ assistantId }) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [vapi, setVapi] = useState(null);
  const [callStatus, setCallStatus] = useState('');

  const startCall = async () => {
    try {
        console.log('🎯 Starting call with assistantId:', assistantId);
      setCallStatus('Starting call...');
      
      const vapiInstance = new Vapi(VAPI_PUBLIC_KEY);
      setVapi(vapiInstance);

      // Event listeners
      vapiInstance.on('call-start', () => {
        console.log('✅ Call started!');
        setIsCallActive(true);
        setCallStatus('Call started! Speak now...');
      });

      vapiInstance.on('call-end', () => {
        console.log('🔴 Call ended');
        setIsCallActive(false);
        setCallStatus('Call ended');
        setVapi(null);
      });

      vapiInstance.on('speech-start', () => {
        setCallStatus('Assistant is speaking...');
      });

      vapiInstance.on('speech-end', () => {
        setCallStatus('Listening...');
      });

      vapiInstance.on('error', (error) => {
        console.error('VAPI Error:', error);
        setCallStatus('Error: ' + error.message);
        setIsCallActive(false);
      });

      // Start call
      console.log('📞 Calling vapiInstance.start()...');
      await vapiInstance.start(assistantId);

    } catch (error) {
      console.error('Start call error:', error);
      setCallStatus('Failed to start call: ' + error.message);
      setIsCallActive(false);
    }
  };

  const endCall = () => {
    if (vapi) {
      vapi.stop();
    }
  };

    console.log('VoiceDemo rendered with assistantId:', assistantId);

  return (
    <div style={{ 
      padding: '30px', 
      background: '#f0f4ff', 
      borderRadius: '10px', 
      border: '2px solid #4f46e5',
      textAlign: 'center'
    }}>
      <h3 style={{ marginBottom: '15px' }}>🎤 Test Your AI Assistant</h3>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
        {assistantId 
          ? 'Click the button below to start a voice conversation with your AI assistant'
          : 'Please create an assistant first to test'}
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
            disabled={!assistantId}
            style={{
              padding: '15px 30px',
              background: assistantId ? '#4f46e5' : '#e5e7eb',
              color: assistantId ? 'white' : '#999',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: assistantId ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            🎤 Start Voice Test
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
            🔴 End Call
          </button>
        )}
      </div>

      <p style={{ fontSize: '12px', color: '#999', marginTop: '15px' }}>
        💡 Make sure to allow microphone access when prompted
      </p>
    </div>
  );
}