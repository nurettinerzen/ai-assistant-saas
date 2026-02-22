/**
 * Guardrails Test Suite
 *
 * Comprehensive tests for:
 * - P0-A: Tool-Only Data Gate (semantic gating + tool-response binding)
 * - P0-B: Internal Protocol Guard (intent-based detection)
 * - P1-A: Anti-Confabulation Guard
 * - P1-B: NO_INFO Constraints
 *
 * Test categories:
 * - Positive tests: Valid responses should pass
 * - Negative tests: Violations should be caught
 * - Paraphrase tests: Different wordings of same violation
 * - Edge cases: Boundary conditions
 */

import { describe, it, expect } from 'vitest';
import {
  containsSensitiveSemantics,
  validateToolOnlyData,
  validateResponseConsistency,
  validateToolOnlyDataFull
} from '../../src/guardrails/toolOnlyDataGuard.js';
import {
  detectInternalProtocolIntent,
  validateInternalProtocol
} from '../../src/guardrails/internalProtocolGuard.js';
import {
  detectEventClaim,
  validateConfabulation
} from '../../src/guardrails/antiConfabulationGuard.js';
import {
  getNoInfoConstraint,
  detectForbiddenTemplate,
  validateNoInfoResponse
} from '../../src/guardrails/noInfoConstraints.js';
import {
  evaluateSecurityGateway,
  applyLeakFilter
} from '../../src/guardrails/securityGateway.js';
import { shouldBypassLeakFilter } from '../../src/security/outcomePolicy.js';
import { ToolOutcome } from '../../src/tools/toolResult.js';

// ============================================
// Contract-focused policy tests (SSOT)
// ============================================
describe('Guardrail Policy Contracts', () => {
  it('should require verification for account-verified fields when state is none', () => {
    const decision = evaluateSecurityGateway({
      verificationState: 'none',
      requestedDataFields: ['order_status', 'tracking_number']
    });

    expect(decision.requiresVerification).toBe(true);
    expect(decision.allowedActions.ask_verification).toBe(true);
    expect(decision.deniedFields.length).toBeGreaterThan(0);
  });

  it('should allow verified account fields after verification passes', () => {
    const decision = evaluateSecurityGateway({
      verificationState: 'verified',
      verifiedIdentity: { phone: '05321234567' },
      requestedRecord: { phone: '05321234567' },
      requestedDataFields: ['order_status', 'tracking_number']
    });

    expect(decision.requiresVerification).toBe(false);
    expect(decision.allowedFields).toContain('order_status');
    expect(decision.hasIdentityMismatch).toBe(false);
  });

  it('should PASS tracking+address text (detection removed, security via tool gating)', () => {
    const result = applyLeakFilter(
      'Takip numaranız TR1234567890 ve teslimat adresiniz İstanbul Kadıköy.',
      'none',
      'TR',
      {}
    );

    // Tracking/address detection kaldirildi — artik PASS
    // Guvenlik: tool gating + LLM prompt ile saglaniyor
    expect(result.safe).toBe(true);
    expect(result.action).toBe('PASS');
  });

  it('should bypass leak filter for non-data terminal outcomes', () => {
    expect(shouldBypassLeakFilter(ToolOutcome.NOT_FOUND)).toBe(true);
    expect(shouldBypassLeakFilter(ToolOutcome.VALIDATION_ERROR)).toBe(true);
    expect(shouldBypassLeakFilter(ToolOutcome.VERIFICATION_REQUIRED)).toBe(true);
    expect(shouldBypassLeakFilter(ToolOutcome.OK)).toBe(false);
  });
});

