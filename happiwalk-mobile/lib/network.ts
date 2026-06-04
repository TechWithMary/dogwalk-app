import { useState, useEffect } from 'react';
import * as Network from 'expo-network';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    Network.getNetworkStateAsync().then((state) => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    }).catch(() => {});

    return () => subscription.remove();
  }, []);

  const isOffline = !isConnected || !isInternetReachable;

  return { isConnected, isInternetReachable, isOffline };
}
