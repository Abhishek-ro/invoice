import React, { useState } from 'react';

const ERP_INTEGRATIONS = [
  { id: 'sap', name: 'SAP S/4HANA', status: 'Connected', lastSync: '2 mins ago', icon: 'S/4' },
  { id: 'oracle', name: 'Oracle ERP Cloud', status: 'Disconnected', lastSync: 'Never', icon: 'O' },
  { id: 'coupa', name: 'Coupa Procurement', status: 'Connected', lastSync: '15 mins ago', icon: 'C' },
  { id: 'netsuite', name: 'Oracle NetSuite', status: 'Disconnected', lastSync: 'Never', icon: 'N' }
];

export default function ErpConfig() {
  const [integrations, setIntegrations] = useState(ERP_INTEGRATIONS);

  const handleToggle = (id) => {
    setIntegrations(integrations.map(int => {
      if (int.id === id) {
        return {
          ...int,
          status: int.status === 'Connected' ? 'Disconnected' : 'Connected',
          lastSync: int.status === 'Disconnected' ? 'Just now' : 'Never'
        };
      }
      return int;
    }));
  };

  return (
    <>
      <header className="topbar">
        <h1 className="topbar__title">ERP Configuration</h1>
      </header>
      <div className="ud-content" style={{ paddingBottom: '3rem', maxWidth: '900px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--gray-900)' }}>Active Integrations</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>Connect your external ERP and Procurement systems to enable automated 3-way matching and syncing.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {integrations.map(int => (
            <div key={int.id} className="ir-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--gray-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: int.status === 'Connected' ? 'var(--primary-50)' : 'var(--gray-100)', color: int.status === 'Connected' ? 'var(--primary-blue)' : 'var(--gray-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800 }}>
                    {int.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-800)' }}>{int.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: int.status === 'Connected' ? '#10b981' : 'var(--gray-300)' }} />
                      <span style={{ fontSize: '13px', color: int.status === 'Connected' ? 'var(--tint-success-text)' : 'var(--gray-500)', fontWeight: int.status === 'Connected' ? 600 : 400 }}>{int.status}</span>
                    </div>
                  </div>
                </div>
                <div 
                  onClick={() => handleToggle(int.id)}
                  style={{ width: '44px', height: '24px', background: int.status === 'Connected' ? 'var(--primary-blue)' : 'var(--gray-300)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'background 0.3s' }}
                >
                  <div style={{ width: '20px', height: '20px', background: 'var(--primary-white)', borderRadius: '50%', position: 'absolute', top: '2px', left: int.status === 'Connected' ? '22px' : '2px', transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                </div>
              </div>
              
              <div style={{ padding: '1.5rem', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Last Sync</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-800)', marginTop: '4px' }}>{int.lastSync}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Sync Frequency</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-800)', marginTop: '4px' }}>Real-time</div>
                  </div>
                </div>

                {int.status === 'Connected' && (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{ padding: '8px 16px', background: 'var(--primary-white)', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--gray-700)', cursor: 'pointer', flex: 1 }}>Configure Mapping</button>
                    <button style={{ padding: '8px 16px', background: 'var(--primary-white)', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--gray-700)', cursor: 'pointer', flex: 1 }}>Sync Now</button>
                  </div>
                )}
                {int.status === 'Disconnected' && (
                  <button style={{ padding: '8px 16px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--gray-400)', cursor: 'not-allowed', width: '100%' }}>Connect via OAuth 2.0</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
