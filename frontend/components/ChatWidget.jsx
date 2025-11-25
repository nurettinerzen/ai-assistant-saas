/**
 * ChatWidget Component
 * Embeddable voice chat widget powered by VAPI
 * Can be customized and embedded on any website
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Phone, X, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Vapi from '@vapi-ai/web';

export default function ChatWidget({ 
  assistantId, 
  position = 'bottom-right',
  primaryColor = '#6366f1',
  showBranding = true,
  buttonText = 'Talk to us',
  vapiPublicKey
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [vapi, setVapi] = useState(null);

  // Initialize VAPI
  useEffect(() => {
    if (vapiPublicKey) {
      const vapiInstance = new Vapi(vapiPublicKey);
      setVapi(vapiInstance);

      // Event listeners
      vapiInstance.on('call-start', () => {
        console.log('Call started');
        setIsConnected(true);
        setIsConnecting(false);
        addMessage('system', 'Connected! Start speaking...');
      });

      vapiInstance.on('call-end', () => {
        console.log('Call ended');
        setIsConnected(false);
        setIsConnecting(false);
        addMessage('system', 'Call ended');
      });

      vapiInstance.on('speech-start', () => {
        console.log('User started speaking');
      });

      vapiInstance.on('speech-end', () => {
        console.log('User stopped speaking');
      });

      vapiInstance.on('message', (message) => {
        console.log('Message:', message);
        if (message.type === 'transcript' && message.transcriptType === 'final') {
          if (message.role === 'user') {
            addMessage('user', message.transcript);
          } else if (message.role === 'assistant') {
            addMessage('assistant', message.transcript);
          }
        }
      });

      vapiInstance.on('error', (error) => {
        console.error('VAPI Error:', error);
        setIsConnecting(false);
        setIsConnected(false);
        addMessage('system', 'Connection error. Please try again.');
      });

      return () => {
        vapiInstance.stop();
      };
    }
  }, [vapiPublicKey]);

  const addMessage = (role, content) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  };

  const handleStartCall = async () => {
    if (!vapi || !assistantId) {
      console.error('VAPI or assistantId not available');
      return;
    }

    setIsConnecting(true);
    try {
      await vapi.start(assistantId);
    } catch (error) {
      console.error('Failed to start call:', error);
      setIsConnecting(false);
      addMessage('system', 'Failed to connect. Please try again.');
    }
  };

  const handleEndCall = () => {
    if (vapi) {
      vapi.stop();
      setIsConnected(false);
    }
  };

  const toggleMute = () => {
    if (vapi && isConnected) {
      vapi.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-50`}>
      {/* Chat Window */}
      {isOpen && (
        <div 
          className="mb-4 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
          style={{ maxHeight: '500px' }}
        >
          {/* Header */}
          <div 
            className="p-4 text-white flex items-center justify-between"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              <span className="font-semibold">Voice Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 rounded p-1 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="p-4 h-64 overflow-y-auto bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <Phone className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">Start a voice conversation</p>
                <p className="text-xs mt-1">Click the button below to begin</p>
              </div>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-3 ${
                  msg.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                <div
                  className={`inline-block px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : msg.role === 'assistant'
                      ? 'bg-white text-gray-800 border border-gray-200'
                      : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  }`}
                >
                  {msg.content}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="p-4 border-t border-gray-200 bg-white">
            {!isConnected && !isConnecting && (
              <Button
                onClick={handleStartCall}
                className="w-full"
                style={{ backgroundColor: primaryColor }}
              >
                <Phone className="h-4 w-4 mr-2" />
                Start Voice Call
              </Button>
            )}

            {isConnecting && (
              <Button disabled className="w-full">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </Button>
            )}

            {isConnected && (
              <div className="flex gap-2">
                <Button
                  onClick={toggleMute}
                  variant="outline"
                  className="flex-1"
                >
                  {isMuted ? (
                    <MicOff className="h-4 w-4 mr-2" />
                  ) : (
                    <Mic className="h-4 w-4 mr-2" />
                  )}
                  {isMuted ? 'Unmute' : 'Mute'}
                </Button>
                <Button
                  onClick={handleEndCall}
                  variant="destructive"
                  className="flex-1"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  End Call
                </Button>
              </div>
            )}
          </div>

          {/* Branding */}
          {showBranding && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-center">
              <span className="text-xs text-gray-500">
                Powered by <span className="font-semibold">Telyx</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full p-4 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        style={{ backgroundColor: primaryColor }}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Phone className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}
