// ============================================================================
// AI ANALYSIS SERVICE (PRO FEATURE)
// ============================================================================
// FILE: backend/src/services/aiAnalysis.js
//
// Analyzes call transcripts using OpenAI to extract insights
// Only runs for PROFESSIONAL and ENTERPRISE plans
// ============================================================================

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Analyze a call transcript using AI
 * @param {Number} callLogId - Database ID of the call log
 */
export const analyzeCall = async (callLogId) => {
  try {
    console.log(`🤖 Starting AI analysis for call log ${callLogId}...`);

    if (!openai) {
      console.warn('⚠️ OpenAI API key not configured. Skipping AI analysis.');
      return null;
    }

    // Get call log with transcript
    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
      include: {
        business: {
          select: {
            subscription: {
              select: {
                plan: true
              }
            }
          }
        }
      }
    });

    if (!callLog) {
      console.error(`❌ Call log ${callLogId} not found`);
      return null;
    }

    // Check if plan supports AI analysis
    const plan = callLog.business.subscription?.plan;
    if (plan !== 'PROFESSIONAL' && plan !== 'ENTERPRISE') {
      console.log(`ℹ️ Skipping AI analysis - ${plan} plan doesn't include this feature`);
      return null;
    }

    if (!callLog.transcript || callLog.transcript.trim().length === 0) {
      console.warn('⚠️ No transcript available for analysis');
      return null;
    }

    // Call OpenAI GPT-4 for analysis
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert call analyst for customer service conversations. Analyze the call transcript and provide structured insights in JSON format.

You must return ONLY a valid JSON object with these fields:
- summary: A one-sentence summary of the call
- intent: The primary reason the customer called (e.g., "reservation", "order status", "complaint", "information request")
- sentiment: Overall customer sentiment ("positive", "neutral", or "negative")
- keyPoints: Array of 2-4 key points or topics discussed
- taskCompleted: Boolean - did the assistant successfully help the customer?
- followUpNeeded: Boolean - does this require human follow-up?

Be concise and accurate. Focus on business value.`
        },
        {
          role: 'user',
          content: `Analyze this call transcript:\n\n${callLog.transcript}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500
    });

    const analysisText = completion.choices[0]?.message?.content;
    
    if (!analysisText) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const analysis = JSON.parse(analysisText);

    console.log('✅ AI analysis completed:', analysis);

    // Update call log with analysis results
    const updated = await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        summary: analysis.summary || null,
        intent: analysis.intent || null,
        sentiment: analysis.sentiment || null,
        keyPoints: analysis.keyPoints || [],
        taskCompleted: analysis.taskCompleted || null,
        followUpNeeded: analysis.followUpNeeded || null,
        updatedAt: new Date()
      }
    });

    return updated;
  } catch (error) {
    console.error('❌ AI analysis error:', error);
    
    // Log error but don't fail - analysis is optional
    if (error.code === 'insufficient_quota') {
      console.error('❌ OpenAI quota exceeded. Please add credits to your OpenAI account.');
    } else if (error.code === 'invalid_api_key') {
      console.error('❌ OpenAI API key is invalid.');
    }
    
    return null;
  }
};

/**
 * Analyze multiple calls in batch
 * @param {Array<Number>} callLogIds 
 */
export const analyzeCallsBatch = async (callLogIds) => {
  try {
    console.log(`🤖 Starting batch analysis for ${callLogIds.length} calls...`);

    const results = [];
    for (const callLogId of callLogIds) {
      try {
        const result = await analyzeCall(callLogId);
        results.push({ callLogId, success: !!result, result });
        
        // Rate limiting: wait 1 second between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to analyze call ${callLogId}:`, error);
        results.push({ callLogId, success: false, error: error.message });
      }
    }

    console.log(`✅ Batch analysis completed: ${results.filter(r => r.success).length}/${results.length} successful`);
    return results;
  } catch (error) {
    console.error('❌ Batch analysis error:', error);
    throw error;
  }
};

/**
 * Get aggregated insights for a business
 * @param {Number} businessId 
 * @param {Object} options - { startDate, endDate }
 */
export const getAggregatedInsights = async (businessId, options = {}) => {
  try {
    const { startDate, endDate } = options;

    // Build where clause
    const where = {
      businessId,
      intent: { not: null }
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Get all analyzed calls
    const calls = await prisma.callLog.findMany({
      where,
      select: {
        intent: true,
        sentiment: true,
        taskCompleted: true,
        followUpNeeded: true,
        keyPoints: true
      }
    });

    if (calls.length === 0) {
      return {
        totalAnalyzed: 0,
        insights: null
      };
    }

    // Aggregate intents
    const intentCounts = {};
    calls.forEach(call => {
      if (call.intent) {
        intentCounts[call.intent] = (intentCounts[call.intent] || 0) + 1;
      }
    });

    // Aggregate sentiments
    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      negative: 0
    };
    calls.forEach(call => {
      if (call.sentiment && sentimentCounts.hasOwnProperty(call.sentiment)) {
        sentimentCounts[call.sentiment]++;
      }
    });

    // Task completion rate
    const completedTasks = calls.filter(c => c.taskCompleted === true).length;
    const taskCompletionRate = calls.length > 0 
      ? Math.round((completedTasks / calls.length) * 100)
      : 0;

    // Follow-up needed count
    const followUpCount = calls.filter(c => c.followUpNeeded === true).length;

    // Extract all key points
    const allKeyPoints = [];
    calls.forEach(call => {
      if (Array.isArray(call.keyPoints)) {
        allKeyPoints.push(...call.keyPoints);
      }
    });

    // Count key point frequencies
    const keyPointCounts = {};
    allKeyPoints.forEach(point => {
      const normalized = point.toLowerCase().trim();
      keyPointCounts[normalized] = (keyPointCounts[normalized] || 0) + 1;
    });

    // Get top 5 key points
    const topKeyPoints = Object.entries(keyPointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([point, count]) => ({ point, count }));

    return {
      totalAnalyzed: calls.length,
      insights: {
        intents: Object.entries(intentCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([intent, count]) => ({ 
            intent, 
            count, 
            percentage: Math.round((count / calls.length) * 100)
          })),
        sentiment: {
          positive: sentimentCounts.positive,
          neutral: sentimentCounts.neutral,
          negative: sentimentCounts.negative,
          positivePercentage: Math.round((sentimentCounts.positive / calls.length) * 100),
          negativePercentage: Math.round((sentimentCounts.negative / calls.length) * 100)
        },
        taskCompletionRate,
        followUpNeeded: followUpCount,
        topKeyPoints
      }
    };
  } catch (error) {
    console.error('❌ Error getting aggregated insights:', error);
    throw error;
  }
};

export default {
  analyzeCall,
  analyzeCallsBatch,
  getAggregatedInsights
};
