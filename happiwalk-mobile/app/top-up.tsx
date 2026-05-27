import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { createPaymentPreference, openMercadoPagoCheckout } from '../lib/paymentService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Loader2 } from '../components/Icons';

const formatMoney = (val: number) => '$' + (val || 0).toLocaleString('es-CO');

export default function TopUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    const success = params.success;
    const failed = params.failed;
    const pending = params.pending;

    if (success === 'true') {
      Alert.alert('¡Recarga exitosa!', 'Tu saldo se ha actualizado.', [
        { text: 'OK', onPress: () => router.replace('/wallet') }
      ]);
    } else if (failed === 'true') {
      Alert.alert('Pago Fallido', 'El pago no se completó. Intenta de nuevo.');
    } else if (pending === 'true') {
      Alert.alert('Pago Pendiente', 'Tu pago está siendo procesado.');
    }
  }, [params]);

  const handlePayment = async () => {
    if (!amount || parseInt(amount) < 5000) {
      Alert.alert('Monto inválido', 'El mínimo es $5.000 COP');
      return;
    }

    setLoading(true);
    try {
      const preferenceId = await createPaymentPreference(
        parseInt(amount),
        'Recarga HappiWalk - ' + (await supabase.auth.getUser()).data.user?.email
      );
      await openMercadoPagoCheckout(preferenceId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo iniciar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recargar Saldo</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Monto en COP</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={(text) => /^\d*$/.test(text) && setAmount(text)}
            placeholder="Ej: 50000"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
          
          <View style={styles.quickAmounts}>
            {[10000, 20000, 50000, 100000].map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.quickBtn, amount === val.toString() && styles.quickBtnActive]}
                onPress={() => setAmount(val.toString())}
              >
                <Text style={[styles.quickBtnText, amount === val.toString() && styles.quickBtnTextActive]}>
                  {formatMoney(val)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.payBtn, (!amount || parseInt(amount) < 5000) && styles.payBtnDisabled]}
          onPress={handlePayment}
          disabled={loading || !amount || parseInt(amount) < 5000}
        >
          {loading ? (
            <Loader2 size={20} color="#000000" />
          ) : (
            <Text style={styles.payBtnText}>Hacer el Pago</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.minText}>Mínimo $5.000 COP</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  input: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 20,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  quickBtnActive: {
    backgroundColor: '#111827',
  },
  quickBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  quickBtnTextActive: {
    color: '#FFFFFF',
  },
  payBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnDisabled: {
    backgroundColor: '#F3F4F6',
    shadowOpacity: 0,
    elevation: 0,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  minText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
});