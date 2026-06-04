import { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Star, X } from './Icons';
import AvatarImage from './AvatarImage';

interface RatingModalProps {
  visible: boolean;
  walkerName: string;
  walkerPhoto?: string;
  bookingId: string;
  onSubmit: (rating: number, comment: string) => void;
  onClose: () => void;
}

const STAR_COUNT = 5;
const STAR_SIZE = 36;
const FILLED_COLOR = '#FBBF24';
const EMPTY_COLOR = '#D1D5DB';

function StarButton({
  value,
  isFilled,
  onPress,
}: {
  value: number;
  isFilled: boolean;
  onPress: (v: number) => void;
}) {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(1.3, { duration: 100 }),
      withSpring(1, { damping: 3, stiffness: 400 })
    );
    onPress(value);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={4}
      accessibilityLabel={`${value} estrella${value > 1 ? 's' : ''}`}
    >
      <Animated.View style={animatedStyle}>
        <Star
          size={STAR_SIZE}
          color={isFilled ? FILLED_COLOR : EMPTY_COLOR}
          fill={isFilled ? FILLED_COLOR : 'none'}
          strokeWidth={isFilled ? 0 : 1.5}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function RatingModal({
  visible,
  walkerName,
  walkerPhoto,
  bookingId,
  onSubmit,
  onClose,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStarPress = useCallback((star: number) => {
    setRating(star);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(rating, comment);
      setRating(0);
      setComment('');
    } finally {
      setSubmitting(false);
    }
  }, [rating, comment, submitting, onSubmit]);

  const handleClose = useCallback(() => {
    setRating(0);
    setComment('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.header}>
                <View style={{ width: 28 }} />
                <Text style={styles.title}>¿Cómo fue el paseo?</Text>
                <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Cerrar">
                  <X size={20} color="#9CA3AF" />
                </Pressable>
              </View>

              <View style={styles.walkerRow}>
                <AvatarImage
                  photoUrl={walkerPhoto ?? null}
                  fallbackInitial={walkerName}
                  size={48}
                />
                <Text style={styles.walkerName} numberOfLines={1}>
                  {walkerName}
                </Text>
              </View>

              <View style={styles.starsRow}>
                {Array.from({ length: STAR_COUNT }, (_, i) => {
                  const starValue = i + 1;
                  return (
                    <StarButton
                      key={starValue}
                      value={starValue}
                      isFilled={starValue <= rating}
                      onPress={handleStarPress}
                    />
                  );
                })}
              </View>

              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Comentario opcional..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />

              <Pressable
                onPress={handleSubmit}
                disabled={rating === 0 || submitting}
                style={[
                  styles.submitButton,
                  (rating === 0 || submitting) && styles.submitButtonDisabled,
                ]}
                accessibilityLabel="Enviar calificación"
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Enviando...' : 'Enviar Calificación'}
                </Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  walkerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  walkerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    flex: 1,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  commentInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
