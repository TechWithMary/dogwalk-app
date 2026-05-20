import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'light' | 'dark';
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'light',
}: EmptyStateProps) {
  const isDark = variant === 'dark';

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, isDark ? styles.iconCircleDark : styles.iconCircleLight]}>
        {icon}
      </View>
      <Text style={[styles.title, isDark && styles.titleDark]}>{title}</Text>
      <Text style={[styles.description, isDark && styles.descriptionDark]}>{description}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, isDark ? styles.actionBtnDark : styles.actionBtnLight]}
          onPress={onAction}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionBtnText, isDark ? styles.actionBtnTextDark : styles.actionBtnTextLight]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconCircleLight: {
    backgroundColor: '#ECFDF5',
  },
  iconCircleDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  descriptionDark: {
    color: '#6B7280',
  },
  actionBtn: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  actionBtnLight: {
    backgroundColor: '#13ec13',
  },
  actionBtnDark: {
    backgroundColor: '#13ec13',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionBtnTextLight: {
    color: '#FFFFFF',
  },
  actionBtnTextDark: {
    color: '#000000',
  },
});