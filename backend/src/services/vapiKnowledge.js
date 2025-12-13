/**
 * VAPI Knowledge Base Service - Updated API (2024)
 * New flow: Upload file → Create KB → Attach to Assistant
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';

const VAPI_API_KEY = process.env.VAPI_API_KEY || process.env.VAPI_PRIVATE_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';

class VAPIKnowledgeService {
  
  /**
   * Upload a file to VAPI
   */
  async uploadFile(filePath, fileName) {
    try {
      console.log('📤 Uploading file to VAPI...');
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), fileName);

      const response = await axios.post(
        `${VAPI_BASE_URL}/file`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            ...formData.getHeaders()
          }
        }
      );

      console.log('✅ File uploaded to VAPI:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ VAPI file upload error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Upload text content as a file to VAPI
   */
  async uploadTextAsFile(title, content) {
    try {
      console.log('📤 Uploading text to VAPI as file...');
      
      // Create temp file
      const tempDir = os.tmpdir();
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.txt`;
      const tempPath = path.join(tempDir, fileName);
      
      fs.writeFileSync(tempPath, content, 'utf8');
      
      const result = await this.uploadFile(tempPath, fileName);
      
      // Cleanup temp file
      fs.unlinkSync(tempPath);
      
      return result;
    } catch (error) {
      console.error('❌ VAPI text upload error:', error.message);
      throw error;
    }
  }

  /**
   * Create a knowledge base with file IDs
   */
  async createKnowledgeBase(name, fileIds) {
    try {
      console.log('📚 Creating VAPI knowledge base...');
      
      const response = await axios.post(
        `${VAPI_BASE_URL}/knowledge-base`,
        {
          provider: 'google',
          name: name,
          fileIds: Array.isArray(fileIds) ? fileIds : [fileIds]
        },
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Knowledge base created:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ VAPI KB create error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Add file to existing knowledge base
   */
  async addFileToKnowledgeBase(knowledgeBaseId, fileId) {
    try {
      console.log('📎 Adding file to knowledge base...');
      
      // Get current KB
      const kb = await this.getKnowledgeBase(knowledgeBaseId);
      const currentFileIds = kb.fileIds || [];
      
      // Update with new file
      const response = await axios.patch(
        `${VAPI_BASE_URL}/knowledge-base/${knowledgeBaseId}`,
        {
          fileIds: [...currentFileIds, fileId]
        },
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ File added to KB');
      return response.data;
    } catch (error) {
      console.error('❌ VAPI add file error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get knowledge base by ID
   */
  async getKnowledgeBase(knowledgeBaseId) {
    try {
      const response = await axios.get(
        `${VAPI_BASE_URL}/knowledge-base/${knowledgeBaseId}`,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ VAPI get KB error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * List all knowledge bases
   */
  async listKnowledgeBases() {
    try {
      const response = await axios.get(
        `${VAPI_BASE_URL}/knowledge-base`,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ VAPI list KB error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete knowledge base
   */
  async deleteKnowledgeBase(knowledgeBaseId) {
    try {
      console.log('🗑️ Deleting knowledge base...');
      
      await axios.delete(
        `${VAPI_BASE_URL}/knowledge-base/${knowledgeBaseId}`,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`
          }
        }
      );

      console.log('✅ Knowledge base deleted');
      return { success: true };
    } catch (error) {
      console.error('❌ VAPI delete KB error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete file from VAPI
   */
  async deleteFile(fileId) {
    try {
      console.log('🗑️ Deleting file from VAPI...');
      
      await axios.delete(
        `${VAPI_BASE_URL}/file/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`
          }
        }
      );

      console.log('✅ File deleted');
      return { success: true };
    } catch (error) {
      console.error('❌ VAPI delete file error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Attach knowledge base to assistant
   */
 async attachToAssistant(assistantId, knowledgeBaseId) {
  try {
    console.log('🔗 Attaching KB to assistant...');
    
    // First get current assistant to preserve model config
    const getResponse = await axios.get(
      `${VAPI_BASE_URL}/assistant/${assistantId}`,
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`
        }
      }
    );
    
    const currentModel = getResponse.data.model || {};
    
    const response = await axios.patch(
      `${VAPI_BASE_URL}/assistant/${assistantId}`,
      {
        model: {
          ...currentModel,
          knowledgeBaseId: knowledgeBaseId
        }
      },
        {
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ KB attached to assistant');
      return response.data;
    } catch (error) {
      console.error('❌ VAPI attach KB error:', error.response?.data || error.message);
      throw error;
    }
  }

  // ============ LEGACY COMPATIBILITY METHODS ============
  // These wrap the new API for backward compatibility

  /**
   * Upload text content (legacy compatibility)
   */
  async uploadText(assistantId, title, content) {
    const file = await this.uploadTextAsFile(title, content);
    const kb = await this.createKnowledgeBase(title, [file.id]);
    await this.attachToAssistant(assistantId, kb.id);
    return { id: kb.id, fileId: file.id };
  }

  /**
   * Upload URL content (legacy compatibility)
   * Note: VAPI doesn't support direct URL upload anymore
   * We crawl content ourselves and upload as text
   */
  async uploadUrl(assistantId, url, title, content) {
    if (!content) {
      throw new Error('Content required for URL upload');
    }
    return this.uploadText(assistantId, title, content);
  }

  /**
   * Delete knowledge (legacy compatibility)
   */
  async deleteKnowledge(assistantId, knowledgeId) {
    return this.deleteKnowledgeBase(knowledgeId);
  }
}

export default new VAPIKnowledgeService();