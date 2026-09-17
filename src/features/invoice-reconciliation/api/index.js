// Barrel file so pages can do `import { getReconciliation, postDecision } from '../api'`
// instead of reaching into individual files. Also re-exports ApiError so
// components can do `catch (e) { if (e instanceof ApiError) ... }`.
export { ApiError, ACTOR } from './apiClient';
export {
  uploadDocument,
  confirmDocument,
  checkDocumentHash,
  digitizeDocument,
  checkDuplicateInvoice,
} from './documents';
export {
  createReconciliation,
  getReconciliation,
  listReconciliations,
  addNote,
  postDecision,
  reconcileDocuments,
} from './reconciliations';
export { getTolerances, updateTolerances } from './settings';
export { listExceptions } from './exceptions';
export { getDashboardKpis, getDashboardCharts } from './dashboard';
