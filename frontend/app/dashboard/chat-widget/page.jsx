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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, ExternalLink, Code, Eye } from 'lucide-react';
import { toast } from 'sonner';
import ChatWidget from '@/components/ChatWidget';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ChatWidgetPage() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [position, setPosition] = useState('bottom-right');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [showBranding, setShowBranding] = useState(true);
  const [buttonText, setButtonText] = useState('Talk to us');
  const [showPreview, setShowPreview] = useState(false);
  const [assistantId, setAssistantId] = useState('');
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssistants();
    loadSettings();
  }, []);

  const loadAssistants = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/assistants`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssistants(response.data.assistants || []);
      if (response.data.assistants.length > 0) {
        setAssistantId(response.data.assistants[0].vapiAssistantId);
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
      setButtonText(settings.buttonText || 'Talk to us');
      setAssistantId(settings.assistantId || '');
    }
  };

  const saveSettings = () => {
    const settings = {
      isEnabled,
      position,
      primaryColor,
      showBranding,
      buttonText,
      assistantId
    };
    localStorage.setItem('chatWidgetSettings', JSON.stringify(settings));
    toast.success('Settings saved successfully!');
  };

  const generateEmbedCode = () => {
    const vapiPublicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || 'YOUR_VAPI_PUBLIC_KEY';
    
    return `<!-- Telyx Chat Widget -->
<script src="https://unpkg.com/@vapi-ai/web@latest/dist/index.umd.js"></script>
<div id="telyx-chat-widget"></div>
<script>
  (function() {
    const config = {
      assistantId: '${assistantId}',
      vapiPublicKey: '${vapiPublicKey}',
      position: '${position}',
      primaryColor: '${primaryColor}',
      showBranding: ${showBranding},
      buttonText: '${buttonText}'
    };

    // Initialize widget
    const container = document.getElementById('telyx-chat-widget');
    // Widget initialization code would go here
    // This is a simplified example
  })();
</script>`;
  };

  const copyEmbedCode = () => {
    const code = generateEmbedCode();
    navigator.clipboard.writeText(code);
    toast.success('Embed code copied to clipboard!');
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
        <h1 className="text-3xl font-bold text-neutral-900">Chat Widget</h1>
        <p className="text-neutral-600 mt-1">
          Add a voice chat widget to your website
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          {/* Enable/Disable */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Enable Widget</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Activate the chat widget on your website
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
            <Label htmlFor="assistant">Select Assistant</Label>
            <Select value={assistantId} onValueChange={setAssistantId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose an assistant" />
              </SelectTrigger>
              <SelectContent>
                {assistants.map((assistant) => (
                  <SelectItem key={assistant.id} value={assistant.vapiAssistantId}>
                    {assistant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-2">
              {assistants.length === 0 ? 'No assistants found. Create one first.' : 'This assistant will handle the chat'}
            </p>
          </Card>

          {/* Appearance */}
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Appearance</h3>

            {/* Position */}
            <div>
              <Label htmlFor="position">Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Primary Color */}
            <div>
              <Label htmlFor="color">Primary Color</Label>
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
              <Label htmlFor="buttonText">Button Text</Label>
              <Input
                id="buttonText"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="Talk to us"
                className="mt-2"
              />
            </div>

            {/* Show Branding */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Show "Powered by Telyx"</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Remove branding on Pro plan
                </p>
              </div>
              <Switch
                checked={showBranding}
                onCheckedChange={setShowBranding}
              />
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={saveSettings} className="flex-1">
              Save Settings
            </Button>
            <Button
              onClick={() => setShowPreview(!showPreview)}
              variant="outline"
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide' : 'Preview'}
            </Button>
          </div>
        </div>

        {/* Embed Code */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Embed Code</h3>
              <Button onClick={copyEmbedCode} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
              <code>{generateEmbedCode()}</code>
            </pre>
            <p className="text-xs text-gray-500 mt-2">
              Paste this code before the closing &lt;/body&gt; tag on your website
            </p>
          </Card>

          {/* Instructions */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-3">How to Install</h3>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>Copy the embed code above</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>Paste it into your website's HTML, just before the closing &lt;/body&gt; tag</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>The widget will appear on your website automatically</span>
              </li>
            </ol>
          </Card>

          {/* Stats (placeholder) */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-3">Widget Analytics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-primary-600">0</p>
                <p className="text-xs text-gray-600">Conversations</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary-600">0</p>
                <p className="text-xs text-gray-600">Avg. Duration</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Analytics coming soon
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
          vapiPublicKey={process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY}
        />
      )}
    </div>
  );
}
