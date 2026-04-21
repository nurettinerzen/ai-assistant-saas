import {
  buildGroundedMarketplaceAnswer,
  findRelevantProductEvidence,
} from '../../src/services/marketplace/qaAnswerGenerator.js';

describe('qaAnswerGenerator grounding', () => {
  const productContext = {
    title: 'TAB70WIFI 10.1 64GB/12GB Tablet MAVİ',
    brand: 'TeknoLine',
    categoryName: 'Tablet',
    description: '10.1 inç ekranlı tablet modeli. Wi-Fi bağlantısını destekler.',
    facts: [
      'Sim Kart Desteği: Yok',
      'Garanti Süresi: 24 Ay',
      'Bağlantı Türü: Wi-Fi',
    ],
  };

  it('selects evidence that matches the asked detail', () => {
    const evidence = findRelevantProductEvidence('Sim kart desteği var mı?', productContext);

    expect(evidence[0]?.text).toContain('Sim Kart Desteği: Yok');
  });

  it('returns an evidence-backed answer when product data contains the detail', () => {
    const answer = buildGroundedMarketplaceAnswer({
      language: 'tr',
      productName: productContext.title,
      questionText: 'Garanti süresi kaç yıl?',
      productContext,
    });

    expect(answer).toContain('garanti süresi');
    expect(answer).toContain('24 Ay');
  });

  it('falls back to verification wall when the detail is not present in product data', () => {
    const answer = buildGroundedMarketplaceAnswer({
      language: 'tr',
      productName: productContext.title,
      questionText: 'Menşei nedir?',
      productContext,
    });

    expect(answer).toContain('doğrulayamıyorum');
  });
});
