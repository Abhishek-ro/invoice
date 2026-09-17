import { Router } from 'express';
import multer from 'multer';
import { documents, documentHashes, genId, nowISO } from '../lib/db.js';
import { fakeExtract } from '../lib/extractor.js';
import { Errors, asyncRoute } from '../lib/errors.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Best-effort reconstruction of 01-SCOPE.md's DOC_TYPES.accepts table — that
// doc wasn't available while building this mock, only 04-API-CONTRACT.md
// (which references it but doesn't repeat the full list). Cross-check this
// against the real 01 §Upload table and adjust if it's wrong; the
// enforcement mechanism (415 unsupported_file_type, server re-checks what
// the client already guards) matches 04 §B.1.1 exactly either way.
const ACCEPTS = {
  invoice: ['.pdf'],
  po: ['.pdf', '.csv', '.xlsx'],
  grn: ['.pdf', '.csv', '.xlsx'],
  quality: ['.pdf'],
  service_entry: ['.pdf'],
  contract: ['.pdf'],
};
const DOCUMENT_TYPES = Object.keys(ACCEPTS);

function extOf(filename) {
  const i = filename.lastIndexOf('.');
  return i === -1 ? '' : filename.slice(i).toLowerCase();
}

const router = Router();

// Minimal, self-contained duplicate-invoice check, added alongside the
// §B.1.1/§B.1.2 contract endpoints (not part of that doc — this is new).
// Frontend computes a SHA-256 hex digest of the raw invoice file bytes
// (Web Crypto, client-side) and posts it here BEFORE calling POST
// /documents, so a duplicate never even reaches extraction. Storage is
// just another Map in lib/db.js (documentHashes), matching the
// in-memory-store pattern the rest of this mock backend already uses.
//
// POST /api/v1/documents/check-hash
//   body: { hash: string, filename?: string }
//   200: { duplicate: false }
//   200: { duplicate: true, match: { document_id, original_filename, processed_at } }
router.post(
  '/documents/check-hash',
  asyncRoute(async (req, res) => {
    const { hash } = req.body ?? {};
    if (!hash || typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) {
      throw Errors.malformedRequest('hash is required and must be a sha256 hex digest.', { received: hash });
    }
    const existing = documentHashes.get(hash.toLowerCase());
    if (!existing) {
      return res.status(200).json({ duplicate: false });
    }
    res.status(200).json({ duplicate: true, match: existing });
  })
);

// §B.1.1 POST /documents
router.post(
  '/documents',
  upload.single('file'),
  asyncRoute(async (req, res) => {
    const documentType = req.body?.document_type;
    if (!documentType || !DOCUMENT_TYPES.includes(documentType)) {
      throw Errors.malformedRequest('document_type is required and must be a known document type.', { received: documentType });
    }
    if (!req.file) {
      throw Errors.malformedRequest('file is required.');
    }

    const ext = extOf(req.file.originalname);
    const accepts = ACCEPTS[documentType];
    if (!accepts.includes(ext)) {
      throw Errors.unsupportedFileType(`${ext || '(no extension)'} is not accepted for ${documentType}.`, {
        document_type: documentType,
        received: ext,
        accepts,
      });
    }

    const id = genId();
    const createdAt = nowISO();

    // §A.1.1 — 'contract' has extract:false, Node stores the file and
    // never calls Python. §F.4: extraction_status 'manual' for this case.
    if (documentType === 'contract') {
      const doc = {
        id,
        document_type: documentType,
        source: 'upload',
        original_filename: req.file.originalname,
        mime_type: req.file.mimetype,
        byte_size: req.file.size,
        page_count: null,
        extraction_status: 'manual',
        extraction_confidence: null,
        extraction_error: null,
        extracted_at: null,
        confirmed_at: null,
        fields: { vendor_name: null, doc_number: null, doc_date: null, po_ref: null, buyer_name: null, subtotal: null, tax_amount: null, total: null, currency: null },
        line_items: [],
        warnings: [],
        created_at: createdAt,
      };
      documents.set(id, doc);
      return res.status(201).json(doc);
    }

    // Every other type: Node "calls Python" (fakeExtract stands in for
    // that HTTP call — see lib/extractor.js's header comment). §A.4's
    // failure table always returns 201 to the browser regardless of what
    // extraction did; this mock always succeeds, so extraction_status is
    // always 'extracted'. If you want to exercise the degraded/'failed'
    // path in the UI, that's the one thing this mock doesn't simulate —
    // add a random failure chance here if you need to test that branch.
    const extraction = fakeExtract({ documentType, filename: req.file.originalname });
    const doc = {
      id,
      document_type: documentType,
      source: 'upload',
      original_filename: req.file.originalname,
      mime_type: req.file.mimetype,
      byte_size: req.file.size,
      page_count: extraction.page_count,
      extraction_status: 'extracted',
      extraction_confidence: extraction.confidence,
      extraction_error: null,
      extracted_at: createdAt,
      confirmed_at: null,
      fields: extraction.fields,
      line_items: extraction.line_items.map((li) => ({ id: genId(), ...li })),
      warnings: extraction.warnings,
      created_at: createdAt,
    };
    documents.set(id, doc);

    // Record the hash (if the client sent one) so a later identical
    // upload is caught by POST /documents/check-hash. Only invoices
    // participate in duplicate detection.
    const fileHash = req.body?.file_hash;
    if (documentType === 'invoice' && fileHash && typeof fileHash === 'string' && /^[a-f0-9]{64}$/i.test(fileHash)) {
      documentHashes.set(fileHash.toLowerCase(), {
        document_id: id,
        original_filename: req.file.originalname,
        processed_at: createdAt,
      });
    }

    res.status(201).json(doc);
  })
);

// §B.1.2 PATCH /documents/:id — the confirm step.
router.patch(
  '/documents/:id',
  asyncRoute(async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc) throw Errors.notFound('No document with that id.', { id: req.params.id });

    const { fields, line_items } = req.body ?? {};
    if (fields) {
      const fieldErrors = {};
      if (fields.total !== undefined && fields.total !== null && typeof fields.total !== 'number') {
        fieldErrors.total = 'must be a number';
      }
      if (Object.keys(fieldErrors).length) throw Errors.validationFailed('Field validation failed.', { fields: fieldErrors });
      doc.fields = { ...doc.fields, ...fields, currency: doc.fields.currency }; // §B.1.2: currency is not editable
    }

    // "Omitting line_items entirely leaves them untouched. Sending []
    // deletes them." — §B.1.2. Full replace, not a patch.
    if (line_items !== undefined) {
      const lineNos = line_items.map((li) => li.line_no);
      if (new Set(lineNos).size !== lineNos.length) {
        throw Errors.validationFailed('Duplicate line_no in line_items.', { fields: { line_items: 'duplicate line_no' } });
      }
      doc.line_items = line_items.map((li) => ({ id: genId(), ...li }));
    }

    // §B.1.2 transition table.
    if (doc.extraction_status === 'extracted') {
      // stays 'extracted' — confirmed_at is what records that someone looked.
    } else {
      doc.extraction_status = 'manual';
    }
    doc.confirmed_at = nowISO();

    res.status(200).json(doc);
  })
);

export default router;
