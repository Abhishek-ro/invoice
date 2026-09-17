import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './theme.css';
import InvoiceReconApp from './features/invoice-reconciliation/routes/index.jsx';
import ThemeToggle from './ThemeToggle.jsx';

// Landing page now lives in its own app (../invoice-website). This app is
// the product only — there is no marketing page or login gate here, so "/"
// just drops straight into the tool.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/invoice-reconciliation/*" element={<InvoiceReconApp />} />
        <Route path="*" element={<Navigate to="/invoice-reconciliation" replace />} />
      </Routes>
      <ThemeToggle />
    </BrowserRouter>
  </React.StrictMode>
);
