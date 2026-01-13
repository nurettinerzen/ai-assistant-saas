import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import axios from 'axios';
import OpenAI from 'openai';

const router = express.Router();
const prisma = new PrismaClient();
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/**
 * Fetch conversation data from 11Labs and process it
 * @param {string} conversationId - 11Labs conversation ID
 * @param {Object} business - Business object with subscription
 * @returns {Object|null} Processed data for database update
 */
async function fetchAndProcessConversation(conversationId, business) {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey || !conversationId) return null;

  try {
    const response = await axios.get(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      { headers: { 'xi-api-key': elevenLabsApiKey } }
    );

    const data = response.data;
    if (!data) return null;

    // Parse transcript
    let transcriptMessages = [];
    let transcriptText = '';
    if (Array.isArray(data.transcript)) {
      transcriptMessages = data.transcript.map(msg => ({
        speaker: msg.role === 'agent' ? 'assistant' : 'user',
        text: msg.message || msg.text || '',
        timestamp: msg.time_in_call_secs || msg.timestamp
      }));
      transcriptText = transcriptMessages.map(m => `${m.speaker}: ${m.text}`).join('\n');
    }

    // Get summary and translate if needed
    let summary = data.analysis?.transcript_summary || data.analysis?.summary || null;
    if (summary && openai) {
      // Check if needs translation (no Turkish chars)
      const hasTurkishChars = /[ğüşıöçĞÜŞİÖÇ]/.test(summary);
      if (!hasTurkishChars) {
        try {
          const translated = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Sen bir çevirmensin. Verilen İngilizce metni doğal Türkçe\'ye çevir. Kısa ve öz tut.' },
              { role: 'user', content: summary }
            ],
            max_tokens: 300,
            temperature: 0.3
          });
          summary = translated.choices[0]?.message?.content?.trim() || summary;
          console.log('🌐 Summary translated to Turkish');
        } catch (e) {
          console.warn('Translation failed:', e.message);
        }
      }
    }

    // Parse termination reason
    const terminationReason = data.metadata?.termination_reason || data.status || null;
    let endReason = null;
    if (terminationReason) {
      const reason = terminationReason.toLowerCase();
      if (reason.includes('client disconnected') || reason.includes('user_ended') || reason.includes('hangup')) {
        endReason = 'client_ended';
      } else if (reason.includes('agent') || reason.includes('assistant')) {
        endReason = 'agent_ended';
      } else if (reason.includes('timeout') || reason.includes('silence') || reason.includes('no_input')) {
        endReason = 'system_timeout';
      } else if (reason.includes('error') || reason.includes('failed')) {
        endReason = 'error';
      } else if (reason === 'done' || reason === 'completed') {
        endReason = 'completed';
      }
    }

    // Calculate call cost
    const duration = data.call_duration_secs || data.metadata?.call_duration_secs || 0;
    const plan = business?.subscription?.plan;
    let costPerMinute = 0.60;
    if (plan === 'STARTER') costPerMinute = 0.70;
    else if (plan === 'PROFESSIONAL') costPerMinute = 0.50;
    else if (plan === 'ENTERPRISE') costPerMinute = 0.40;
    const durationMinutes = duration > 0 ? Math.ceil(duration / 60) : 0;
    const callCost = durationMinutes > 0 ? durationMinutes * costPerMinute : 0;

    // Determine direction
    let direction = data.metadata?.phone_call?.direction || data.metadata?.channel || 'inbound';
    if (direction === 'web' || direction === 'chat') direction = 'inbound';

    return {
      duration: duration || undefined,
      direction: direction,
      transcript: transcriptMessages.length > 0 ? transcriptMessages : undefined,
      transcriptText: transcriptText || undefined,
      summary: summary || undefined,
      endReason: endReason || undefined,
      callCost: callCost || undefined,
      status: 'answered',
      updatedAt: new Date()
    };
  } catch (error) {
    console.error('Error fetching 11Labs conversation:', error.message);
    return null;
  }
}

router.use(authenticateToken);

