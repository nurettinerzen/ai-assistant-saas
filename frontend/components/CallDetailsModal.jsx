/**
 * Call Details Modal
 * Display full call information including transcript
 */

'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Phone,
  Clock,
  DollarSign,
  User,
  Bot,
  Download,
  FileText,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export default function CallDetailsModal({ call, isOpen, onClose }) {
  if (!call) return null;

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const statusColors = {
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    'in-progress': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  };

  const sentimentColors = {
    positive: 'text-green-600 dark:text-green-400',
    neutral: 'text-gray-600 dark:text-gray-400',
    negative: 'text-red-600 dark:text-red-400',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Call Details</DialogTitle>
        </DialogHeader>

        {/* Call Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Phone Number</p>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{call.callerId || 'Unknown'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Duration</p>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{formatDuration(call.duration)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Cost</p>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{formatCurrency(call.cost)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Status</p>
              <Badge className={statusColors[call.status]}>
                {call.status}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Call Metadata */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Call Information</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Call ID</p>
              <p className="font-mono text-xs text-gray-900 dark:text-gray-200">{call.callId}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Timestamp</p>
              <p className="text-gray-900 dark:text-gray-200">{formatDate(call.createdAt)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Assistant</p>
              <p className="font-medium text-gray-900 dark:text-white">{call.assistantName || 'Default Assistant'}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Direction</p>
              <p className="text-gray-900 dark:text-gray-200">{call.direction || 'Inbound'}</p>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        {(call.intent || call.sentiment || call.summary) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary-600" />
                AI Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {call.intent && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">Intent</p>
                    <p className="text-sm text-gray-900 dark:text-gray-200">{call.intent}</p>
                  </div>
                )}
                {call.sentiment && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1">Sentiment</p>
                    <p className={`text-sm font-medium ${sentimentColors[call.sentiment]}`}>
                      {call.sentiment}
                    </p>
                  </div>
                )}
                {call.taskCompleted !== undefined && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">Task Completed</p>
                    <p className="text-sm text-gray-900 dark:text-gray-200">{call.taskCompleted ? 'Yes' : 'No'}</p>
                  </div>
                )}
              </div>
              {call.summary && (
                <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                  <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold mb-2">Summary</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{call.summary}</p>
                </div>
              )}
              {call.keyPoints && call.keyPoints.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-2">Key Points</p>
                  <ul className="list-disc list-inside space-y-1">
                    {call.keyPoints.map((point, index) => (
                      <li key={index} className="text-sm text-gray-700 dark:text-gray-300">{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        {/* Transcript */}
        {call.transcript && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary-600" />
                  Transcript
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const transcriptText = Array.isArray(call.transcript)
                      ? call.transcript.map(msg => `${msg.speaker}: ${msg.text}`).join('\n')
                      : call.transcript;
                    const blob = new Blob([transcriptText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `transcript-${call.callId}.txt`;
                    a.click();
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg max-h-96 overflow-y-auto space-y-3">
                {Array.isArray(call.transcript) ? (
                  call.transcript.map((msg, idx) => {
                    // Calculate time from call start
                    const callStartTime = new Date(call.createdAt);
                    const messageTime = new Date(callStartTime.getTime() + (msg.timestamp || 0) * 1000);

                    return (
                      <div key={idx} className={`flex gap-3 ${msg.speaker === 'assistant' ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-1 ${msg.speaker === 'assistant' ? 'text-right' : ''}`}>
                          <div className="flex items-center gap-2 mb-1" style={{ justifyContent: msg.speaker === 'assistant' ? 'flex-end' : 'flex-start' }}>
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                              {msg.speaker === 'assistant' ? 'Asistan' : 'Müşteri'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {messageTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <div className={`inline-block px-3 py-2 rounded-lg ${
                            msg.speaker === 'assistant'
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-gray-900 dark:text-gray-100'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                    {call.transcript}
                  </pre>
                )}
              </div>
            </div>
          </>
        )}

        {/* Recording */}
        {call.recordingUrl && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Recording</h3>
              <audio controls className="w-full">
                <source src={call.recordingUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          {call.followUpNeeded && (
            <Button className="flex-1">
              Create Follow-up Task
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
