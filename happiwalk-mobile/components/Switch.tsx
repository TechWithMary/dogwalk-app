import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const THUMB_SIZE = 20;
const THUMB_OFFSET = (TRACK_HEIGHT - THUMB_SIZE) / 2; // 2px vertical centering
const ACTIVE_TRANSLATE_X = TRACK_WIDTH - THUMB_SIZE - THUMB_OFFSET; // 22px

export default function Switch({ value, onValueChange, disabled = false }: SwitchProps) {
  const translateX = useRef(new Animated.Value(value ? ACTIVE_TRANSLATE_X : THUMB_OFFSET)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: value ? ACTIVE_TRANSLATE_X : THUMB_OFFSET,
      useNativeDriver: true,
      friction: 7,
      tension: 40,
    }).start();
  }, [value]);

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel="Toggle"
      style={[styles.touchTarget, disabled && styles.disabled]}
    >
      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: value ? '#13ec13' : '#374151',
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: 12,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    top: THUMB_OFFSET,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});