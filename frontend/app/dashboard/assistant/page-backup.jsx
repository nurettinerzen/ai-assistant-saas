'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const ASSISTANT_OPTIONS = [
  { id: '1de49414-20bd-4f8c-a7fe-9ffc0c31f299', name: 'Male - Professional', language: 'English', gender: 'male', tone: 'professional', description: 'Clear, formal, business-like tone', icon: '👔' },
  { id: '8a8de2a7-ef5c-4e4a-9fcc-b3ba09902853', name: 'Male - Friendly', language: 'English', gender: 'male', tone: 'friendly', description: 'Warm, approachable, conversational', icon: '😊' },
  { id: 'e0edb369-b0eb-458b-8065-711566e55ccc', name: 'Female - Professional', language: 'English', gender: 'female', tone: 'professional', description: 'Clear, formal, business-like tone', icon: '👔' },
  { id: 'e2331274-3400-4072-89d9-f6fb1983592a', name: 'Female - Friendly', language: 'English', gender: 'female', tone: 'friendly', description: 'Warm, approachable, conversational', icon: '😊' },
  { id: '92c1b650-ff94-4965-9823-b68dbadceae3', name: 'Erkek - Profesyonel', language: 'Türkçe', gender: 'male', tone: 'professional', description: 'Net, resmi, iş odaklı', icon: '👔' },
  { id: '978bd2ab-2a1d-4bd9-9ad1-5d47d75e5c6b', name: 'Erkek - Samimi', language: 'Türkçe', gender: 'male', tone: 'friendly', description: 'Sıcak, yakın, rahat', icon: '😊' },
  { id: '55772a91-8283-4ccf-8d70-d2169bed0f16', name: 'Kadın - Profesyonel', language: 'Türkçe', gender: 'female', tone: 'professional', description: 'Net, resmi, iş odaklı', icon: '👔' },
  { id: '09279902-6a07-4831-9d8c-abcec48857bf', name: 'Kadın - Samimi', language: 'Türkçe', gender: 'female', tone: 'friendly', description: 'Sıcak, yakın, rahat', icon: '😊' },
];

export default function AssistantPage() {

  const router = useRouter();
  const [activeTab, setActiveTab] = useState('assistant');

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [currentAssistantId, setCurrentAssistantId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // AI TRAINING STATES
  const [trainings, setTrainings] = useState([]);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [trainingForm, setTrainingForm] = useState({
    title: '',
    instructions: '',
    category: ''
  });

  // FETCH USER + TRAININGS
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/login');

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(async data => {
        if (!data.id) return router.push('/login');

        setUser(data);
        setCurrentAssistantId(data.business?.vapiAssistantId);
        setSelectedAssistant(data.business?.vapiAssistantId);

        await loadTrainings();
      })
      .finally(() => setLoading(false));
  }, []);

  // LOAD TRAININGS
  const loadTrainings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/ai-training`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTrainings(data);
    } catch (err) {
      console.error("Load trainings error:", err);
    }
  };

  // SAVE ASSISTANT
  const handleSaveAssistant = async () => {
    if (!selectedAssistant) {
      setMessage("Please select an assistant first");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/business/${user.businessId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vapiAssistantId: selectedAssistant })
      });

      if (res.ok) {
        setCurrentAssistantId(selectedAssistant);
        setMessage("Assistant saved ✔");
      } else {
        setMessage("Error saving assistant ❌");
      }
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  {/* YENİ BUTON: Training'leri VAPI'ye gönder */}
<button
  onClick={async () => {
    if (!currentAssistantId) {
      alert('Please save an assistant first!');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/assistant/update`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vapiAssistantId: currentAssistantId,
          customInstructions: 'Applying all training data'
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(`✅ Success! ${data.trainingsApplied} trainings applied to VAPI assistant!`);
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Failed to apply training');
    }
  }}
  disabled={!currentAssistantId}
  style={{
    marginTop: '10px',
    padding: '15px 30px',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: currentAssistantId ? 'pointer' : 'not-allowed',
    opacity: currentAssistantId ? 1 : 0.5
  }}
>
  🚀 Sync Training to VAPI
