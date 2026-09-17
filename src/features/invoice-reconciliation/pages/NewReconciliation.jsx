import React, { useReducer, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  uploadDocument,
  confirmDocument,
  checkDocumentHash,
  digitizeDocument,
  checkDuplicateInvoice,
  createReconciliation,
  reconcileDocuments,
  ApiError,
} from '../api';
import DocumentUploadStep from '../components/new-reconciliation/DocumentUploadStep';

/* ── Icons ───────────────────────────────────────── */
const UploadIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'></path>
    <polyline points='17 8 12 3 7 8'></polyline>
    <line x1='12' y1='3' x2='12' y2='15'></line>
  </svg>
);
const FileTextIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path>
    <polyline points='14 2 14 8 20 8'></polyline>
    <line x1='16' y1='13' x2='8' y2='13'></line>
    <line x1='16' y1='17' x2='8' y2='17'></line>
    <polyline points='10 9 9 9 8 9'></polyline>
  </svg>
);
const CheckCircleIcon = () => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'></path>
    <polyline points='22 4 12 14.01 9 11.01'></polyline>
  </svg>
);
const PackageIcon = () => (
  <svg
    width='20'
    height='20'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z'></path>
    <polyline points='3.29 7 12 12 20.71 7'></polyline>
    <line x1='12' y1='22' x2='12' y2='12'></line>
  </svg>
);
const ShieldCheckIcon = () => (
  <svg
    width='20'
    height='20'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'></path>
    <polyline points='9 12 11 14 15 10'></polyline>
  </svg>
);
const ClockIcon = () => (
  <svg
    width='20'
    height='20'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <circle cx='12' cy='12' r='10'></circle>
    <polyline points='12 6 12 12 16 14'></polyline>
  </svg>
);
const FileSignatureIcon = () => (
  <svg
    width='20'
    height='20'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6'></path>
    <polyline points='14 2 14 8 20 8'></polyline>
    <path d='M16 18.5c.5-.5 1.5-.5 2 0s1.5.5 2 0'></path>
    <path d='M13 18.5 17 14.5'></path>
  </svg>
);

const DOC_ID_TO_TYPE = {
  po: 'po',
  grn: 'grn',
  quality: 'quality',
  service_entry: 'service_entry',
  contracts: 'contract',
};

const DOC_ID_TO_DIGITIZE_TYPE = {
  po: 'po',
  grn: 'grn',
  service_entry: 'timesheet',
  contracts: 'sla',
};

const DOC_TYPES = [
  {
    id: 'po',
    label: 'Purchase Order',
    checklistLabel: 'Purchase Order (PO)',
    icon: <FileTextIcon />,
    title: 'Attach Purchase Order',
    desc: 'Match invoice details to original purchase order.',
    targetRef: (data) => data?.po_ref,
    formats: ['PDF', 'CSV', 'XLSX'],
  },
  {
    id: 'grn',
    label: 'Goods Receipt',
    checklistLabel: 'Goods Receipt Note (GRN)',
    icon: <PackageIcon />,
    title: 'Attach Goods Receipt Note',
    desc: 'Match quantities billed to quantities delivered.',
    targetRef: () => null,
    formats: ['PDF', 'CSV', 'XLSX'],
  },
  {
    id: 'quality',
    label: 'Acceptance Cert.',
    checklistLabel: 'Acceptance Certificate',
    icon: <ShieldCheckIcon />,
    title: 'Attach Acceptance Certificate',
    desc: 'Match accepted quality against billed items.',
    targetRef: () => null,
    formats: ['PDF'],
  },
  {
    id: 'service_entry',
    label: 'Service Entry',
    checklistLabel: 'Service Entry Sheet / Timesheet',
    icon: <ClockIcon />,
    title: 'Attach Service Entry Sheet / Timesheet',
    desc: 'Match billed hours or service milestones.',
    targetRef: () => null,
    formats: ['PDF', 'XLSX'],
  },
  {
    id: 'contracts',
    label: 'Contracts',
    checklistLabel: 'SLA / Master Contract',
    icon: <FileSignatureIcon />,
    title: 'Attach SLA / Master Contract',
    desc: 'Ensure compliance with contracted SLA rates.',
    targetRef: () => null,
    formats: ['PDF'],
  },
];

const formatFileTypes = (formats) => {
  if (!formats || formats.length <= 1) return (formats && formats[0]) || 'PDF';
  return `${formats.slice(0, -1).join(', ')} or ${formats[formats.length - 1]}`;
};

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const SKELETON_LINE_WIDTHS = [88, 72, 95, 50, 82, 65];

function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function altDateGuess(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const [, y, mo, d] = m;
  if (Number(d) <= 12)
    return {
      alt: `${y}-${d}-${mo}`,
      reason: 'Ambiguous format — could be read day-first or month-first.',
    };
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  dt.setDate(dt.getDate() + 8);
  const altIso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return {
    alt: altIso,
    reason: 'Two dates found in header — issue vs. revision date.',
  };
}

const OCR_CONFUSABLES = { i: 'o', o: 'i', m: 'rn', e: 'c', a: 'o', l: '1' };
function altBuyerGuess(name) {
  if (!name) return null;
  const chars = name.split('');
  const last = chars.length - 1;
  const lastLower = chars[last]?.toLowerCase();
  const swap = OCR_CONFUSABLES[lastLower];
  if (!swap) return null;
  chars[last] = chars[last] === lastLower ? swap : swap.toUpperCase();
  return chars.join('');
}
function buildFieldReview(fields, seedKey) {
  return null; // Disabled — this was generating fake confidence/flagged/alt data, not real backend signal.
  const rand = mulberry32(seedFromString(String(seedKey)));
  const review = {};
  for (const key of [
    'doc_number',
    'doc_date',
    'vendor_name',
    'buyer_name',
    'currency',
    'po_ref',
    'payment_terms',
    'due_date',
    'grn_ref',
    'subtotal',
    'tax_amount',
    'total',
  ]) {
    if (fields[key] === null || fields[key] === undefined || fields[key] === '')
      continue;
    review[key] = { confidence: 90 + Math.floor(rand() * 9) };
  }
  const dateGuess = altDateGuess(fields.doc_date);
  if (review.doc_date && dateGuess) {
    review.doc_date = {
      confidence: 52 + Math.floor(rand() * 14),
      flagged: true,
      reason: dateGuess.reason,
      alt: dateGuess.alt,
    };
  }

  const secondCandidates = ['buyer_name', 'vendor_name', 'doc_number'].filter(
    (k) => review[k],
  );
  if (secondCandidates.length) {
    const pick = secondCandidates[Math.floor(rand() * secondCandidates.length)];
    if (pick === 'buyer_name') {
      const altBuyer = altBuyerGuess(fields.buyer_name);
      if (altBuyer) {
        review.buyer_name = {
          confidence: 40 + Math.floor(rand() * 15),
          flagged: true,
          reason: 'Handwritten signature block — verify against vendor record.',
          alt: altBuyer,
        };
      }
    } else if (pick === 'vendor_name') {
      const trimmed = fields.vendor_name
        .replace(/\s+(Ltd\.?|Inc\.?|Co\.?)$/i, '')
        .trim();
      if (trimmed && trimmed !== fields.vendor_name) {
        review.vendor_name = {
          confidence: 40 + Math.floor(rand() * 15),
          flagged: true,
          reason: 'Name partially obscured — verify against vendor record.',
          alt: trimmed,
        };
      }
    } else {
      const m = /^(.*-)(\d+)$/.exec(fields.doc_number || '');
      if (m) {
        review.doc_number = {
          confidence: 40 + Math.floor(rand() * 15),
          flagged: true,
          reason: 'Reference partially obscured by a stamp.',
          alt: `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, '0')}`,
        };
      }
    }
  }
  return review;
}

function formatPartyAddress(party) {
  if (!party) return null;
  const a = party.address || {};
  const line = [a.street, a.city, a.state, a.postal_code, a.country]
    .filter(Boolean)
    .join(', ');
  return [party.name, line].filter(Boolean).join(' — ');
}

function mapInvoiceDigitization(res) {
  const ri = res.reconciliation_input || {};
  const h = ri.header || {};
  const pt = ri.payment_terms || {};
  return {
    doc_number: h.invoice_number ?? null,
    doc_date: h.invoice_date ?? null,
    vendor_name: ri.supplier?.name ?? null,
    buyer_name: ri.buyer?.name ?? null,
    currency: h.currency ?? null,
    subtotal: h.subtotal ?? null,
    tax_amount: h.tax_amount ?? null,
    total: h.grand_total ?? null,
    po_ref: h.po_number ?? null,
    payment_terms:
      pt.payment_description ??
      (pt.payment_days ? `Net ${pt.payment_days}` : null),
    due_date: pt.due_date ?? null,
    bill_from: formatPartyAddress(ri.supplier),
    bill_to: formatPartyAddress(ri.bill_to || ri.buyer),
  };
}

function mapInvoiceLineItems(res) {
  const lineItems = res.invoice_data?.line_items ?? res.line_items;
  return Array.isArray(lineItems) ? lineItems : [];
}

function describeDuplicateResult(dupResult) {
  const match =
    dupResult.selected_reprocessable_match || dupResult.qualifying_matches?.[0];
  switch (dupResult.duplicate_validation_status) {
    case 'duplicate_rejected':
      return {
        label: 'Already processed',
        detail: match
          ? `Matches invoice ${match.raw_fields?.raw_invoice_number || match.historical_record_id} processed ${match.processed_at ? formatDateTime(match.processed_at) : 'earlier'}.`
          : 'This invoice matches one already processed.',
      };
    case 'previous_error_persists':
      return {
        label: 'Previously rejected — same issue',
        detail:
          match?.previous_rejection_summary ||
          'This invoice was uploaded before and rejected; the same problem still applies.',
      };
    case 'duplicate_upload_in_progress':
      return {
        label: 'Upload already in progress',
        detail: 'This invoice is currently being processed elsewhere.',
      };
    case 'duplicate_validation_error':
      return {
        label: 'Duplicate check failed',
        detail:
          dupResult.decision_reason ||
          'Could not verify whether this is a duplicate.',
      };
    default:
      return { label: 'Blocked', detail: dupResult.decision_reason || '' };
  }
}

function mapPoDigitization(res) {
  const po = res.po_data || {};
  return {
    doc_number: po.po_number ?? null,
    doc_date: po.po_date ?? null,
    vendor_name: po.vendor_name ?? null,
    buyer_name: po.buyer_name ?? null,
    currency: po.currency ?? null,
    subtotal: po.subtotal ?? null,
    tax_amount: po.tax_amount ?? null,
    total: po.total_value ?? null,
  };
}

function mapGrnDigitization(res) {
  const g = res.receipt_doc || {};
  return {
    doc_number: g.grn_number ?? g.document_number ?? null,
    doc_date: g.grn_date ?? g.document_date ?? null,
    vendor_name: g.supplier_name ?? g.vendor_name ?? null,
    buyer_name: g.buyer_name ?? null,
    currency: g.currency ?? null,
    subtotal: g.subtotal_amount ?? null,
    tax_amount: g.tax_amount ?? null,
    total: g.total_inclusive_tax ?? g.total_amount ?? null,
  };
}

function mapSlaDigitization(res) {
  const s = res.sla_data || {};
  return {
    doc_number: null,
    doc_date: s.effective_date ?? null,
    vendor_name: s.vendor_name ?? null,
    buyer_name: s.buyer_name ?? null,
    currency: null,
    subtotal: null,
    tax_amount: null,
    total: null,
  };
}

function mapTimesheetDigitization(res) {
  const t = res.receipt_doc || {};
  return {
    doc_number: t.timesheet_number ?? null,
    doc_date: null,
    vendor_name: t.vendor_name ?? null,
    buyer_name: t.client_name ?? null,
    currency: null,
    subtotal: null,
    tax_amount: null,
    total: null,
  };
}

const DOC_ID_TO_MAPPER = {
  po: mapPoDigitization,
  grn: mapGrnDigitization,
  service_entry: mapTimesheetDigitization,
  contracts: mapSlaDigitization,
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
}

