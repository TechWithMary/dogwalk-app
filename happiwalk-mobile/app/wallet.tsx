import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, CreditCard, ArrowUpRight, ChevronLeft } from '../components/Icons';

const formatMoney = (val: number) => '$' + (val || 0).toLocaleString('es-CO');

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [walletData, setWalletData] = useState({ balance: 0, transactions: [] });

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
         
      setProfile(userProfile);

      const { data: history } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setWalletData({
        balance: userProfile?.balance || 0,
        transactions: history || []
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Billetera</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <View style={styles.balanceContent}>
            <Text style={styles.balanceLabel}>Saldo Disponible</Text>
            <Text style={styles.balanceAmount}>{formatMoney(walletData.balance)}</Text>
            <Text style={styles.balanceName}>Titular: {profile?.first_name || 'Usuario'}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionBtn}>
            <View style={[styles.actionIconBg, { backgroundColor: '#D1FAE5' }]}>
              <Plus size={20} color="#059669" />
            </View>
            <Text style={styles.actionLabel}>Recargar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <View style={[styles.actionIconBg, { backgroundColor: '#DBEAFE' }]}>
              <CreditCard size={20} color="#2563EB" />
            </View>
            <Text style={styles.actionLabel}>Mis Tarjetas</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Historial de Movimientos</Text>

        <View style={styles.transactionsList}>
          {walletData.transactions.length > 0 ? (
            walletData.transactions.map((t: any, i: number) => (
              <View key={i} style={styles.transactionItem}>
                <View style={styles.transactionLeft}>
                  <View style={[styles.transactionIcon, { backgroundColor: '#FED7AA' }]}>
                    <ArrowUpRight size={20} color="#EA580C" />
                  </View>
                  <View>
                    <Text style={styles.transactionDesc}>
                      {t.transaction_type === 'payment' ? 'Pago de paseo' : 'Recarga de saldo'}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {new Date(t.created_at).toLocaleDateString('es-CO')}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.transactionAmount, { color: '#111827' }]}>
                  -{formatMoney(Math.abs(t.amount || 0))}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyTransactions}>
              <Text style={styles.emptyText}>No hay movimientos</Text>
            </View>
          )}
        </View>

        <View style={styles.spacer} />
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
  balanceCard: {
    backgroundColor: '#111827',
    borderRadius: 32,
    height: 192,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  balanceContent: {
    justifyContent: 'space-between',
    height: '100%',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  balanceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 16,
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  transactionDate: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  emptyTransactions: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  spacer: {
    height: 40,
  },
});