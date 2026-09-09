// The one error envelope from 04-API-CONTRACT.md §0. Every route in this
// server throws an ApiError (or lets express-async wrapper catch one) and
// the single error handler in server.js turns it into this exact shape.
// No route is allowed to hand-roll its own error body.

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toBody() {
    const body = { error: { code: this.code, message: this.message } };
    if (this.details !== undefined) body.error.details = this.details;
    return body;
  }
}

// Convenience constructors, one per §0 error table row.
export const Errors = {
  malformedRequest: (message = 'Malformed request.', details) =>
    new ApiError(400, 'malformed_request', message, details),
  notFound: (message = 'Not found.', details) =>
    new ApiError(404, 'not_found', message, details),
  illegalTransition: (message, details) =>
    new ApiError(409, 'illegal_transition', message, details),
  documentAlreadyUsed: (message, details) =>
    new ApiError(409, 'document_already_used', message, details),
  duplicateDocumentType: (message, details) =>
    new ApiError(409, 'duplicate_document_type', message, details),
  unsupportedFileType: (message, details) =>
    new ApiError(415, 'unsupported_file_type', message, details),
  validationFailed: (message = 'Validation failed.', details) =>
    new ApiError(422, 'validation_failed', message, details),
  noteRequired: (message = 'A note is required for this action.', details) =>
    new ApiError(422, 'note_required', message, details),
  missingInvoiceDocument: (message = 'Exactly one invoice document is required.', details) =>
    new ApiError(422, 'missing_invoice_document', message, details),
  documentNotConfirmed: (message = 'One or more documents are not confirmed.', details) =>
    new ApiError(422, 'document_not_confirmed', message, details),
  internal: (message = 'Internal error.', details) =>
    new ApiError(500, 'internal_error', message, details),
};

// §0: every mutating request must carry X-Actor-Id / X-Actor-Name.
export function requireActor(req, _res, next) {
  const actorId = req.header('X-Actor-Id');
  const actorName = req.header('X-Actor-Name');
  if (!actorId || !actorName) {
    return next(
      Errors.malformedRequest('Missing X-Actor-Id / X-Actor-Name header.', {
        missing: [!actorId && 'X-Actor-Id', !actorName && 'X-Actor-Name'].filter(Boolean),
      })
    );
  }
  req.actor = { id: actorId, name: actorName };
  next();
}

export function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
