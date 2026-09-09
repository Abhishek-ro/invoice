import React, { useState } from 'react';

// TODO(04 §B.3.3 / 03 §9): notes and the override log are ONE table with a
// `kind` field now (`note` | `decision` | `system`) — this component used
// to paper over two different shapes with `entry.author || entry.actor`
// and `entry.text || entry.note`. Both callers in ReconciliationDetail.jsx
// now pass real audit_log rows, so this reads `actor_name` / `body`
// directly; no more fallback chain needed.
export default function ActivityTimeline({ entries, type = 'formal', onAddNote }) {
  // type can be 'formal' (audit log: system + decision rows) or
  // 'informal' (notes: kind === 'note' rows, with an add-note box)
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!draft.trim() || !onAddNote) return;
    setPosting(true);
    try {
      await onAddNote(draft.trim());
      setDraft('');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
      {entries.length === 0 && (
        <div style={{ fontSize: '13px', color: 'var(--gray-400)', fontStyle: 'italic' }}>Nothing here yet.</div>
      )}
      {entries.map((entry, idx) => (
        <div key={entry.id ?? idx} style={{ display: 'flex', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: type === 'formal' ? 'var(--gray-200)' : 'var(--primary-50)',
              color: type === 'formal' ? 'var(--gray-600)' : 'var(--primary-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700
            }}>
              {entry.actor_name === 'system' ? 'SYS' : (entry.actor_name || '?').substring(0, 2).toUpperCase()}
            </div>
            {idx !== entries.length - 1 && (
              <div style={{ width: '2px', flex: 1, background: 'var(--gray-100)', marginTop: '4px' }} />
            )}
          </div>

          <div style={{ flex: 1, paddingBottom: idx !== entries.length - 1 ? '16px' : '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)' }}>
                {entry.actor_name}
                {entry.action && <span style={{ marginLeft: '6px', color: 'var(--gray-500)', fontWeight: 500 }}>did <strong style={{color: 'var(--gray-700)'}}>{entry.action}</strong></span>}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>
                {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--gray-600)', lineHeight: 1.5, background: type === 'informal' ? 'var(--gray-50)' : 'transparent', padding: type === 'informal' ? '8px 12px' : 0, borderRadius: '6px', border: type === 'informal' ? '1px solid var(--gray-200)' : 'none' }}>
              {entry.body}
            </div>
          </div>
        </div>
      ))}

      {type === 'informal' && onAddNote && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Add a note..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePost()}
            disabled={posting}
            style={{ flex: 1, padding: '8px 12px', fontSize: '13px', border: '1px solid var(--gray-300)', borderRadius: '6px', outline: 'none' }}
          />
          <button onClick={handlePost} disabled={posting || !draft.trim()} style={{ background: 'var(--primary-blue)', color: 'white', border: 'none', borderRadius: '6px', padding: '0 12px', fontWeight: 600, fontSize: '12px', cursor: posting ? 'not-allowed' : 'pointer', opacity: posting || !draft.trim() ? 0.6 : 1 }}>
            {posting ? '…' : 'Post'}
          </button>
        </div>
      )}
    </div>
  );
}
