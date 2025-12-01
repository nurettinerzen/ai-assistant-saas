/**
 * VAPI Knowledge Base Service
 * Integrates with VAPI AI for training data
 */

import axios from 'axios';

const VAPI_API_KEY = process.env.VAPI_API_KEY || process.env.VAPI_PRIVATE_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';

class VAPIKnowledgeService {
  /**
   * Upload text content to VAPI knowledge base
   */
  async uploadText(assistantId, title, content) {
    try {
      console.log('📚 Uploading text to VAPI knowledge base...');
      
      const response = await axios.post(
        `${VAPI_BASE_URL}/assistant/${assistantId}/knowledge`,
        {
          type: 'text',
          name: title,
          content: content
        },
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Text uploaded to VAPI');
      return response.data;
    } catch (error) {
      console.error('❌ VAPI upload text error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Upload file to VAPI knowledge base
   */
  async uploadFile(assistantId, filePath, fileName) {
    try {
      console.log('📚 Uploading file to VAPI knowledge base...');
      
      const FormData = require('form-data');
      const fs = require('fs');
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      formData.append('name', fileName);

      const response = await axios.post(
        `${VAPI_BASE_URL}/assistant/${assistantId}/knowledge/file`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            ...formData.getHeaders()
          }
        }
      );

      console.log('✅ File uploaded to VAPI');
      return response.data;
    } catch (error) {
      console.error('❌ VAPI upload file error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Upload URL to VAPI knowledge base
   */
  async uploadUrl(assistantId, url, title) {
    try {
      console.log('📚 Uploading URL to VAPI knowledge base...');
      
      const response = await axios.post(
        `${VAPI_BASE_URL}/assistant/${assistantId}/knowledge`,
        {
          type: 'url',
          name: title || url,
          url: url
        },
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ URL uploaded to VAPI');
      return response.data;
    } catch (error) {
      console.error('❌ VAPI upload URL error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete knowledge base item
   */
  async deleteKnowledge(assistantId, knowledgeId) {
    try {
      console.log('🗑️ Deleting knowledge from VAPI...');
      
      await axios.delete(
        `${VAPI_BASE_URL}/assistant/${assistantId}/knowledge/${knowledgeId}`,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`
          }
        }
      );

      console.log('✅ Knowledge deleted from VAPI');
      return { success: true };
    } catch (error) {
      console.error('❌ VAPI delete knowledge error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * List knowledge base items
   */
  async listKnowledge(assistantId) {
    try {
      const response = await axios.get(
        `${VAPI_BASE_URL}/assistant/${assistantId}/knowledge`,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ VAPI list knowledge error:', error.response?.data || error.message);
      throw error;
    }
  }
}\n\nexport default new VAPIKnowledgeService();
