import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { createPaymentPreference } from '../lib/paymentService';
import Svg, { Path, Circle } from 'react-native-svg';

interface MercadoPagoButtonProps {
  amount: number;
  title: string;
  description?: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: Error) => void;
}

function MercadoPagoIcon({ size = 24, color = '#000000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Path d="M8 12c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2s-.9 2-2 2h-4c-1.1 0-2 .9-2 2s.9 2 2 2h4" />
    </Svg>
  );
}

function parseRedirectUrl(url: string): { path: string; queryParams: Record<string, string> } {
  try {
    const hashIndex = url.indexOf('#');
    const urlWithoutHash = hashIndex >= 0 ? url.substring(0, hashIndex) : url;
    const queryIndex = urlWithoutHash.indexOf('?');
    const pathAndQuery = urlWithoutHash.replace(/^happiwalk:\/\//, '');
    const path = queryIndex >= 0 ? pathAndQuery.substring(0, queryIndex) : pathAndQuery;
    const queryParams: Record<string, string> = {};
    if (queryIndex >= 0) {
      const queryString = urlWithoutHash.substring(queryIndex + 1);
      for (const pair of queryString.split('&')) {
        const eqIndex = pair.indexOf('=');
        if (eqIndex >= 0) {
          queryParams[decodeURIComponent(pair.substring(0, eqIndex))] = decodeURIComponent(pair.substring(eqIndex + 1));
        }
      }
    }
    return { path, queryParams };
  } catch {
    return { path: '', queryParams: {} };
  }
}

export default function MercadoPagoButton({
  amount,
  title,
  description,
  onSuccess,
  onError,
}: MercadoPagoButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const preferenceId = await createPaymentPreference(amount, title);
      const checkoutUrl = `https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=${preferenceId}`;

      let result: WebBrowser.WebBrowserAuthSessionResult;

      try {
        result = await WebBrowser.openAuthSessionAsync(checkoutUrl, 'happiwalk://payment');
      } catch {
        try {
          await Linking.openURL(checkoutUrl);
          return;
        } catch {
          throw new Error('No se pudo abrir el pago');
        }
      }

      if (result.type === 'success' && 'url' in result) {
        const { path, queryParams } = parseRedirectUrl(result.url);

        if (path.startsWith('payment/')) {
          const status = path.replace('payment/', '');
          const paymentId =
            queryParams.collection_id ||
            queryParams.payment_id ||
            queryParams.external_reference ||
            preferenceId;

          if (status === 'success' || status === 'pending') {
            onSuccess(paymentId);
          } else if (status === 'failure') {
            onError(new Error('El pago no se completó'));
          } else {
            onSuccess(preferenceId);
          }
        } else {
          onSuccess(preferenceId);
        }
      } else if (result.type === 'cancel') {
        onError(new Error('Pago cancelado por el usuario'));
      } else {
        onError(new Error('El pago fue cancelado'));
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Error al procesar el pago'));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, amount, title, onSuccess, onError]);

  return (
    <Pressable
      onPress={handlePayment}
      disabled={isLoading}
      style={({ pressed }) => [
        styles.button,
        isLoading && styles.buttonDisabled,
        pressed && !isLoading && styles.buttonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={isLoading ? 'Procesando pago' : `Pagar ${title}`}
    >
      {isLoading ? (
        <ActivityIndicator color="#000000" size="small" />
      ) : (
        <View style={styles.content}>
          <MercadoPagoIcon size={20} color="#000000" />
          <Text style={styles.text} numberOfLines={1}>
            Hacer el Pago
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#13ec13',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#13ec13',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});