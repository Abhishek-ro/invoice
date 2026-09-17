import { useEffect, useState } from 'react';
import { listExceptions } from '../api';

export function usePendingExceptionsCount() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let active = true;
    listExceptions()
      .then((res) => { if (active) setCount(res.rows.length); })
      .catch(() => { if (active) setCount(null); });
    return () => { active = false; };
  }, []);

  return count;
}
