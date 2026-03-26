import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

const formatMoney = (val: number) => '$' + (val || 0).toLocaleString('es-CO');

export default function WalletScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [walletData, setWalletData] = useState({ balance: 0, transactions: [] });
  const [isToppingUp, setIsToppingUp] = useState(false);

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

  const isWalker = profile?.role === 'walker';

  return (
    <View style={[styles.container, isWalker && styles.containerDark]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isWalker ? 'Mis Ganancias' : 'Mi Billetera'}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Balance Card - EXACTAMENTE IGUAL A LA WEB */}
        <View style={[styles.balanceCard, isWalker && styles.balanceCardDark]}>
          <View style={styles.balanceContent}>
            <Text style={styles.balanceLabel}>
              {isWalker ? "Saldo Disponible" : "Saldo Promocional"}
            </Text>
            <Text style={styles.balanceAmount}>{formatMoney(walletData.balance)}</Text>
            <Text style={styles.balanceName}>{profile?.first_name || 'Usuario'}</Text>
          </View>
        </View>

        {/* Action Buttons - EXACTAMENTE IGUAL A LA WEB */}
        {!isWalker && (
          isToppingUp ? (
            <View style={styles.topUpSection}>
              <Text style={styles.topUpTitle}>Recargar Saldo</Text>
              <View style={styles.topUpInfo}>
                <Text style={styles.topUpInfoText}>
                  Para recargar, usa la versión web de HappiWalk o contacta al soporte.
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.cancelTopUpBtn}
                onPress={() => setIsToppingUp(false)}
              >
                <Text style={styles.cancelTopUpText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setIsToppingUp(true)}>
                <View style={[styles.actionIconBg, { backgroundColor: '#D1FAE5' }]}>
                  <Text style={styles.actionIcon}>➕</Text>
                </View>
                <Text style={styles.actionLabel}>Recargar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <View style={[styles.actionIconBg, { backgroundColor: '#DBEAFE' }]}>
                  <Text style={styles.actionIcon}>💳</Text>
                </View>
                <Text style={styles.actionLabel}>Mis Tarjetas</Text>
              </TouchableOpacity>
            </View>
          )
        )}

        {/* Transactions - EXACTAMENTE IGUAL A LA WEB */}
        <Text style={[styles.sectionTitle, isWalker && styles.sectionTitleDark]}>
          Historial de Movimientos
        </Text>

        <View style={styles.transactionsList}>
          {walletData.transactions.length > 0 ? (
            walletData.transactions.map((t: any, i: number) => (
              <View key={i} style={[styles.transactionItem, isWalker && styles.transactionItemDark]}>
                <View style={styles.transactionLeft}>
                  <View style={[styles.transactionIcon, { 
                    backgroundColor: isWalker || t.transaction_type === 'deposit' ? '#D1FAE5' : '#FEE2E2'
                  }]}>
                    <Text style={styles.transactionIconText}>
                      {t.transaction_type === 'payment' ? '⬆️' : '⬇️'}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.transactionDesc, isWalker && styles.transactionDescDark]}>
                      {t.transaction_type === 'payment' 
                        ? (isWalker ? "Ganancia por paseo" : "Pago de paseo") 
                        : "Recarga de saldo"}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {new Date(t.created_at).toLocaleDateString('es-CO')}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.transactionAmount, { 
                  color: isWalker || t.transaction_type === 'deposit' ? '#10B981' : '#111827'
                }]}>
                  {t.transaction_type === 'payment' ? (isWalker ? '+' : '-') : '+'}
                  {formatMoney(isWalker ? Math.abs(t.net_earning || 0) : Math.abs(t.amount || 0))}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyTransactions}>
              <Text style={styles.emptyText}>No hay movimientos</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 20,
    color: '#374151',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  headerRight: {
    width: 36,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  balanceCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceCardDark: {
    backgroundColor: '#1F2937',
  },
  balanceContent: {
    alignItems: 'center',
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
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  balanceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  actionIcon: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  topUpSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  topUpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  topUpInfo: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  topUpInfoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  cancelTopUpBtn: {
    alignItems: 'center',
    padding: 8,
  },
  cancelTopUpText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
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
  transactionItemDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
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
  transactionIconText: {
    fontSize: 18,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  transactionDescDark: {
    color: '#FFFFFF',
  },
  transactionDate: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
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
    letterSpacing: 2,
  },
});
