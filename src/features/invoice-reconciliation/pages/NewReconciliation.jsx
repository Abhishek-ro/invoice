import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadDocument, confirmDocument, createReconciliation, ApiError } from '../api';

/* ── Icons ───────────────────────────────────────── */
const UploadIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>;
const FileTextIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const CheckCircleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
const ErpIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>;

// TODO(04 §A.1.2 / §B.1.1): ERP source is cut for v1 — "there is always a
// file". This whole FETCH_SOURCES/erp branch has no backend counterpart,
// now or later per the current contract. Left as the same cosmetic
// setTimeout fake it always was; not wired to the API layer. If ERP
// fetch ever ships, it still ends at the same POST /documents call the
// manual-upload branch makes below.
const FETCH_SOURCES = [
  { id: 'manual', label: 'Manual Upload', icon: <UploadIcon /> },
  { id: 'erp', label: 'Fetch from ERP', icon: <ErpIcon /> },
];

// Frontend step ids (matches the wizard's own vocabulary and matchParams
// keys) -> the document_type domain value the API actually expects
// (03 §1 / 04 §A.2). 'timesheet' and 'contracts' are the two that differ.
const DOC_ID_TO_TYPE = { po: 'po', grn: 'grn', quality: 'quality', timesheet: 'service_entry', contracts: 'contract' };

