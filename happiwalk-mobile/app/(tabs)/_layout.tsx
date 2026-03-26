import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Home, MessageSquare, User } from '../../components/Icons';

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
            <View style={focused ? styles.activeTab : styles.tabItem}>
              <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
                <Home size={24} color={focused ? '#059669' : '#9CA3AF'} />
              </View>
              {focused && <Text style={styles.activeLabel}>Inicio</Text>}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <View style={styles.iconContainer}>
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
            <View style={styles.tabItem}>
              <View style={styles.iconContainer}>
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
    paddingBottom: 20,
    paddingTop: 10,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.4,
  },
  activeTab: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  iconContainer: {
    padding: 12,
    borderRadius: 999,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconContainerActive: {
    backgroundColor: '#ECFDF5',
    transform: [{ scale: 1.1 }],
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
});