/* ── Date field (doc_date) ──────────────────────────
   A small popover calendar, swapped in for the plain text input on
   date-shaped extracted fields. Opens anchored on whatever day is
   currently selected (not always today), so fixing a low-confidence
   date extraction doesn't mean paging backward through months first. */

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// new Date('YYYY-MM-DD') parses as UTC midnight, which can roll the day
// back or forward once the browser renders it in the viewer's local time —
// wrong for a plain calendar date with no time component attached. Parsed
// and formatted by hand instead so the picker never drifts a day off.
function parseIsoDate(str) {
  const m = typeof str === 'string' && /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function isSameDay(a, b) {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DateField({ value, onChange }) {
  const containerRef = useRef(null);
  const selected = parseIsoDate(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(selected || new Date());

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const today = new Date();

  const cells = Array(startWeekday)
    .fill(null)
    .concat(
      Array.from(
        { length: daysInMonth },
        (_, i) => new Date(year, month, i + 1),
      ),
    );

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        onClick={() => {
          setViewDate(selected || new Date());
          setOpen((o) => !o);
        }}
        style={{
          width: '100%',
          padding: '6px 8px',
          border: '1px solid transparent',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--gray-900)',
          background: 'var(--gray-50)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
        }}
      >
        <span>{value || 'Select date'}</span>
        <svg
          width='14'
          height='14'
          viewBox='0 0 24 24'
          fill='none'
          stroke='var(--primary-blue)'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <rect x='3' y='4' width='18' height='18' rx='3'></rect>
          <line x1='16' y1='2' x2='16' y2='6'></line>
          <line x1='8' y1='2' x2='8' y2='6'></line>
          <line x1='3' y1='10' x2='21' y2='10'></line>
        </svg>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 30,
            width: '250px',
            background: 'var(--primary-white)',
            border: '1px solid var(--gray-200)',
            borderRadius: '14px',
            boxShadow: 'var(--shadow-md)',
            padding: '14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <button
              type='button'
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                background: 'var(--gray-100)',
                color: 'var(--gray-600)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
              }}
            >
              ‹
            </button>
            <div
              style={{
                fontWeight: 800,
                fontSize: '12.5px',
                color: 'var(--gray-800)',
              }}
            >
              {MONTH_LABELS[month]} {year}
            </div>
            <button
              type='button'
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                background: 'var(--gray-100)',
                color: 'var(--gray-600)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
              }}
            >
              ›
            </button>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}
          >
            {WEEKDAY_LABELS.map((w, i) => (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--gray-400)',
                  padding: '2px 0 6px',
                }}
              >
                {w}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '2px',
            }}
          >
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const isSelected = isSameDay(cell, selected);
              const isToday = isSameDay(cell, today);
              return (
                <button
                  type='button'
                  key={i}
                  onClick={() => {
                    onChange(toIsoDate(cell));
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: '50%',
                    border:
                      isToday && !isSelected
                        ? '1.5px solid var(--primary-blue)'
                        : 'none',
                    background: isSelected
                      ? 'var(--primary-blue)'
                      : 'transparent',
                    color: isSelected ? '#fff' : 'var(--gray-700)',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = 'var(--primary-50)';
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ── Ingestion channels ──────────────────────────────
   01-SCOPE's "Documents Supported" list (PDF, email attachments, scanned
   invoices, images, EDI) described five ways an invoice reaches us but
   Step 1 only ever offered a file picker — the rest lived in a caption.
   These make the other four real, selectable options.

   The setup dialogs are UI only — no OAuth round-trip, no AS2 handshake,
   no key issuing. The FIELDS though are the real ones each integration
   actually needs, taken from the vendor docs rather than invented, so
   this doubles as the spec for whoever wires the backend up:

     AS2      RFC 4130 / Stedi's AS2 requirements — AS2 IDs both ways,
              partner cert, cipher + MIC algorithms, MDN mode
     X12      ISA/GS envelope identifiers (qualifier + ID, ISA15, GS08)
     Gmail    OAuth consent vs service account + domain-wide delegation
     Graph    app-only: tenant/client/secret + ApplicationAccessPolicy
     NetSuite TBA is OAuth 1.0a — consumer pair AND token pair, plus the
              account ID that the suitetalk host is derived from
     S/4HANA  communication user (basic) vs OAuth client credentials
     D365     environment URL + Entra app + DataAreaId
     Tally    local XML gateway on 9000, company must be loaded

   Anything marked hint below is the "where do I find this" line, which is
   most of what makes an integration form usable. */

const TabUploadIcon = () => (
  <svg
    width='15'
    height='15'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
    <polyline points='17 8 12 3 7 8' />
    <line x1='12' y1='3' x2='12' y2='15' />
  </svg>
);
const TabMailIcon = () => (
  <svg
    width='15'
    height='15'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <rect x='2' y='4' width='20' height='16' rx='2' />
    <polyline points='2.5 6 12 13 21.5 6' />
  </svg>
);
const TabEdiIcon = () => (
  <svg
    width='15'
    height='15'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <polyline points='16 3 21 8 16 13' />
    <path d='M21 8H8a4 4 0 0 0-4 4' />
    <polyline points='8 21 3 16 8 11' />
    <path d='M3 16h13a4 4 0 0 0 4-4' />
  </svg>
);
const TabApiIcon = () => (
  <svg
    width='15'
    height='15'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <polyline points='16 18 22 12 16 6' />
    <polyline points='8 6 2 12 8 18' />
  </svg>
);
const TabErpIcon = () => (
  <svg
    width='15'
    height='15'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <ellipse cx='12' cy='5' rx='9' ry='3' />
    <path d='M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' />
    <path d='M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' />
  </svg>
);

/* Field helpers — keep the specs below readable. */
const f = (key, label, extra = {}) => ({ kind: 'text', key, label, ...extra });
const sel = (key, label, options, extra = {}) => ({
  kind: 'select',
  key,
  label,
  options,
  ...extra,
});
const seg = (key, label, options, extra = {}) => ({
  kind: 'seg',
  key,
  label,
  options,
  ...extra,
});
const file = (key, label, extra = {}) => ({
  kind: 'file',
  key,
  label,
  ...extra,
});
const checks = (key, label, options, extra = {}) => ({
  kind: 'checks',
  key,
  label,
  options,
  ...extra,
});
const note = (text, extra = {}) => ({ kind: 'note', text, ...extra });
const pair = (a, b) => ({ kind: 'pair', fields: [a, b] });

const EDI_QUALIFIERS = [
  '01 — DUNS',
  '08 — UCC/EDI (UCC)',
  '12 — Phone number',
  '14 — DUNS plus suffix',
  'ZZ — Mutually defined',
];

/* Envelope identity is shared by both AS2 and SFTP — the transport moves
   the file, the envelope is how the file says who it's from. */
const ediEnvelopeSections = (v) => [
  {
    title: 'Document standard',
    fields: [
      seg('standard', 'Standard', ['X12', 'EDIFACT']),
      ...(v.standard === 'EDIFACT'
        ? [
            pair(
              sel('unVersion', 'Version', ['D.96A', 'D.01B', 'D.03A'], {
                hint: 'UNB/UNH message version',
              }),
              sel('unMsg', 'Message type', ['INVOIC', 'ORDERS', 'DESADV']),
            ),
            pair(
              f('unSender', 'Your UNB sender ID', {
                placeholder: '5790000012345',
                mono: true,
              }),
              f('unReceiver', 'Partner UNB receiver ID', {
                placeholder: '5790000098765',
                mono: true,
              }),
            ),
          ]
        : [
            pair(
              sel('gs08', 'Version (GS08)', ['004010', '005010', '006020'], {
                hint: 'Must match the partner spec exactly',
              }),
              sel(
                'txnSet',
                'Transaction set',
                ['810 — Invoice', '850 — Purchase order', '856 — Ship notice'],
                { hint: '810 is what we ingest' },
              ),
            ),
            pair(
              sel('isaSendQual', 'Your ISA qualifier', EDI_QUALIFIERS),
              f('isaSendId', 'Your ISA sender ID (ISA06)', {
                placeholder: '9876543210',
                mono: true,
              }),
            ),
            pair(
              sel('isaRecvQual', 'Partner ISA qualifier', EDI_QUALIFIERS),
              f('isaRecvId', 'Partner ISA receiver ID (ISA08)', {
                placeholder: '1234567890',
                mono: true,
              }),
            ),
            pair(
              seg('isa15', 'Usage (ISA15)', ['T — Test', 'P — Production']),
              f('gsId', 'Application sender ID (GS02)', {
                placeholder: 'ACMEAP',
                mono: true,
              }),
            ),
            // GS03 gets skipped surprisingly often — every implementation
            // guide we checked (D&H, Best Buy) lists it as its own
            // trading-partner-assigned code, not just an echo of GS02.
            pair(
              f('gsRecvId', "Partner's application code (GS03)", {
                placeholder: '007911209',
                mono: true,
                hint: "Partner's code, agreed with them — not the same as GS02",
              }),
              f('compSep', 'Component separator (ISA16)', {
                defaultValue: ':',
                mono: true,
                hint: 'Must differ from the other two below',
              }),
            ),
            pair(
              f('elemSep', 'Element separator', {
                defaultValue: '*',
                mono: true,
              }),
              f('segTerm', 'Segment terminator', {
                defaultValue: '~',
                mono: true,
              }),
            ),
            seg(
              'ack997',
              'Functional acknowledgment (997)',
              ['Send automatically on receipt', "Don't send"],
              { hint: 'Most partner agreements require one per interchange' },
            ),
          ]),
    ],
  },
];

const CHANNEL_SPECS = {
  email: {
    variantKey: 'provider',
    variantLabel: 'Mailbox provider',
    variants: ['Google Workspace', 'Microsoft 365', 'IMAP'],
    sections: (v) => {
      const google = [
        {
          title: 'Authentication',
          fields: [
            seg('gAuth', 'Method', ['OAuth consent', 'Service account']),
            ...(v.gAuth === 'Service account'
              ? [
                  file('gKey', 'Service account key (JSON)', {
                    hint: 'From Google Cloud → IAM → Service accounts → Keys',
                  }),
                  f('gClientId', 'Service account client ID', {
                    placeholder: '118273645019283746501',
                    mono: true,
                  }),
                  f('gDelegated', 'Mailbox to impersonate', {
                    placeholder: 'ap@yourcompany.com',
                  }),
                  note(
                    'Authorise this client ID for gmail.readonly and gmail.modify in Admin console → Security → API controls → Domain-wide delegation.',
                  ),
                ]
              : [
                  {
                    kind: 'oauth',
                    key: 'gConnect',
                    label: 'Google account',
                    provider: 'Google',
                    scopes: ['gmail.readonly', 'gmail.modify'],
                  },
                  note(
                    'The mailbox is chosen on Google’s consent screen, so there’s nothing to type here. gmail.modify is what lets us label or archive a message once it’s been ingested.',
                  ),
                ]),
          ],
        },
      ];

      const microsoft = [
        {
          title: 'Entra app registration',
          fields: [
            f('msTenant', 'Directory (tenant) ID', {
              placeholder: '72f988bf-86f1-41af-91ab-2d7cd011db47',
              mono: true,
              hint: 'Entra admin centre → Overview',
            }),
            f('msClient', 'Application (client) ID', {
              placeholder: '4a1b9c30-77e2-4d18-bd55-9f0a2c6e1d84',
              mono: true,
            }),
            seg('msCred', 'Credential', ['Client secret', 'Certificate']),
            ...(v.msCred === 'Certificate'
              ? [
                  file('msCert', 'Certificate (.pfx)', {
                    hint: 'Thumbprint must match the one uploaded to the app registration',
                  }),
                ]
              : [
                  f('msSecret', 'Client secret', {
                    placeholder: '••••••••••••••••••••••••',
                    mono: true,
                    hint: 'Certificates & secrets → Client secrets',
                  }),
                ]),
          ],
        },
        {
          title: 'Mailbox',
          fields: [
            f('msMailbox', 'Mailbox UPN', {
              placeholder: 'ap@yourcompany.com',
            }),
            f('msFolder', 'Folder', { defaultValue: 'Inbox' }),
            note(
              'Needs Mail.Read (Application) with admin consent. Scope it with a New-ApplicationAccessPolicy so the app can only read this one mailbox, not the whole tenant.',
            ),
          ],
        },
      ];

      const imap = [
        {
          title: 'Server',
          fields: [
            pair(
              f('imapHost', 'Host', { placeholder: 'imap.yourcompany.com' }),
              f('imapPort', 'Port', { defaultValue: '993' }),
            ),
            seg('imapSec', 'Security', ['SSL/TLS', 'STARTTLS', 'None']),
            pair(
              f('imapUser', 'Username', { placeholder: 'ap@yourcompany.com' }),
              f('imapPass', 'Password', {
                placeholder: '••••••••••••',
                hint: 'App password if MFA is on',
              }),
            ),
            f('imapFolder', 'Folder', { defaultValue: 'INBOX' }),
          ],
        },
      ];

      const common = [
        {
          title: 'What to ingest',
          fields: [
            f(
              'filter',
              v.provider === 'Google Workspace'
                ? 'Gmail search filter'
                : 'Subject / sender filter',
              {
                defaultValue:
                  v.provider === 'Google Workspace'
                    ? 'has:attachment -label:ingested'
                    : 'has attachment',
                mono: v.provider === 'Google Workspace',
                hint: 'Applied before anything is downloaded',
              },
            ),
            checks(
              'types',
              'Attachment types',
              ['PDF', 'Images (JPG/PNG/TIFF)', 'EDI (.edi/.x12)', 'XML / UBL'],
              { on: [0, 1, 2] },
            ),
            pair(
              sel(
                'poll',
                'Check every',
                ['1 minute', '5 minutes', '15 minutes', 'Hourly'],
                {
                  hint:
                    v.provider === 'IMAP'
                      ? 'IMAP has no push — polling only'
                      : 'Push is used where available',
                },
              ),
              f('maxSize', 'Max attachment size', { defaultValue: '15 MB' }),
            ),
            sel('after', 'After a message is ingested', [
              'Apply a label',
              'Mark as read',
              'Move to a folder',
              'Leave untouched',
            ]),
          ],
        },
      ];

      const byProvider = {
        'Google Workspace': google,
        'Microsoft 365': microsoft,
        IMAP: imap,
      };
      return [...(byProvider[v.provider] ?? google), ...common];
    },
  },

  edi: {
    variantKey: 'transport',
    variantLabel: 'Transport',
    variants: ['AS2', 'SFTP'],
    sections: (v) => {
      if (v.transport === 'SFTP') {
        return [
          {
            title: 'Connection',
            fields: [
              pair(
                f('sftpHost', 'Host', { placeholder: 'sftp.supplier.com' }),
                f('sftpPort', 'Port', { defaultValue: '22' }),
              ),
              f('sftpUser', 'Username', { placeholder: 'ap-feed' }),
              seg('sftpAuth', 'Authentication', ['SSH key', 'Password']),
              ...(v.sftpAuth === 'Password'
                ? [f('sftpPass', 'Password', { placeholder: '••••••••••••' })]
                : [
                    file('sftpKey', 'Private key', {
                      hint: 'OpenSSH or PEM, passphrase optional',
                    }),
                  ]),
              f('sftpFp', 'Expected host key fingerprint', {
                placeholder: 'SHA256:nThbg6kXUp...',
                mono: true,
                hint: 'Refuse the connection if it changes',
              }),
            ],
          },
          {
            title: 'Pickup',
            fields: [
              pair(
                f('sftpDir', 'Watch directory', {
                  defaultValue: '/outbound/810',
                  mono: true,
                }),
                f('sftpGlob', 'File pattern', {
                  defaultValue: '*.edi',
                  mono: true,
                }),
              ),
              pair(
                sel('sftpPoll', 'Poll every', [
                  '5 minutes',
                  '15 minutes',
                  'Hourly',
                  'Daily',
                ]),
                sel('sftpAfter', 'After download', [
                  'Move to archive',
                  'Delete',
                  'Leave in place',
                ]),
              ),
              f('sftpArchive', 'Archive directory', {
                defaultValue: '/outbound/810/processed',
                mono: true,
              }),
            ],
          },
          ...ediEnvelopeSections(v),
        ];
      }
      return [
        {
          title: 'Identity',
          fields: [
            pair(
              f('as2Self', 'Your AS2 ID', {
                defaultValue: 'CORTEX-AP',
                mono: true,
              }),
              f('as2Partner', 'Partner AS2 ID', {
                placeholder: 'SUPPLIER-PROD',
                mono: true,
                hint: 'Case sensitive',
              }),
            ),
            f('as2Url', 'Partner AS2 URL', {
              placeholder: 'https://edi.supplier.com/as2',
              mono: true,
            }),
            {
              kind: 'readonly',
              key: 'as2Inbound',
              label: 'Your inbound AS2 URL',
              value: 'https://as2.cortex-ap.io/inbound',
              hint: 'Give this to the partner for messages coming the other way',
            },
          ],
        },
        {
          title: 'Security',
          fields: [
            file('as2EncCert', 'Partner public encryption certificate', {
              hint: '.cer / .pem — used to encrypt what we send them',
            }),
            pair(
              sel(
                'as2Cipher',
                'Encryption algorithm',
                ['AES-256-CBC', 'AES-192-CBC', 'AES-128-CBC', '3DES'],
                { hint: 'Must match their spec' },
              ),
              sel('as2Mic', 'Signing algorithm', [
                'SHA-256',
                'SHA-384',
                'SHA-512',
                'SHA-1',
              ]),
            ),
            file('as2SignKey', 'Your signing certificate + private key', {
              hint: '2048-bit RSA or stronger',
            }),
            checks(
              'as2Opts',
              'Options',
              ['Sign outbound messages', 'Compress payload (zlib)'],
              { on: [0, 1] },
            ),
          ],
        },
        {
          title: 'Receipts (MDN)',
          fields: [
            seg('mdnMode', 'MDN delivery', [
              'Synchronous',
              'Asynchronous',
              'None',
            ]),
            ...(v.mdnMode === 'Asynchronous'
              ? [
                  f('mdnUrl', 'Async MDN return URL', {
                    defaultValue: 'https://as2.cortex-ap.io/mdn',
                    mono: true,
                  }),
                ]
              : []),
            ...(v.mdnMode === 'None'
              ? [
                  note(
                    'Without an MDN there is no proof the partner received the message — most trading agreements require signed receipts.',
                  ),
                ]
              : [
                  checks('mdnSigned', '', ['Require a signed MDN'], {
                    on: [0],
                  }),
                  file('as2MdnCert', 'Partner public signing certificate', {
                    hint: 'Used to verify their MDN signature',
                  }),
                ]),
          ],
        },
        ...ediEnvelopeSections(v),
      ];
    },
  },

  api: {
    variantKey: 'env',
    variantLabel: 'Environment',
    variants: ['Live', 'Test'],
    sections: (v) => [
      {
        title: 'Key',
        fields: [
          f('keyName', 'Label', {
            defaultValue: 'AP ingestion service',
            hint: 'Shows in the audit log against every call this key makes',
          }),
          checks(
            'scopes',
            'Scopes',
            [
              'documents:write',
              'documents:read',
              'reconciliations:read',
              'reconciliations:write',
              'exceptions:read',
            ],
            { on: [0, 1] },
          ),
          pair(
            sel('expiry', 'Expires', [
              'Never',
              'In 30 days',
              'In 90 days',
              'In 365 days',
            ]),
            f('ips', 'IP allowlist', {
              placeholder: '203.0.113.0/24',
              mono: true,
              hint: 'Optional, comma separated',
            }),
          ),
          {
            kind: 'key',
            key: 'apiKey',
            label: `Your ${String(v.env ?? 'Live').toLowerCase()} key`,
          },
        ],
      },
      {
        title: 'Usage',
        fields: [
          { kind: 'code', key: 'curl' },
          f('webhook', 'Webhook for extraction results', {
            placeholder: 'https://yourapp.com/hooks/cortex',
            mono: true,
            hint: 'Extraction is async — we POST the result here when it finishes',
          }),
          {
            kind: 'websecret',
            key: 'webhookSecret',
            label: 'Webhook signing secret',
          },
        ],
      },
    ],
  },

  erp: {
    variantKey: 'system',
    variantLabel: 'ERP system',
    variants: [
      'SAP S/4HANA',
      'SAP ECC',
      'Oracle Fusion',
      'NetSuite',
      'Dynamics 365',
      'Tally Prime',
    ],
    sections: (v) => {
      const bySystem = {
        'SAP S/4HANA': [
          {
            title: 'Connection',
            fields: [
              f('sapUrl', 'Tenant API URL', {
                placeholder: 'https://my123456-api.s4hana.cloud.sap',
                mono: true,
              }),
              seg('sapAuth', 'Authentication', [
                'OAuth 2.0',
                'Communication user',
              ]),
              ...(v.sapAuth === 'Communication user'
                ? [
                    pair(
                      f('sapUser', 'Communication user', {
                        placeholder: 'CC0001234567',
                      }),
                      f('sapPass', 'Password', { placeholder: '••••••••••••' }),
                    ),
                  ]
                : [
                    f('sapToken', 'Token URL', {
                      placeholder:
                        'https://my123456.authentication.eu10.hana.ondemand.com/oauth/token',
                      mono: true,
                    }),
                    pair(
                      f('sapClientId', 'Client ID', {
                        placeholder: 'sb-na-abc123!b1234',
                        mono: true,
                      }),
                      f('sapSecret', 'Client secret', {
                        placeholder: '••••••••••••',
                        mono: true,
                      }),
                    ),
                  ]),
              pair(
                f('sapClient', 'Client (sap-client)', {
                  defaultValue: '100',
                  hint: 'Private cloud / on-prem only',
                }),
                f('sapCoCode', 'Company code', { placeholder: '1000' }),
              ),
              note(
                'A Communication Arrangement (SAP_COM_0134 or equivalent) has to expose the supplier-invoice OData service before any of this resolves.',
              ),
            ],
          },
        ],
        'SAP ECC': [
          {
            title: 'Connection (RFC)',
            fields: [
              pair(
                f('ecHost', 'Application server host', {
                  placeholder: 'sap-prd.yourcompany.com',
                }),
                f('ecSysNr', 'System number', { defaultValue: '00' }),
              ),
              pair(
                f('ecClient', 'Client', { defaultValue: '100' }),
                f('ecCoCode', 'Company code', { placeholder: '1000' }),
              ),
              pair(
                f('ecUser', 'RFC user', { placeholder: 'RFC_CORTEX' }),
                f('ecPass', 'Password', { placeholder: '••••••••••••' }),
              ),
              f('ecRouter', 'SAP router string', {
                placeholder: '/H/router.yourcompany.com/S/3299/H/',
                mono: true,
                hint: 'Optional — only if SAP sits behind a router',
              }),
            ],
          },
        ],
        'Oracle Fusion': [
          {
            title: 'Connection',
            fields: [
              f('oraUrl', 'Pod URL', {
                placeholder: 'https://abc.fa.us2.oraclecloud.com',
                mono: true,
                hint: 'REST base is /fscmRestApi/resources/latest',
              }),
              seg('oraAuth', 'Authentication', ['OAuth 2.0', 'Basic']),
              ...(v.oraAuth === 'Basic'
                ? [
                    pair(
                      f('oraUser', 'Integration user', {
                        placeholder: 'CORTEX_INT',
                      }),
                      f('oraPass', 'Password', { placeholder: '••••••••••••' }),
                    ),
                  ]
                : [
                    pair(
                      f('oraClientId', 'Client ID', {
                        placeholder: '8f2c1a...',
                        mono: true,
                      }),
                      f('oraSecret', 'Client secret', {
                        placeholder: '••••••••••••',
                        mono: true,
                      }),
                    ),
                  ]),
              pair(
                f('oraBu', 'Business unit', {
                  placeholder: 'US1 Business Unit',
                }),
                f('oraLedger', 'Ledger', { placeholder: 'US Primary Ledger' }),
              ),
            ],
          },
        ],
        NetSuite: [
          {
            title: 'Account',
            fields: [
              f('nsAccount', 'Account ID', {
                placeholder: '1234567_SB1',
                mono: true,
                hint: 'The REST host is derived from this: 1234567-sb1.suitetalk.api.netsuite.com',
              }),
              seg('nsAuth', 'Authentication', [
                'Token-based (TBA)',
                'OAuth 2.0',
              ]),
              ...(v.nsAuth === 'OAuth 2.0'
                ? [
                    pair(
                      f('nsCk2', 'Consumer key', {
                        placeholder: '••••••••••••',
                        mono: true,
                      }),
                      f('nsCs2', 'Consumer secret', {
                        placeholder: '••••••••••••',
                        mono: true,
                      }),
                    ),
                  ]
                : [
                    pair(
                      f('nsCk', 'Consumer key', {
                        placeholder: '••••••••••••',
                        mono: true,
                        hint: 'Integration record',
                      }),
                      f('nsCs', 'Consumer secret', {
                        placeholder: '••••••••••••',
                        mono: true,
                      }),
                    ),
                    pair(
                      f('nsTid', 'Token ID', {
                        placeholder: '••••••••••••',
                        mono: true,
                        hint: 'Access token',
                      }),
                      f('nsTs', 'Token secret', {
                        placeholder: '••••••••••••',
                        mono: true,
                      }),
                    ),
                  ]),
              f('nsSub', 'Subsidiary', {
                placeholder: 'Parent Company : India',
              }),
            ],
          },
        ],
        'Dynamics 365': [
          {
            title: 'Connection',
            fields: [
              f('dynUrl', 'Environment URL', {
                placeholder: 'https://yourco.operations.dynamics.com',
                mono: true,
                hint: 'OData lives at {environment}/data',
              }),
              f('dynTenant', 'Directory (tenant) ID', {
                placeholder: '72f988bf-86f1-41af-91ab-2d7cd011db47',
                mono: true,
              }),
              pair(
                f('dynClient', 'Application (client) ID', {
                  placeholder: '4a1b9c30-77e2-...',
                  mono: true,
                }),
                f('dynSecret', 'Client secret', {
                  placeholder: '••••••••••••',
                  mono: true,
                }),
              ),
              pair(
                f('dynLe', 'Legal entity (DataAreaId)', {
                  placeholder: 'USMF',
                  mono: true,
                }),
                sel('dynCross', 'Scope', [
                  'This legal entity',
                  'All (cross-company)',
                ]),
              ),
              note(
                'The Entra app also has to be registered under System administration → Microsoft Entra applications, or every call comes back 401.',
              ),
            ],
          },
        ],
        'Tally Prime': [
          {
            title: 'Connection',
            fields: [
              pair(
                f('tlyHost', 'Host', {
                  defaultValue: 'localhost',
                  hint: 'Machine running Tally',
                }),
                f('tlyPort', 'Port', { defaultValue: '9000' }),
              ),
              f('tlyCompany', 'Company name', {
                placeholder: 'Acme Industries Pvt Ltd',
                hint: 'Exactly as it appears in Tally',
              }),
              note(
                'Tally has to be running with a company loaded, and its role set to Server or Both under Exchange → Data Synchronisation. The gateway only accepts XML over HTTP while the app is open.',
              ),
            ],
          },
        ],
      };

      return [
        ...(bySystem[v.system] ?? bySystem['SAP S/4HANA']),
        {
          title: 'Sync',
          fields: [
            checks(
              'entities',
              'Pull',
              [
                'Invoices',
                'Purchase orders',
                'Goods receipts',
                'Vendor master',
              ],
              { on: [0, 1, 2] },
            ),
            pair(
              sel('freq', 'Frequency', [
                'Every 15 minutes',
                'Hourly',
                'Daily',
                'Manual only',
              ]),
              f('since', 'Start from', {
                defaultValue: '2026-04-01',
                hint: 'Nothing older than this is pulled',
              }),
            ),
            sel('writeback', 'Write back reconciliation status', [
              'No — read only',
              'Yes — post match result to the ERP',
            ]),
          ],
        },
      ];
    },
  },
};

const INGESTION_CHANNELS = [
  { id: 'upload', label: 'Upload File', icon: <TabUploadIcon /> },
  {
    id: 'email',
    label: 'Email',
    icon: <TabMailIcon />,
    tone: 'purple',
    heading: 'Connect your inbox to pull invoices automatically',
    blurb:
      'Point an AP mailbox at us and every invoice that lands in it — PDF attachment, forwarded thread, scanned image — gets queued for extraction on arrival.',
    bullets: [
      'Google Workspace, Microsoft 365 or plain IMAP',
      'Reads PDF, image and EDI attachments',
      'Filters out replies and non-invoice mail',
    ],
    cta: 'Connect Email',
  },
  {
    id: 'edi',
    label: 'EDI',
    icon: <TabEdiIcon />,
    tone: 'amber',
    heading: 'Connect an EDI feed (AS2/SFTP)',
    blurb:
      'Suppliers already sending EDI 810 invoice documents can drop them straight onto a feed instead of emailing a PDF.',
    bullets: [
      'AS2 with signed MDN receipts, or a polled SFTP drop',
      'X12 810 and EDIFACT INVOIC',
      'Per-trading-partner envelope mapping',
    ],
    cta: 'Set Up EDI',
  },
  {
    id: 'api',
    label: 'API',
    icon: <TabApiIcon />,
    tone: 'blue',
    heading: 'Push invoices via our API',
    blurb:
      'For systems that already hold the invoice — a supplier portal, an existing AP tool — POST the document and get the extraction result back.',
    bullets: [
      'POST /documents with the file and its type',
      'Scoped keys, optional IP allowlist',
      'Webhook callback when extraction finishes',
    ],
    cta: 'Get API Key',
  },
  {
    id: 'erp',
    label: 'ERP',
    icon: <TabErpIcon />,
    tone: 'green',
    heading: 'Sync from your ERP',
    blurb:
      'Pull invoices that were already keyed into the ERP, so reconciliation covers those too rather than only what arrives as a document.',
    bullets: [
      'SAP, Oracle, NetSuite, Dynamics and Tally',
      'Scheduled pull or on-demand scan',
      'Matches against the same PO and GRN records',
    ],
    cta: 'Connect ERP',
  },
];

// Looks like a real key so the demo reads properly; generated in the
// browser and never sent anywhere.
function fakeApiKey(env) {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 24; i++) out += hex[Math.floor(Math.random() * 16)];
  return `sk_${env === 'Test' ? 'test' : 'live'}_${out}`;
}

/* Defaults pulled out of the specs so a freshly-opened dialog already has
   the first option of every segmented control selected — otherwise the
   variant-dependent branches above all fall through to their else. */
function initialValues(channelId) {
  const spec = CHANNEL_SPECS[channelId];
  const v = { [spec.variantKey]: spec.variants[0] };
  const walk = (fields) =>
    fields.forEach((fld) => {
      if (fld.kind === 'pair') return walk(fld.fields);
      if (fld.kind === 'seg' && v[fld.key] === undefined)
        v[fld.key] = fld.options[0];
      if (fld.kind === 'select' && v[fld.key] === undefined)
        v[fld.key] = fld.options[0];
      if (fld.kind === 'checks' && v[fld.key] === undefined)
        v[fld.key] = (fld.on ?? []).map((i) => fld.options[i]);
    });
  // Two passes: the first resolves the variant branches, the second picks
  // up any control that only exists inside one of them.
  spec.sections(v).forEach((s) => walk(s.fields));
  spec.sections(v).forEach((s) => walk(s.fields));
  return v;
}

function ChannelSetupModal({ channel, onClose }) {
  const spec = CHANNEL_SPECS[channel.id];
  const [values, setValues] = useState(() => initialValues(channel.id));
  const [copied, setCopied] = useState(null);
  const apiKeyRef = useRef(null);
  if (channel.id === 'api' && apiKeyRef.current === null)
    apiKeyRef.current = fakeApiKey(values.env);
  const whsecRef = useRef(null);
  if (channel.id === 'api' && whsecRef.current === null)
    whsecRef.current = 'whsec_' + fakeApiKey(values.env).slice(8);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const set = (key, value) => setValues((s) => ({ ...s, [key]: value }));
  const toggle = (key, option) =>
    setValues((s) => {
      const cur = s[key] ?? [];
      return {
        ...s,
        [key]: cur.includes(option)
          ? cur.filter((o) => o !== option)
          : [...cur, option],
      };
    });

  const apiKey =
    channel.id === 'api'
      ? `${values.env === 'Test' ? apiKeyRef.current.replace('sk_live_', 'sk_test_') : apiKeyRef.current.replace('sk_test_', 'sk_live_')}`
      : null;

  const copy = (text, tag) => {
    // Clipboard API needs a secure context; the fallback keeps the button
    // from silently doing nothing over plain http on a LAN address.
    const done = () => {
      setCopied(tag);
      setTimeout(() => setCopied(null), 1600);
    };
    if (navigator.clipboard?.writeText)
      navigator.clipboard.writeText(text).then(done).catch(done);
    else done();
  };

  const renderField = (fld, i) => {
    switch (fld.kind) {
      case 'pair':
        return (
          <div className='ir-modal__row2' key={i}>
            {fld.fields.map((sub, j) => (
              <div key={j}>{renderField(sub, j)}</div>
            ))}
          </div>
        );

      case 'text':
        return (
          <div className='ir-fieldwrap' key={fld.key}>
            <label className='ir-modal__label' htmlFor={`fld-${fld.key}`}>
              {fld.label}
            </label>
            <input
              id={`fld-${fld.key}`}
              className={`ir-inv-input${fld.mono ? ' is-mono' : ''}`}
              defaultValue={fld.defaultValue ?? ''}
              placeholder={fld.placeholder}
            />
            {fld.hint && <div className='ir-modal__hint'>{fld.hint}</div>}
          </div>
        );

      case 'select':
        return (
          <div className='ir-fieldwrap' key={fld.key}>
            <label className='ir-modal__label' htmlFor={`fld-${fld.key}`}>
              {fld.label}
            </label>
            <select
              id={`fld-${fld.key}`}
              className='ir-modal__select'
              value={values[fld.key] ?? fld.options[0]}
              onChange={(e) => set(fld.key, e.target.value)}
            >
              {fld.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {fld.hint && <div className='ir-modal__hint'>{fld.hint}</div>}
          </div>
        );

      case 'seg':
        return (
          <div className='ir-fieldwrap' key={fld.key}>
            {fld.label && <span className='ir-modal__label'>{fld.label}</span>}
            <div className='ir-modal__seg'>
              {fld.options.map((o) => (
                <button
                  type='button'
                  key={o}
                  className={`ir-modal__segbtn${values[fld.key] === o ? ' is-on' : ''}`}
                  onClick={() => set(fld.key, o)}
                >
                  {o}
                </button>
              ))}
            </div>
            {fld.hint && <div className='ir-modal__hint'>{fld.hint}</div>}
          </div>
        );

      case 'checks':
        return (
          <div className='ir-fieldwrap' key={fld.key}>
            {fld.label && <span className='ir-modal__label'>{fld.label}</span>}
            <div className='ir-modal__checks'>
              {fld.options.map((o) => {
                const on = (values[fld.key] ?? []).includes(o);
                return (
                  <button
                    type='button'
                    key={o}
                    className={`ir-modal__check${on ? ' is-on' : ''}`}
                    onClick={() => toggle(fld.key, o)}
                  >
                    <span className='ir-modal__box'>
                      {on && (
                        <svg
                          width='9'
                          height='9'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth='4'
                        >
                          <polyline points='20 6 9 17 4 12' />
                        </svg>
                      )}
                    </span>
                    {o}
                  </button>
                );
              })}
            </div>
            {fld.hint && <div className='ir-modal__hint'>{fld.hint}</div>}
          </div>
        );

      case 'file':
        return (
          <div className='ir-fieldwrap' key={fld.key}>
            <span className='ir-modal__label'>{fld.label}</span>
            <div className='ir-modal__file'>
              <svg
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                <polyline points='17 8 12 3 7 8' />
                <line x1='12' y1='3' x2='12' y2='15' />
              </svg>
              Choose file
            </div>
            {fld.hint && <div className='ir-modal__hint'>{fld.hint}</div>}
          </div>
        );

      case 'oauth':
        return (
          <div className='ir-fieldwrap' key={fld.key}>
            <span className='ir-modal__label'>{fld.label}</span>
            <button type='button' className='ir-modal__oauth'>
              <span className='ir-modal__oauthmark'>G</span>
              Sign in with {fld.provider}
            </button>
            <div className='ir-modal__scopes'>
              {fld.scopes.map((sc) => (
                <code key={sc}>{sc}</code>
              ))}
            </div>
          </div>
        );

      case 'readonly':
        return (
          <div className='ir-fieldwrap' key={fld.key}>
            <span className='ir-modal__label'>{fld.label}</span>
            <div className='ir-modal__key'>
              <code>{fld.value}</code>
              <button type='button' onClick={() => copy(fld.value, fld.key)}>
                {copied === fld.key ? 'Copied' : 'Copy'}
              </button>
            </div>
            {fld.hint && <div className='ir-modal__hint'>{fld.hint}</div>}
          </div>
        );

      case 'key':
        return (
          <div className='ir-fieldwrap' key={fld.key}>
            <span className='ir-modal__label'>{fld.label}</span>
            <div className='ir-modal__key'>
              <code>{apiKey}</code>
              <button type='button' onClick={() => copy(apiKey, 'apikey')}>
                {copied === 'apikey' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className='ir-modal__hint'>
              Shown once. Store it in your secret manager — we keep only a hash.
            </div>
          </div>
        );

      case 'websecret':
        return (
          <div className='ir-fieldwrap' key={fld.key}>
            <span className='ir-modal__label'>{fld.label}</span>
            <div className='ir-modal__key'>
              <code>{whsecRef.current}</code>
              <button
                type='button'
                onClick={() => copy(whsecRef.current, 'whsec')}
              >
                {copied === 'whsec' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className='ir-modal__hint'>
              HMAC-sign every webhook payload with this. Compare it on your end
              before trusting the body — anyone can POST to a public URL
              otherwise.
            </div>
          </div>
        );

      case 'code':
        return (
          <pre
            className='ir-modal__code'
            key={fld.key}
          >{`curl -X POST https://api.cortex-ap.io/documents \\
  -H "Authorization: Bearer ${apiKey}" \\
  -F "document_type=invoice" \\
  -F "file=@invoice.pdf"`}</pre>
        );

      case 'note':
        return (
          <div className='ir-modal__note' key={i}>
            <svg
              width='13'
              height='13'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.2'
              strokeLinecap='round'
            >
              <circle cx='12' cy='12' r='10' />
              <line x1='12' y1='16' x2='12' y2='12' />
              <line x1='12' y1='8' x2='12.01' y2='8' />
            </svg>
            <span>{fld.text}</span>
          </div>
        );

      default:
        return null;
    }
  };

  const sections = spec.sections(values);

  return createPortal(
    <div
      className='ir-modal__scrim'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className='ir-modal'
        role='dialog'
        aria-modal='true'
        aria-label={channel.cta}
      >
        <div className='ir-modal__head'>
          <div className={`ir-modal__icon ir-modal__icon--${channel.tone}`}>
            {channel.icon}
          </div>
          <div className='ir-modal__headtext'>
            <div className='ir-modal__title'>{channel.cta}</div>
            <div className='ir-modal__sub'>{channel.heading}</div>
          </div>
          <button
            type='button'
            className='ir-modal__x'
            onClick={onClose}
            aria-label='Close'
          >
            ×
          </button>
        </div>

        <div className='ir-modal__body'>
          <div className='ir-fieldwrap'>
            <span className='ir-modal__label'>{spec.variantLabel}</span>
            <div className='ir-modal__seg'>
              {spec.variants.map((o) => (
                <button
                  type='button'
                  key={o}
                  className={`ir-modal__segbtn${values[spec.variantKey] === o ? ' is-on' : ''}`}
                  onClick={() =>
                    setValues({
                      ...initialValues(channel.id),
                      [spec.variantKey]: o,
                    })
                  }
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {sections.map((section) => (
            <div className='ir-modal__section' key={section.title}>
              <div className='ir-modal__sectiontitle'>{section.title}</div>
              {section.fields.map(renderField)}
            </div>
          ))}
        </div>

        <div className='ir-modal__foot'>
          <div className='ir-modal__foothint'>
            You can change any of this later in Settings → Integrations.
          </div>
          <div className='ir-modal__actions'>
            <button type='button' className='ir-modal__btn' onClick={onClose}>
              Cancel
            </button>
            <button
              type='button'
              className='ir-modal__btn is-primary'
              onClick={onClose}
            >
              {channel.id === 'api'
                ? 'Done'
                : channel.id === 'edi'
                  ? 'Save & test connection'
                  : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* What sits where the dropzone would be, for a channel that isn't 'upload'. */
function ChannelPanel({ channel, onOpen }) {
  return (
    <div className='ir-chan'>
      <div className={`ir-chan__icon ir-chan__icon--${channel.tone}`}>
        {channel.icon}
      </div>
      <div className='ir-chan__status'>
        <span className='ir-chan__dot' /> Not connected
      </div>
      <div className='ir-chan__heading'>{channel.heading}</div>
      <p className='ir-chan__blurb'>{channel.blurb}</p>
      <ul className='ir-chan__list'>
        {channel.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <button type='button' className='ir-chan__cta' onClick={onOpen}>
        {channel.cta}
      </button>
    </div>
  );
}

/* ── Invoice form scaffolding ────────────────────────
   Step 1 stopped being "a 2-column dump of whatever came back from
   /extract" and became a real invoice document: header block, line-item
   table, totals, notes. Everything below exists to feed that form.

   04 §A.3's `fields` has no payment_terms / due_date / grn_ref. The mock
   extractor sends all three for invoices now, but an older backend won't
   have those keys at all — hydrateInvoiceFields fills them in so the
   form still renders complete against one. A key that IS present but
   null means the extractor looked and didn't find it: that stays blank.
   We never guess a payment term. */

const PAYMENT_TERMS_OPTIONS = [
  'Due on Receipt',
  'Net 7',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
];
const TERM_DAYS = {
  'Due on Receipt': 0,
  'Net 7': 7,
  'Net 15': 15,
  'Net 30': 30,
  'Net 45': 45,
  'Net 60': 60,
};

// The seven fields 01-SCOPE's "Data Extracted" list promises, plus the
// GRN reference 3/4-way matching needs (Zoho has no equivalent — invoice
// amount and tax live in the totals block below, not here).
const INVOICE_HEADER_FIELDS = [
  {
    key: 'vendor_name',
    label: 'Vendor / Supplier Name',
    type: 'text',
    placeholder: 'e.g. Meridian Components Ltd',
  },
  {
    key: 'doc_number',
    label: 'Invoice Number',
    type: 'text',
    placeholder: 'e.g. INV-4821',
  },
  {
    key: 'po_ref',
    label: 'PO Reference',
    type: 'text',
    placeholder: 'e.g. PO-8241',
  },
  { key: 'doc_date', label: 'Invoice Date', type: 'date' },
  {
    key: 'payment_terms',
    label: 'Payment Terms',
    type: 'terms',
    placeholder: 'e.g. Net 30',
  },
  { key: 'due_date', label: 'Due Date', type: 'date' },
  {
    key: 'grn_ref',
    label: 'GRN / Delivery Reference',
    type: 'text',
    placeholder: 'e.g. GRN-3390',
  },
  {
    key: 'bill_from',
    label: 'Bill From',
    type: 'text',
    placeholder: 'Supplier name and address',
  },
  {
    key: 'bill_to',
    label: 'Bill To',
    type: 'text',
    placeholder: 'Buyer name and address',
  },
];

function addDaysIso(iso, days) {
  const d = parseIsoDate(iso);
  if (!d || !Number.isFinite(days)) return '';
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function hydrateInvoiceFields(fields, seedKey) {
  return { ...(fields || {}) };
}

// Row keys have to survive re-renders and stay stable when a row above
// gets deleted, so they can't be array indices and can't be derived from
// the (editable) contents either.
let lineRowSeq = 0;
const nextLineRowKey = () => `ln-${++lineRowSeq}`;

function toFormRows(lineItems) {
  const src = Array.isArray(lineItems) ? lineItems : [];
  return src.map((li, i) => ({
    rowKey: nextLineRowKey(),
    id: li.id ?? null,
    line_no: li.line_no ?? i + 1,
    description: li.description ?? '',
    sku: li.sku ?? '',
    uom: li.uom ?? 'EA',
    quantity: li.quantity ?? 1,
    unit_price: li.unit_price ?? 0,
  }));
}

// Quantity and rate are held as whatever the user has typed (so "12." and
// a mid-edit empty box both survive), and coerced only at the point of
// arithmetic.
const num = (v) => {
  const n =
    typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;
const rowAmount = (r) => round2(num(r.quantity) * num(r.unit_price));

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
function money(n, currency) {
  const sym = CURRENCY_SYMBOLS[currency];
  const body = num(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return sym ? `${sym}${body}` : `${body}${currency ? ` ${currency}` : ''}`;
}

// Same three tiers the exceptions queue uses. Kept as tint tokens rather
// than raw hex so it flips with the dark theme like everything else.
function confidenceTier(pct) {
  if (pct == null) return null;
  if (pct >= 85) return 'high';
  if (pct >= 60) return 'med';
  return 'low';
}

function ConfidenceChip({ value, flagged }) {
  if (value == null) return null;
  const tier = flagged ? 'low' : confidenceTier(value);
  return (
    <span
      className={`ir-inv-conf ir-inv-conf--${tier}`}
      title={`Extraction confidence: ${value}%`}
    >
      <span className='ir-inv-conf__dot' />
      {value}%
    </span>
  );
}

/* One header field: label + confidence chip + the right kind of input.
   Flagged fields keep the alternate-reading / one-click Confirm affordance
   the PO & GRN steps already use, so the two screens behave the same. */
function InvoiceField({ field, onChange, onAcceptAlt }) {
  const {
    key,
    label,
    type,
    placeholder,
    value,
    confidence,
    flagged,
    reason,
    alt,
  } = field;
  return (
    <div className={`ir-inv-field${flagged ? ' is-flagged' : ''}`}>
      <div className='ir-inv-field__top'>
        <span className='ir-inv-field__label'>
          {flagged && <span aria-hidden='true'>⚠ </span>}
          {label}
        </span>
        <ConfidenceChip value={confidence} flagged={flagged} />
      </div>

      {type === 'date' ? (
        <DateField
          value={value ?? ''}
          onChange={(next) => onChange(key, next)}
        />
      ) : type === 'terms' ? (
        <input
          className='ir-inv-input'
          list='ir-payment-terms'
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(key, e.target.value)}
        />
      ) : (
        <input
          className='ir-inv-input'
          type='text'
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(key, e.target.value)}
        />
      )}

      {flagged && reason && <div className='ir-inv-field__note'>{reason}</div>}
      {flagged && alt !== undefined && (
        <div className='ir-inv-field__alt'>
          <code>alt: {alt}</code>
          <button type='button' onClick={() => onAcceptAlt(key)}>
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

// Phase 1 (02 §5): pulled out of the inline `currentStep.id === 'invoice'`
// JSX block below. Prop-driven rather than hardcoded to invoice state, so
// it's reusable once other doc types grow the same extract/confirm state.
// The post-upload view is a full invoice document (header block → item
// table → totals → notes) with the source file pinned alongside it, so a
// reviewer can read the form against the original without leaving Step 1.
function DocumentStep({
  title,
  description,
  file,
  extracting,
  extractedData,
  fieldReview,
  resolvedFlags = [],
  lineItems = [],
  notes = '',
  onFileSelect,
  onFieldChange,
  onLineItemChange,
  onLineItemAdd,
  onLineItemRemove,
  onNotesChange,
  onAcceptAlt,
  onRemoveFile,
  onConfirm,
  confirming,
  fileInputRef,
  showChannels = false,
  accept = '.pdf',
  uploadHint = 'Click or drag PDF here',
  uploadSubtext = 'Supports .pdf up to 15 MB',
  extractingLabel = 'Cortex AI is analyzing your document...',
  confirmLabel = 'Confirm & Continue →',
  confirmingLabel = 'Confirming…',
}) {
  const [docOpen, setDocOpen] = useState(true);
  // Channel choice is presentation only — it changes nothing about the
  // document being created, so it stays local rather than going through
  // the reducer with the rest of Step 1's state.
  const [channel, setChannel] = useState('upload');
  const [setupChannel, setSetupChannel] = useState(null);
  const activeChannel =
    INGESTION_CHANNELS.find((c) => c.id === channel) ?? INGESTION_CHANNELS[0];
  const fields = extractedData || {};
  const currency = fields.currency || 'USD';

  const entries = INVOICE_HEADER_FIELDS.map((spec) => {
    const r = fieldReview?.[spec.key];
    const resolved = resolvedFlags.includes(spec.key);
    return {
      ...spec,
      value: fields[spec.key] ?? '',
      confidence: r?.confidence ?? null,
      flagged: !!r?.flagged && !resolved,
      reason: r?.reason,
      alt: r?.alt,
    };
  });
  const flaggedCount = entries.filter((f) => f.flagged).length;
  const scored = entries.map((f) => f.confidence).filter((c) => c != null);
  const avgConfidence = scored.length
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
    : null;

  // Sub Total is always the sum of the table, never the extracted header
  // figure — the whole point of letting someone edit a row is that the
  // total moves with it. Tax stays editable on its own; Total is derived.
  const subTotal = round2(lineItems.reduce((s, r) => s + rowAmount(r), 0));
  const taxAmount = num(fields.tax_amount);
  const total = round2(subTotal + taxAmount);
  const taxRatePct = subTotal > 0 ? (taxAmount / subTotal) * 100 : 0;

  return (
    <motion.div
      key='document-step'
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className='ir-card'
      style={{ padding: file && !extracting ? '2rem' : '3rem 2rem' }}
    >
      <div
        style={{
          textAlign: 'center',
          marginBottom: file && !extracting ? '1.75rem' : '2.5rem',
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--gray-900)',
            marginBottom: '8px',
          }}
        >
          {title}
        </h2>
        <p style={{ color: 'var(--gray-500)', fontSize: '15px' }}>
          {description}
        </p>
      </div>

      {/* Hoisted out of the !file branch below so it stays mounted once a
          file exists too — "Replace file" on the processed card needs a
          live input to re-click, not just the initial dropzone. */}
      <input
        type='file'
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept={accept}
        onChange={onFileSelect}
      />
      <datalist id='ir-payment-terms'>
        {PAYMENT_TERMS_OPTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {!file ? (
        <>
          {/* Only shown before a file exists. Once one is uploaded the
              source has been chosen and the review form owns the screen —
              leaving the tabs up there would invite a click that throws
              away work in progress. */}
          {showChannels && (
            <div
              className='ir-chantabs'
              role='tablist'
              aria-label='Invoice source'
            >
              {INGESTION_CHANNELS.map((c) => (
                <button
                  key={c.id}
                  type='button'
                  role='tab'
                  aria-selected={channel === c.id}
                  className={`ir-chantab${channel === c.id ? ' is-on' : ''}`}
                  onClick={() => setChannel(c.id)}
                >
                  <span className='ir-chantab__icon'>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {!showChannels || channel === 'upload' ? (
            <div
              onClick={() => fileInputRef.current.click()}
              style={{
                border: '2px dashed var(--gray-300)',
                borderRadius: '16px',
                padding: '4rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background:
                  'linear-gradient(180deg, var(--gray-50) 0%, var(--gray-100) 100%)',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  color: 'var(--primary-blue)',
                  background: 'var(--primary-50)',
                  padding: '16px',
                  borderRadius: '50%',
                }}
              >
                <UploadIcon />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--gray-800)',
                  }}
                >
                  {uploadHint}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--gray-500)',
                    marginTop: '4px',
                  }}
                >
                  {uploadSubtext}
                </div>
              </div>
            </div>
          ) : (
            <ChannelPanel
              channel={activeChannel}
              onOpen={() => setSetupChannel(activeChannel)}
            />
          )}

          {setupChannel && (
            <ChannelSetupModal
              channel={setupChannel}
              onClose={() => setSetupChannel(null)}
            />
          )}
        </>
      ) : extracting ? (
        <div
          style={{
            padding: '4rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            background: 'var(--gray-50)',
            borderRadius: '16px',
            border: '1px solid var(--gray-200)',
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            style={{
              width: 48,
              height: 48,
              border: '4px solid var(--gray-200)',
              borderTopColor: 'var(--primary-blue)',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              color: 'var(--gray-800)',
              fontWeight: 700,
              fontSize: '16px',
            }}
          >
            {extractingLabel}
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className={`ir-inv-review${docOpen ? '' : ' is-doc-collapsed'}`}>
            {/* ── LEFT: the file it all came from ─────────────── */}
            <aside className='ir-inv-doc'>
              <div className='ir-inv-doc__head'>
                <span className='ir-inv-doc__heading'>Source document</span>
                <button
                  type='button'
                  className='ir-inv-doc__toggle'
                  onClick={() => setDocOpen((o) => !o)}
                  title={docOpen ? 'Collapse' : 'Expand'}
                >
                  {docOpen ? '‹' : '›'}
                </button>
              </div>

              {docOpen && (
                <>
                  {/* A real page thumbnail needs a PDF renderer we don't
                      ship (no pdf.js in package.json) — this skeleton
                      signals "here's a document" without faking content. */}
                  <div className='ir-inv-doc__thumb'>
                    {SKELETON_LINE_WIDTHS.map((w, i) => (
                      <div key={i} style={{ width: `${w}%` }} />
                    ))}
                  </div>

                  <div className='ir-inv-doc__meta'>
                    <div className='ir-inv-doc__name' title={file.name}>
                      {file.name}
                    </div>
                    <div className='ir-inv-doc__row'>
                      <span
                        className='ir-badge ir-badge-success'
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <svg
                          width='10'
                          height='10'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth='3'
                        >
                          <polyline points='20 6 9 17 4 12'></polyline>
                        </svg>
                        PROCESSED
                      </span>
                      <span className='ir-inv-doc__size'>
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  </div>

                  <div className='ir-inv-doc__actions'>
                    <button
                      type='button'
                      onClick={() => fileInputRef.current.click()}
                    >
                      Replace file
                    </button>
                    {onRemoveFile && (
                      <button
                        type='button'
                        className='is-danger'
                        onClick={onRemoveFile}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </>
              )}
            </aside>

            {/* ── RIGHT: the invoice itself ───────────────────── */}
            <section className='ir-inv-form'>
              <div className='ir-inv-form__head'>
                <div>
                  <div className='ir-inv-form__title'>Invoice details</div>
                  <div className='ir-inv-form__sub'>
                    Pre-filled by extraction. Every field and row below is
                    editable.
                  </div>
                </div>
                <div className='ir-inv-form__chips'>
                  <span className='ir-inv-ai'>
                    <svg
                      width='13'
                      height='13'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                    >
                      <path d='M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83' />
                    </svg>
                    AI EXTRACTED
                    {avgConfidence != null ? ` · ${avgConfidence}% avg` : ''}
                  </span>
                  {flaggedCount > 0 && (
                    <span
                      className='ir-badge ir-badge-warning'
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'currentColor',
                        }}
                      />
                      {flaggedCount} need{flaggedCount === 1 ? 's' : ''}{' '}
                      confirmation
                    </span>
                  )}
                </div>
              </div>

              <div className='ir-inv-grid'>
                {entries.map((f) => (
                  <InvoiceField
                    key={f.key}
                    field={f}
                    onChange={onFieldChange}
                    onAcceptAlt={onAcceptAlt}
                  />
                ))}
              </div>

              {/* ── Item table ─────────────────────────────── */}
              <div className='ir-inv-items'>
                <div className='ir-inv-items__head'>
                  <span className='ir-inv-items__title'>Item table</span>
                  <span className='ir-inv-items__count'>
                    {lineItems.length} line{lineItems.length === 1 ? '' : 's'}{' '}
                    extracted
                  </span>
                </div>

                <div className='ir-inv-tablewrap'>
                  <table className='ir-inv-table'>
                    <thead>
                      <tr>
                        <th className='ir-inv-th--item'>Item / Description</th>
                        <th className='ir-inv-th--num'>Quantity</th>
                        <th className='ir-inv-th--num'>Unit Rate</th>
                        <th className='ir-inv-th--num'>Amount</th>
                        <th
                          className='ir-inv-th--act'
                          aria-label='Remove row'
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((row, i) => (
                        <tr key={row.rowKey}>
                          <td>
                            <input
                              className='ir-inv-cell'
                              value={row.description}
                              placeholder='Item name or description'
                              onChange={(e) =>
                                onLineItemChange(
                                  i,
                                  'description',
                                  e.target.value,
                                )
                              }
                            />
                            <input
                              className='ir-inv-cell ir-inv-cell--sub'
                              value={row.sku}
                              placeholder='SKU / item code'
                              onChange={(e) =>
                                onLineItemChange(i, 'sku', e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              className='ir-inv-cell ir-inv-cell--num'
                              inputMode='decimal'
                              value={row.quantity}
                              onChange={(e) =>
                                onLineItemChange(i, 'quantity', e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              className='ir-inv-cell ir-inv-cell--num'
                              inputMode='decimal'
                              value={row.unit_price}
                              onChange={(e) =>
                                onLineItemChange(
                                  i,
                                  'unit_price',
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className='ir-inv-amount'>
                            {money(rowAmount(row), currency)}
                          </td>
                          <td className='ir-inv-td--act'>
                            <button
                              type='button'
                              className='ir-inv-rowdel'
                              title='Remove this line'
                              disabled={lineItems.length === 1}
                              onClick={() => onLineItemRemove(i)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className='ir-inv-items__foot'>
                  <button
                    type='button'
                    className='ir-inv-addrow'
                    onClick={onLineItemAdd}
                  >
                    + Add another line
                  </button>
                  <div className='ir-inv-items__sub'>
                    <span>Sub Total</span>
                    <strong>{money(subTotal, currency)}</strong>
                  </div>
                </div>
              </div>

              {/* ── Notes + totals ─────────────────────────── */}
              <div className='ir-inv-foot'>
                <div className='ir-inv-notes'>
                  <label
                    className='ir-inv-notes__label'
                    htmlFor='ir-inv-notes-input'
                  >
                    Notes <span>(optional)</span>
                  </label>
                  <textarea
                    id='ir-inv-notes-input'
                    className='ir-inv-notes__ta'
                    value={notes}
                    placeholder='Anything the matching engine or an approver should know about this invoice…'
                    onChange={(e) => onNotesChange(e.target.value)}
                  />
                </div>

                <div className='ir-inv-totals'>
                  <div className='ir-inv-totals__row'>
                    <span>Sub Total</span>
                    <span className='ir-inv-totals__val'>
                      {money(subTotal, currency)}
                    </span>
                  </div>
                  <div className='ir-inv-totals__row'>
                    <span>
                      Tax
                      {subTotal > 0 && (
                        <em className='ir-inv-totals__rate'>
                          ({taxRatePct.toFixed(1)}%)
                        </em>
                      )}
                    </span>
                    <input
                      className='ir-inv-cell ir-inv-cell--num ir-inv-totals__input'
                      inputMode='decimal'
                      value={fields.tax_amount ?? ''}
                      onChange={(e) =>
                        onFieldChange('tax_amount', e.target.value)
                      }
                    />
                  </div>
                  <div className='ir-inv-totals__row ir-inv-totals__row--grand'>
                    <span>Total</span>
                    <span className='ir-inv-totals__val'>
                      {money(total, currency)}
                    </span>
                  </div>
                  <div className='ir-inv-totals__note'>
                    Sub Total is the sum of the item table above.
                  </div>
                </div>
              </div>
            </section>
          </div>

          <button
            onClick={onConfirm}
            disabled={confirming}
            style={{
              marginTop: '1.5rem',
              width: '100%',
              background: confirming ? 'var(--gray-400)' : '#10b981',
              color: 'white',
              padding: '16px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '16px',
              border: 'none',
              cursor: confirming ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.transform = 'translateY(-2px)')
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.transform = 'translateY(0)')
            }
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── Multi-invoice batch pipeline ─────────────────────
   Step 1 used to accept exactly one invoice PDF. It now accepts many at
   once: each selected file becomes its own `invoices[]` entry that
   hashes, duplicate-checks and extracts independently — one file being
   mid-hash while another is already flagged a duplicate and a third is
   sitting in HITL review is the normal case, not an edge case.

   Once at least one file has cleared extraction, the wizard moves every
   non-duplicate invoice through HITL review one at a time ("Invoice 2 of
   3"), then — per invoice, since each invoice reconciles independently —
   through match-type selection and the existing Steps 3-7 supporting-doc
   wizard (unchanged, reused as-is) and finally submits that invoice's
   reconciliation before moving on to the next one. */

// SHA-256 over the raw file bytes, client-side (Web Crypto — no library).
// Used both for the duplicate-check lookup and to tag the eventual real
// upload so the backend can record it for the next check.
async function hashFileSha256(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let invoiceRowSeq = 0;
const nextInvoiceId = () => `batch-inv-${Date.now()}-${++invoiceRowSeq}`;

function makeDocState() {
  return {
    source: 'manual',
    file: null,
    fetched: false,
    fetching: false,
    documentId: null,
    confirming: false,
    submitting: false,
    extractedData: null,
    extractionConfidence: null,
    lineItems: [],
    fieldReview: null,
    resolvedFlags: [],
    pageCount: null,
    uploadedAt: null,
  };
}

function makeInvoiceEntry(file) {
  return {
    id: nextInvoiceId(),
    file,
    fileName: file.name,
    fileSize: file.size,
    fileHash: null,
    // pending -> hashing -> checking-duplicate -> (duplicate | processing -> needs-review) -> reviewed
    status: 'pending',
    duplicateOf: null,
    duplicateResult: null,
    error: null,

    docId: null,
    extractedData: null,
    rawDigitization: null,
    lineItems: [],
    notes: '',
    fieldReview: null,
    resolvedFlags: [],
    confirming: false,

    matchType: null, // '2' | '3' | '4' | '5', set on the Matching Selection screen
    matchParams: {
      po: true,
      grn: true,
      quality: false,
      service_entry: false,
      contracts: false,
    },
    docStates: {
      po: makeDocState(),
      grn: makeDocState(),
      quality: makeDocState(),
      service_entry: makeDocState(),
      contracts: makeDocState(),
    },
    pipelineStepIndex: 0, // index into THIS invoice's ['match', ...docTypes, 'review'] sequence
    review: { taxRate: 0, actualSla: '', isFinalizing: false, processStage: 0 },
    reconciliationId: null,
    reconciliationResult: null,
  };
}

const initialBatchState = {
  invoices: [],
  // batch: multi-file upload + dedupe (Step 1)
  // hitl: reviewing non-duplicate invoices one at a time (Step 2)
  // pipeline: match-type selection -> supporting docs -> review, per invoice (Steps 3+)
  // complete: every invoice's reconciliation has been submitted
  phase: 'batch',
  hitlIndex: 0,
  pipelineIndex: 0,
  error: null,
};

function mapInv(state, id, updater) {
  return {
    ...state,
    invoices: state.invoices.map((inv) => (inv.id === id ? updater(inv) : inv)),
  };
}

function batchReducer(state, action) {
  switch (action.type) {
    case 'ERROR_SET':
      return { ...state, error: action.message };

    case 'FILES_ADDED':
      return {
        ...state,
        error: null,
        invoices: [
          ...state.invoices,
          ...action.files.map((f) => makeInvoiceEntry(f)),
        ],
      };
    case 'INVOICE_REMOVED':
      return {
        ...state,
        invoices: state.invoices.filter((inv) => inv.id !== action.id),
      };

    case 'INV_HASHING':
      return mapInv(state, action.id, (inv) => ({ ...inv, status: 'hashing' }));
    case 'INV_HASHED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        fileHash: action.hash,
        status: 'checking-duplicate',
      }));
    case 'INV_DUP_CHECK_STARTED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        status: 'checking-duplicate',
      }));
    case 'INV_DUPLICATE_BLOCKED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        status: 'duplicate',
        duplicateResult: action.duplicateResult,
      }));
    case 'INV_CLEARED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        status: 'processing',
      }));
    case 'INV_HASH_FAILED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        status: 'error',
        error: action.message,
      }));

    case 'INV_EXTRACT_SUCCESS': {
      const fields = hydrateInvoiceFields(action.fields, action.docId);
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        status: 'needs-review',
        docId: action.docId,
        rawDigitization: action.rawDigitization,
        extractedData: fields,
        lineItems: toFormRows(action.lineItems),
        fieldReview: buildFieldReview(fields, action.docId),
        resolvedFlags: [],
        error: action.degraded
          ? 'Extraction failed — fields below are empty, please enter them manually.'
          : null,
      }));
    }
    case 'INV_EXTRACT_FAILED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        status: 'error',
        error: action.message,
      }));

    case 'INV_FIELD_EDITED':
      return mapInv(state, action.id, (inv) => {
        const next = { ...inv.extractedData, [action.key]: action.value };
        if (
          action.key === 'payment_terms' &&
          TERM_DAYS[action.value] !== undefined
        )
          next.due_date = addDaysIso(next.doc_date, TERM_DAYS[action.value]);
        if (
          action.key === 'doc_date' &&
          TERM_DAYS[next.payment_terms] !== undefined
        )
          next.due_date = addDaysIso(
            action.value,
            TERM_DAYS[next.payment_terms],
          );
        return { ...inv, extractedData: next };
      });
    case 'INV_LINE_ITEM_CHANGED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        lineItems: inv.lineItems.map((r, i) =>
          i === action.index ? { ...r, [action.key]: action.value } : r,
        ),
      }));
    case 'INV_LINE_ITEM_ADDED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        lineItems: [
          ...inv.lineItems,
          {
            rowKey: nextLineRowKey(),
            id: null,
            line_no: inv.lineItems.length + 1,
            description: '',
            sku: '',
            uom: 'EA',
            quantity: 1,
            unit_price: 0,
          },
        ],
      }));
    case 'INV_LINE_ITEM_REMOVED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        lineItems: inv.lineItems
          .filter((_, i) => i !== action.index)
          .map((r, i) => ({ ...r, line_no: i + 1 })),
      }));
    case 'INV_NOTES_CHANGED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        notes: action.value,
      }));
    case 'INV_FLAG_CONFIRMED':
      return mapInv(state, action.id, (inv) => {
        const alt = inv.fieldReview?.[action.key]?.alt;
        return {
          ...inv,
          extractedData:
            alt !== undefined
              ? { ...inv.extractedData, [action.key]: alt }
              : inv.extractedData,
          resolvedFlags: inv.resolvedFlags.includes(action.key)
            ? inv.resolvedFlags
            : [...inv.resolvedFlags, action.key],
        };
      });
    case 'INV_CONFIRM_STARTED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        confirming: true,
        error: null,
      }));
    case 'INV_CONFIRM_SUCCESS':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        confirming: false,
        status: 'reviewed',
        extractedData: action.fields ?? inv.extractedData,
      }));
    case 'INV_CONFIRM_FAILED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        confirming: false,
        error: action.message,
      }));

    case 'PHASE_SET':
      return { ...state, phase: action.phase };
    case 'HITL_INDEX_SET':
      return { ...state, hitlIndex: action.index };
    case 'PIPELINE_INDEX_SET':
      return { ...state, pipelineIndex: action.index, error: null };

    case 'INV_MATCH_TYPE_SET':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        matchType: action.matchType,
        matchParams: action.matchParams,
      }));
    case 'INV_MATCH_PARAM_TOGGLED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        matchParams: { ...inv.matchParams, [action.key]: action.checked },
      }));

    case 'INV_DOC_UPDATED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        docStates: {
          ...inv.docStates,
          [action.docId]: { ...inv.docStates[action.docId], ...action.updates },
        },
      }));
    case 'INV_DOC_UPLOAD_STARTED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        error: null,
        docStates: {
          ...inv.docStates,
          [action.docId]: {
            ...inv.docStates[action.docId],
            file: action.file,
            confirming: true,
            error: null,
          },
        },
      }));
    case 'INV_DOC_UPLOAD_SUCCESS':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        docStates: {
          ...inv.docStates,
          [action.docId]: {
            ...inv.docStates[action.docId],
            documentId: action.documentId,
            confirming: false,
            extractedData: action.fields,
            rawDigitization: action.rawDigitization,
            extractionConfidence: action.confidence,
            lineItems: action.lineItems || [],
            fieldReview: action.fieldReview,
            resolvedFlags: [],
            pageCount: action.pageCount,
            uploadedAt: action.uploadedAt,
          },
        },
      }));
    case 'INV_DOC_UPLOAD_FAILED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        error: action.message,
        docStates: {
          ...inv.docStates,
          [action.docId]: {
            ...inv.docStates[action.docId],
            file: null,
            confirming: false,
            error: action.message,
          },
        },
      }));
    case 'INV_DOC_FLAG_CONFIRMED':
      return mapInv(state, action.id, (inv) => {
        const target = inv.docStates[action.docId];
        const alt = target.fieldReview?.[action.key]?.alt;
        return {
          ...inv,
          docStates: {
            ...inv.docStates,
            [action.docId]: {
              ...target,
              extractedData:
                alt !== undefined
                  ? { ...target.extractedData, [action.key]: alt }
                  : target.extractedData,
              resolvedFlags: target.resolvedFlags.includes(action.key)
                ? target.resolvedFlags
                : [...target.resolvedFlags, action.key],
            },
          },
        };
      });
    case 'INV_DOC_CONFIRM_STARTED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        error: null,
        docStates: {
          ...inv.docStates,
          [action.docId]: { ...inv.docStates[action.docId], submitting: true },
        },
      }));
    case 'INV_DOC_CONFIRM_SUCCESS':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        pipelineStepIndex: inv.pipelineStepIndex + 1,
        docStates: {
          ...inv.docStates,
          [action.docId]: { ...inv.docStates[action.docId], submitting: false },
        },
      }));
    case 'INV_DOC_CONFIRM_FAILED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        error: action.message,
        docStates: {
          ...inv.docStates,
          [action.docId]: { ...inv.docStates[action.docId], submitting: false },
        },
      }));

    case 'INV_STEP_ADVANCED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        pipelineStepIndex: inv.pipelineStepIndex + 1,
      }));
    case 'INV_STEP_BACK':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        pipelineStepIndex: inv.pipelineStepIndex - 1,
      }));

    case 'INV_TAX_RATE_CHANGED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        review: { ...inv.review, taxRate: action.value },
      }));
    case 'INV_SLA_CHANGED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        review: { ...inv.review, actualSla: action.value },
      }));
    case 'INV_FINALIZE_STARTED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        error: null,
        review: { ...inv.review, isFinalizing: true, processStage: 0 },
      }));
    case 'INV_FINALIZE_PROGRESS':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        review: { ...inv.review, processStage: action.stage },
      }));
    case 'INV_FINALIZE_SUCCESS':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        review: { ...inv.review, processStage: action.stage },
        reconciliationId: action.reconciliationId ?? null,
        reconciliationResult: action.reconciliationResult,
      }));
    case 'INV_FINALIZE_FAILED':
      return mapInv(state, action.id, (inv) => ({
        ...inv,
        error: action.message,
        review: { ...inv.review, isFinalizing: false, processStage: 0 },
      }));

    default:
      return state;
  }
}

