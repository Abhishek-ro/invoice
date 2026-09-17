// Shared per-document-type colour so a document reads the same wherever it
// shows up in the wizard — the tone in Step 2's cards is the same tone on
// Step 3-7's header icon and status chips. Single source of truth so the
// two never drift apart as either step gets edited later.
export const DOC_TONE = {
  po: 'blue',
  grn: 'teal',
  quality: 'amber',
  service_entry: 'purple',
  contracts: 'rose',
};

export const toneClass = (docId) => `ir-ms-tone--${DOC_TONE[docId] || 'slate'}`;