// Get all call logs for the user's business (including chat and WhatsApp)
router.get('/', async (req, res) => {
  try {
    const { businessId } = req;
    const { status, search, limit = 100 } = req.query;

    // Build where clause for CallLog (phone calls)
    const callWhere = { businessId };

    if (status && status !== 'all') {
      callWhere.status = status;
    }

    if (search) {
      // Search in transcript text, caller ID, or call ID
      callWhere.OR = [
        {
          transcriptText: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          callerId: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          callId: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Build where clause for ChatLog (chat and WhatsApp)
    const chatWhere = { businessId };

    if (status && status !== 'all') {
      // Map status to chat status
      if (status === 'completed' || status === 'answered') {
        chatWhere.status = 'completed';
      } else if (status === 'in_progress' || status === 'in-progress') {
        chatWhere.status = 'active';
      } else {
        chatWhere.status = status;
      }
    }

    if (search) {
      // Search in sessionId or customerPhone
      chatWhere.OR = [
        {
          sessionId: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          customerPhone: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Fetch both call logs and chat logs in parallel
    const [callLogs, chatLogs] = await Promise.all([
      prisma.callLog.findMany({
        where: callWhere,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      }),
      prisma.chatLog.findMany({
        where: chatWhere,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      })
    ]);

    // Format phone call logs
    const formattedCalls = callLogs.map(call => ({
      id: call.id,
      callId: call.callId,
      phoneNumber: call.callerId,
      duration: call.duration,
      status: call.status,
      direction: call.direction || 'inbound',
      channel: 'phone',
      type: 'phone',
      createdAt: call.createdAt,
      sentiment: call.sentiment,
      summary: call.summary,
      hasRecording: !!call.recordingUrl,
      hasTranscript: !!call.transcript || !!call.transcriptText,
    }));

    // Format chat/WhatsApp logs
    const formattedChats = chatLogs.map(chat => ({
      id: `chat-${chat.id}`,
      callId: chat.sessionId,
      phoneNumber: chat.customerPhone || null,
      duration: null, // Chats don't have duration
      status: chat.status === 'active' ? 'in_progress' : 'completed',
      direction: 'inbound',
      channel: chat.channel?.toLowerCase() || 'chat',
      type: chat.channel?.toLowerCase() || 'chat',
      createdAt: chat.createdAt,
      sentiment: null,
      summary: chat.summary,
      hasRecording: false,
      hasTranscript: chat.messages && Array.isArray(chat.messages) && chat.messages.length > 0,
      messageCount: chat.messageCount || 0,
    }));

    // Merge and sort by createdAt descending
    const allLogs = [...formattedCalls, ...formattedChats]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, parseInt(limit));

    res.json({ calls: allLogs });
  } catch (error) {
    console.error('Get call logs error:', error);
    res.status(500).json({ error: 'Failed to fetch call logs' });
  }
});

// Get a single call log by ID (supports both phone calls and chat/WhatsApp)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req;

    // Check if this is a chat log (ID starts with "chat-")
    if (id.startsWith('chat-')) {
      const chatId = id.replace('chat-', '');
      const chatLog = await prisma.chatLog.findUnique({
        where: { id: chatId }
      });

      if (!chatLog) {
        return res.status(404).json({ error: 'Chat log not found' });
      }

      if (chatLog.businessId !== businessId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Format chat messages to match transcript format
      const transcript = chatLog.messages && Array.isArray(chatLog.messages)
        ? chatLog.messages.map((msg, index) => ({
            speaker: msg.role === 'user' ? 'user' : 'assistant',
            text: msg.content || '',
            timestamp: msg.timestamp || index
          }))
        : [];

      const transcriptText = transcript.map(m => `${m.speaker}: ${m.text}`).join('\n');

      // Return chat log in the same format as call log
      const response = {
        id: `chat-${chatLog.id}`,
        callId: chatLog.sessionId,
        phoneNumber: chatLog.customerPhone || null,
        duration: null,
        recordingDuration: null,
        status: chatLog.status === 'active' ? 'in_progress' : 'completed',
        createdAt: chatLog.createdAt,
        updatedAt: chatLog.updatedAt,
        channel: chatLog.channel?.toLowerCase() || 'chat',
        type: chatLog.channel?.toLowerCase() || 'chat',

        // No recording for chat
        recordingUrl: null,

        // Transcript
        transcript: transcript,
        transcriptText: transcriptText,

        // Chat-specific
        messageCount: chatLog.messageCount || 0,
        summary: chatLog.summary,

        // Not applicable for chat
        sentiment: null,
        sentimentScore: null,
        keyTopics: null,
        actionItems: null,
        keyPoints: null,
        intent: null,
        taskCompleted: null,
        followUpNeeded: null,
        endReason: null,
        callCost: null,
        direction: 'inbound',
      };

      return res.json(response);
    }

    // Handle phone call logs (original logic)
    // ID can be either integer or string - try to parse if numeric
    let callLog = await prisma.callLog.findUnique({
      where: { id: isNaN(parseInt(id)) ? id : parseInt(id) },
      include: {
        business: {
          include: { subscription: { select: { plan: true } } }
        }
      }
    });

    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    if (callLog.businessId !== businessId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Lazy load: If missing endReason/callCost/summary, fetch from 11Labs
    const needsUpdate = callLog.callId && (!callLog.endReason || !callLog.callCost || !callLog.summary);

    if (needsUpdate) {
      try {
        console.log(`📞 Lazy loading conversation data for ${callLog.callId}...`);
        const updatedData = await fetchAndProcessConversation(callLog.callId, callLog.business);

        if (updatedData) {
          // Update database
          callLog = await prisma.callLog.update({
            where: { id: callLog.id },
            data: updatedData
          });
          console.log(`✅ Call log ${callLog.id} updated with 11Labs data`);
        }
      } catch (fetchError) {
        console.warn(`⚠️ Could not fetch 11Labs data: ${fetchError.message}`);
      }
    }

    // Return full call details including transcript, recording, and analysis
    const response = {
      id: callLog.id,
      callId: callLog.callId,
      phoneNumber: callLog.callerId,
      duration: callLog.duration,
      recordingDuration: callLog.recordingDuration,
      status: callLog.status,
      createdAt: callLog.createdAt,
      updatedAt: callLog.updatedAt,
      channel: 'phone',
      type: 'phone',

      // Recording
      recordingUrl: callLog.recordingUrl,

      // Transcript
      transcript: callLog.transcript, // JSON array of messages
      transcriptText: callLog.transcriptText,

      // AI Analysis
      summary: callLog.summary,
      sentiment: callLog.sentiment,
      sentimentScore: callLog.sentimentScore,
      keyTopics: callLog.keyTopics,
      actionItems: callLog.actionItems,
      keyPoints: callLog.keyPoints,

      // Legacy fields
      intent: callLog.intent,
      taskCompleted: callLog.taskCompleted,
      followUpNeeded: callLog.followUpNeeded,

      // New fields
      endReason: callLog.endReason,
      callCost: callLog.callCost,
      direction: callLog.direction,
    };

    res.json(response);
  } catch (error) {
    console.error('Get call log error:', error);
    res.status(500).json({ error: 'Failed to fetch call log' });
  }
});

// Create a new call log
router.post('/', async (req, res) => {
  try {
    const { callId, businessId, duration, status, transcript, recordingUrl, metadata } = req.body;

    // Verify user has access to this business
    if (businessId !== req.businessId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const callLog = await prisma.callLog.create({
      data: {
        callId,
        businessId,
        duration,
        status,
        transcript,
        recordingUrl,
        metadata
      }
    });

    res.status(201).json(callLog);
  } catch (error) {
    console.error('Create call log error:', error);
    res.status(500).json({ error: 'Failed to create call log' });
  }
});

// Get call recording audio (proxy from 11Labs)
// Token can be passed via Authorization header or query param (for <audio> elements)
router.get('/:id/audio', async (req, res) => {
  try {
    const { businessId } = req;
    const { id } = req.params;

    // Find call log - ID can be integer or string
    const callLog = await prisma.callLog.findUnique({
      where: { id: isNaN(parseInt(id)) ? id : parseInt(id) }
    });

    if (!callLog || callLog.businessId !== businessId) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Get conversation ID from callId (which is the conversation_id from 11Labs)
    const conversationId = callLog.callId;
    if (!conversationId) {
      return res.status(404).json({ error: 'No recording available' });
    }

    // Fetch audio from 11Labs
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return res.status(500).json({ error: 'Audio service not configured' });
    }

    const audioUrl = `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`;
    console.log(`🎵 Fetching audio for conversation: ${conversationId}`);

    // Fetch full audio file to buffer for seek support
    const audioResponse = await axios.get(audioUrl, {
      headers: { 'xi-api-key': elevenLabsApiKey },
      responseType: 'arraybuffer'
    });

    const audioBuffer = Buffer.from(audioResponse.data);
    const contentType = audioResponse.headers['content-type'] || 'audio/mpeg';
    const totalLength = audioBuffer.length;

    console.log(`🎵 Audio fetched: ${totalLength} bytes, type: ${contentType}`);

    // Handle Range requests for seeking
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
      const chunkSize = end - start + 1;

      console.log(`🎵 Range request: ${start}-${end}/${totalLength}`);

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalLength}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="call-${id}.mp3"`);
      res.end(audioBuffer.slice(start, end + 1));
    } else {
      // Full file request
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', totalLength);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Disposition', `inline; filename="call-${id}.mp3"`);
      res.end(audioBuffer);
    }
  } catch (error) {
    console.error('Get call audio error:', error.message, error.response?.status);
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(403).json({ error: 'Audio access denied' });
    }
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
});

// Get call statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { businessId } = req;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalCalls = await prisma.callLog.count({
      where: { businessId }
    });

    const monthCalls = await prisma.callLog.count({
      where: {
        businessId,
        createdAt: {
          gte: firstDayOfMonth
        }
      }
    });

    const completedCalls = await prisma.callLog.count({
      where: {
        businessId,
        status: 'COMPLETED'
      }
    });

    const totalDuration = await prisma.callLog.aggregate({
      where: { businessId },
      _sum: {
        duration: true
      }
    });

    res.json({
      totalCalls,
      monthCalls,
      completedCalls,
      totalDuration: totalDuration._sum.duration || 0,
      averageDuration: totalCalls > 0 ? Math.round((totalDuration._sum.duration || 0) / totalCalls) : 0
    });
  } catch (error) {
    console.error('Get call stats error:', error);
    res.status(500).json({ error: 'Failed to fetch call statistics' });
  }
});

// Export calls as CSV
router.get('/export', async (req, res) => {
  try {
    const { businessId } = req;

    const callLogs = await prisma.callLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' }
    });

    // Create CSV
    const headers = ['Date', 'Phone Number', 'Duration', 'Status', 'Cost'];
    const rows = callLogs.map(call => [
      new Date(call.createdAt).toISOString(),
      call.callerId || 'Unknown',
      call.duration || 0,
      call.status,
      (call.duration * 0.01).toFixed(2) // Example cost calculation
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=calls.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export calls error:', error);
    res.status(500).json({ error: 'Failed to export calls' });
  }
});

export default router;