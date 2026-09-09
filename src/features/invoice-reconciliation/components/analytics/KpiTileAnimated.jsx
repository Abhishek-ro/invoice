import React from 'react';
import { motion } from 'framer-motion';
import { useCountUp } from '../../hooks/useCountUp';

export default function KpiTileAnimated({ label, value, delta, deltaIsGood = true, target, prefix = '', suffix = '', children }) {
  const animatedValue = useCountUp(value);
  const isPositiveDelta = delta > 0;
  
  // Handle inverted good/bad logic (e.g. for Variance)
  let deltaColor = 'var(--gray-500)'; // neutral
  if (delta !== undefined) {
    if (isPositiveDelta) {
      deltaColor = deltaIsGood ? '#10b981' : '#ef4444';
    } else if (delta < 0) {
      deltaColor = deltaIsGood ? '#ef4444' : '#10b981';
    }
  }

  const formattedValue = prefix + (value >= 1000 ? animatedValue.toLocaleString(undefined, { maximumFractionDigits: 1 }) : animatedValue.toFixed(1).replace(/\.0$/, '')) + suffix;

  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }} className="ir-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--gray-900)' }}>{formattedValue}</div>
        {delta !== undefined && (
          <div style={{ fontSize: '12px', fontWeight: 700, color: deltaColor, background: `${deltaColor}15`, padding: '2px 6px', borderRadius: '4px' }}>
            {isPositiveDelta ? '▲ +' : '▼ '}{delta}%
          </div>
        )}
      </div>
      {(target || children) && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
          {target ? <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-400)' }}>Target: {target}</div> : children}
        </div>
      )}
    </motion.div>
  );
}