// ============================================
// P0-A: Tool-Only Data Gate Tests
// ============================================
describe('Tool-Only Data Gate (P0-A)', () => {
  describe('containsSensitiveSemantics', () => {
    // Positive: Safe responses
    it('should pass safe greeting responses', () => {
      const response = 'Merhaba! Size nasıl yardımcı olabilirim?';
      const result = containsSensitiveSemantics(response, 'TR');
      expect(result.hasSensitiveData).toBe(false);
    });

    it('should pass general help offers', () => {
      const response = 'Sipariş numaranızı alabilir miyim?';
      const result = containsSensitiveSemantics(response, 'TR');
      expect(result.hasSensitiveData).toBe(false);
    });

    // Negative: Violations - Direct patterns
    it('should catch direct delivery status leak', () => {
      const response = 'Paketiniz bugün teslim edildi.';
      const result = containsSensitiveSemantics(response, 'TR');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.category).toBe('orderStatus');
    });

    it('should catch tracking number leak', () => {
      const response = 'Takip numaranız: YK123456789TR';
      const result = containsSensitiveSemantics(response, 'TR');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.category).toBe('orderStatus');
    });

    // Negative: Paraphrase variations
    it('should catch paraphrased delivery - neighbor scenario', () => {
      const response = 'Görünüşe göre paketiniz komşunuza bırakılmış.';
      const result = containsSensitiveSemantics(response, 'TR');
      expect(result.hasSensitiveData).toBe(true);
    });

    it('should catch paraphrased delivery - time estimate', () => {
      const response = 'Siparişiniz yarın elinize ulaşacak.';
      const result = containsSensitiveSemantics(response, 'TR');
      expect(result.hasSensitiveData).toBe(true);
    });

    it('should catch paraphrased delivery - informal', () => {
      const response = 'Kargonuz yola çıkmış, 2 gün içinde gelir.';
      const result = containsSensitiveSemantics(response, 'TR');
      expect(result.hasSensitiveData).toBe(true);
    });

    // Negative: Customer PII
    it('should catch phone number leak', () => {
      const response = 'Telefonunuz: 0532 123 45 67';
      const result = containsSensitiveSemantics(response, 'TR');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.category).toBe('customerPII');
    });

    it('should catch balance/debt leak', () => {
      const response = 'Bakiyeniz: 1.500,00 TL';
      const result = containsSensitiveSemantics(response, 'TR');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.category).toBe('customerPII');
    });
  });

  describe('validateToolOnlyData', () => {
    // Tool called correctly
    it('should pass when tool called for sensitive data', () => {
      const response = 'Kargonuz yola çıktı, 2 gün içinde teslim edilecek.';
      const toolCalls = [{ name: 'check_order_status', success: true }];
      const result = validateToolOnlyData(response, toolCalls, 'TR');
      expect(result.safe).toBe(true);
    });

    // No tool called
    it('should fail when no tool called for sensitive data', () => {
      const response = 'Paketiniz teslim edildi.';
      const toolCalls = [];
      const result = validateToolOnlyData(response, toolCalls, 'TR');
      expect(result.safe).toBe(false);
      expect(result.violation.type).toBe('TOOL_ONLY_DATA_LEAK');
    });

    // Wrong tool called
    it('should fail when wrong tool called for data type', () => {
      const response = 'Siparişiniz kargoda, takip no: XYZ123';
      const toolCalls = [{ name: 'search_knowledge_base', success: true }];
      const result = validateToolOnlyData(response, toolCalls, 'TR');
      expect(result.safe).toBe(false);
      expect(result.violation.type).toBe('TOOL_MISMATCH_DATA_LEAK');
    });
  });

  describe('validateResponseConsistency', () => {
    it('should detect status inconsistency', () => {
      const response = 'Siparişiniz teslim edildi.';
      const toolOutput = {
        truth: {
          order: { status: 'PROCESSING' }
        }
      };
      const result = validateResponseConsistency(response, toolOutput, 'TR');
      expect(result.consistent).toBe(false);
      expect(result.discrepancies[0].expected).toBe('PROCESSING');
    });

    it('should pass consistent response', () => {
      const response = 'Siparişiniz hazırlanıyor.';
      const toolOutput = {
        truth: {
          order: { status: 'PROCESSING' }
        }
      };
      const result = validateResponseConsistency(response, toolOutput, 'TR');
      expect(result.consistent).toBe(true);
    });
  });
});

