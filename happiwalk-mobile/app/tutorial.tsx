import { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TUTORIAL_KEY = 'hasSeenTutorial';

interface Slide {
  id: number;
  emoji: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    id: 0,
    emoji: '🐾',
    title: 'Welcome to HappiWalk',
    description:
      'The app that connects pet owners with trusted walkers. Your dog deserves the best care — we make it easy.',
  },
  {
    id: 1,
    emoji: '🐕‍🦺',
    title: 'For Owners',
    description:
      'Find verified walkers near you, book walks in seconds, and track every step with live GPS. Stay connected with your pet wherever you are.',
  },
  {
    id: 2,
    emoji: '🚶',
    title: 'For Walkers',
    description:
      'Accept walk requests on your schedule, earn money doing what you love, and build your reputation with every happy pup.',
  },
  {
    id: 3,
    emoji: '🛡️',
    title: 'Safety First',
    description:
      'Every walker is verified. Live GPS tracking, secure in-app payments, and real-time notifications keep your pet safe.',
  },
  {
    id: 4,
    emoji: '✨',
    title: 'Get Started',
    description:
      'Ready to give your dog the best walks? Create your account and join the HappiWalk community today.',
  },
];

export default function TutorialScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== currentIndex) {
        setCurrentIndex(index);
      }
    },
    [currentIndex],
  );

  const handleSkip = useCallback(async () => {
    await AsyncStorage.setItem(TUTORIAL_KEY, 'true');
    router.replace('/(auth)/login');
  }, [router]);

  const handleGetStarted = useCallback(async () => {
    await AsyncStorage.setItem(TUTORIAL_KEY, 'true');
    router.replace('/(auth)/login');
  }, [router]);

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (currentIndex + 1) * SCREEN_WIDTH, animated: true });
    }
  }, [currentIndex]);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slide}>
            <Animated.View
              entering={FadeInUp.duration(600).delay(100)}
              style={styles.illustrationArea}
            >
              <View style={styles.emojiCircle}>
                <Text style={styles.emoji}>{slide.emoji}</Text>
              </View>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.duration(600).delay(200)}
              style={styles.textArea}
            >
              <Text style={styles.slideTitle}>{slide.title}</Text>
              <Text style={styles.slideDescription}>{slide.description}</Text>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      <Animated.View entering={FadeIn.duration(400).delay(300)} style={styles.footer}>
        <View style={styles.dotsContainer}>
          {SLIDES.map((slide) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                slide.id === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {isLastSlide ? (
          <TouchableOpacity style={styles.getStartedBtn} onPress={handleGetStarted}>
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  carousel: {
    flex: 1,
  },
  carouselContent: {
    flexGrow: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  illustrationArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  emojiCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  emoji: {
    fontSize: 56,
  },
  textArea: {
    alignItems: 'center',
    maxWidth: 320,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#0EA5E9',
  },
  getStartedBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  getStartedText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  nextBtn: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  nextText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});