export default function NewReconciliation() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState(null);

  // States for Invoice
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null); // POST /documents' `fields`, see TODO below
  const [invoiceDocId, setInvoiceDocId] = useState(null); // TODO(04 §B.1.1): the `id` POST /documents returns — needed for the PATCH confirm and for document_ids at submit
  const [invoiceLineItems, setInvoiceLineItems] = useState([]);
  const [confirmingInvoice, setConfirmingInvoice] = useState(false);
  const invoiceRef = useRef();

  // Match Params
  const [matchParams, setMatchParams] = useState({
    po: true,
    grn: true,
    quality: false,
    timesheet: false,
    contracts: false
  });

  const dynamicSteps = [
    { id: 'invoice', label: 'Invoice' },
    { id: 'params', label: 'Matching Strategy' }
  ];
  if (matchParams.po) dynamicSteps.push({ id: 'po', label: 'Purchase Order' });
  if (matchParams.grn) dynamicSteps.push({ id: 'grn', label: 'Goods Receipt' });
  if (matchParams.quality) dynamicSteps.push({ id: 'quality', label: 'Quality Insp.' });
  if (matchParams.timesheet) dynamicSteps.push({ id: 'timesheet', label: 'Service Entry' });
  if (matchParams.contracts) dynamicSteps.push({ id: 'contracts', label: 'Contracts' });
  dynamicSteps.push({ id: 'review', label: 'Review' });

  const currentStep = dynamicSteps[stepIndex];

  // Generic document states. `documentId` and `confirming` are new — the
  // rest is unchanged from before the API existed.
  const [docStates, setDocStates] = useState({
    po: { source: 'manual', file: null, fetched: false, fetching: false, documentId: null, confirming: false },
    grn: { source: 'manual', file: null, fetched: false, fetching: false, documentId: null, confirming: false },
    quality: { source: 'manual', file: null, fetched: false, fetching: false, documentId: null, confirming: false },
    timesheet: { source: 'manual', file: null, fetched: false, fetching: false, documentId: null, confirming: false },
    contracts: { source: 'manual', file: null, fetched: false, fetching: false, documentId: null, confirming: false },
  });

  const updateDoc = (docId, updates) => setDocStates(prev => ({ ...prev, [docId]: { ...prev[docId], ...updates } }));

  const fileRefs = {
    po: useRef(),
    grn: useRef(),
    quality: useRef(),
    timesheet: useRef(),
    contracts: useRef()
  };

  // Step Review
  const [taxRate, setTaxRate] = useState(0);
  const [actualSla, setActualSla] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [processStage, setProcessStage] = useState(0);

  const handleFileUpload = (e, setter) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.name.toLowerCase().endsWith('.pdf')) return setError('Only PDF files are supported.');
      setError(null);
      setter(f);
    }
  };

  // TODO(04 §B.1.1 POST /documents, §A.3 for the `fields`/`line_items`
  // shape): real upload + extraction call, replacing the old 2-second
  // setTimeout fake. `fields` comes back exactly per the contract — no
  // remapping needed since we render it generically below.
  const handleInvoiceUpload = (e) => {
    handleFileUpload(e, async (file) => {
      setInvoiceFile(file);
      setIsExtracting(true);
      setError(null);
      try {
        const doc = await uploadDocument(file, 'invoice');
        setInvoiceDocId(doc.id);
        setExtractedData(doc.fields);
        setInvoiceLineItems(doc.line_items);
        if (doc.extraction_status === 'failed') {
          // §A.4 degraded path — still a 201, fields are just all-null.
          // The form above still renders (now empty), same as a real
          // backend would leave it for manual entry.
          setError('Extraction failed — fields below are empty, please enter them manually.');
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
        setInvoiceFile(null);
      } finally {
        setIsExtracting(false);
      }
    });
  };

  const handleDocUpload = (e, docId) => {
    handleFileUpload(e, (file) => updateDoc(docId, { file }));
  };

  // TODO(04 §B.1.1 + §B.1.2): upload then immediately confirm. The wizard
  // has no review/edit UI for these secondary documents (only the
  // invoice gets one, further down), so this mock-parity refactor
  // confirms them as-is right after upload rather than leaving them
  // unconfirmed — POST /reconciliations rejects unconfirmed documents
  // with 422 document_not_confirmed. A real product probably wants a
  // review step here too, matching the invoice flow.
  const handleDocFileSelected = async (docId, file) => {
    updateDoc(docId, { file, confirming: true });
    setError(null);
    try {
      const documentType = DOC_ID_TO_TYPE[docId];
      const doc = await uploadDocument(file, documentType);
      await confirmDocument(doc.id, {});
      updateDoc(docId, { documentId: doc.id, confirming: false });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to process ${docId} upload.`);
      updateDoc(docId, { file: null, confirming: false });
    }
  };

  const handleFetchSource = (docId) => {
    // Cosmetic only — see the FETCH_SOURCES TODO above.
    updateDoc(docId, { fetching: true });
    setTimeout(() => { updateDoc(docId, { fetching: false, fetched: true }); }, 1500);
  };

  // TODO(04 §B.1.2 PATCH /documents/:id): persist any edits the user made
  // to the extracted fields before advancing, and mark the document
  // confirmed. POST /reconciliations later requires confirmed_at on
  // every attached document.
  const confirmInvoiceAndContinue = async () => {
    if (!invoiceDocId) return setStepIndex(stepIndex + 1);
    setConfirmingInvoice(true);
    setError(null);
    try {
      await confirmDocument(invoiceDocId, { fields: extractedData, line_items: invoiceLineItems });
      setStepIndex(stepIndex + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm the invoice. Please try again.');
    } finally {
      setConfirmingInvoice(false);
    }
  };

  // TODO(04 §B.1.3 POST /reconciliations): the real submit. The 5-stage
  // animation below is explicitly a "client-side flourish, no endpoint"
  // per 04's build notes for this screen — kept as-is for the UX, it
  // just now runs alongside a real request instead of a fake timer that
  // always "succeeds" after 4 seconds. Navigates using the id the API
  // actually returns instead of a hardcoded INV-1001.
  const submitReconciliation = async () => {
    setIsFinalizing(true);
    setError(null);
    let st = 0;
    const processingSteps = ['Extracting', 'Matching Engine', 'Validating Allowances', 'SLA / Fraud Check', 'Finalizing Decision'];
    const interval = setInterval(() => {
      st = Math.min(st + 1, processingSteps.length - 1);
      setProcessStage(st);
    }, 700);

    const documentIds = [invoiceDocId, ...Object.entries(matchParams)
      .filter(([docId, included]) => included)
      .map(([docId]) => docStates[docId].documentId)]
      .filter(Boolean);

    try {
      const record = await createReconciliation({
        document_ids: documentIds,
        tax_rate: taxRate,
        actual_sla: actualSla === '' ? null : Number(actualSla),
      });
      setProcessStage(processingSteps.length);
      clearInterval(interval);
      setTimeout(() => { navigate(`/invoice-reconciliation/${record.id}`); }, 800);
    } catch (err) {
      clearInterval(interval);
      setIsFinalizing(false);
      setProcessStage(0);
      setError(err instanceof ApiError ? err.message : 'Could not run the reconciliation. Please try again.');
    }
  };

  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2.5rem', width: '100%', maxWidth: '800px', margin: '0 auto 2.5rem auto', flexWrap: 'wrap', gap: '8px 0' }}>
      {dynamicSteps.map((step, i) => {
        const active = stepIndex === i;
        const completed = stepIndex > i;
        return (
          <React.Fragment key={step.id}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 2 }}>
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: completed ? '#10b981' : active ? 'var(--primary-blue)' : 'var(--gray-100)',
                  color: completed || active ? 'white' : 'var(--gray-400)',
                  scale: active ? 1.15 : 1
                }}
                style={{
                  width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '12px', boxShadow: active ? '0 4px 12px rgba(59,130,246,0.3)' : 'none'
                }}
              >
                {completed ? <CheckCircleIcon /> : (i + 1)}
              </motion.div>
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: active ? 'var(--gray-800)' : 'var(--gray-400)', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
            </div>
            {i < dynamicSteps.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: '0 4px 16px 4px', borderRadius: 2, background: completed ? '#10b981' : 'var(--gray-200)', transition: 'all 0.3s', minWidth: '15px' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderDocStep = (docId, title, desc, targetRefText) => {
    const doc = docStates[docId];
    return (
      <motion.div key={docId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="ir-card" style={{ padding: '3rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '8px' }}>{title}</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: '15px' }}>{desc}</p>
          {targetRefText && <p style={{ color: 'var(--gray-500)', fontSize: '14px', marginTop: '8px' }}>Targeting: <strong style={{ color: 'var(--primary-blue)', background: 'var(--primary-50)', padding: '4px 8px', borderRadius: '6px' }}>{targetRefText}</strong></p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '2.5rem' }}>
          {FETCH_SOURCES.map(s => (
            <button key={s.id} onClick={() => updateDoc(docId, { source: s.id })} style={{ padding: '12px 8px', background: doc.source === s.id ? 'var(--primary-50)' : 'var(--primary-white)', border: `2px solid ${doc.source === s.id ? 'var(--primary-blue)' : 'var(--gray-200)'}`, borderRadius: '12px', color: doc.source === s.id ? 'var(--primary-blue-dark)' : 'var(--gray-500)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <div style={{ color: doc.source === s.id ? 'var(--primary-blue)' : 'var(--gray-400)' }}>{s.icon}</div>
              {s.label}
            </button>
          ))}
        </div>

        {doc.source === 'manual' ? (
          doc.file ? (
              <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
                <div style={{ color: doc.confirming ? 'var(--gray-400)' : '#10b981' }}>{doc.confirming ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: 20, height: 20, border: '3px solid var(--gray-200)', borderTopColor: 'var(--primary-blue)', borderRadius: '50%' }} /> : <CheckCircleIcon />}</div>
                <div style={{ flex: 1, fontWeight: 700, color: 'var(--gray-800)', fontSize: '15px' }}>{doc.file.name}{doc.confirming ? ' — processing…' : ''}</div>
                <button onClick={() => updateDoc(docId, { file: null, documentId: null })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}>Remove File</button>
              </div>
          ) : (
            <div onClick={() => fileRefs[docId].current.click()} style={{ border: '2px dashed var(--gray-300)', borderRadius: '16px', padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer', background: 'var(--gray-50)', marginBottom: '3rem' }}>
              <input type="file" ref={fileRefs[docId]} style={{ display: 'none' }} accept=".pdf" onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!f.name.toLowerCase().endsWith('.pdf')) return setError('Only PDF files are supported.');
                setError(null);
                handleDocFileSelected(docId, f);
              }} />
              <div style={{ color: 'var(--gray-400)', marginBottom: '12px' }}><UploadIcon /></div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-700)' }}>Drop PDF here to manually upload</div>
            </div>
          )
        ) : (
          <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '4rem 2rem', textAlign: 'center', marginBottom: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {!doc.fetched ? (
              doc.fetching ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: 40, height: 40, border: '4px solid var(--gray-200)', borderTopColor: 'var(--primary-blue)', borderRadius: '50%', marginBottom: '1rem' }} />
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-800)' }}>Connecting to ERP API...</div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => handleFetchSource(docId)} style={{ background: 'var(--primary-white)', border: '2px solid var(--gray-300)', padding: '14px 28px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', color: 'var(--gray-800)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ErpIcon /> Scan ERP Now
                    </div>
                  </button>
                  <div style={{ fontSize: '12px', color: 'var(--gray-400)', fontStyle: 'italic' }}>Last synced: 2 min ago</div>
                </div>
              )
            ) : (
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} style={{ color: 'var(--tint-success-text)', fontWeight: 700, fontSize: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ color: '#10b981', background: 'var(--tint-success-bg)', padding: '16px', borderRadius: '50%' }}><CheckCircleIcon /></div>
                Success! Found matching document in ERP
                <div style={{ fontSize: '14px', color: 'var(--gray-600)', fontWeight: 600 }}>Attached: Match_Found.pdf</div>
              </motion.div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <button onClick={() => setStepIndex(stepIndex - 1)} style={{ width: '140px', background: 'var(--primary-white)', color: 'var(--gray-700)', padding: '16px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', border: '2px solid var(--gray-200)', cursor: 'pointer' }}>← Back</button>
          <button onClick={() => setStepIndex(stepIndex + 1)} disabled={(doc.source === 'manual' && (!doc.file || doc.confirming)) || (doc.source !== 'manual' && !doc.fetched)} style={{ flex: 1, background: ((doc.source === 'manual' && doc.file && !doc.confirming) || (doc.source !== 'manual' && doc.fetched)) ? 'var(--primary-blue)' : 'var(--gray-300)', color: 'white', padding: '16px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', border: 'none', cursor: 'pointer', transition: 'all 0.3s' }}>
            Continue to Next Step →
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <header className="topbar">
        <h1 className="topbar__title">New AI Reconciliation</h1>
      </header>

      <div className="ud-content" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <StepIndicator />

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{
            background: 'var(--tint-danger-bg)', borderLeft: '4px solid #ef4444', padding: '12px 16px', color: 'var(--tint-danger-text)',
            borderRadius: '8px', fontSize: '14px', fontWeight: 600, marginBottom: '1.5rem', width: '100%', maxWidth: '800px'
          }}>
            ⚠ {error}
          </motion.div>
        )}

        <div style={{ width: '100%', maxWidth: '900px', position: 'relative' }}>
          <AnimatePresence mode="wait">

            {/* INVOICE */}
            {currentStep.id === 'invoice' && (
              <motion.div key="invoice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="ir-card" style={{ padding: '3rem 2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '8px' }}>Upload Supplier Invoice</h2>
                  <p style={{ color: 'var(--gray-500)', fontSize: '15px' }}>Our AI will extract the PO number, Vendor, and line items automatically.</p>
                </div>

                {!invoiceFile ? (
                  <div
                    onClick={() => invoiceRef.current.click()}
                    style={{ border: '2px dashed var(--gray-300)', borderRadius: '16px', padding: '4rem 2rem', textAlign: 'center', cursor: 'pointer', background: 'linear-gradient(180deg, var(--gray-50) 0%, var(--gray-100) 100%)', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
                  >
                    <input type="file" ref={invoiceRef} style={{ display: 'none' }} accept=".pdf" onChange={handleInvoiceUpload} />
                    <div style={{ color: 'var(--primary-blue)', background: 'var(--primary-50)', padding: '16px', borderRadius: '50%' }}><UploadIcon /></div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-800)' }}>Click or drag invoice PDF here</div>
                      <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '4px' }}>Supports .pdf up to 15 MB</div>
                    </div>
                  </div>
                ) : isExtracting ? (
                  <div style={{ padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', background: 'var(--gray-50)', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: 48, height: 48, border: '4px solid var(--gray-200)', borderTopColor: 'var(--primary-blue)', borderRadius: '50%' }} />
                    <div style={{ color: 'var(--gray-800)', fontWeight: 700, fontSize: '16px' }}>Cortex AI is analyzing your invoice...</div>
                  </div>
                ) : (
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                    <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ color: '#10b981', marginBottom: '8px' }}><CheckCircleIcon /></div>
                      <div style={{ fontWeight: 700, color: 'var(--gray-800)', fontSize: '15px' }}>{invoiceFile.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Successfully Processed</div>
                    </div>

                    <div style={{ background: 'var(--primary-white)', border: '1px solid var(--gray-200)', borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ background: 'var(--gray-50)', padding: '12px 16px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--primary-blue-dark)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                          AI EXTRACTED
                        </div>
                      </div>
                      {/* TODO(04 §A.3 `fields` shape): renders whatever came back from
                          POST /documents' `fields` — vendor_name, doc_number, doc_date,
                          po_ref, subtotal, tax_amount, total. `currency` is excluded:
                          §B.1.2 says it's not editable. */}
                      <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {Object.entries(extractedData || {}).filter(([key]) => key !== 'currency').map(([key, val]) => (
                          <div key={key}>
                            <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>{key.replace(/_/g, ' ')}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="text" value={val ?? ''} onChange={(e) => setExtractedData({...extractedData, [key]: e.target.value})} style={{ width: '100%', padding: '6px 8px', border: '1px solid transparent', borderRadius: '4px', fontSize: '14px', fontWeight: 600, color: 'var(--gray-900)', background: 'var(--gray-50)', outline: 'none' }} />
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button onClick={confirmInvoiceAndContinue} disabled={confirmingInvoice} style={{ gridColumn: '1 / -1', marginTop: '1rem', width: '100%', background: confirmingInvoice ? 'var(--gray-400)' : '#10b981', color: 'white', padding: '16px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', border: 'none', cursor: confirmingInvoice ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}>
                      {confirmingInvoice ? 'Confirming…' : 'Proceed to Select Matching Strategy →'}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* STRATEGY SELECTION */}
            {currentStep.id === 'params' && (
              <motion.div key="params" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="ir-card" style={{ padding: '3rem 2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '8px' }}>Select Basis of Reconciliation</h2>
                  <p style={{ color: 'var(--gray-500)', fontSize: '15px' }}>Check the parameters you want to include in this reconciliation workflow.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px', background: matchParams.po ? 'var(--primary-50)' : 'var(--gray-50)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={matchParams.po} onChange={e => setMatchParams({...matchParams, po: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-800)' }}>Purchase Order (PO)</div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px', background: matchParams.grn ? 'var(--primary-50)' : 'var(--gray-50)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={matchParams.grn} onChange={e => setMatchParams({...matchParams, grn: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-800)' }}>Goods Receipt Note (GRN)</div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px', background: matchParams.quality ? 'var(--primary-50)' : 'var(--gray-50)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={matchParams.quality} onChange={e => setMatchParams({...matchParams, quality: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-800)' }}>Quality Inspection Certificate</div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px', background: matchParams.timesheet ? 'var(--primary-50)' : 'var(--gray-50)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={matchParams.timesheet} onChange={e => setMatchParams({...matchParams, timesheet: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-800)' }}>Service Entry Sheet / Timesheet</div>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px', background: matchParams.contracts ? 'var(--primary-50)' : 'var(--gray-50)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={matchParams.contracts} onChange={e => setMatchParams({...matchParams, contracts: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-800)' }}>SLA / Master Contract</div>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <button onClick={() => setStepIndex(stepIndex - 1)} style={{ width: '140px', background: 'var(--primary-white)', color: 'var(--gray-700)', padding: '16px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', border: '2px solid var(--gray-200)', cursor: 'pointer' }}>← Back</button>
                  <button onClick={() => setStepIndex(stepIndex + 1)} style={{ flex: 1, background: 'var(--primary-blue)', color: 'white', padding: '16px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', border: 'none', cursor: 'pointer', transition: 'all 0.3s' }}>
                    Continue to Document Uploads →
                  </button>
                </div>
              </motion.div>
            )}

            {/* DYNAMIC DOCUMENT UPLOADS */}
            {currentStep.id === 'po' && renderDocStep('po', 'Attach Purchase Order', 'Match invoice details to original purchase order.', extractedData?.po_ref)}
            {currentStep.id === 'grn' && renderDocStep('grn', 'Attach Goods Receipt Note', 'Match quantities billed to quantities delivered.', null)}
            {currentStep.id === 'quality' && renderDocStep('quality', 'Attach Quality Inspection', 'Match accepted quality against billed items.', null)}
            {currentStep.id === 'timesheet' && renderDocStep('timesheet', 'Attach Service Entry Sheet / Timesheet', 'Match billed hours or service milestones.', null)}
            {currentStep.id === 'contracts' && renderDocStep('contracts', 'Attach SLA / Master Contract', 'Ensure compliance with contracted SLA rates.', null)}

            {/* REVIEW & CONFIRM */}
            {currentStep.id === 'review' && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="ir-card" style={{ padding: '3rem 2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--gray-900)', marginBottom: '8px' }}>Review & Confirm</h2>
                  <p style={{ color: 'var(--gray-500)', fontSize: '15px' }}>Verify the package details before running the AI reconciliation pipeline.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '1.5rem' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--gray-800)', marginBottom: '1rem' }}>Extracted Metadata</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div><span style={{ color: 'var(--gray-500)' }}>Vendor:</span> <span style={{ fontWeight: 600 }}>{extractedData?.vendor_name}</span></div>
                        <div><span style={{ color: 'var(--gray-500)' }}>Invoice ID:</span> <span style={{ fontWeight: 600 }}>{extractedData?.doc_number}</span></div>
                        <div><span style={{ color: 'var(--gray-500)' }}>Target PO:</span> <span style={{ fontWeight: 600 }}>{extractedData?.po_ref}</span></div>
                        <div><span style={{ color: 'var(--gray-500)' }}>Amount:</span> <span style={{ fontWeight: 600 }}>${extractedData?.total}</span></div>
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '1.5rem' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--gray-800)', marginBottom: '1rem' }}>Document Package</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice</span> <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Attached</span></div>
                        {matchParams.po && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Purchase Order</span> <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {docStates.po.source.toUpperCase()}</span></div>}
                        {matchParams.grn && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Goods Receipt</span> <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {docStates.grn.source.toUpperCase()}</span></div>}
                        {matchParams.quality && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Quality Inspection</span> <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {docStates.quality.source.toUpperCase()}</span></div>}
                        {matchParams.timesheet && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Timesheet/SES</span> <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {docStates.timesheet.source.toUpperCase()}</span></div>}
                        {matchParams.contracts && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SLA/Contract</span> <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {docStates.contracts.source.toUpperCase()}</span></div>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '1.5rem', background: 'var(--gray-50)' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--gray-800)', marginBottom: '1rem' }}>Global Parameters</div>
                      {/* TODO(04 §B.1.3): tax_rate / actual_sla travel as-is in the
                          POST /reconciliations body — both flagged "v1 shortcuts" in
                          the contract itself, not derived from anything yet. */}
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '4px' }}>Tax Rate (%)</label>
                        <input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '4px' }}>Actual SLA Performance (%)</label>
                        <input type="number" placeholder="e.g. 98.5" value={actualSla} onChange={e => setActualSla(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '14px', outline: 'none' }} />
                      </div>
                    </div>

                    {isFinalizing && (
                      <div style={{ background: 'var(--primary-white)', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '1.5rem' }}>
                        {['Extracting', 'Matching Engine', 'Validating Allowances', 'SLA / Fraud Check', 'Finalizing Decision'].map((st, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', opacity: processStage >= idx ? 1 : 0.4 }}>
                            {processStage > idx ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg> : (processStage === idx ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: 14, height: 14, border: '2px solid var(--gray-200)', borderTopColor: 'var(--primary-blue)', borderRadius: '50%' }} /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--gray-300)' }} />)}
                            <span style={{ fontSize: '13px', fontWeight: 600, color: processStage > idx ? '#10b981' : (processStage === idx ? 'var(--primary-blue)' : 'var(--gray-500)') }}>{st}...</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <button onClick={() => setStepIndex(stepIndex - 1)} disabled={isFinalizing} style={{ width: '140px', background: 'var(--primary-white)', color: 'var(--gray-700)', padding: '16px', borderRadius: '12px', fontWeight: 700, fontSize: '16px', border: '2px solid var(--gray-200)', cursor: 'pointer', opacity: isFinalizing ? 0.5 : 1 }}>← Back</button>
                  <button
                    onClick={submitReconciliation}
                    disabled={isFinalizing}
                    style={{ flex: 1, background: isFinalizing ? 'var(--gray-400)' : 'var(--primary-blue)', color: 'white', padding: '16px', borderRadius: '12px', fontWeight: 800, fontSize: '16px', border: 'none', cursor: isFinalizing ? 'not-allowed' : 'pointer', transition: 'all 0.3s' }}
                  >
                    {isFinalizing ? 'Processing Pipeline...' : 'Run AI Reconciliation'}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