/* ── File-row cards for Step 1 ───────────────────────── */
const STATUS_META = {
  pending: { label: 'Queued', tone: 'ir-badge' },
  hashing: { label: 'Hashing…', tone: 'ir-badge-info' },
  'checking-duplicate': {
    label: 'Checking for duplicates…',
    tone: 'ir-badge-info',
  },
  duplicate: { label: 'Duplicate', tone: 'ir-badge-danger' },
  processing: { label: 'Extracting…', tone: 'ir-badge-info' },
  'needs-review': { label: 'Cleared — needs review', tone: 'ir-badge-warning' },
  reviewed: { label: 'Reviewed', tone: 'ir-badge-success' },
  error: { label: 'Error', tone: 'ir-badge-danger' },
};

const STATUS_PROGRESS = {
  pending: 0,
  hashing: 15,
  'checking-duplicate': 35,
  processing: 75,
  duplicate: 100,
  'needs-review': 100,
  reviewed: 100,
  error: 0,
};

const STATUS_PROGRESS_LABEL = {
  pending: 'Waiting to start',
  hashing: 'Preparing secure file check',
  'checking-duplicate': 'Checking for an existing invoice',
  processing: 'Reading invoice details',
  duplicate: 'Duplicate check complete',
  'needs-review': 'Extraction complete',
  reviewed: 'Upload complete',
};

