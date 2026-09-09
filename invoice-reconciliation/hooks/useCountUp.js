import { useState, useEffect } from 'react';

export function useCountUp(endValue, duration = 1200) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    const animate = (time) => {
      if (!startTime) startTime = time;
      const progress = time - startTime;
      const rawCount = Math.min(progress / duration, 1) * endValue;
      setCount(rawCount);
      if (progress < duration) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [endValue, duration]);

  return count;
}
