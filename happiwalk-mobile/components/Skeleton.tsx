import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type ViewStyle, type DimensionValue } from 'react-native';

const SKELETON_BG = '#E5E7EB';
const SKELETON_SHIMMER = '#F3F4F6';
const SHIMMER_DURATION = 1000;

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  circle?: boolean;
  count?: number;
  style?: ViewStyle;
}

export default function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  circle = false,
  count = 1,
  style,
}: SkeletonProps) {
  const translateX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 1,
          duration: SHIMMER_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -1,
          duration: SHIMMER_DURATION,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [translateX]);

  const resolvedBorderRadius = circle ? (typeof height === 'number' ? height / 2 : 9999) : borderRadius;
  const resolvedWidth = circle ? height : width;

  const items = Array.from({ length: count }, (_, i) => (
    <View
      key={i}
      style={[
        styles.base,
        {
          width: resolvedWidth as DimensionValue,
          height,
          borderRadius: resolvedBorderRadius,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  ));

  return count === 1 ? items[0] : <View style={styles.column}>{items}</View>;
}

export interface SkeletonCardProps {
  count?: number;
  style?: ViewStyle;
}

export function SkeletonCard({ count = 1, style }: SkeletonCardProps) {
  const items = Array.from({ length: count }, (_, i) => (
    <View key={i} style={[styles.card, style]}>
      <View style={styles.cardTop}>
        <Skeleton circle height={48} />
        <View style={styles.cardInfo}>
          <Skeleton width="60%" height={16} borderRadius={8} />
          <Skeleton width="40%" height={12} borderRadius={6} />
        </View>
      </View>
      <Skeleton width="100%" height={12} borderRadius={6} />
      <Skeleton width="75%" height={12} borderRadius={6} />
      <View style={styles.cardFooter}>
        <Skeleton width={100} height={32} borderRadius={16} />
        <Skeleton width={80} height={32} borderRadius={16} />
      </View>
    </View>
  ));

  return <View style={styles.column}>{items}</View>;
}

export interface SkeletonListProps {
  count?: number;
  style?: ViewStyle;
}

export function SkeletonList({ count = 4, style }: SkeletonListProps) {
  const items = Array.from({ length: count }, (_, i) => (
    <View key={i} style={[styles.listItem, style]}>
      <Skeleton circle height={44} />
      <View style={styles.listInfo}>
        <Skeleton width="55%" height={14} borderRadius={7} />
        <Skeleton width="35%" height={11} borderRadius={6} />
      </View>
      <Skeleton width={24} height={24} borderRadius={4} />
    </View>
  ));

  return <View style={styles.column}>{items}</View>;
}

export interface SkeletonProfileProps {
  style?: ViewStyle;
}

export function SkeletonProfile({ style }: SkeletonProfileProps) {
  return (
    <View style={[styles.profile, style]}>
      <Skeleton circle height={80} />
      <Skeleton width="45%" height={20} borderRadius={10} />
      <Skeleton width="30%" height={14} borderRadius={7} />
      <View style={styles.profileStats}>
        <View style={styles.profileStat}>
          <Skeleton width={32} height={20} borderRadius={6} />
          <Skeleton width={48} height={10} borderRadius={5} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={32} height={20} borderRadius={6} />
          <Skeleton width={48} height={10} borderRadius={5} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={32} height={20} borderRadius={6} />
          <Skeleton width={48} height={10} borderRadius={5} />
        </View>
      </View>
      <View style={styles.profileSection}>
        <Skeleton width="70%" height={14} borderRadius={7} />
        <Skeleton width="100%" height={12} borderRadius={6} />
        <Skeleton width="85%" height={12} borderRadius={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: SKELETON_BG,
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SKELETON_SHIMMER,
    opacity: 0.6,
  },
  column: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  cardInfo: {
    flex: 1,
    gap: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  listInfo: {
    flex: 1,
    gap: 5,
  },
  profile: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 40,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginVertical: 8,
  },
  profileStat: {
    alignItems: 'center',
    gap: 4,
  },
  profileSection: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
});