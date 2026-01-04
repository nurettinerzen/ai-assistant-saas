/**
 * Chat Widget Settings Page
 * Configure and generate embed code for chat widget
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, ExternalLink, Code, Eye, Lock } from 'lucide-react';
import { toast } from 'sonner';
import ChatWidget from '@/components/ChatWidget';
import axios from 'axios';
import { apiClient } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ChatWidgetPage() {
  const { t, locale } = useLanguage();
  const [isEnabled, setIsEnabled] = useState(false);
  const [position, setPosition] = useState('bottom-right');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [showBranding, setShowBranding] = useState(true);
  const [buttonText, setButtonText] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [placeholderText, setPlaceholderText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [assistantId, setAssistantId] = useState('');
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);

  // Set default texts based on current locale
  useEffect(() => {
    if (!buttonText) {
      setButtonText(t('dashboard.chatWidgetPage.defaultButtonText'));
    }
    if (!welcomeMessage) {
      setWelcomeMessage(t('dashboard.chatWidgetPage.defaultWelcomeMessage'));
    }
    if (!placeholderText) {
      setPlaceholderText(t('dashboard.chatWidgetPage.defaultPlaceholder'));
    }
  }, [locale]);

  useEffect(() => {
    loadAssistants();
    loadSettings();
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const res = await apiClient.subscription.getCurrent();
      const planId = res.data?.planId || '';
      // Pro or higher plans can remove branding
      setIsPro(['professional', 'enterprise'].includes(planId));
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const loadAssistants = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/assistants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allAssistants = response.data.assistants || [];
      setAssistants(allAssistants);

      // Check if we have a saved assistantId in localStorage
      const saved = localStorage.getItem('chatWidgetSettings');
      const savedSettings = saved ? JSON.parse(saved) : {};

      if (savedSettings.assistantId && allAssistants.find(a => a.id === savedSettings.assistantId)) {
        // Use saved assistant if it still exists
        setAssistantId(savedSettings.assistantId);
      } else if (allAssistants.length > 0) {
        // Find first inbound assistant, or fallback to first assistant
        const inboundAssistant = allAssistants.find(a => a.callDirection === 'inbound' || !a.callDirection);
        setAssistantId(inboundAssistant?.id || allAssistants[0].id);
      }
    } catch (error) {
      console.error('Failed to load assistants:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = () => {
    // Load from localStorage (in production, this would come from backend)
    const saved = localStorage.getItem('chatWidgetSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      setIsEnabled(settings.isEnabled || false);
      setPosition(settings.position || 'bottom-right');
      setPrimaryColor(settings.primaryColor || '#6366f1');
      setShowBranding(settings.showBranding !== undefined ? settings.showBranding : true);
      if (settings.buttonText) setButtonText(settings.buttonText);
      if (settings.welcomeMessage) setWelcomeMessage(settings.welcomeMessage);
      if (settings.placeholderText) setPlaceholderText(settings.placeholderText);
      setAssistantId(settings.assistantId || '');
    }
  };

  const saveSettings = () => {
    const settings = {
      isEnabled,
      position,
      primaryColor,
      showBranding: isPro ? showBranding : true, // Free users always show branding
      buttonText,
      welcomeMessage,
      placeholderText,
      assistantId
    };
    localStorage.setItem('chatWidgetSettings', JSON.stringify(settings));
    toast.success(t('dashboard.chatWidgetPage.settingsSaved'));
  };

  const generateEmbedCode = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const positionMap = {
    'bottom-right': 'bottom: 20px; right: 20px;',
    'bottom-left': 'bottom: 20px; left: 20px;',
    'top-right': 'top: 20px; right: 20px;',
    'top-left': 'top: 20px; left: 20px;'
  };

  // Use actual values or fallback to translated defaults
  const actualButtonText = buttonText || t('dashboard.chatWidgetPage.defaultButtonText');
  const actualWelcomeMessage = welcomeMessage || t('dashboard.chatWidgetPage.defaultWelcomeMessage');
  const actualPlaceholder = placeholderText || t('dashboard.chatWidgetPage.defaultPlaceholder');
  // Free users can't disable branding
  const actualShowBranding = isPro ? showBranding : true;

  return `<!-- Telyx.ai Chat Widget -->
<script>
(function() {
  var CONFIG = {
    assistantId: '${assistantId}',
    apiUrl: '${apiUrl}',
    position: '${positionMap[position] || positionMap['bottom-right']}',
    primaryColor: '${primaryColor}',
    buttonText: '${actualButtonText}',
    welcomeMessage: '${actualWelcomeMessage}',
    placeholderText: '${actualPlaceholder}',
    showBranding: ${actualShowBranding}
  };

  // Styles
  var style = document.createElement('style');
  style.textContent = \`
    #telyx-widget-container * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    #telyx-widget-btn {
      position: fixed; \${CONFIG.position}
      width: 60px; height: 60px; border-radius: 50%;
      background: \${CONFIG.primaryColor}; border: none; cursor: pointer;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      z-index: 99999; transition: all 0.3s ease;
      display: flex; align-items: center; justify-content: center;
    }
    #telyx-widget-btn:hover { transform: scale(1.1); }
    #telyx-widget-btn svg { width: 28px; height: 28px; fill: white; }
    #telyx-chat-window {
      position: fixed; \${CONFIG.position}
      width: 380px; height: 520px;
      background: white; border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      z-index: 99999; display: none; flex-direction: column;
      overflow: hidden;
    }
    #telyx-chat-window.open { display: flex; }
    #telyx-chat-header {
      background: \${CONFIG.primaryColor}; color: white;
      padding: 16px; display: flex; align-items: center; justify-content: space-between;
    }
    #telyx-chat-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
    #telyx-close-btn { background: none; border: none; color: white; cursor: pointer; font-size: 24px; line-height: 1; }
    #telyx-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .telyx-msg {
      max-width: 80%; padding: 10px 14px; border-radius: 12px;
      font-size: 14px; line-height: 1.4; word-wrap: break-word;
    }
    .telyx-msg.user {
      background: \${CONFIG.primaryColor}; color: white;
      align-self: flex-end; border-bottom-right-radius: 4px;
    }
    .telyx-msg.bot {
      background: #f1f5f9; color: #1e293b;
      align-self: flex-start; border-bottom-left-radius: 4px;
    }
    .telyx-msg.typing { opacity: 0.7; }
    #telyx-chat-input-area {
      padding: 12px; border-top: 1px solid #e2e8f0;
      display: flex; gap: 8px;
    }
    #telyx-chat-input {
      flex: 1; padding: 10px 14px; border: 1px solid #e2e8f0;
      border-radius: 24px; outline: none; font-size: 14px;
    }
    #telyx-chat-input:focus { border-color: \${CONFIG.primaryColor}; }
    #telyx-send-btn {
      width: 40px; height: 40px; border-radius: 50%;
      background: \${CONFIG.primaryColor}; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    #telyx-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    #telyx-send-btn svg { width: 18px; height: 18px; fill: white; }
    #telyx-branding {
      text-align: center; padding: 8px; font-size: 11px; color: #94a3b8;
    }
    #telyx-branding a { color: \${CONFIG.primaryColor}; text-decoration: none; }
  \`;
  document.head.appendChild(style);

  // Create container
  var container = document.createElement('div');
  container.id = 'telyx-widget-container';
  container.innerHTML = \`
    <button id="telyx-widget-btn" aria-label="\${CONFIG.buttonText}">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
    </button>
    <div id="telyx-chat-window">
      <div id="telyx-chat-header">
        <h3>\${CONFIG.buttonText}</h3>
        <button id="telyx-close-btn">&times;</button>
      </div>
      <div id="telyx-chat-messages"></div>
      <div id="telyx-chat-input-area">
        <input id="telyx-chat-input" type="text" placeholder="\${CONFIG.placeholderText}" />
        <button id="telyx-send-btn">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      \${CONFIG.showBranding ? '<div id="telyx-branding">Powered by <a href="https://telyx.ai" target="_blank">Telyx.ai</a></div>' : ''}
    </div>
  \`;
  document.body.appendChild(container);

  // Elements
  var btn = document.getElementById('telyx-widget-btn');
  var chatWindow = document.getElementById('telyx-chat-window');
  var closeBtn = document.getElementById('telyx-close-btn');
  var messagesDiv = document.getElementById('telyx-chat-messages');
  var input = document.getElementById('telyx-chat-input');
  var sendBtn = document.getElementById('telyx-send-btn');

  var conversationHistory = [];
  var isOpen = false;

  // Toggle chat
  btn.onclick = function() {
    isOpen = !isOpen;
    chatWindow.classList.toggle('open', isOpen);
    btn.style.display = isOpen ? 'none' : 'flex';
    if (isOpen && messagesDiv.children.length === 0) {
      addMessage('bot', CONFIG.welcomeMessage);
    }
  };
  closeBtn.onclick = function() {
    isOpen = false;
    chatWindow.classList.remove('open');
    btn.style.display = 'flex';
  };

  // Add message to UI
  function addMessage(role, content, isTyping) {
    var div = document.createElement('div');
    div.className = 'telyx-msg ' + role + (isTyping ? ' typing' : '');
    div.textContent = content;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return div;
  }

  // Send message
  async function sendMessage() {
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    sendBtn.disabled = true;
    addMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });

    var typingDiv = addMessage('bot', 'Typing...', true);

    try {
      var res = await fetch(CONFIG.apiUrl + '/api/chat/widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: CONFIG.assistantId,
          message: text,
          conversationHistory: conversationHistory
        })
      });
      var data = await res.json();
      typingDiv.remove();
      
      if (data.reply) {
        addMessage('bot', data.reply);
        conversationHistory.push({ role: 'assistant', content: data.reply });
      } else {
        addMessage('bot', 'Sorry, something went wrong.');
      }
    } catch (err) {
      typingDiv.remove();
      addMessage('bot', 'Connection error. Please try again.');
    }
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.onclick = sendMessage;
  input.onkeypress = function(e) { if (e.key === 'Enter') sendMessage(); };
})();
</script>`;
};

  const copyEmbedCode = () => {
    const code = generateEmbedCode();
    navigator.clipboard.writeText(code);
    toast.success(t('dashboard.chatWidgetPage.embedCodeCopied'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard.chatWidgetPage.title')}</h1>
        <p className="text-neutral-600 mt-1">
          {t('dashboard.chatWidgetPage.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          {/* Enable/Disable */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{t('dashboard.chatWidgetPage.enableWidget')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('dashboard.chatWidgetPage.enableWidgetDesc')}
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>
          </Card>

          {/* Assistant Selection */}
          <Card className="p-6">
            <Label htmlFor="assistant">{t('dashboard.chatWidgetPage.selectAssistant')}</Label>
            <Select value={assistantId} onValueChange={setAssistantId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t('dashboard.chatWidgetPage.chooseAssistant')} />
              </SelectTrigger>
              <SelectContent>
                {assistants.map((assistant) => (
                  <SelectItem key={assistant.id} value={assistant.id}>
                    {assistant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-2">
              {assistants.length === 0 ? t('dashboard.chatWidgetPage.noAssistantsFound') : t('dashboard.chatWidgetPage.assistantWillHandle')}
            </p>
          </Card>

          {/* Appearance */}
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">{t('dashboard.chatWidgetPage.appearance')}</h3>

            {/* Position */}
            <div>
              <Label htmlFor="position">{t('dashboard.chatWidgetPage.position')}</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">{t('dashboard.chatWidgetPage.bottomRight')}</SelectItem>
                  <SelectItem value="bottom-left">{t('dashboard.chatWidgetPage.bottomLeft')}</SelectItem>
                  <SelectItem value="top-right">{t('dashboard.chatWidgetPage.topRight')}</SelectItem>
                  <SelectItem value="top-left">{t('dashboard.chatWidgetPage.topLeft')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Primary Color */}
            <div>
              <Label htmlFor="color">{t('dashboard.chatWidgetPage.primaryColor')}</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#6366f1"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Button Text */}
            <div>
              <Label htmlFor="buttonText">{t('dashboard.chatWidgetPage.buttonText')}</Label>
              <Input
                id="buttonText"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder={t('dashboard.chatWidgetPage.buttonTextPlaceholder')}
                className="mt-2"
              />
            </div>

            {/* Show Branding */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Label>{t('dashboard.chatWidgetPage.showBranding')}</Label>
                  {!isPro && <Lock className="h-3 w-3 text-gray-400" />}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {isPro
                    ? t('dashboard.chatWidgetPage.showBrandingDesc')
                    : t('dashboard.chatWidgetPage.brandingProOnly')}
                </p>
              </div>
              <Switch
                checked={isPro ? showBranding : true}
                onCheckedChange={setShowBranding}
                disabled={!isPro}
              />
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={saveSettings} className="flex-1">
              {t('dashboard.chatWidgetPage.saveSettings')}
            </Button>
            <Button
              onClick={() => setShowPreview(!showPreview)}
              variant="outline"
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? t('dashboard.chatWidgetPage.hide') : t('dashboard.chatWidgetPage.preview')}
            </Button>
          </div>
        </div>

        {/* Embed Code */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('dashboard.chatWidgetPage.embedCode')}</h3>
              <Button onClick={copyEmbedCode} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                {t('dashboard.chatWidgetPage.copy')}
              </Button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
              <code>{generateEmbedCode()}</code>
            </pre>
            <p className="text-xs text-gray-500 mt-2">
              {t('dashboard.chatWidgetPage.embedCodeInstructions')}
            </p>
          </Card>

          {/* Instructions */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-3">{t('dashboard.chatWidgetPage.howToInstall')}</h3>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>{t('dashboard.chatWidgetPage.step1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>{t('dashboard.chatWidgetPage.step2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>{t('dashboard.chatWidgetPage.step3')}</span>
              </li>
            </ol>
          </Card>

          {/* Stats (placeholder) */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-3">{t('dashboard.chatWidgetPage.widgetAnalytics')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-primary-600">0</p>
                <p className="text-xs text-gray-600">{t('dashboard.chatWidgetPage.conversations')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary-600">0</p>
                <p className="text-xs text-gray-600">{t('dashboard.chatWidgetPage.avgDuration')}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {t('dashboard.chatWidgetPage.analyticsComingSoon')}
            </p>
          </Card>
        </div>
      </div>

      {/* Preview Widget */}
      {showPreview && assistantId && (
        <ChatWidget
          assistantId={assistantId}
          position={position}
          primaryColor={primaryColor}
          showBranding={showBranding}
          buttonText={buttonText}
        />
      )}
    </div>
  );
}