const STATUS_PROGRESS_CEILING = {
  hashing: 30,
  'checking-duplicate': 60,
  processing: 90,
};

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function InvoiceFileRow({ invoice, onRemove }) {
  const meta = STATUS_META[invoice.status] || STATUS_META.pending;
  const progress = STATUS_PROGRESS[invoice.status] ?? 0;
  const [displayProgress, setDisplayProgress] = useState(progress);
  const spinning =
    invoice.status === 'hashing' ||
    invoice.status === 'checking-duplicate' ||
    invoice.status === 'processing';

  useEffect(() => {
    setDisplayProgress(progress);
    if (!spinning) return undefined;
    const ceiling = STATUS_PROGRESS_CEILING[invoice.status] ?? progress;
    const timer = setInterval(() => {
      setDisplayProgress((current) =>
        current >= ceiling ? current : Math.min(current + 1, ceiling),
      );
    }, 700);
    return () => clearInterval(timer);
  }, [invoice.status, progress, spinning]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 16px',
        border: '1px solid var(--gray-200)',
        borderRadius: '12px',
        background:
          invoice.status === 'duplicate'
            ? 'var(--tint-danger-bg)'
            : 'var(--primary-white)',
      }}
    >
      <div
        style={{
          color: 'var(--primary-blue)',
          background: 'var(--primary-50)',
          padding: '10px',
          borderRadius: '10px',
          flexShrink: 0,
        }}
      >
        <FileTextIcon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: '14px',
            color: 'var(--gray-900)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={invoice.fileName}
        >
          {invoice.fileName}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--gray-500)',
            marginTop: '2px',
          }}
        >
          {formatFileSize(invoice.fileSize)}
        </div>
        {spinning && (
          <div style={{ marginTop: '8px', maxWidth: '360px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                fontSize: '11px',
                color: 'var(--gray-500)',
                marginBottom: '4px',
              }}
            >
              <span>{STATUS_PROGRESS_LABEL[invoice.status]}</span>
              <strong style={{ color: 'var(--primary-blue)' }}>
                {displayProgress}%
              </strong>
            </div>
            <div
              role='progressbar'
              aria-label={`Invoice upload progress: ${displayProgress}%`}
              aria-valuemin='0'
              aria-valuemax='100'
              aria-valuenow={displayProgress}
              style={{
                height: '5px',
                background: 'var(--gray-200)',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${displayProgress}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  background: 'var(--primary-blue)',
                  borderRadius: 'inherit',
                }}
              />
            </div>
          </div>
        )}
        {invoice.status === 'duplicate' &&
          invoice.duplicateResult &&
          (() => {
            const { label, detail } = describeDuplicateResult(
              invoice.duplicateResult,
            );
            return (
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--tint-danger-text)',
                  marginTop: '6px',
                }}
              >
                <strong>{label}.</strong> {detail}
              </div>
            );
          })()}
        {invoice.status === 'error' && invoice.error && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--tint-danger-text)',
              marginTop: '6px',
            }}
          >
            {invoice.error}
          </div>
        )}
      </div>
      <span
        className={`ir-badge ${meta.tone}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
        }}
      >
        {spinning && (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            style={{
              width: 10,
              height: 10,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              display: 'inline-block',
            }}
          />
        )}
        {meta.label}
      </span>
      <button
        type='button'
        onClick={() => onRemove(invoice.id)}
        disabled={spinning}
        title='Remove'
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--gray-400)',
          fontSize: '18px',
          cursor: spinning ? 'not-allowed' : 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

/* ── Step 1: multi-file upload + duplicate check ─────── */
const ACCEPTED_INVOICE_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xlsx',
  '.xls',
  '.csv',
  '.jpg',
  '.jpeg',
  '.edi',
];
const isAcceptedInvoiceFile = (name) =>
  ACCEPTED_INVOICE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

function BatchUploadStep({
  invoices,
  onFilesSelected,
  onRemove,
  onContinue,
  canContinue,
  busy,
  language,
  onLanguageChange,
}) {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      isAcceptedInvoiceFile(f.name),
    );
    if (files.length) onFilesSelected(files);
  };

  return (
    <motion.div
      key='batch-upload'
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className='ir-card'
      style={{ padding: '2.5rem 2rem' }}
    >
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--gray-900)',
            marginBottom: '8px',
          }}
        >
          Upload Supplier Invoices
        </h2>
        <p style={{ color: 'var(--gray-500)', fontSize: '15px' }}>
          Add as many invoice files as you like — each is hashed and checked for
          duplicates independently, then extracted.
        </p>
        <div
          style={{
            marginTop: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <label
            style={{
              fontSize: '13px',
              color: 'var(--gray-500)',
              fontWeight: 600,
            }}
          >
            Invoice language
          </label>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className='dash-select'
          >
            <option value='English'>English</option>
            <option value='Hindi'>Hindi</option>
            <option value='Arabic'>Arabic</option>
            <option value='Chinese'>Chinese</option>
            <option value='Japanese'>Japanese</option>
          </select>
        </div>
      </div>

      <input
        type='file'
        ref={inputRef}
        multiple
        accept={ACCEPTED_INVOICE_EXTENSIONS.join(',')}
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFilesSelected(files);
          e.target.value = '';
        }}
      />

      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? 'var(--primary-blue)' : 'var(--gray-300)'}`,
          borderRadius: '16px',
          padding: invoices.length ? '2rem' : '3.5rem 2rem',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver
            ? 'var(--primary-50)'
            : 'linear-gradient(180deg, var(--gray-50) 0%, var(--gray-100) 100%)',
          transition: 'all 0.15s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: invoices.length ? '1.5rem' : 0,
        }}
      >
        <div
          style={{
            color: 'var(--primary-blue)',
            background: 'var(--primary-50)',
            padding: '14px',
            borderRadius: '50%',
          }}
        >
          <UploadIcon />
        </div>
        <div
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--gray-800)',
          }}
        >
          Click or drag invoice files here
        </div>
        <div style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
          PDF, Word, Excel, CSV, JPG or EDI · up to 15 MB each
        </div>
      </div>

      {invoices.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '2rem',
          }}
        >
          {invoices.map((inv) => (
            <InvoiceFileRow key={inv.id} invoice={inv} onRemove={onRemove} />
          ))}
        </div>
      )}

      <button
        onClick={onContinue}
        disabled={!canContinue || busy}
        style={{
          width: '100%',
          background:
            canContinue && !busy ? 'var(--primary-blue)' : 'var(--gray-400)',
          color: 'white',
          padding: '16px',
          borderRadius: '12px',
          fontWeight: 700,
          fontSize: '16px',
          border: 'none',
          cursor: canContinue && !busy ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
        }}
      >
        {busy ? 'Processing…' : 'Review extracted invoices →'}
      </button>
    </motion.div>
  );
}