</button>

  // CREATE / UPDATE TRAINING
  const saveTraining = async () => {
    try {
      const token = localStorage.getItem('token');

      const method = editingTraining ? 'PUT' : 'POST';
      const url = editingTraining
        ? `${API_URL}/api/ai-training/${editingTraining.id}`
        : `${API_URL}/api/ai-training`;

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(trainingForm)
      });

      if (!res.ok) return alert("Error saving training");

      setShowTrainingModal(false);
      setEditingTraining(null);
      setTrainingForm({ title: '', instructions: '', category: '' });
      await loadTrainings();
    } catch (err) {
      console.error("Save training error:", err);
    }
  };

  // DELETE TRAINING
  const deleteTraining = async (id) => {
    if (!confirm("Delete this training?")) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/ai-training/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadTrainings();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  if (loading) return <div style={{ padding: 50, textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ padding: '50px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <button
          onClick={() => setActiveTab('assistant')}
          style={{
            padding: '10px 20px',
            borderBottom: activeTab === 'assistant' ? '3px solid #4f46e5' : 'none',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'assistant' ? 'bold' : 'normal'
          }}
        >
          🤖 Assistant
        </button>

        <button
          onClick={() => setActiveTab('training')}
          style={{
            padding: '10px 20px',
            borderBottom: activeTab === 'training' ? '3px solid #4f46e5' : 'none',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'training' ? 'bold' : 'normal'
          }}
        >
          📘 AI Training
        </button>
      </div>

      {/* ========================= */}
      {/* ASSISTANT TAB */}
      {/* ========================= */}

      {activeTab === 'assistant' && (
        <div>

          <h1 style={{ marginBottom: '10px' }}>AI Assistant Configuration</h1>
          <p style={{ color: '#666' }}>Select the voice/personality of your assistant</p>

          {message && (
            <div style={{
              padding: '10px',
              marginBottom: '20px',
              borderRadius:'5px',
              background: message.includes("✔") ? "#d4edda" : "#f8d7da"
            }}>
              {message}
            </div>
          )}

          {currentAssistantId && (
            <div style={{
              padding: '15px',
              borderRadius: '5px',
              background: '#f0f4ff',
              marginBottom: '20px'
            }}>
              <strong>Current:</strong>{" "}
              {ASSISTANT_OPTIONS.find(a => a.id === currentAssistantId)?.name}
            </div>
          )}

          {/* Assistant Options Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
            gap: '20px'
          }}>
            {ASSISTANT_OPTIONS.map(opt => (
              <div
                key={opt.id}
                onClick={() => setSelectedAssistant(opt.id)}
                style={{
                  padding: '15px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: selectedAssistant === opt.id ? '3px solid #4f46e5' : '2px solid #ddd',
                  background: selectedAssistant === opt.id ? '#f7f7ff' : 'white',
                  position:'relative'
                }}
              >
                {selectedAssistant === opt.id && (
                  <div style={{
                    position: 'absolute',
                    top: 10, right: 10,
                    width: 22, height: 22,
                    background:'#4f46e5', color:'white',
                    borderRadius:'50%',
                    display:'flex', alignItems:'center', justifyContent:'center'
                  }}>
                    ✓
                  </div>
                )}

                <div style={{ fontSize: 40 }}>{opt.gender === 'male' ? '👨' : '👩'} {opt.icon}</div>
                <h3 style={{ margin:'10px 0 5px' }}>{opt.name}</h3>
                <p style={{ fontSize: 13, color:'#666' }}>{opt.description}</p>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveAssistant}
            disabled={!selectedAssistant || saving}
            style={{
              marginTop:'20px',
              padding:'15px 30px',
              background:'#4f46e5',
              color:'white',
              border:'none',
              borderRadius:'5px',
              cursor:'pointer'
            }}
          >
            {saving ? "Saving..." : "Save Assistant"}
          </button>
        </div>
      )}

      {/* ========================= */}
      {/* AI TRAINING TAB */}
      {/* ========================= */}

      {activeTab === 'training' && (
        <div>

          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'25px' }}>
            <h2>AI Training Instructions</h2>
            <button
              onClick={() => {
                setEditingTraining(null);
                setTrainingForm({ title:'', instructions:'', category:'' });
                setShowTrainingModal(true);
              }}
              style={{
                padding:'10px 20px',
                background:'#4f46e5',
                color:'white',
                borderRadius:'5px',
                border:'none',
                cursor:'pointer'
              }}
            >
              + Add Training
            </button>
          </div>

          {/* LIST */}
          {trainings.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#666' }}>
              📘 No training data yet  
              <br />  
              <small>Add custom rules, instructions or knowledge.</small>
            </div>
          ) : (
            <div style={{
              background:'white',
              borderRadius:'10px',
              overflow:'hidden',
              border:'1px solid #eee'
            }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f5f5f5' }}>
                    <th style={{ padding:15, textAlign:'left' }}>Title</th>
                    <th style={{ padding:15, textAlign:'left' }}>Category</th>
                    <th style={{ padding:15, textAlign:'left' }}>Created</th>
                    <th style={{ padding:15, textAlign:'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trainings.map(t => (
                    <tr key={t.id} style={{ borderBottom:'1px solid #eee' }}>
                      <td style={{ padding:15 }}>{t.title}</td>
                      <td style={{ padding:15 }}>{t.category || '-'}</td>
                      <td style={{ padding:15 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding:15, textAlign:'center' }}>
                        <button
                          onClick={() => {
                            setEditingTraining(t);
                            setTrainingForm({
                              title: t.title,
                              instructions: t.instructions,
                              category: t.category || ''
                            });
                            setShowTrainingModal(true);
                          }}
                          style={{
                            marginRight:10,
                            padding:'6px 12px',
                            border:'none',
                            background:'#4f46e5',
                            color:'white',
                            borderRadius:'4px',
                            cursor:'pointer'
                          }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteTraining(t.id)}
                          style={{
                            padding:'6px 12px',
                            border:'none',
                            background:'#ef4444',
                            color:'white',
                            borderRadius:'4px',
                            cursor:'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TRAINING MODAL */}
      {showTrainingModal && (
        <div style={{
          position:'fixed',
          inset:0,
          background:'rgba(0,0,0,0.5)',
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          zIndex:1000
        }}>
          <div style={{
            background:'white',
            padding:'30px',
            borderRadius:'10px',
            width:'90%',
            maxWidth:'600px'
          }}>
            <h2 style={{ marginTop:0 }}>
              {editingTraining ? "Edit Training" : "Add Training"}
            </h2>

            <div style={{ marginBottom:15 }}>
              <label>Title *</label>
              <input
                type="text"
                value={trainingForm.title}
                onChange={(e) => setTrainingForm({ ...trainingForm, title:e.target.value })}
                style={{ width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'5px' }}
              />
            </div>

            <div style={{ marginBottom:15 }}>
              <label>Category</label>
              <input
                type="text"
                value={trainingForm.category}
                onChange={(e) => setTrainingForm({ ...trainingForm, category:e.target.value })}
                style={{ width:'100%', padding:'10px', border:'1px solid #ccc', borderRadius:'5px' }}
              />
            </div>

            <div style={{ marginBottom:15 }}>
              <label>Instructions *</label>
              <textarea
                value={trainingForm.instructions}
                onChange={(e) => setTrainingForm({ ...trainingForm, instructions:e.target.value })}
                style={{ width:'100%', minHeight:'150px', padding:'10px', border:'1px solid #ccc', borderRadius:'5px' }}
              ></textarea>
            </div>

            <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}>
              <button
                onClick={saveTraining}
                style={{
                  flex:1,
                  padding:'12px',
                  background:'#4f46e5',
                  color:'white',
                  border:'none',
                  borderRadius:'5px',
                  cursor:'pointer'
                }}
              >
                {editingTraining ? "Save Changes" : "Create"}
              </button>

              <button
                onClick={() => setShowTrainingModal(false)}
                style={{
                  flex:1,
                  padding:'12px',
                  background:'#e5e7eb',
                  border:'none',
                  borderRadius:'5px',
                  cursor:'pointer'
                }}
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}