// ============================================
// P0-B: Internal Protocol Guard Tests
// ============================================
describe('Internal Protocol Guard (P0-B)', () => {
  describe('detectInternalProtocolIntent', () => {
    // Positive: Safe responses
    it('should pass helpful response', () => {
      const response = 'Bu konuda size yardımcı olabilirim.';
      const result = detectInternalProtocolIntent(response, 'TR');
      expect(result.hasIntent).toBe(false);
    });

    // Negative: System disclosure
    it('should catch "sistem gereği" disclosure', () => {
      const response = 'Sistem gereği bu bilgiye erişemiyorum.';
      const result = detectInternalProtocolIntent(response, 'TR');
      expect(result.hasIntent).toBe(true);
      expect(result.category).toBe('systemDisclosure');
    });

    it('should catch "güvenlik kuralı" disclosure', () => {
      const response = 'Güvenlik kurallarımız gereği bunu yapamam.';
      const result = detectInternalProtocolIntent(response, 'TR');
      expect(result.hasIntent).toBe(true);
      expect(result.category).toBe('systemDisclosure');
    });

    // Negative: Paraphrase variations
    it('should catch "erişim yok" paraphrase', () => {
      const response = 'Maalesef bu bilgiye erişimim yok.';
      const result = detectInternalProtocolIntent(response, 'TR');
      expect(result.hasIntent).toBe(true);
    });

    it('should catch "yetkim dışında" paraphrase', () => {
      const response = 'Bu benim yetkilerim dışında kalıyor.';
      const result = detectInternalProtocolIntent(response, 'TR');
      expect(result.hasIntent).toBe(true);
    });

    it('should catch indirect capability denial', () => {
      const response = 'Bu tür bilgileri paylaşamam, üzgünüm.';
      const result = detectInternalProtocolIntent(response, 'TR');
      expect(result.hasIntent).toBe(true);
      expect(result.category).toBe('capabilityDenial');
    });

    // Negative: Policy reference
    it('should catch KVKK reference', () => {
      const response = 'KVKK gereği bu bilgiyi veremiyorum.';
      const result = detectInternalProtocolIntent(response, 'TR');
      expect(result.hasIntent).toBe(true);
      expect(result.category).toBe('policyReference');
    });

    // Negative: AI disclosure
    it('should catch AI identity disclosure', () => {
      const response = 'Ben bir yapay zeka asistanıyım.';
      const result = detectInternalProtocolIntent(response, 'TR');
      expect(result.hasIntent).toBe(true);
      expect(result.category).toBe('aiDisclosure');
    });
  });

  describe('validateInternalProtocol', () => {
    it('should return correction constraint for violation', () => {
      const response = 'Güvenlik kurallarımız nedeniyle bu bilgiyi paylaşamam.';
      const result = validateInternalProtocol(response, 'TR');
      expect(result.safe).toBe(false);
      expect(result.correctionConstraint).toBeDefined();
      expect(result.correctionConstraint).toContain('DÜZELTME');
    });
  });
});

// ============================================
// P1-A: Anti-Confabulation Guard Tests
// ============================================
describe('Anti-Confabulation Guard (P1-A)', () => {
  describe('detectEventClaim', () => {
    // Positive: Safe responses
    it('should pass question responses', () => {
      const response = 'Sipariş numaranızı alabilir miyim?';
      const result = detectEventClaim(response, 'TR');
      expect(result.hasClaim).toBe(false);
    });

    it('should pass hedged responses', () => {
      const response = 'Muhtemelen yarın teslim edilir.';
      const result = detectEventClaim(response, 'TR');
      expect(result.hasClaim).toBe(false);
      expect(result.hedged).toBe(true);
    });

    // Negative: Delivery claims
    it('should catch "teslim edildi" claim', () => {
      const response = 'Paketiniz teslim edildi.';
      const result = detectEventClaim(response, 'TR');
      expect(result.hasClaim).toBe(true);
      expect(result.category).toBe('deliveryEvents');
    });

    it('should catch "komşuya bırakıldı" claim', () => {
      const response = 'Kargonuz komşunuza bırakıldı.';
      const result = detectEventClaim(response, 'TR');
      expect(result.hasClaim).toBe(true);
    });

    // Negative: Paraphrase variations
    it('should catch informal delivery claim', () => {
      const response = 'Paket kapıya gelmiş görünüyor.';
      const result = detectEventClaim(response, 'TR');
      // This might be hedged due to "görünüyor", test the pattern
      expect(result.hasClaim || result.hedged).toBe(true);
    });

    it('should catch future time assertion', () => {
      const response = 'Yarın saat 14:00 civarında teslim edilecek.';
      const result = detectEventClaim(response, 'TR');
      expect(result.hasClaim).toBe(true);
      expect(result.category).toBe('timeAssertions');
    });

    // Negative: Service event claims
    it('should catch "talep oluşturuldu" claim', () => {
      const response = 'Talebiniz oluşturuldu.';
      const result = detectEventClaim(response, 'TR');
      expect(result.hasClaim).toBe(true);
      expect(result.category).toBe('serviceEvents');
    });

    it('should catch "ekibimiz arayacak" claim', () => {
      const response = 'Ekibimiz 24 saat içinde sizinle iletişime geçecek.';
      const result = detectEventClaim(response, 'TR');
      expect(result.hasClaim).toBe(true);
    });
  });

  describe('validateConfabulation', () => {
    // With tool backup
    it('should pass claim with tool success', () => {
      const response = 'Siparişiniz kargoya verildi.';
      const toolCalls = [{ name: 'check_order_status', success: true }];
      const result = validateConfabulation(response, toolCalls, false, 'TR');
      expect(result.safe).toBe(true);
    });

    // Without tool backup
    it('should fail delivery claim without tool', () => {
      const response = 'Paketiniz bugün teslim edilecek.';
      const toolCalls = [];
      const result = validateConfabulation(response, toolCalls, false, 'TR');
      expect(result.safe).toBe(false);
      expect(result.violation.type).toBe('CONFABULATION');
    });

    // Stock with KB
    it('should pass stock claim with KB match', () => {
      const response = 'Bu ürün stoklarımızda mevcut.';
      const toolCalls = [];
      const hasKBMatch = true;
      const result = validateConfabulation(response, toolCalls, hasKBMatch, 'TR');
      expect(result.safe).toBe(true);
    });
  });
});

