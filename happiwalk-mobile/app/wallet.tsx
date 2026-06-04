import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, CreditCard, ArrowUpRight, ChevronLeft } from '../components/Icons';
import EmptyState from '../components/EmptyState';
import { SkeletonList } from '../components/Skeleton';

const formatMoney = (val: number) => '$' + (val || 0).toLocaleString('es-CO');
const PAGE_SIZE = 20;

export default function WalletScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  const fetchWalletData = useCallback(async (pageNum: number, append: boolean = false) => {
    if (append) setLoadingMore(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      if (!append) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        setProfile(userProfile);
        setBalance(userProfile?.balance || 0);
      }

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: history } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      const newTransactions = history || [];
      setHasMore(newTransactions.length === PAGE_SIZE);

      if (append) {
        setTransactions(prev => [...prev, ...newTransactions]);
      } else {
        setTransactions(newTransactions);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron cargar los datos de la billetera. Intenta de nuevo.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData(0);
  }, [fetchWalletData]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchWalletData(nextPage, true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
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
            <Text style={styles.balanceAmount}>{formatMoney(balance)}</Text>
            <Text style={styles.balanceName}>Titular: {profile?.first_name || 'Usuario'}</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/top-up')}>
            <View style={[styles.actionIconBg, { backgroundColor: '#D1FAE5' }]}>
              <Plus size={20} color="#052e05" />
            </View>
            <Text style={styles.actionLabel}>Recargar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/manage-cards')}>
            <View style={[styles.actionIconBg, { backgroundColor: '#DBEAFE' }]}>
              <CreditCard size={20} color="#2563EB" />
            </View>
            <Text style={styles.actionLabel}>Mis Tarjetas</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Historial de Movimientos</Text>

        <View style={styles.transactionsList}>
          {loading ? (
            <SkeletonList count={4} />
          ) : transactions.length > 0 ? (
            transactions.map((t: any, i: number) => (
              <View key={t.id || i} style={styles.transactionItem}>
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
          ) : !loading ? (
            <EmptyState
              icon={<CreditCard size={36} color="#0EA5E9" />}
              title="No hay movimientos"
              description="Tus transacciones aparecerán aquí cuando realices pagos o recargas."
            />
          ) : null}
        </View>

        {hasMore && transactions.length > 0 && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={handleLoadMore}
            disabled={loadingMore}
            activeOpacity={0.7}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#052e05" />
            ) : (
              <Text style={styles.loadMoreText}>Cargar más</Text>
            )}
          </TouchableOpacity>
        )}

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
  loadMoreBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 12,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#052e05',
  },
  spacer: {
    height: 40,
  },
});