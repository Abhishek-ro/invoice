import React, { useState } from 'react';
import * as XLSX from 'xlsx';

export default function DataGridViewer({ columns, rows, conditionalFormatting, enableExport, enableColumnToggle, frozenHeader = true, filename = 'export.xlsx' }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [visibleCols, setVisibleCols] = useState(columns.map(c => c.key));

  const sortedRows = React.useMemo(() => {
    let sortableItems = [...rows];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [rows, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(sortedRows.map(row => {
      const exportRow = {};
      columns.forEach(col => {
        if (visibleCols.includes(col.key)) {
          exportRow[col.label] = row[col.key];
        }
      });
      return exportRow;
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, filename);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      {(enableExport || enableColumnToggle) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
          {enableExport && (
            <button onClick={handleExport} style={{ background: 'var(--primary-white)', border: '1px solid var(--gray-300)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Export to Excel
            </button>
          )}
        </div>
      )}
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="ir-table" style={{ width: '100%', minWidth: '600px' }}>
          <thead style={frozenHeader ? { position: 'sticky', top: 0, zIndex: 1, background: 'var(--gray-50)' } : {}}>
            <tr>
              {columns.map(col => visibleCols.includes(col.key) && (
                <th key={col.key} onClick={() => col.sortable !== false && requestSort(col.key)} style={{ cursor: col.sortable !== false ? 'pointer' : 'default', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {col.label}
                    {col.sortable !== false && sortConfig.key === col.key && (
                      <span style={{ fontSize: '10px' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={row._id || i}>
                {columns.map(col => {
                  if (!visibleCols.includes(col.key)) return null;
                  const cellValue = row[col.key];
                  const cellStyle = conditionalFormatting ? conditionalFormatting(col.key, row) : {};
                  return (
                    <td key={col.key} style={cellStyle}>
                      {col.render ? col.render(cellValue, row) : cellValue}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
