import { useState, useEffect } from 'react';

type NetworkHook = {
  isConnected: boolean;
  isOffline: boolean;
};

export function useNetworkStatus(): NetworkHook {
  const [isConnected, setIsConnected] = useState(
    typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('onLine' in navigator)) return;

    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isConnected,
    isOffline: !isConnected,
  };
}
