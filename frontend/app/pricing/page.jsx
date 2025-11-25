'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/login');

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.id) setUser(data);
      });
  }, []);

  const handleSubscribe = async () => {
  setLoading(true);
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/subscription/create-checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        priceId: 'price_1SUjlxRJeFH9VDJoJst7CKKz'
      })
    });

    const data = await res.json();

    if (res.ok) {
      // Stripe Checkout sayfasına yönlendir
      window.location.href = data.sessionUrl;
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Failed: ' + err.message);
  } finally {
    setLoading(false);
  }
};

  return (
    <div style={{ padding: '50px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '50px' }}>Choose Your Plan</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
        
        {/* Free Trial */}
        <div style={{ border: '2px solid #e5e7eb', borderRadius: '10px', padding: '30px', background: 'white' }}>
          <h2 style={{ marginBottom: '10px' }}>Free Trial</h2>
          <p style={{ fontSize: '40px', fontWeight: 'bold', margin: '20px 0' }}>$0<span style={{ fontSize: '16px', fontWeight: 'normal' }}>/month</span></p>
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: '30px' }}>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ AI Assistant</li>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ Basic Training</li>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>❌ Phone Number</li>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>❌ Advanced Features</li>
          </ul>
          <button disabled style={{ width: '100%', padding: '15px', background: '#e5e7eb', color: '#666', border: 'none', borderRadius: '5px', cursor: 'not-allowed' }}>Current Plan</button>
        </div>

        {/* Basic Plan */}
        <div style={{ border: '3px solid #4f46e5', borderRadius: '10px', padding: '30px', background: 'white', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', background: '#4f46e5', color: 'white', padding: '5px 20px', borderRadius: '20px', fontSize: '12px' }}>RECOMMENDED</div>
          <h2 style={{ marginBottom: '10px' }}>Basic Plan</h2>
          <p style={{ fontSize: '40px', fontWeight: 'bold', margin: '20px 0' }}>$29<span style={{ fontSize: '16px', fontWeight: 'normal' }}>/month</span></p>
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: '30px' }}>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ AI Assistant</li>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ Unlimited Training</li>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ 1 Phone Number</li>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ Call Analytics</li>
          </ul>
          <button 
            onClick={handleSubscribe}
            disabled={loading}
            style={{ width: '100%', padding: '15px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '5px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}
          >
            {loading ? 'Processing...' : 'Subscribe Now'}
          </button>
        </div>

        {/* Pro Plan */}
        <div style={{ border: '2px solid #e5e7eb', borderRadius: '10px', padding: '30px', background: 'white' }}>
          <h2 style={{ marginBottom: '10px' }}>Pro Plan</h2>
          <p style={{ fontSize: '40px', fontWeight: 'bold', margin: '20px 0' }}>$79<span style={{ fontSize: '16px', fontWeight: 'normal' }}>/month</span></p>
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: '30px' }}>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ Everything in Basic</li>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ 3 Phone Numbers</li>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ Advanced Analytics</li>
            <li style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>✅ Priority Support</li>
          </ul>
          <button disabled style={{ width: '100%', padding: '15px', background: '#e5e7eb', color: '#666', border: 'none', borderRadius: '5px', cursor: 'not-allowed' }}>Coming Soon</button>
        </div>

      </div>
    </div>
  );
}