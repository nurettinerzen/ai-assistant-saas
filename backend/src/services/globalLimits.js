/**
 * V1 MVP: Global Limits Enforcement
 *
 * Simple, fixed limits for all users (no plan-based enforcement)
 *
 * Limits:
 * - CRM_RECORDS_LIMIT=5000
 * - KB_ITEMS_LIMIT=50 (docs+faq+url)
 * - KB_STORAGE_MB_LIMIT=100 (docs only)
 * - KB_CRAWL_MAX_PAGES=50
 */

import prisma from '../config/database.js';

// Read from env
const CRM_RECORDS_LIMIT = parseInt(process.env.CRM_RECORDS_LIMIT || '5000');
const KB_ITEMS_LIMIT = parseInt(process.env.KB_ITEMS_LIMIT || '50');
const KB_STORAGE_MB_LIMIT = parseInt(process.env.KB_STORAGE_MB_LIMIT || '100');
const KB_CRAWL_MAX_PAGES = parseInt(process.env.KB_CRAWL_MAX_PAGES || '50');

/**
 * Check KB item count limit (docs + faqs + urls)
 * @param {number} businessId
 * @param {number} additionalItems - How many items to add (default: 1)
 * @returns {Promise<Object>} { allowed, current, limit, error }
 */
export async function checkKBItemLimit(businessId, additionalItems = 1) {
  try {
    const currentCount = await prisma.knowledgeBase.count({
      where: { businessId }
    });

    const newTotal = currentCount + additionalItems;
    const allowed = newTotal <= KB_ITEMS_LIMIT;

    return {
      allowed,
      current: currentCount,
      limit: KB_ITEMS_LIMIT,
      newTotal,
      error: allowed ? null : {
        code: 'KB_LIMIT_EXCEEDED',
        message: `Knowledge base limit reached (${currentCount}/${KB_ITEMS_LIMIT} items). Cannot add ${additionalItems} more.`
      }
    };
  } catch (err) {
    console.error('❌ [Global Limits] KB item check error:', err);
    throw err;
  }
}

/**
 * Check KB storage limit (docs only, in MB)
 * @param {number} businessId
 * @param {number} fileSizeBytes - File size to add
 * @returns {Promise<Object>} { allowed, currentMB, limitMB, error }
 */
export async function checkKBStorageLimit(businessId, fileSizeBytes) {
  try {
    const result = await prisma.knowledgeBase.aggregate({
      where: {
        businessId,
        type: 'DOCUMENT'
      },
      _sum: {
        fileSize: true
      }
    });

    const currentBytes = result._sum.fileSize || 0;
    const currentMB = Math.ceil(currentBytes / 1024 / 1024);
    const fileSizeMB = Math.ceil(fileSizeBytes / 1024 / 1024);
    const newTotalMB = currentMB + fileSizeMB;

    const allowed = newTotalMB <= KB_STORAGE_MB_LIMIT;

    return {
      allowed,
      currentMB,
      limitMB: KB_STORAGE_MB_LIMIT,
      fileSizeMB,
      newTotalMB,
      error: allowed ? null : {
        code: 'KB_STORAGE_EXCEEDED',
        message: `Storage limit exceeded. Current: ${currentMB}MB, File: ${fileSizeMB}MB, Limit: ${KB_STORAGE_MB_LIMIT}MB`
      }
    };
  } catch (err) {
    console.error('❌ [Global Limits] KB storage check error:', err);
    throw err;
  }
}

/**
 * Check CRM records limit
 * @param {number} businessId
 * @param {number} additionalRecords - How many records to add
 * @returns {Promise<Object>} { allowed, current, limit, error }
 */
export async function checkCRMLimit(businessId, additionalRecords = 1) {
  try {
    const currentCount = await prisma.customerData.count({
      where: { businessId }
    });

    const newTotal = currentCount + additionalRecords;
    const allowed = newTotal <= CRM_RECORDS_LIMIT;

    return {
      allowed,
      current: currentCount,
      limit: CRM_RECORDS_LIMIT,
      newTotal,
      error: allowed ? null : {
        code: 'CRM_LIMIT_EXCEEDED',
        message: `CRM record limit reached (${currentCount}/${CRM_RECORDS_LIMIT}). Cannot add ${additionalRecords} more.`
      }
    };
  } catch (err) {
    console.error('❌ [Global Limits] CRM check error:', err);
    throw err;
  }
}

/**
 * Get URL crawl max pages limit
 * @returns {number}
 */
export function getURLCrawlLimit() {
  return KB_CRAWL_MAX_PAGES;
}

/**
 * Get all limits (for UI display)
 * @returns {Object}
 */
export function getLimits() {
  return {
    crmRecords: CRM_RECORDS_LIMIT,
    kbItems: KB_ITEMS_LIMIT,
    kbStorageMB: KB_STORAGE_MB_LIMIT,
    urlCrawlMaxPages: KB_CRAWL_MAX_PAGES
  };
}

/**
 * Get current usage for a business
 * @param {number} businessId
 * @returns {Promise<Object>}
 */
export async function getUsage(businessId) {
  try {
    const [kbCount, crmCount, storageResult] = await Promise.all([
      prisma.knowledgeBase.count({ where: { businessId } }),
      prisma.customerData.count({ where: { businessId } }),
      prisma.knowledgeBase.aggregate({
        where: { businessId, type: 'DOCUMENT' },
        _sum: { fileSize: true }
      })
    ]);

    const storageMB = Math.ceil((storageResult._sum.fileSize || 0) / 1024 / 1024);

    return {
      kbItems: kbCount,
      crmRecords: crmCount,
      kbStorageMB: storageMB
    };
  } catch (err) {
    console.error('❌ [Global Limits] Get usage error:', err);
    throw err;
  }
}
