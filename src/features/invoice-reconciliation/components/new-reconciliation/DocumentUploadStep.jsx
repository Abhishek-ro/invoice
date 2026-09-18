import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { toneClass } from './docMeta';

/*
 * Steps 3-7 of the New Reconciliation wizard — one shared step for
 * whichever document types Step 2 selected (PO / GRN / Quality / Service
 * Entry / Contracts). Same header language, tone colour and footer as
 * Step 2 (MatchingStrategyStep) so the wizard reads as one system instead
 * of "the nice step" followed by four plain ones.
 *
 * Everything under the extracted-fields review (comparisonRows,
 * checksumOk, labelFor/captionFor, fieldEntries) is unchanged business
 * logic lifted from the old renderDocStep — this file only reskins the
 * chrome around it (header, source toggle, empty states, footer).
 */

const FETCH_SOURCES = [
  { id: 'manual', label: 'Manual Upload' },
  { id: 'erp', label: 'Fetch from ERP' },
];

const SKELETON_LINE_WIDTHS = [88, 72, 95, 50, 82, 65];

const UploadIcon = () => (
  <svg
    width='22'
    height='22'
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
);
const ErpIcon = () => (
  <svg
    width='18'
    height='18'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <ellipse cx='12' cy='5' rx='9' ry='3' />
    <path d='M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' />
    <path d='M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' />
  </svg>
);
const FileTextIcon = () => (
  <svg
    width='17'
    height='17'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
    <polyline points='14 2 14 8 20 8' />
    <line x1='16' y1='13' x2='8' y2='13' />
    <line x1='16' y1='17' x2='8' y2='17' />
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
    <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14' />
    <polyline points='22 4 12 14.01 9 11.01' />
  </svg>
);
const CheckIcon = ({ size = 11 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={3}
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <polyline points='20 6 9 17 4 12' />
  </svg>
);

const formatFileTypes = (formats) => {
  if (!formats || formats.length <= 1) return (formats && formats[0]) || 'PDF';
  return `${formats.slice(0, -1).join(', ')} or ${formats[formats.length - 1]}`;
};
const FORMAT_EXT = {
  PDF: '.pdf',
  CSV: '.csv',
  XLSX: '.xlsx',
  XLS: '.xls',
  DOC: '.doc',
  DOCX: '.docx',
  JPG: '.jpg,.jpeg',
  PNG: '.png',
};
const formatsToAccept = (formats) =>
  (formats && formats.length ? formats : ['PDF'])
    .map((f) => FORMAT_EXT[f] || '')
    .filter(Boolean)
    .join(',');
let lineRowSeq = 0;
const nextLineRowKey = () => `doc-ln-${++lineRowSeq}`;
const num = (v) => {
  const n =
    typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;
const rowAmount = (r) => round2(num(r.quantity) * num(r.unit_price));
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

export default function DocumentUploadStep({
  docId,
  title,
  desc,
  icon,
  targetRefText,
  formats = ['PDF'],
  doc,
  invoiceData,
  nextStepLabel,
  onFileSelect,
  onSourceChange,
  onRemoveFile,
  onFetch,
  onJumpToNextFlag,
  onConfirmFlag,
  onFieldChange,
  onLineItemChange,
  onLineItemAdd,
  onLineItemRemove,
  registerFieldRef,
  onBack,
  onContinue,
}) {
  const fileInputRef = useRef(null);
  const tone = toneClass(docId);

  const extracted = doc.extractedData;
  const norm = (v) => String(v).trim().toLowerCase();
  const docStamp = title.replace(/^Attach /, '');

  // This comparison is calculated independently for each extracted document.
  // "Compared to invoice" rows (left card, bottom) — text match on
  // supplier/reference, numeric diff on the money fields. Only shows a
  // row when both sides actually have a value to compare (GRN/quality
  // have no subtotal/tax/total in this data model, so those rows just
  // don't appear for those doc types).
  const comparisonRows = [];
  if (extracted?.vendor_name && invoiceData?.vendor_name) {
    const ok = norm(extracted.vendor_name) === norm(invoiceData.vendor_name);
    comparisonRows.push({
      label: 'Supplier',
      text: ok ? 'identical' : 'different',
      ok,
    });
  }
  if (targetRefText && extracted?.doc_number) {
    const ok = norm(extracted.doc_number) === norm(targetRefText);
    comparisonRows.push({
      label: 'Reference',
      text: ok ? 'identical' : `expected ${targetRefText}`,
      ok,
    });
  }
  [
    ['subtotal', 'Net amount'],
    ['tax_amount', 'Tax amount'],
    ['total', 'Total'],
  ].forEach(([key, label]) => {
    const a = extracted?.[key],
      b = invoiceData?.[key];
    if (typeof a === 'number' && typeof b === 'number') {
      const diff = Math.abs(a - b);
      comparisonRows.push({
        label,
        text: `${diff.toFixed(2)} ${diff < 0.01 ? 'match' : 'variance'}`,
        ok: diff < 0.01,
      });
    }
  });

  // Checksum sanity line under the fields grid — net + tax should equal
  // the total the document itself states. Only rendered when all three
  // are actually present (again, not true for GRN/quality).
  const checksumOk =
    typeof extracted?.subtotal === 'number' &&
    typeof extracted?.tax_amount === 'number' &&
    typeof extracted?.total === 'number'
      ? Math.abs(extracted.subtotal + extracted.tax_amount - extracted.total) <
        0.01
      : null;

  // PO gets its own field labels (matches the reference design exactly);
  // every other doc type falls back to generic ones built from the key.
  // buyer_name is PO-only (a PO has both a supplier and an internal
  // buyer/requester who raised it — invoices/GRNs/etc. have no such
  // concept, so this stays null for every other document type).
  const PO_LABELS = {
    doc_number: 'PO NUMBER',
    doc_date: 'PO DATE',
    total: 'ORDER VALUE',
    buyer_name: 'BUYER / REQUESTER',
  };
  const BASE_LABELS = {
    vendor_name: 'SUPPLIER',
    subtotal: 'NET AMOUNT',
    tax_amount: 'TAX AMOUNT',
    currency: 'CURRENCY',
    total: 'TOTAL',
  };
  const labelFor = (key) =>
    (docId === 'po' && PO_LABELS[key]) ||
    BASE_LABELS[key] ||
    key.replace(/_/g, ' ').toUpperCase();
  const captionFor = (f) => {
    if (f.flagged) return f.reason;
    switch (f.key) {
      case 'doc_number':
      case 'doc_date':
      case 'buyer_name':
        return 'Header, page 1';
      case 'vendor_name':
        return invoiceData?.vendor_name &&
          norm(invoiceData.vendor_name) === norm(f.value)
          ? 'Vendor record — matches invoice'
          : 'Header, page 1';
      case 'currency':
        return 'Document currency';
      case 'subtotal':
        return doc.lineItems?.length
          ? `Sum of ${doc.lineItems.length} order line${doc.lineItems.length === 1 ? '' : 's'}`
          : 'Header total';
      case 'tax_amount':
        return typeof extracted.subtotal === 'number' && extracted.subtotal > 0
          ? `${((extracted.tax_amount / extracted.subtotal) * 100).toFixed(1)}%`
          : 'Header total';
      case 'total':
        return 'Order footer';
      default:
        return '';
    }
  };

  // The right-column grid: one card per real extracted field (skips
  // nulls — GRN/quality legitimately have no subtotal/tax/total, and
  // buyer_name is null outside 'po'), each carrying its generated
  // confidence/flag from doc.fieldReview. buyer_name sits right after
  // vendor_name so PO's grid reads PO NUMBER/PO DATE, SUPPLIER/BUYER —
  // matching the reference design's row order.
  const fieldEntries = extracted
    ? [
        'doc_number',
        'doc_date',
        'vendor_name',
        'buyer_name',
        'currency',
        'subtotal',
        'tax_amount',
        'total',
      ]
        .filter((k) => extracted[k] !== null && extracted[k] !== undefined)
        .map((key) => {
          const r = doc.fieldReview?.[key];
          return {
            key,
            label: labelFor(key),
            value: extracted[key],
            confidence: r?.confidence ?? doc.extractionConfidence ?? null,
            flagged: !!r?.flagged && !doc.resolvedFlags?.includes(key),
            reason: r?.reason,
            alt: r?.alt,
          };
        })
    : [];
  fieldEntries.forEach((f) => {
    f.caption = captionFor(f);
  });
  const needsConfirmationCount = fieldEntries.filter((f) => f.flagged).length;
  const dateFlagged = fieldEntries.find((f) => f.key === 'doc_date')?.flagged;
  const vendorFlagged = fieldEntries.find(
    (f) => f.key === 'vendor_name',
  )?.flagged;
  const buyerFlagged = fieldEntries.find(
    (f) => f.key === 'buyer_name',
  )?.flagged;
  const displayVal = (f) =>
    ['subtotal', 'tax_amount', 'total'].includes(f.key) &&
    typeof f.value === 'number'
      ? f.value.toFixed(2)
      : f.value;

  const continueDisabled =
    (doc.source === 'manual' &&
      (!doc.file || doc.confirming || doc.submitting)) ||
    (doc.source !== 'manual' && !doc.fetched);

  return (
    <motion.div
      key={docId}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`ir-doc ${tone}`}
    >
      <div className='ir-ms__head'>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span className='ir-ms-doc__icon' style={{ width: 40, height: 40 }}>
            {icon}
          </span>
          <div>
            <h2 className='ir-ms__title'>{title}</h2>
            <p className='ir-ms__sub'>{desc}</p>
            {targetRefText && (
              <div className='ir-doc-target'>
                Targeting <strong>{targetRefText}</strong>
              </div>
            )}
          </div>
        </div>
        {invoiceData?.doc_number && (
          <div className='ir-ms__inv' title='Invoice being reconciled'>
            <span className='ir-ms__inv-icon'>
              <FileTextIcon />
            </span>
            <span className='ir-ms__inv-text'>
              <strong>{invoiceData.doc_number}</strong>
              <span className='ir-ms__inv-sep'>·</span>
              <span className='ir-ms__inv-vendor'>
                {invoiceData.vendor_name || 'Unknown vendor'}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className='ir-doc__body'>
        <div
          className='ir-doc-source'
          role='radiogroup'
          aria-label='Document source'
        >
          {FETCH_SOURCES.map((s) => (
            <button
              key={s.id}
              type='button'
              role='radio'
              aria-checked={doc.source === s.id}
              className={`ir-doc-source__btn${doc.source === s.id ? ' is-active' : ''}`}
              onClick={() => onSourceChange(s.id)}
            >
              {s.id === 'manual' ? <UploadIcon /> : <ErpIcon />}
              {s.label}
            </button>
          ))}
        </div>

        {doc.error && (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--tint-danger-text)',
              background: 'var(--tint-danger-bg)',
              border: '1px solid var(--tint-danger-border)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '12px',
            }}
          >
            {doc.error}
          </div>
        )}

        {doc.source === 'manual' ? (
          <>
            {/* Hoisted so "Replace file" can re-click a live input — nested
                inside doc.file's branch it would unmount the instant the
                dropzone swaps out and silently do nothing. */}
            <input
              type='file'
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={formatsToAccept(formats)}
              onChange={onFileSelect}
            />
            {doc.file ? (
              doc.confirming ? (
                <div className='ir-doc-loading'>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: 'linear',
                    }}
                    className='ir-doc-spinner'
                  />
                  <div className='ir-doc-loading__text'>
                    Extracting {doc.file.name}…
                  </div>
                </div>
              ) : (
                // Two equal-height columns (grid's default row stretch) — the
                // document card on the left and the fields-review panel on the
                // right stay the same length as each other regardless of how
                // much either one has to show.
                <motion.div
                  initial={{ scale: 0.97, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className='ir-doc-review'
                >
                  {/* LEFT — the document itself: header, a real preview built
                      from its own extracted fields/line items (not a generic
                      skeleton), pagination, file actions, and how it stacks up
                      against the invoice. */}
                  <div className='ir-doc-card'>
                    <div className='ir-doc-card__head'>
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          minWidth: 0,
                        }}
                      >
                        <span
                          className='ir-ms-doc__icon'
                          style={{ width: 32, height: 32, flexShrink: 0 }}
                        >
                          <FileTextIcon />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className='ir-doc-card__filename'>
                            {extracted?.doc_number || doc.file.name} · Manual
                            Upload
                          </div>
                          <div className='ir-doc-card__meta'>
                            Uploaded · {formatTime(doc.uploadedAt)}
                          </div>
                        </div>
                      </div>
                      <span className='ir-ms-chip ir-ms-chip--ok'>
                        <CheckIcon /> PROCESSED
                      </span>
                    </div>

                    {extracted ? (
                      <div className='ir-doc-card__body'>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 10,
                            marginBottom: 12,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 15,
                              color: 'var(--gray-900)',
                            }}
                          >
                            {extracted.vendor_name}
                          </div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: 11,
                              color: 'var(--gray-400)',
                              letterSpacing: '0.5px',
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {docStamp.toUpperCase()}
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '6px 14px',
                            fontSize: 12,
                            color: 'var(--gray-700)',
                            paddingBottom: 12,
                            marginBottom: 12,
                            borderBottom: '1px dashed var(--gray-200)',
                          }}
                        >
                          <div>
                            No. <strong>{extracted.doc_number}</strong>
                          </div>
                          <div>
                            Issued{' '}
                            <strong
                              style={
                                dateFlagged
                                  ? {
                                      background: 'var(--tint-warning-bg)',
                                      padding: '1px 4px',
                                      borderRadius: 3,
                                    }
                                  : undefined
                              }
                            >
                              {extracted.doc_date}
                            </strong>
                          </div>
                          {/* Buyer only exists on POs — Supplier spans the full
                              row for every other doc type, same as before. */}
                          <div
                            style={{
                              gridColumn: extracted.buyer_name
                                ? 'auto'
                                : '1 / -1',
                            }}
                          >
                            Supplier{' '}
                            <strong
                              style={
                                vendorFlagged
                                  ? {
                                      background: 'var(--tint-warning-bg)',
                                      padding: '1px 4px',
                                      borderRadius: 3,
                                    }
                                  : undefined
                              }
                            >
                              {extracted.vendor_name}
                            </strong>
                          </div>
                          {extracted.buyer_name && (
                            <div>
                              Buyer{' '}
                              <strong
                                style={
                                  buyerFlagged
                                    ? {
                                        background: 'var(--tint-warning-bg)',
                                        padding: '1px 4px',
                                        borderRadius: 3,
                                      }
                                    : undefined
                                }
                              >
                                {extracted.buyer_name}
                              </strong>
                            </div>
                          )}
                        </div>
                        {doc.lineItems?.length > 0 && (
                          <div
                            className='ir-inv-items'
                            style={{ marginBottom: 12 }}
                          >
                            <div className='ir-inv-items__head'>
                              <span className='ir-inv-items__title'>
                                Line items
                              </span>
                              <span className='ir-inv-items__count'>
                                {doc.lineItems.length} line
                                {doc.lineItems.length === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div className='ir-inv-tablewrap'>
                              <table className='ir-inv-table'>
                                <thead>
                                  <tr>
                                    <th className='ir-inv-th--item'>
                                      Item / Description
                                    </th>
                                    <th className='ir-inv-th--num'>Quantity</th>
                                    <th className='ir-inv-th--num'>
                                      Unit Rate
                                    </th>
                                    <th className='ir-inv-th--num'>Amount</th>
                                    <th
                                      className='ir-inv-th--act'
                                      aria-label='Remove row'
                                    />
                                  </tr>
                                </thead>
                                <tbody>
                                  {doc.lineItems.map((row, i) => (
                                    <tr key={row.rowKey || nextLineRowKey()}>
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
                                            onLineItemChange(
                                              i,
                                              'sku',
                                              e.target.value,
                                            )
                                          }
                                        />
                                      </td>
                                      <td>
                                        <input
                                          className='ir-inv-cell ir-inv-cell--num'
                                          inputMode='decimal'
                                          value={row.quantity}
                                          onChange={(e) =>
                                            onLineItemChange(
                                              i,
                                              'quantity',
                                              e.target.value,
                                            )
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
                                        {rowAmount(row).toFixed(2)}
                                      </td>
                                      <td className='ir-inv-td--act'>
                                        <button
                                          type='button'
                                          className='ir-inv-rowdel'
                                          title='Remove this line'
                                          disabled={doc.lineItems.length === 1}
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
                                <strong>
                                  {doc.lineItems
                                    .reduce(
                                      (sum, line) => sum + rowAmount(line),
                                      0,
                                    )
                                    .toFixed(2)}
                                </strong>
                              </div>
                            </div>
                          </div>
                        )}
                        {typeof extracted.total === 'number' && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--gray-700)',
                              borderTop: '1px solid var(--gray-100)',
                              paddingTop: 10,
                            }}
                          >
                            {typeof extracted.subtotal === 'number' && (
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span>Net</span>
                                <span>{extracted.subtotal.toFixed(2)}</span>
                              </div>
                            )}
                            {typeof extracted.tax_amount === 'number' && (
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <span>Tax</span>
                                <span>{extracted.tax_amount.toFixed(2)}</span>
                              </div>
                            )}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontWeight: 800,
                                color: 'var(--gray-900)',
                                marginTop: 4,
                              }}
                            >
                              <span>{labelFor('total')}</span>
                              <span>{extracted.total.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className='ir-doc-card__skeleton'>
                        {SKELETON_LINE_WIDTHS.map((w, i) => (
                          <div
                            key={i}
                            style={{
                              height: 7,
                              width: `${w}%`,
                              background: 'var(--gray-200)',
                              borderRadius: 4,
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {doc.pageCount > 1 && (
                      <div style={{ padding: '0 16px 14px' }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--gray-500)',
                            marginBottom: 6,
                          }}
                        >
                          Page 1 of {doc.pageCount}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {Array.from({ length: doc.pageCount }).map((_, i) => (
                            <div
                              key={i}
                              style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                background:
                                  i === 0
                                    ? 'var(--primary-blue)'
                                    : 'var(--gray-200)',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      style={{ display: 'flex', gap: 8, margin: '0 16px 16px' }}
                    >
                      <button
                        type='button'
                        onClick={() => fileInputRef.current?.click()}
                        className='ir-ms-btn-back'
                        style={{ flex: 1, padding: '9px', fontSize: 13 }}
                      >
                        Replace file
                      </button>
                      <button
                        type='button'
                        onClick={onRemoveFile}
                        className='ir-doc-btn-danger'
                      >
                        Remove file
                      </button>
                    </div>
                  </div>

                  {/* RIGHT — every real extracted field as its own card, with
                      a generated confidence score and (for the flagged ones)
                      an alternate reading you can accept in one click. */}
                  <div className='ir-doc-card'>
                    <div
                      className='ir-doc-card__head'
                      style={{ flexWrap: 'wrap' }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: 'var(--gray-900)',
                          }}
                        >
                          {docStamp} fields
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--gray-500)',
                            marginTop: 2,
                          }}
                        >
                          Click a field to see where it came from on the
                          document.
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexShrink: 0,
                        }}
                      >
                        {needsConfirmationCount > 0 && (
                          <span className='ir-ms-chip ir-ms-chip--warn'>
                            {needsConfirmationCount} of {fieldEntries.length}{' '}
                            need confirmation
                          </span>
                        )}
                        <button
                          type='button'
                          onClick={onJumpToNextFlag}
                          disabled={needsConfirmationCount === 0}
                          className='ir-doc-jump'
                        >
                          Jump to next →
                        </button>
                      </div>
                    </div>

                    <div className='ir-doc-fields'>
                      {fieldEntries.map((f) => (
                        <div
                          key={f.key}
                          ref={registerFieldRef(f.key)}
                          className={`ir-doc-field${f.flagged ? ' is-flagged' : ''}`}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                color: f.flagged
                                  ? 'var(--tint-warning-text)'
                                  : 'var(--gray-500)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {f.flagged && '⚠'} {f.label}
                            </span>
                            {f.confidence != null && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: f.flagged
                                    ? 'var(--tint-warning-text)'
                                    : 'var(--gray-400)',
                                }}
                              >
                                {f.confidence}%
                              </span>
                            )}
                          </div>
                          <input
                            className='ir-doc-field__value'
                            style={{ width: '100%' }}
                            value={displayVal(f) ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const isMoney = [
                                'subtotal',
                                'tax_amount',
                                'total',
                              ].includes(f.key);
                              onFieldChange(
                                f.key,
                                isMoney
                                  ? raw === ''
                                    ? null
                                    : Number(raw)
                                  : raw,
                              );
                            }}
                          />
                          {f.caption && (
                            <div
                              style={{
                                fontSize: 11,
                                color: f.flagged
                                  ? 'var(--tint-warning-text)'
                                  : 'var(--gray-400)',
                                marginTop: 4,
                              }}
                            >
                              {f.caption}
                            </div>
                          )}
                          {f.flagged && f.alt !== undefined && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                marginTop: 6,
                              }}
                            >
                              <code className='ir-doc-field__alt'>
                                alt:{' '}
                                {f.key === 'total' ||
                                f.key === 'subtotal' ||
                                f.key === 'tax_amount'
                                  ? Number(f.alt).toFixed(2)
                                  : f.alt}
                              </code>
                              <button
                                type='button'
                                onClick={() => onConfirmFlag(f.key)}
                                className='ir-doc-field__confirm'
                              >
                                Confirm
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {!fieldEntries.length && (
                        <div
                          style={{
                            gridColumn: '1 / -1',
                            fontSize: 13,
                            color: 'var(--gray-400)',
                          }}
                        >
                          No fields extracted from this document.
                        </div>
                      )}
                    </div>

                    {checksumOk !== null && (
                      <div
                        className={`ir-doc-checksum ${checksumOk ? 'is-ok' : 'is-bad'}`}
                      >
                        {checksumOk ? '✓' : '⚠'} Net + tax{' '}
                        {checksumOk ? 'equals' : "doesn't equal"} order value —{' '}
                        {extracted.subtotal.toFixed(2)} +{' '}
                        {extracted.tax_amount.toFixed(2)} ={' '}
                        {extracted.total.toFixed(2)}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            ) : (
              <div
                className='ir-doc-drop'
                onClick={() => fileInputRef.current?.click()}
              >
                <span className='ir-doc-drop__icon'>
                  <UploadIcon />
                </span>
                <div className='ir-doc-drop__title'>
                  Drop {formatFileTypes(formats)} here, or click to browse
                </div>
                <div className='ir-doc-drop__sub'>
                  Manually upload a {docStamp.toLowerCase()}
                </div>
                <div className='ir-doc-drop__formats'>
                  {formats.map((f) => (
                    <span key={f} className='ir-ms-chip ir-ms-chip--muted'>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className='ir-doc-erp'>
            {!doc.fetched ? (
              doc.fetching ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: 'linear',
                    }}
                    className='ir-doc-spinner'
                    style={{ marginBottom: 16 }}
                  />
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--gray-800)',
                    }}
                  >
                    Connecting to ERP API...
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <button
                    onClick={onFetch}
                    className='ir-ms-btn-next'
                    style={{ padding: '13px 26px' }}
                  >
                    <ErpIcon /> Scan ERP Now
                  </button>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--gray-400)',
                      fontStyle: 'italic',
                    }}
                  >
                    Last synced: 2 min ago
                  </div>
                </div>
              )
            ) : (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                style={{
                  color: 'var(--tint-success-text)',
                  fontWeight: 700,
                  fontSize: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    color: '#10b981',
                    background: 'var(--tint-success-bg)',
                    padding: 16,
                    borderRadius: '50%',
                  }}
                >
                  <CheckCircleIcon />
                </div>
                Success! Found matching document in ERP
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--gray-600)',
                    fontWeight: 600,
                  }}
                >
                  Attached: Match_Found.pdf
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <div className='ir-ms__foot'>
        <button type='button' onClick={onBack} className='ir-ms-btn-back'>
          ← Back
        </button>
        <div className='ir-ms__foot-meta'>
          {doc.source === 'manual' && doc.file && needsConfirmationCount > 0
            ? `${needsConfirmationCount} flagged field${needsConfirmationCount === 1 ? '' : 's'} still unconfirmed`
            : ''}
        </div>
        <button
          type='button'
          onClick={onContinue}
          disabled={continueDisabled}
          className='ir-ms-btn-next'
        >
          {doc.submitting
            ? 'Confirming…'
            : `Continue to ${(nextStepLabel || 'next step').toLowerCase()} →`}
        </button>
      </div>
    </motion.div>
  );
}
