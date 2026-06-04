import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import {
  ChevronLeft,
  Loader2,
  Check,
  X,
  Clock,
  CreditCard,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Phone,
} from '../../components/Icons';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';

const formatMoney = (val: number) => '$' + (val || 0).toLocaleString('es-CO');

type TabType = 'pending' | 'completed' | 'rejected';

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
}

interface Walker {
  id: string;
  name: string;
  user_id: string;
  user_profiles: UserProfile | UserProfile[] | null;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  payout_date: string | null;
  notes: string | null;
  walker_id: string;
  walkers: Walker;
}

function resolveProfile(walker: Walker): UserProfile | null {
  if (!walker?.user_profiles) return null;
  if (Array.isArray(walker.user_profiles)) return walker.user_profiles[0] || null;
  return walker.user_profiles;
}

export default function AdminPayoutsScreen() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/(auth)/login'); return; }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile?.role !== 'admin') {
        Alert.alert('Acceso Denegado', 'No tienes permisos de administrador');
        router.replace('/(tabs)');
        return;
      }
      setIsAdmin(true);
    })();
  }, []);

  useEffect(() => {
    if (isAdmin) fetchPayouts();
  }, [isAdmin, activeTab]);

  if (isAdmin === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!isAdmin) return null;

  const fetchPayouts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select(
          `*,
          walkers:walker_id (
            id,
            name,
            user_id,
            user_profiles (first_name, last_name, phone, bank_account_type, bank_account_number)
          )`
        )
        .eq('status', activeTab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayouts((data as Payout[]) || []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      Alert.alert('Error', 'Error cargando retiros');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setLoading(true);
    fetchPayouts();
  }, [fetchPayouts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayouts();
  };

  const processPayout = async (payoutId: string, newStatus: 'completed' | 'rejected') => {
    const action = newStatus === 'completed' ? 'APROBAR' : 'RECHAZAR';

    Alert.alert(
      'Confirmar',
      `¿Confirmas que quieres ${action} este retiro?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: action,
          style: newStatus === 'completed' ? 'default' : 'destructive',
          onPress: async () => {
            setProcessingId(payoutId);
            try {
              const { data: payoutData, error: fetchError } = await supabase
                .from('payouts')
                .select('*, walkers(*)')
                .eq('id', payoutId)
                .single();

              if (fetchError) throw fetchError;

              const { error: updateError } = await supabase
                .from('payouts')
                .update({
                  status: newStatus,
                  payout_date: new Date().toISOString().split('T')[0],
                })
                .eq('id', payoutId);

              if (updateError) throw updateError;

              if (newStatus === 'completed' && payoutData?.walkers?.user_id) {
                const walkerUserId = payoutData.walkers.user_id;

                const { data: profile } = await supabase
                  .from('user_profiles')
                  .select('balance')
                  .eq('user_id', walkerUserId)
                  .single();

                const currentBalance = Number(profile?.balance) || 0;
                const newBalance = Math.max(0, currentBalance - payoutData.amount);

                const { error: balanceError } = await supabase
                  .from('user_profiles')
                  .update({ balance: newBalance })
                  .eq('user_id', walkerUserId);

                if (balanceError) console.error('Balance update error:', balanceError);

                await supabase.from('transactions').insert({
                  user_id: walkerUserId,
                  transaction_type: 'withdrawal',
                  amount: payoutData.amount,
                  net_amount: payoutData.amount,
                  status: 'completed',
                  description: `Retiro aprobado - ${payoutData.notes || ''}`,
                });
              }

              if (payoutData?.walkers?.user_id) {
                await supabase.from('notifications').insert({
                  user_id: payoutData.walkers.user_id,
                  title:
                    newStatus === 'completed'
                      ? '✅ Retiro Aprobado'
                      : '❌ Retiro Rechazado',
                  body:
                    newStatus === 'completed'
                      ? `Tu retiro de ${formatMoney(payoutData.amount)} ha sido procesado.`
                      : 'Tu solicitud de retiro ha sido rechazada. Contacta soporte.',
                  link_to: '/walker-balance',
                });
              }

              Alert.alert(
                'Éxito',
                newStatus === 'completed'
                  ? 'Retiro aprobado y balance actualizado'
                  : 'Retiro rechazado'
              );

              setTimeout(() => fetchPayouts(), 500);
            } catch (error: any) {
              console.error('Error processing payout:', error);
              Alert.alert('Error', error.message || 'Error al procesar');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
      completed: { bg: '#D1FAE5', color: '#052e05', label: 'Completado' },
      rejected: { bg: '#FEE2E2', color: '#DC2626', label: 'Rechazado' },
    };
    const config = configs[status] || configs.pending;
    return (
      <View style={[styles.badge, { backgroundColor: config.bg }]}>
        <Text style={[styles.badgeText, { color: config.color }]}>
          {config.label}
        </Text>
      </View>
    );
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'pending', label: 'Pendientes' },
    { key: 'completed', label: 'Completados' },
    { key: 'rejected', label: 'Rechazados' },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Retiros</Text>
            <Text style={styles.headerSubtitle}>Gestionar solicitudes de pago</Text>
          </View>
          <View style={styles.headerRight}>
            <DollarSign size={20} color="#0EA5E9" />
          </View>
        </View>
        <View style={styles.scrollView}>
          <SkeletonList count={3} />
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Retiros</Text>
          <Text style={styles.headerSubtitle}>Gestionar solicitudes de pago</Text>
        </View>
        <View style={styles.headerRight}>
          <DollarSign size={20} color="#0EA5E9" />
        </View>
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />
        }
      >
        {payouts.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={36} color="#0EA5E9" />}
            title="Todo al día"
            description={
              activeTab === 'pending'
                ? 'No hay retiros pendientes'
                : `No hay retiros ${activeTab === 'completed' ? 'completados' : 'rechazados'}`
            }
            variant="dark"
          />
        ) : (
          <View style={styles.list}>
            {payouts.map((payout) => {
              const walker = payout.walkers;
              const profile = resolveProfile(walker);
              const walkerName = profile
                ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                : walker?.name || 'Paseador';

              return (
                <View key={payout.id} style={styles.payoutCard}>
                  <View style={styles.payoutHeader}>
                    <View style={styles.walkerInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {walkerName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.walkerDetails}>
                        <Text style={styles.walkerName}>{walkerName}</Text>
                        <View style={styles.phoneRow}>
                          <Phone size={14} color="#9CA3AF" />
                          <Text style={styles.phoneText}>
                            {profile?.phone || 'Sin teléfono'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {getStatusBadge(payout.status)}
                  </View>

                  <View style={styles.amountCard}>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>MONTO</Text>
                      <Text style={styles.amountValue}>
                        {formatMoney(payout.amount)}
                      </Text>
                    </View>
                    <View style={styles.bankRow}>
                      <CreditCard size={16} color="#9CA3AF" />
                      <Text style={styles.bankType}>
                        {profile?.bank_account_type || 'Nequi'}
                      </Text>
                      <Text style={styles.bankNumber}>
                        •••• {profile?.bank_account_number?.slice(-4) || '****'}
                      </Text>
                    </View>
                  </View>

                  {payout.notes ? (
                    <View style={styles.notesRow}>
                      <Clock size={12} color="#6B7280" />
                      <Text style={styles.notesText}>{payout.notes}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.dateText}>
                    Solicitado:{' '}
                    {new Date(payout.created_at).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>

                  {payout.status === 'pending' && (
                    <View style={styles.actionBar}>
                      <Text style={styles.actionWarning}>
                        ⚠️ Haz la transferencia primero, luego confirma
                      </Text>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.rejectBtn}
                          onPress={() => processPayout(payout.id, 'rejected')}
                          disabled={processingId === payout.id}
                        >
                          {processingId === payout.id ? (
                            <Loader2 size={16} color="#EF4444" />
                          ) : (
                            <X size={16} color="#EF4444" />
                          )}
                          <Text style={styles.rejectBtnText}>Rechazar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.approveBtn}
                          onPress={() => processPayout(payout.id, 'completed')}
                          disabled={processingId === payout.id}
                        >
                          {processingId === payout.id ? (
                            <Loader2 size={16} color="#FFFFFF" />
                          ) : (
                            <Check size={16} color="#FFFFFF" />
                          )}
                          <Text style={styles.approveBtnText}>Confirmar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {payout.status === 'completed' && (
                    <View style={styles.completedBar}>
                      <CheckCircle size={16} color="#052e05" />
                      <Text style={styles.completedText}>
                        Pago procesado el{' '}
                        {new Date(payout.payout_date!).toLocaleDateString('es-CO')}
                      </Text>
                    </View>
                  )}

                  {payout.status === 'rejected' && (
                    <View style={styles.rejectedBar}>
                      <AlertCircle size={16} color="#DC2626" />
                      <Text style={styles.rejectedText}>Retiro rechazado</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  headerRight: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#0EA5E9',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  list: {
    gap: 16,
  },
  payoutCard: {
    backgroundColor: '#1F2937',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  walkerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  walkerDetails: {
    flex: 1,
  },
  walkerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 13,
    color: '#9CA3AF',
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
  amountCard: {
    backgroundColor: '#111827',
    margin: 12,
    borderRadius: 16,
    padding: 16,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0EA5E9',
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
    textTransform: 'capitalize',
  },
  bankNumber: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  actionBar: {
    backgroundColor: '#1C1917',
    borderTopWidth: 1,
    borderTopColor: '#374151',
    padding: 16,
  },
  actionWarning: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7F1D1D',
    backgroundColor: 'transparent',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0EA5E9',
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  completedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(16,185,129,0.2)',
  },
  completedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#052e05',
  },
  rejectedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(239,68,68,0.2)',
  },
  rejectedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
});