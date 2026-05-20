import { useState, useEffect } from 'react';

let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (e) {
  console.warn('NetInfo not available, using fallback');
}

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    if (!NetInfo) return;

    const unsubscribe = NetInfo.addEventListener((state: any) => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    NetInfo.fetch().then((state: any) => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    }).catch(() => {});

    return () => unsubscribe();
  }, []);

  const isOffline = !isConnected || !isInternetReachable;

  return { isConnected, isInternetReachable, isOffline };
}