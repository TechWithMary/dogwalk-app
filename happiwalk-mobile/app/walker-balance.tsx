import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Modal, TextInput, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Loader2, Clock, ArrowUpCircle, ArrowDownCircle, X } from '../components/Icons';
import EmptyState from '../components/EmptyState';
import { SkeletonProfile } from '../components/Skeleton';

const formatMoney = (val: number) => '$' + (val || 0).toLocaleString('es-CO');
const MIN_WITHDRAWAL = 50000;

interface Transaction {
  id: string;
  net_earning: number;
  amount: number;
  description: string;
  created_at: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function WalkerBalanceScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [bankInfo, setBankInfo] = useState<{ bank_account_type: string | null; bank_account_number: string | null } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('balance, bank_account_type, bank_account_number')
        .eq('user_id', user.id)
        .maybeSingle();

      setBalance(profile?.balance || 0);
      setBankInfo({
        bank_account_type: profile?.bank_account_type ?? null,
        bank_account_number: profile?.bank_account_number ?? null,
      });

      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walkerData) {
        const { data: txns } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('transaction_type', 'payment')
          .not('net_earning', 'is', null)
          .order('created_at', { ascending: false })
          .limit(15);
        setTransactions(txns || []);

        const { data: pyt } = await supabase
          .from('payouts')
          .select('*')
          .eq('walker_id', walkerData.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setPayouts(pyt || []);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos de ganancias. Intenta de nuevo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const requestWithdrawal = async () => {
    const amount = parseInt(withdrawAmount.replace(/\D/g, ''));

    if (!amount || amount < MIN_WITHDRAWAL) {
      Alert.alert('Error', `Mínimo ${formatMoney(MIN_WITHDRAWAL)} para retirar`);
      return;
    }

    if (amount > balance) {
      Alert.alert('Error', 'Saldo insuficiente');
      return;
    }

    setRequesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario');

      const { data: walkerData } = await supabase
        .from('walkers')
        .select('id, user_id')
        .eq('user_id', user.id)
        .single();

      if (!walkerData) {
        Alert.alert('Error', 'Perfil de paseador no encontrado');
        return;
      }

      const { data: result, error: rpcError } = await supabase.rpc('request_payout', {
        p_walker_id: walkerData.id,
        p_amount: amount,
      });

      if (rpcError) {
        // Postgres RAISE EXCEPTION message comes through
        const friendlyMsg = rpcError.message
          .replace(/^request_payout: /, '')
          .replace(/^process_payout: /, '');
        throw new Error(friendlyMsg);
      }

      // Notify walker
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '💰 Solicitud de Retiro Enviada',
        body: `Tu solicitud de retiro por ${formatMoney(amount)} está siendo procesada. Te avisaremos cuando se complete.`,
        link_to: '/walker-balance',
      });

      // Notify all admins
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('role', 'admin');
      if (admins?.length) {
        const adminNotifs = admins.map(a => ({
          user_id: a.user_id,
          title: '💳 Nuevo Retiro Pendiente',
          body: `Un paseador solicita retiro de ${formatMoney(amount)} — Revisá datos bancarios y transferí.`,
          link_to: '/admin/payouts',
        }));
        await supabase.from('notifications').insert(adminNotifs);
      }

      Alert.alert(
        'Solicitud enviada',
        `Retiro de ${formatMoney(amount)} en proceso. Te avisaremos cuando se complete.\n\nA ${result?.bank_type || 'tu cuenta'}: ${result?.bank_number || ''}`,
        [{ text: 'OK' }]
      );
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al solicitar');
    } finally {
      setRequesting(false);
    }
  };

  const getPayoutStatusBadge = (status: string) => {
    const styles: any = {
      pending: { bg: '#FEF3C7', color: '#92400E' },
      completed: { bg: '#D1FAE5', color: '#052e05' },
      rejected: { bg: '#FEE2E2', color: '#DC2626' },
    };
    const s = styles[status] || styles.pending;
    return (
      <View style={[styles.badge, { backgroundColor: s.bg }]}>
        <Text style={[styles.badgeText, { color: s.color }]}>
          {status === 'pending' ? 'Pendiente' : status === 'completed' ? 'Completado' : 'Rechazado'}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mis Ganancias</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.scrollView}>
          <View style={styles.skeletonPadding}>
            <SkeletonProfile />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Ganancias</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Disponible</Text>
          <Text style={styles.balanceAmount}>{formatMoney(balance)}</Text>

          <TouchableOpacity
            style={[styles.withdrawBtn, balance < MIN_WITHDRAWAL && styles.withdrawBtnDisabled]}
            onPress={() => balance >= MIN_WITHDRAWAL && setShowWithdrawModal(true)}
            disabled={balance < MIN_WITHDRAWAL}
          >
            <Text style={styles.withdrawBtnText}>
              {balance >= MIN_WITHDRAWAL ? 'Solicitar Retiro' : `Mínimo ${formatMoney(MIN_WITHDRAWAL)}`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={20} color="#9CA3AF" />
            <Text style={styles.sectionTitle}>Ganancias</Text>
            {transactions.length > 0 && (
              <Text style={styles.sectionMeta}>{transactions.length} paseo{transactions.length !== 1 ? 's' : ''}</Text>
            )}
          </View>

          {transactions.length === 0 ? (
            <EmptyState
              icon={<Clock size={36} color="#0EA5E9" />}
              title="Aún no tienes ganancias"
              description="Tus ganancias por paseos completados aparecerán aquí."
              variant="dark"
            />
          ) : (
            <View style={styles.list}>
              {transactions.map((txn) => (
                <View key={txn.id} style={styles.item}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>Paseo Finalizado</Text>
                    <Text style={styles.itemDate}>
                      {new Date(txn.created_at).toLocaleDateString('es-CO')}
                    </Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemAmountPositive}>+{formatMoney(txn.net_earning || 0)}</Text>
                    <View style={[styles.badge, styles.earnedBadge]}>
                      <Text style={[styles.badgeText, styles.earnedBadgeText]}>Acreditado</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ArrowUpCircle size={20} color="#9CA3AF" />
            <Text style={styles.sectionTitle}>Retiros</Text>
            {payouts.length > 0 && (
              <Text style={styles.sectionMeta}>
                {payouts.filter(p => p.status === 'pending').length > 0
                  ? `${payouts.filter(p => p.status === 'pending').length} pendiente${payouts.filter(p => p.status === 'pending').length !== 1 ? 's' : ''}`
                  : `${payouts.length} realizado${payouts.length !== 1 ? 's' : ''}`}
              </Text>
            )}
          </View>

          {payouts.length === 0 ? (
            <View style={styles.compactEmpty}>
              <Text style={styles.compactEmptyText}>Sin retiros aún. Cuando solicites uno, aparecerá acá.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {payouts.map((payout) => (
                <View key={payout.id} style={styles.item}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>Retiro</Text>
                    <Text style={styles.itemDate}>
                      {new Date(payout.created_at).toLocaleDateString('es-CO')}
                    </Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemAmount}>-{formatMoney(payout.amount)}</Text>
                    {getPayoutStatusBadge(payout.status)}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showWithdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Solicitar Retiro</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.bankInfoBox}>
              <Text style={styles.bankInfoLabel}>Transferiremos a:</Text>
              <Text style={styles.bankInfoValue}>
                {bankInfo?.bank_account_type || 'Nequi'} · {bankInfo?.bank_account_number || 'Sin cuenta'}
              </Text>
              {!bankInfo?.bank_account_number && (
                <Text style={styles.bankInfoWarning}>
                  ⚠️ Configurá tu cuenta bancaria en tu perfil antes de retirar.
                </Text>
              )}
            </View>

            <TextInput
              style={styles.modalInput}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder="$0"
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.quickAmounts}>
              {[50000, 100000, 200000].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={styles.quickAmountBtn}
                  onPress={() => setWithdrawAmount(amt.toString())}
                >
                  <Text style={styles.quickAmountText}>{formatMoney(amt)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.quickAmountBtn, styles.quickAmountAll]}
                onPress={() => setWithdrawAmount(balance.toString())}
              >
                <Text style={styles.quickAmountText}>Todo</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.availableText}>Disponible: {formatMoney(balance)}</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowWithdrawModal(false); setWithdrawAmount(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, requesting && styles.confirmBtnDisabled]}
                onPress={requestWithdrawal}
                disabled={requesting}
              >
                {requesting ? (
                  <Loader2 size={18} color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>Solicitar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  skeletonPadding: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1F2937',
  },
  scrollView: {
    flex: 1,
    padding: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 36,
  },
  balanceCard: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '900',
    color: '#0EA5E9',
    marginBottom: 20,
  },
  withdrawBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  withdrawBtnDisabled: {
    backgroundColor: '#374151',
  },
  withdrawBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 'auto',
  },
  compactEmpty: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  compactEmptyText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  list: {
    gap: 12,
  },
  item: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  itemInfo: {},
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  itemAmountPositive: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0EA5E9',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  earnedBadge: {
    backgroundColor: '#D1FAE5',
  },
  earnedBadgeText: {
    color: '#052e05',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickAmountBtn: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  quickAmountAll: {
    backgroundColor: '#0EA5E9',
  },
  quickAmountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  availableText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },
  bankInfoBox: {
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bankInfoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0EA5E9',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bankInfoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  bankInfoWarning: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});