// ============================================
// P1-B: NO_INFO Constraints Tests
// ============================================
describe('NO_INFO Constraints (P1-B)', () => {
  describe('getNoInfoConstraint', () => {
    it('should return constraint for KB_NOT_FOUND', () => {
      const result = getNoInfoConstraint('KB_NOT_FOUND', 'TR', {
        businessName: 'TestShop',
        topic: 'iade politikası'
      });
      expect(result.constraint).toContain('YAPILMASI GEREKENLER');
      expect(result.constraint).toContain('YAPILMAMASI GEREKENLER');
    });

    it('should include context in constraint', () => {
      const result = getNoInfoConstraint('TOOL_NOT_FOUND', 'TR', {
        searchType: 'sipariş',
        searchValue: 'ABC123'
      });
      expect(result.contextUsed).toContain('searchType');
      expect(result.constraint).toContain('sipariş');
    });
  });

  describe('detectForbiddenTemplate', () => {
    // Positive: Natural responses
    it('should pass natural "no info" response', () => {
      const response = 'Bu konuda elimde bilgi yok, ama başka bir şeyle yardımcı olabilirim.';
      const result = detectForbiddenTemplate(response, 'TR');
      expect(result.hasTemplate).toBe(false);
    });

    // Negative: Template responses
    it('should catch "bilgi bankamda yok" template', () => {
      const response = 'Bilgi bankamızda bu konuda bilgi bulunmuyor.';
      const result = detectForbiddenTemplate(response, 'TR');
      expect(result.hasTemplate).toBe(true);
    });

    it('should catch rigid technical not-found template', () => {
      const response = 'Veritabanı sorgusunda eşleşen kayıt bulunamadı.';
      const result = detectForbiddenTemplate(response, 'TR');
      expect(result.hasTemplate).toBe(true);
    });

    it('should catch "doğrulama başarısız" template', () => {
      const response = 'Doğrulama başarısız oldu, tekrar deneyin.';
      const result = detectForbiddenTemplate(response, 'TR');
      expect(result.hasTemplate).toBe(true);
    });
  });

  describe('validateNoInfoResponse', () => {
    it('should rate good natural response', () => {
      const response = 'Hmm, bu ürün hakkında detay veremiyorum şu an. Başka nasıl yardımcı olabilirim?';
      const result = validateNoInfoResponse(response, 'TR');
      expect(result.quality).toBe('good');
    });

    it('should catch excessive apology', () => {
      const response = 'Özür dilerim, maalesef bu konuda bilgim yok. Özür dilerim.';
      const result = validateNoInfoResponse(response, 'TR');
      expect(result.issues.some(i => i.type === 'EXCESSIVE_APOLOGY')).toBe(true);
    });

    it('should catch technical language', () => {
      const response = 'Veritabanında kayıt bulunamadı. Sistem sorgusu başarısız oldu. Doğrulama hatası.';
      const result = validateNoInfoResponse(response, 'TR');
      expect(result.issues.some(i => i.type === 'TECHNICAL_LANGUAGE')).toBe(true);
    });
  });
});

// ============================================
// Integration Tests
// ============================================
describe('Guardrails Integration', () => {
  describe('Full validation pipeline', () => {
    it('should catch multi-violation response', () => {
      // Response with both tool-only data leak AND internal protocol disclosure
      const response = 'Sistem gereği bu bilgiye erişemiyorum, ama paketiniz teslim edildi.';

      const toolResult = validateToolOnlyData(response, [], 'TR');
      const protocolResult = validateInternalProtocol(response, 'TR');

      expect(toolResult.safe).toBe(false);
      expect(protocolResult.safe).toBe(false);
    });

    it('should pass clean response through all guards', () => {
      const response = 'Sipariş numaranızı alabilir miyim? Durumu kontrol edeyim.';

      const toolResult = validateToolOnlyData(response, [], 'TR');
      const protocolResult = validateInternalProtocol(response, 'TR');
      const confabResult = validateConfabulation(response, [], false, 'TR');
      const noInfoResult = validateNoInfoResponse(response, 'TR');

      expect(toolResult.safe).toBe(true);
      expect(protocolResult.safe).toBe(true);
      expect(confabResult.safe).toBe(true);
      expect(noInfoResult.quality).toBe('good');
    });
  });
});
