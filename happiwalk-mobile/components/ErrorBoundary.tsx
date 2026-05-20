import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>⚠️</Text>
          </View>
          <Text style={styles.title}>¡Ups! Algo salió mal</Text>
          <Text style={styles.description}>
            Ocurrió un error inesperado. Por favor, intenta nuevamente.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={this.handleRetry}
            activeOpacity={0.7}
          >
            <Text style={styles.retryBtnText}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    backgroundColor: '#111827',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(19, 236, 19, 0.15)',
  },
  iconEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    backgroundColor: '#13ec13',
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#000000',
  },
});