/* ── PDF preview pane (real bytes, via object URL) ───── */
function PdfPreviewFrame({ file }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!url) return null;
  return (
    <iframe
      title={`Preview of ${file.name}`}
      src={url}
      style={{
        width: '100%',
        height: '420px',
        border: '1px solid var(--gray-200)',
        borderRadius: '10px',
        background: 'var(--gray-50)',
      }}
    />
  );
}

/* ── HITL invoice review, one file at a time ─────────── */
function InvoiceHitlStep({
  invoice,
  index,
  total,
  onFieldChange,
  onLineItemChange,
  onLineItemAdd,
  onLineItemRemove,
  onNotesChange,
  onAcceptAlt,
  onConfirmAndContinue,
  onBackToUpload,
}) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const fields = invoice.extractedData || {};
  const currency = fields.currency || 'USD';
  const entries = INVOICE_HEADER_FIELDS.map((spec) => {
    const r = invoice.fieldReview?.[spec.key];
    const resolved = invoice.resolvedFlags.includes(spec.key);
    return {
      ...spec,
      value: fields[spec.key] ?? '',
      confidence: r?.confidence ?? null,
      flagged: !!r?.flagged && !resolved,
      reason: r?.reason,
      alt: r?.alt,
    };
  });
  const flaggedCount = entries.filter((f) => f.flagged).length;
  const scored = entries.map((f) => f.confidence).filter((c) => c != null);
  const avgConfidence = scored.length
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
    : null;
  const subTotal = round2(
    invoice.lineItems.reduce((s, r) => s + rowAmount(r), 0),
  );
  const taxAmount = num(fields.tax_amount);
  const total_ = round2(subTotal + taxAmount);
  const taxRatePct = subTotal > 0 ? (taxAmount / subTotal) * 100 : 0;

  return (
    <motion.div
      key={`hitl-${invoice.id}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className='ir-card'
      style={{ padding: '2rem' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--gray-900)',
            }}
          >
            Review extracted invoice
          </h2>
          <p
            style={{
              color: 'var(--gray-500)',
              fontSize: '14px',
              marginTop: '4px',
            }}
          >
            Invoice {index + 1} of {total} · {invoice.fileName}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {invoice.error && (
            <span className='ir-badge ir-badge-danger'>{invoice.error}</span>
          )}
          <button
            type='button'
            onClick={() => setShowAnalysis(true)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--gray-300)',
              background: 'var(--gray-50)',
              color: 'var(--gray-700)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Detailed Analysis
          </button>
        </div>
      </div>

      <div className='ir-inv-review'>
        <aside className='ir-inv-doc'>
          <div className='ir-inv-doc__head'>
            <span className='ir-inv-doc__heading'>Source document</span>
          </div>
          <PdfPreviewFrame file={invoice.file} />
          <div className='ir-inv-doc__meta'>
            <div className='ir-inv-doc__name' title={invoice.fileName}>
              {invoice.fileName}
            </div>
            <div className='ir-inv-doc__row'>
              <span
                className='ir-badge ir-badge-success'
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                PROCESSED
              </span>
              <span className='ir-inv-doc__size'>
                {formatFileSize(invoice.fileSize)}
              </span>
            </div>
          </div>
        </aside>

        <section className='ir-inv-form'>
          <div className='ir-inv-form__head'>
            <div>
              <div className='ir-inv-form__title'>Invoice details</div>
              <div className='ir-inv-form__sub'>
                Pre-filled by extraction. Every field and row below is editable.
              </div>
            </div>
            <div className='ir-inv-form__chips'>
              <span className='ir-inv-ai'>
                AI EXTRACTED
                {avgConfidence != null ? ` · ${avgConfidence}% avg` : ''}
              </span>
              {flaggedCount > 0 && (
                <span className='ir-badge ir-badge-warning'>
                  {flaggedCount} need{flaggedCount === 1 ? 's' : ''}{' '}
                  confirmation
                </span>
              )}
            </div>
          </div>

          <div className='ir-inv-grid'>
            {entries.map((f) => (
              <InvoiceField
                key={f.key}
                field={f}
                onChange={onFieldChange}
                onAcceptAlt={onAcceptAlt}
              />
            ))}
          </div>

          <div className='ir-inv-items'>
            <div className='ir-inv-items__head'>
              <span className='ir-inv-items__title'>Item table</span>
              <span className='ir-inv-items__count'>
                {invoice.lineItems.length} line
                {invoice.lineItems.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className='ir-inv-tablewrap'>
              <table className='ir-inv-table'>
                <thead>
                  <tr>
                    <th className='ir-inv-th--item'>Item / Description</th>
                    <th className='ir-inv-th--num'>Quantity</th>
                    <th className='ir-inv-th--num'>Unit Rate</th>
                    <th className='ir-inv-th--num'>Amount</th>
                    <th className='ir-inv-th--act' aria-label='Remove row' />
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((row, i) => (
                    <tr key={row.rowKey}>
                      <td>
                        <input
                          className='ir-inv-cell'
                          value={row.description}
                          placeholder='Item name or description'
                          onChange={(e) =>
                            onLineItemChange(i, 'description', e.target.value)
                          }
                        />
                        <input
                          className='ir-inv-cell ir-inv-cell--sub'
                          value={row.sku}
                          placeholder='SKU / item code'
                          onChange={(e) =>
                            onLineItemChange(i, 'sku', e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className='ir-inv-cell ir-inv-cell--num'
                          inputMode='decimal'
                          value={row.quantity}
                          onChange={(e) =>
                            onLineItemChange(i, 'quantity', e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className='ir-inv-cell ir-inv-cell--num'
                          inputMode='decimal'
                          value={row.unit_price}
                          onChange={(e) =>
                            onLineItemChange(i, 'unit_price', e.target.value)
                          }
                        />
                      </td>
                      <td className='ir-inv-amount'>
                        {money(rowAmount(row), currency)}
                      </td>
                      <td className='ir-inv-td--act'>
                        <button
                          type='button'
                          className='ir-inv-rowdel'
                          title='Remove this line'
                          disabled={invoice.lineItems.length === 1}
                          onClick={() => onLineItemRemove(i)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className='ir-inv-items__foot'>
              <button
                type='button'
                className='ir-inv-addrow'
                onClick={onLineItemAdd}
              >
                + Add another line
              </button>
              <div className='ir-inv-items__sub'>
                <span>Sub Total</span>
                <strong>{money(subTotal, currency)}</strong>
              </div>
            </div>
          </div>

          <div className='ir-inv-foot'>
            <div className='ir-inv-notes'>
              <label
                className='ir-inv-notes__label'
                htmlFor={`hitl-notes-${invoice.id}`}
              >
                Notes <span>(optional)</span>
              </label>
              <textarea
                id={`hitl-notes-${invoice.id}`}
                className='ir-inv-notes__ta'
                value={invoice.notes}
                placeholder='Anything the matching engine or an approver should know about this invoice…'
                onChange={(e) => onNotesChange(e.target.value)}
              />
            </div>
            <div className='ir-inv-totals'>
              <div className='ir-inv-totals__row'>
                <span>Sub Total</span>
                <span className='ir-inv-totals__val'>
                  {money(subTotal, currency)}
                </span>
              </div>
              <div className='ir-inv-totals__row'>
                <span>
                  Tax
                  {subTotal > 0 && (
                    <em className='ir-inv-totals__rate'>
                      ({taxRatePct.toFixed(1)}%)
                    </em>
                  )}
                </span>
                <input
                  className='ir-inv-cell ir-inv-cell--num ir-inv-totals__input'
                  inputMode='decimal'
                  value={fields.tax_amount ?? ''}
                  onChange={(e) => onFieldChange('tax_amount', e.target.value)}
                />
              </div>
              <div className='ir-inv-totals__row ir-inv-totals__row--grand'>
                <span>Total</span>
                <span className='ir-inv-totals__val'>
                  {money(total_, currency)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        {index === 0 && (
          <button
            onClick={onBackToUpload}
            style={{
              width: '140px',
              background: 'var(--primary-white)',
              color: 'var(--gray-700)',
              padding: '16px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '16px',
              border: '2px solid var(--gray-300)',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        )}
        <button
          onClick={onConfirmAndContinue}
          disabled={invoice.confirming}
          style={{
            flex: 1,
            background: invoice.confirming ? 'var(--gray-400)' : '#10b981',
            color: 'white',
            padding: '16px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '16px',
            border: 'none',
            cursor: invoice.confirming ? 'not-allowed' : 'pointer',
          }}
        >
          {invoice.confirming
            ? 'Confirming…'
            : index + 1 < total
              ? `Confirm & Review Next Invoice (${index + 2} of ${total}) →`
              : 'Confirm & Continue to Matching →'}
        </button>
      </div>

      {showAnalysis && (
        <div
          onClick={() => setShowAnalysis(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--primary-white)',
              borderRadius: '16px',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--gray-900)',
                }}
              >
                Detailed Analysis
              </h3>
              <button
                type='button'
                onClick={() => setShowAnalysis(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: 'var(--gray-500)',
                }}
              >
                ✕
              </button>
            </div>

            {!invoice.rawDigitization ? (
              <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                Detailed analysis data isn't available for this invoice — try
                re-uploading it.
              </p>
            ) : (
              <>
                {invoice.rawDigitization.invoice_data?.extraction_quality
                  ?.overall_confidence != null && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--gray-700)',
                      marginBottom: '16px',
                    }}
                  >
                    Overall extraction confidence:{' '}
                    <strong>
                      {Math.round(
                        invoice.rawDigitization.invoice_data.extraction_quality
                          .overall_confidence * 100,
                      )}
                      %
                    </strong>
                  </div>
                )}

                {(invoice.rawDigitization.page_audit_trail || []).map(
                  (page) => {
                    const attempts = page.checker?.attempt_log || [];
                    const lastAttempt = attempts[attempts.length - 1];
                    const corrections = lastAttempt?.corrections_applied || [];
                    return (
                      <div
                        key={page.page_number}
                        style={{ marginBottom: '16px' }}
                      >
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            color: 'var(--gray-600)',
                            textTransform: 'uppercase',
                            marginBottom: '6px',
                          }}
                        >
                          Page {page.page_number} ·{' '}
                          {page.checker?.verification_status || 'Unknown'}
                        </div>
                        {corrections.length ? (
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: '18px',
                              fontSize: '13px',
                              color: 'var(--gray-800)',
                              lineHeight: 1.6,
                            }}
                          >
                            {corrections.map((correction, correctionIndex) => (
                              <li key={correctionIndex}>{correction}</li>
                            ))}
                          </ul>
                        ) : (
                          <p
                            style={{
                              fontSize: '13px',
                              color: 'var(--gray-500)',
                              margin: 0,
                            }}
                          >
                            No corrections were needed — extraction matched
                            cleanly on the first pass.
                          </p>
                        )}
                      </div>
                    );
                  },
                )}
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ── Matching Selection screen ────────────────────────
   New selection mechanic — 2/3/4/5-way match TYPE, distinct from
   MatchingStrategyStep.jsx (which is per-document-type toggles/params for
   whichever match type has already been chosen). Dummy "recommended"
   value today; the slot is shaped so a real backend suggestion can be
   dropped in later without touching the layout. Reuses this file's
   ir-card / ir-badge visual language. */
const MATCH_TYPE_OPTIONS = [
  {
    id: '2',
    label: '2-Way Match',
    docs: ['po'],
    desc: 'Invoice vs. Purchase Order. Fast, low control — good for low-value or non-stock spend.',
  },
  {
    id: '3',
    label: '3-Way Match',
    docs: ['po', 'grn'],
    desc: 'Invoice vs. PO vs. Goods Receipt. The standard for physical goods.',
  },
  {
    id: '4',
    label: '4-Way Match',
    docs: ['po', 'grn', 'quality'],
    desc: 'Adds Acceptance Certificate. Required for regulated or safety-critical goods.',
  },
  {
    id: '5',
    label: '5-Way Match',
    docs: ['po', 'grn', 'quality', 'service_entry'],
    desc: 'Adds Service Entry / Timesheet. For combined goods + services engagements.',
  },
];
function matchParamsForType(typeId) {
  const opt =
    MATCH_TYPE_OPTIONS.find((o) => o.id === typeId) || MATCH_TYPE_OPTIONS[1];
  return {
    po: opt.docs.includes('po'),
    grn: opt.docs.includes('grn'),
    quality: opt.docs.includes('quality'),
    service_entry: opt.docs.includes('service_entry'),
    contracts: false,
  };
}

// Doc id -> the same tone classes MatchingStrategyStep.jsx uses, so the
// little colour bars on each card read consistently across both screens.
const MATCH_TYPE_TONE = {
  po: 'blue',
  grn: 'teal',
  quality: 'amber',
  service_entry: 'purple',
  contracts: 'rose',
};
const MATCH_TYPE_DOC_LABEL = {
  po: 'PO',
  grn: 'GRN',
  quality: 'AC',
  service_entry: 'SES',
  contracts: 'SLA',
};

function MatchTypeSelectStep({
  invoice,
  index,
  total,
  onSelect,
  onContinue,
  onBack,
}) {
  // Hardcoded placeholder — the slot where a real per-vendor suggestion
  // (vendor history, spend category, etc.) plugs in once that backend
  // endpoint exists.
  const recommended = '4';
  const selected = invoice.matchType || recommended;

  return (
    <motion.div
      key={`match-${invoice.id}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className='ir-ms'
    >
      <div className='ir-ms__head'>
        <div>
          <h2 className='ir-ms__title'>Select matching strategy</h2>
          <p className='ir-ms__sub'>
            Invoice {index + 1} of {total} ·{' '}
            {invoice.extractedData?.vendor_name || invoice.fileName}
          </p>
        </div>
      </div>

      <div className='ir-ms__body ir-mt__body'>
        <div className='ir-ms__main'>
          <div
            className='ir-mt-grid'
            role='radiogroup'
            aria-label='Matching strategy'
          >
            {MATCH_TYPE_OPTIONS.map((opt) => {
              const isOn = selected === opt.id;
              return (
                <button
                  type='button'
                  role='radio'
                  aria-checked={isOn}
                  key={opt.id}
                  className={`ir-mt-card${isOn ? ' is-active' : ''}`}
                  onClick={() => onSelect(opt.id, matchParamsForType(opt.id))}
                >
                  <span className='ir-mt-card__top'>
                    <span className='ir-mt-card__name'>{opt.label}</span>
                  </span>
                  <span className='ir-ms-preset__bars' aria-hidden='true'>
                    <i className='ir-ms-tone--slate' />
                    {opt.docs.map((d) => (
                      <i
                        key={d}
                        className={`ir-ms-tone--${MATCH_TYPE_TONE[d]}`}
                      />
                    ))}
                  </span>
                  <span className='ir-mt-card__desc'>{opt.desc}</span>
                  <span className='ir-mt-card__docs'>
                    {opt.docs.map((d) => (
                      <span
                        key={d}
                        className={`ir-ms-doc__chip ir-ms-tone--${MATCH_TYPE_TONE[d]}`}
                      >
                        {MATCH_TYPE_DOC_LABEL[d]}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className='ir-ms__foot'>
        <button type='button' className='ir-ms-btn-back' onClick={onBack}>
          ← Back
        </button>
        <button
          type='button'
          className='ir-ms-btn-next'
          onClick={() => onContinue(selected)}
        >
          Continue with{' '}
          {MATCH_TYPE_OPTIONS.find((o) => o.id === selected)?.label} →
        </button>
      </div>
    </motion.div>
  );
}

export default function NewReconciliation() {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(batchReducer, initialBatchState);
  const [ocrLanguage, setOcrLanguage] = useState('English');
  const { invoices, phase, hitlIndex, pipelineIndex, error } = state;

  const nonDuplicates = invoices.filter(
    (inv) => inv.status !== 'duplicate' && inv.status !== 'error',
  );
  const anyBusy = invoices.some((inv) =>
    ['hashing', 'checking-duplicate', 'processing'].includes(inv.status),
  );
  const anyClearedReady = nonDuplicates.some(
    (inv) => inv.status === 'needs-review' || inv.status === 'reviewed',
  );

  /* ── Step 1: file selection -> hash -> duplicate check -> extract ── */
  const runInvoicePipeline = async (invoice) => {
    dispatch({ type: 'INV_HASHING', id: invoice.id });

    let digitized;
    try {
      digitized = await digitizeDocument(invoice.file, 'invoice', {
        language: ocrLanguage,
        debug: true,
      });
    } catch (err) {
      dispatch({
        type: 'INV_EXTRACT_FAILED',
        id: invoice.id,
        message:
          err instanceof ApiError
            ? err.message
            : 'Extraction failed. Please try again.',
      });
      return;
    }

    if (digitized.matching_allowed === false) {
      dispatch({
        type: 'INV_EXTRACT_FAILED',
        id: invoice.id,
        message:
          'Invoice could not be reliably digitized — please check the file and retry.',
      });
      return;
    }

    try {
      dispatch({ type: 'INV_DUP_CHECK_STARTED', id: invoice.id });
      const dupResult = await checkDuplicateInvoice(digitized, true);
      if (!dupResult.should_continue_full_pipeline) {
        dispatch({
          type: 'INV_DUPLICATE_BLOCKED',
          id: invoice.id,
          duplicateResult: dupResult,
        });
        return;
      }
    } catch {
      // Duplicate check failing shouldn't block a legitimate upload.
    }
    dispatch({ type: 'INV_CLEARED', id: invoice.id });

    const fields = mapInvoiceDigitization(digitized);
    dispatch({
      type: 'INV_EXTRACT_SUCCESS',
      id: invoice.id,
      docId: null,
      fields,
      lineItems: mapInvoiceLineItems(digitized),
      degraded: false,
      rawDigitization: digitized,
    });
  };

  const handleFilesSelected = (files) => {
    const pdfFiles = files.filter((f) => isAcceptedInvoiceFile(f.name));
    if (pdfFiles.length !== files.length)
      dispatch({
        type: 'ERROR_SET',
        message:
          'Unsupported file skipped — allowed: PDF, DOC, DOCX, XLSX, XLS, CSV, JPG, JPEG, EDI.',
      });
    if (!pdfFiles.length) return;
    dispatch({ type: 'FILES_ADDED', files: pdfFiles });
  };

  // Fire off the hash/dedupe/extract pipeline for each newly-added invoice.
  // Runs per-file independently (Promise not awaited across files) so one
  // slow upload never blocks another's status from updating.
  const kickedOff = useRef(new Set());
  useEffect(() => {
    invoices.forEach((inv) => {
      if (inv.status === 'pending' && !kickedOff.current.has(inv.id)) {
        kickedOff.current.add(inv.id);
        runInvoicePipeline(inv);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices.map((i) => i.id).join(',')]);

  const handleRemoveInvoice = (id) => dispatch({ type: 'INVOICE_REMOVED', id });

  const goToHitl = () => {
    if (!nonDuplicates.length) return;
    dispatch({ type: 'HITL_INDEX_SET', index: 0 });
    dispatch({ type: 'PHASE_SET', phase: 'hitl' });
  };

  /* ── Step 2: HITL, one invoice at a time ─────────────── */
  const currentHitlInvoice = nonDuplicates[hitlIndex];

  const confirmHitlAndContinue = async () => {
    const inv = currentHitlInvoice;
    if (!inv.docId) {
      dispatch({
        type: 'INV_CONFIRM_SUCCESS',
        id: inv.id,
        fields: inv.extractedData,
      });
    } else {
      dispatch({ type: 'INV_CONFIRM_STARTED', id: inv.id });
      const line_items = inv.lineItems.map((r, i) => ({
        line_no: i + 1,
        description: r.description,
        sku: r.sku || null,
        uom: r.uom || null,
        quantity: num(r.quantity),
        unit_price: num(r.unit_price),
        line_total: rowAmount(r),
      }));
      const subtotal = round2(
        line_items.reduce((sum, li) => sum + li.line_total, 0),
      );
      const tax_amount = round2(num(inv.extractedData?.tax_amount));
      const fields = {
        ...inv.extractedData,
        subtotal,
        tax_amount,
        total: round2(subtotal + tax_amount),
        notes: inv.notes || null,
      };
      try {
        await confirmDocument(inv.docId, { fields, line_items });
        dispatch({ type: 'INV_CONFIRM_SUCCESS', id: inv.id, fields });
      } catch (err) {
        dispatch({
          type: 'INV_CONFIRM_FAILED',
          id: inv.id,
          message:
            err instanceof ApiError
              ? err.message
              : 'Could not confirm this invoice. Please try again.',
        });
        return;
      }
    }
    if (hitlIndex + 1 < nonDuplicates.length) {
      dispatch({ type: 'HITL_INDEX_SET', index: hitlIndex + 1 });
    } else {
      dispatch({ type: 'PIPELINE_INDEX_SET', index: 0 });
      dispatch({ type: 'PHASE_SET', phase: 'pipeline' });
    }
  };

  /* ── Steps 3+: per-invoice match-type -> supporting docs -> review ── */
  const currentPipelineInvoice = nonDuplicates[pipelineIndex];

  const setMatchType = (id, matchType, matchParams) =>
    dispatch({ type: 'INV_MATCH_TYPE_SET', id, matchType, matchParams });

  const pipelineDocSteps = currentPipelineInvoice
    ? DOC_TYPES.filter((d) => currentPipelineInvoice.matchParams[d.id])
    : [];
  // Sequence within one invoice's pipeline: 0 = match-type select, then one
  // slot per required doc type (in DOC_TYPES order), then review.
  const pipelineStepIndex = currentPipelineInvoice?.pipelineStepIndex ?? 0;

  const updateInvDoc = (invId, docId, updates) =>
    dispatch({ type: 'INV_DOC_UPDATED', id: invId, docId, updates });

  const handleInvDocFileSelected = async (invId, docId, file) => {
    dispatch({ type: 'INV_DOC_UPLOAD_STARTED', id: invId, docId, file });

    const digitizeType = DOC_ID_TO_DIGITIZE_TYPE[docId];
    if (!digitizeType) {
      dispatch({
        type: 'INV_DOC_UPLOAD_FAILED',
        id: invId,
        docId,
        message: "This document type isn't supported by the backend yet.",
      });
      return;
    }

    try {
      const res = await digitizeDocument(file, digitizeType, { debug: true });
      const fields = DOC_ID_TO_MAPPER[docId](res);
      dispatch({
        type: 'INV_DOC_UPLOAD_SUCCESS',
        id: invId,
        docId,
        documentId: null,
        fields,
        confidence: null,
        lineItems: [],
        fieldReview: buildFieldReview(fields, `${invId}-${docId}`),
        pageCount: null,
        uploadedAt: new Date().toISOString(),
        rawDigitization: res,
      });
    } catch (err) {
      dispatch({
        type: 'INV_DOC_UPLOAD_FAILED',
        id: invId,
        docId,
        message:
          err instanceof ApiError
            ? err.message
            : `Failed to process ${docId} upload.`,
      });
    }
  };

  const confirmInvDocAndContinue = async (invId, docId) => {
    const inv = invoices.find((i) => i.id === invId);
    const doc = inv.docStates[docId];
    if (!doc.documentId)
      return dispatch({ type: 'INV_STEP_ADVANCED', id: invId });
    dispatch({ type: 'INV_DOC_CONFIRM_STARTED', id: invId, docId });
    try {
      await confirmDocument(doc.documentId, { fields: doc.extractedData });
      dispatch({ type: 'INV_DOC_CONFIRM_SUCCESS', id: invId, docId });
    } catch (err) {
      dispatch({
        type: 'INV_DOC_CONFIRM_FAILED',
        id: invId,
        docId,
        message:
          err instanceof ApiError
            ? err.message
            : 'Could not confirm this document. Please try again.',
      });
    }
  };

  const submitInvoiceReconciliation = async (invId) => {
    const inv = invoices.find((i) => i.id === invId);
    dispatch({ type: 'INV_FINALIZE_STARTED', id: invId });
    let st = 0;
    const processingSteps = [
      'Extracting',
      'Matching Engine',
      'Validating Allowances',
      'SLA / Fraud Check',
      'Finalizing Decision',
    ];
    const interval = setInterval(() => {
      st = Math.min(st + 1, processingSteps.length - 1);
      dispatch({ type: 'INV_FINALIZE_PROGRESS', id: invId, stage: st });
    }, 700);

    const poRaw = inv.docStates.po?.rawDigitization;
    const grnRaw = inv.docStates.grn?.rawDigitization;
    const slaRaw = inv.docStates.contracts?.rawDigitization;

    try {
      const result = await reconcileDocuments({
        digitization_output: inv.rawDigitization,
        po_data: poRaw?.po_data || {},
        receipt_doc_text: grnRaw?.receipt_doc || {},
        sla_doc_text: slaRaw?.audit_trail?.raw_ocr_text || '',
        sla_data: slaRaw?.sla_data || {},
        acceptance_data: {},
        tax_rate: inv.review.taxRate,
      });
      clearInterval(interval);

      if (result.status === 'misupload_detected') {
        dispatch({
          type: 'INV_FINALIZE_FAILED',
          id: invId,
          message:
            (result.messages || []).join(' ') ||
            'A supporting document does not match this invoice.',
        });
        return;
      }

      dispatch({
        type: 'INV_FINALIZE_SUCCESS',
        id: invId,
        stage: processingSteps.length,
        reconciliationResult: result,
      });
      setTimeout(() => {
        if (pipelineIndex + 1 < nonDuplicates.length) {
          dispatch({ type: 'PIPELINE_INDEX_SET', index: pipelineIndex + 1 });
        } else {
          dispatch({ type: 'PHASE_SET', phase: 'complete' });
        }
      }, 800);
    } catch (err) {
      clearInterval(interval);
      dispatch({
        type: 'INV_FINALIZE_FAILED',
        id: invId,
        message:
          err instanceof ApiError
            ? err.message
            : 'Could not run this reconciliation. Please try again.',
      });
    }
  };

  const renderInvDocStep = (
    invId,
    docId,
    title,
    desc,
    targetRefText,
    formats = ['PDF'],
  ) => {
    const inv = invoices.find((i) => i.id === invId);
    const dt = DOC_TYPES.find((d) => d.id === docId);
    return (
      <DocumentUploadStep
        key={`${invId}-${docId}`}
        docId={docId}
        title={title}
        desc={desc}
        icon={dt?.icon}
        targetRefText={targetRefText}
        formats={formats}
        doc={inv.docStates[docId]}
        invoiceData={inv.extractedData}
        onFieldChange={(key, value) =>
          updateInvDoc(invId, docId, {
            extractedData: {
              ...inv.docStates[docId].extractedData,
              [key]: value,
            },
          })
        }
        nextStepLabel={
          pipelineStepIndex + 1 <= pipelineDocSteps.length
            ? (pipelineDocSteps[pipelineStepIndex]?.label ?? 'Review')
            : 'Review'
        }
        onFileSelect={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (!f.name.toLowerCase().endsWith('.pdf'))
              return dispatch({
                type: 'ERROR_SET',
                message: 'Only PDF files are supported.',
              });
            handleInvDocFileSelected(invId, docId, f);
          }
        }}
        onSourceChange={(source) => updateInvDoc(invId, docId, { source })}
        onRemoveFile={() =>
          updateInvDoc(invId, docId, {
            file: null,
            documentId: null,
            extractedData: null,
            extractionConfidence: null,
            lineItems: [],
            fieldReview: null,
            resolvedFlags: [],
            pageCount: null,
            uploadedAt: null,
          })
        }
        onFetch={() => {
          updateInvDoc(invId, docId, { fetching: true });
          setTimeout(
            () =>
              updateInvDoc(invId, docId, { fetching: false, fetched: true }),
            1500,
          );
        }}
        onJumpToNextFlag={() => {}}
        onConfirmFlag={(key) =>
          dispatch({ type: 'INV_DOC_FLAG_CONFIRMED', id: invId, docId, key })
        }
        registerFieldRef={() => () => {}}
        onBack={() => dispatch({ type: 'INV_STEP_BACK', id: invId })}
        onContinue={() =>
          inv.docStates[docId].source === 'manual' && inv.docStates[docId].file
            ? confirmInvDocAndContinue(invId, docId)
            : dispatch({ type: 'INV_STEP_ADVANCED', id: invId })
        }
      />
    );
  };

  return (
    <>
      <header className='topbar'>
        <h1 className='topbar__title'>New AI Reconciliation</h1>
      </header>

      <div
        className='ud-content'
        style={{
          padding: '1.4rem 1.75rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'var(--tint-danger-bg)',
              borderLeft: '4px solid #ef4444',
              padding: '12px 16px',
              color: 'var(--tint-danger-text)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '1.5rem',
              width: '100%',
              maxWidth: '1180px',
            }}
          >
            ⚠ {error}
          </motion.div>
        )}

        <div
          style={{ width: '100%', maxWidth: '1180px', position: 'relative' }}
        >
          <AnimatePresence mode='wait'>
            {phase === 'batch' && (
              <BatchUploadStep
                invoices={invoices}
                onFilesSelected={handleFilesSelected}
                onRemove={handleRemoveInvoice}
                onContinue={goToHitl}
                canContinue={anyClearedReady && !anyBusy}
                busy={anyBusy}
                language={ocrLanguage}
                onLanguageChange={setOcrLanguage}
              />
            )}

            {phase === 'hitl' && currentHitlInvoice && (
              <InvoiceHitlStep
                invoice={currentHitlInvoice}
                index={hitlIndex}
                total={nonDuplicates.length}
                onFieldChange={(key, value) =>
                  dispatch({
                    type: 'INV_FIELD_EDITED',
                    id: currentHitlInvoice.id,
                    key,
                    value,
                  })
                }
                onLineItemChange={(index, key, value) =>
                  dispatch({
                    type: 'INV_LINE_ITEM_CHANGED',
                    id: currentHitlInvoice.id,
                    index,
                    key,
                    value,
                  })
                }
                onLineItemAdd={() =>
                  dispatch({
                    type: 'INV_LINE_ITEM_ADDED',
                    id: currentHitlInvoice.id,
                  })
                }
                onLineItemRemove={(index) =>
                  dispatch({
                    type: 'INV_LINE_ITEM_REMOVED',
                    id: currentHitlInvoice.id,
                    index,
                  })
                }
                onNotesChange={(value) =>
                  dispatch({
                    type: 'INV_NOTES_CHANGED',
                    id: currentHitlInvoice.id,
                    value,
                  })
                }
                onAcceptAlt={(key) =>
                  dispatch({
                    type: 'INV_FLAG_CONFIRMED',
                    id: currentHitlInvoice.id,
                    key,
                  })
                }
                onConfirmAndContinue={confirmHitlAndContinue}
                onBackToUpload={() =>
                  dispatch({ type: 'PHASE_SET', phase: 'batch' })
                }
              />
            )}

            {phase === 'pipeline' &&
              currentPipelineInvoice &&
              pipelineStepIndex === 0 && (
                <MatchTypeSelectStep
                  invoice={currentPipelineInvoice}
                  index={pipelineIndex}
                  total={nonDuplicates.length}
                  onSelect={(matchType, matchParams) =>
                    setMatchType(
                      currentPipelineInvoice.id,
                      matchType,
                      matchParams,
                    )
                  }
                  onContinue={(matchType) => {
                    if (!currentPipelineInvoice.matchType)
                      setMatchType(
                        currentPipelineInvoice.id,
                        matchType,
                        matchParamsForType(matchType),
                      );
                    dispatch({
                      type: 'INV_STEP_ADVANCED',
                      id: currentPipelineInvoice.id,
                    });
                  }}
                  onBack={() => dispatch({ type: 'PHASE_SET', phase: 'hitl' })}
                />
              )}

            {phase === 'pipeline' &&
              currentPipelineInvoice &&
              pipelineStepIndex >= 1 &&
              pipelineStepIndex <= pipelineDocSteps.length &&
              (() => {
                const dt = pipelineDocSteps[pipelineStepIndex - 1];
                return renderInvDocStep(
                  currentPipelineInvoice.id,
                  dt.id,
                  dt.title,
                  dt.desc,
                  dt.targetRef(currentPipelineInvoice.extractedData),
                  dt.formats,
                );
              })()}

            {phase === 'pipeline' &&
              currentPipelineInvoice &&
              pipelineStepIndex > pipelineDocSteps.length && (
                <motion.div
                  key={`review-${currentPipelineInvoice.id}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className='ir-card'
                  style={{ padding: '3rem 2rem' }}
                >
                  <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <h2
                      style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        color: 'var(--gray-900)',
                        marginBottom: '8px',
                      }}
                    >
                      Review & Confirm
                    </h2>
                    <p style={{ color: 'var(--gray-500)', fontSize: '15px' }}>
                      Invoice {pipelineIndex + 1} of {nonDuplicates.length} ·
                      Verify the package before running the AI reconciliation
                      pipeline.
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '2rem',
                      marginBottom: '3rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                      }}
                    >
                      <div
                        style={{
                          border: '1px solid var(--gray-200)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: 'var(--gray-800)',
                            marginBottom: '1rem',
                          }}
                        >
                          Extracted Metadata
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '12px',
                            fontSize: '13px',
                          }}
                        >
                          <div>
                            <span style={{ color: 'var(--gray-500)' }}>
                              Vendor:
                            </span>{' '}
                            <span style={{ fontWeight: 600 }}>
                              {
                                currentPipelineInvoice.extractedData
                                  ?.vendor_name
                              }
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--gray-500)' }}>
                              Invoice ID:
                            </span>{' '}
                            <span style={{ fontWeight: 600 }}>
                              {currentPipelineInvoice.extractedData?.doc_number}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--gray-500)' }}>
                              Target PO:
                            </span>{' '}
                            <span style={{ fontWeight: 600 }}>
                              {currentPipelineInvoice.extractedData?.po_ref}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--gray-500)' }}>
                              Amount:
                            </span>{' '}
                            <span style={{ fontWeight: 600 }}>
                              ${currentPipelineInvoice.extractedData?.total}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          border: '1px solid var(--gray-200)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: 'var(--gray-800)',
                            marginBottom: '1rem',
                          }}
                        >
                          Document Package ·{' '}
                          {
                            MATCH_TYPE_OPTIONS.find(
                              (o) => o.id === currentPipelineInvoice.matchType,
                            )?.label
                          }
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            fontSize: '13px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>Invoice</span>{' '}
                            <span style={{ color: '#10b981', fontWeight: 600 }}>
                              ✓ Attached
                            </span>
                          </div>
                          {DOC_TYPES.filter(
                            (d) => currentPipelineInvoice.matchParams[d.id],
                          ).map((d) => (
                            <div
                              key={d.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{d.checklistLabel}</span>
                              <span
                                style={{ color: '#10b981', fontWeight: 600 }}
                              >
                                ✓{' '}
                                {currentPipelineInvoice.docStates[
                                  d.id
                                ].source.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem',
                      }}
                    >
                      <div
                        style={{
                          border: '1px solid var(--gray-200)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          background: 'var(--gray-50)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: 'var(--gray-800)',
                            marginBottom: '1rem',
                          }}
                        >
                          Global Parameters
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--gray-700)',
                              marginBottom: '4px',
                            }}
                          >
                            Tax Rate (%)
                          </label>
                          <input
                            type='number'
                            value={currentPipelineInvoice.review.taxRate}
                            onChange={(e) =>
                              dispatch({
                                type: 'INV_TAX_RATE_CHANGED',
                                id: currentPipelineInvoice.id,
                                value: parseFloat(e.target.value),
                              })
                            }
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid var(--gray-300)',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--gray-700)',
                              marginBottom: '4px',
                            }}
                          >
                            Actual SLA Performance (%)
                          </label>
                          <input
                            type='number'
                            placeholder='e.g. 98.5'
                            value={currentPipelineInvoice.review.actualSla}
                            onChange={(e) =>
                              dispatch({
                                type: 'INV_SLA_CHANGED',
                                id: currentPipelineInvoice.id,
                                value: e.target.value,
                              })
                            }
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid var(--gray-300)',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                            }}
                          />
                        </div>
                      </div>

                      {currentPipelineInvoice.review.isFinalizing && (
                        <div
                          style={{
                            background: 'var(--primary-white)',
                            border: '1px solid var(--gray-200)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                          }}
                        >
                          {[
                            'Extracting',
                            'Matching Engine',
                            'Validating Allowances',
                            'SLA / Fraud Check',
                            'Finalizing Decision',
                          ].map((st, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '8px',
                                opacity:
                                  currentPipelineInvoice.review.processStage >=
                                  idx
                                    ? 1
                                    : 0.4,
                              }}
                            >
                              {currentPipelineInvoice.review.processStage >
                              idx ? (
                                <svg
                                  width='16'
                                  height='16'
                                  viewBox='0 0 24 24'
                                  fill='none'
                                  stroke='#10b981'
                                  strokeWidth='3'
                                >
                                  <polyline points='20 6 9 17 4 12'></polyline>
                                </svg>
                              ) : currentPipelineInvoice.review.processStage ===
                                idx ? (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 1,
                                    ease: 'linear',
                                  }}
                                  style={{
                                    width: 14,
                                    height: 14,
                                    border: '2px solid var(--gray-300)',
                                    borderTopColor: 'var(--primary-blue)',
                                    borderRadius: '50%',
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    border: '2px solid var(--gray-300)',
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color:
                                    currentPipelineInvoice.review.processStage >
                                    idx
                                      ? '#10b981'
                                      : currentPipelineInvoice.review
                                            .processStage === idx
                                        ? 'var(--primary-blue)'
                                        : 'var(--gray-500)',
                                }}
                              >
                                {st}...
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'INV_STEP_BACK',
                          id: currentPipelineInvoice.id,
                        })
                      }
                      disabled={currentPipelineInvoice.review.isFinalizing}
                      style={{
                        width: '140px',
                        background: 'var(--primary-white)',
                        color: 'var(--gray-700)',
                        padding: '16px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '16px',
                        border: '2px solid var(--gray-300)',
                        cursor: 'pointer',
                        opacity: currentPipelineInvoice.review.isFinalizing
                          ? 0.5
                          : 1,
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() =>
                        submitInvoiceReconciliation(currentPipelineInvoice.id)
                      }
                      disabled={currentPipelineInvoice.review.isFinalizing}
                      style={{
                        flex: 1,
                        background: currentPipelineInvoice.review.isFinalizing
                          ? 'var(--gray-400)'
                          : 'var(--primary-blue)',
                        color: 'white',
                        padding: '16px',
                        borderRadius: '12px',
                        fontWeight: 800,
                        fontSize: '16px',
                        border: 'none',
                        cursor: currentPipelineInvoice.review.isFinalizing
                          ? 'not-allowed'
                          : 'pointer',
                        transition: 'all 0.3s',
                      }}
                    >
                      {currentPipelineInvoice.review.isFinalizing
                        ? 'Processing Pipeline...'
                        : pipelineIndex + 1 < nonDuplicates.length
                          ? `Run Reconciliation & Continue to Invoice ${pipelineIndex + 2} →`
                          : 'Run AI Reconciliation'}
                    </button>
                  </div>
                </motion.div>
              )}

            {phase === 'complete' && (
              <motion.div
                key='complete'
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className='ir-card'
                style={{ padding: '3rem 2rem', textAlign: 'center' }}
              >
                <div
                  style={{
                    color: '#10b981',
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircleIcon />
                </div>
                <h2
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: 'var(--gray-900)',
                    marginBottom: '8px',
                  }}
                >
                  All {nonDuplicates.length} invoice
                  {nonDuplicates.length === 1 ? '' : 's'} reconciled
                </h2>
                <p
                  style={{
                    color: 'var(--gray-500)',
                    fontSize: '14px',
                    marginBottom: '2rem',
                  }}
                >
                  Each invoice ran through the matching pipeline independently.
                  Duplicates{' '}
                  {invoices.some((i) => i.status === 'duplicate')
                    ? `(${invoices.filter((i) => i.status === 'duplicate').length}) `
                    : ''}
                  were skipped.
                </p>
                <button
                  onClick={() =>
                    navigate(
                      invoices.find((i) => i.reconciliationId)
                        ? `/invoice-reconciliation/${invoices.find((i) => i.reconciliationId).reconciliationId}`
                        : '/invoice-reconciliation',
                    )
                  }
                  style={{
                    background: 'var(--primary-blue)',
                    color: 'white',
                    padding: '14px 28px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  View reconciliations →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
