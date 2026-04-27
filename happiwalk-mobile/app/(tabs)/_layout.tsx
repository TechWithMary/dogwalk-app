import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Home, MessageSquare, User, House } from '../../components/Icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabButton}>
              <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
                <House size={24} color={focused ? '#059669' : '#9CA3AF'} />
              </View>
              {focused && <Text style={styles.tabLabel}>Inicio</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabButton, !focused && styles.tabButtonInactive]}>
              <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
                <MessageSquare size={24} color={focused ? '#059669' : '#9CA3AF'} />
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabButton, !focused && styles.tabButtonInactive]}>
              <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
                <User size={24} color={focused ? '#059669' : '#9CA3AF'} />
              </View>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    height: 70,
    paddingBottom: 8,
    paddingTop: 4,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: -16,
  },
  tabButtonInactive: {
    opacity: 0.4,
  },
  iconCircle: {
    padding: 12,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  iconCircleActive: {
    backgroundColor: '#ECFDF5',
    transform: [{ scale: 1.1 }],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
});