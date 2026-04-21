import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, Colors } from '@/constants/theme';
import { Config } from '@/constants/Config';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AnimatedCard } from '@/components/ui/animated-card';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface TrendData {
  date: string;
  risk_score: number;
  confidence: number;
  top_factor: string;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

function AnimatedBar({ height, isLowConfidence, index }: { height: number, isLowConfidence: boolean, index: number }) {
  const animatedHeight = useSharedValue(0);

  useEffect(() => {
    animatedHeight.value = withDelay(
      500 + index * 100,
      withTiming(Math.max(10, height), { 
        duration: 800, 
        easing: Easing.out(Easing.back(1)) 
      })
    );
  }, [height]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  return (
    <AnimatedLinearGradient
      colors={isLowConfidence ? ['#D1D1D1', '#A1A1A1'] : ['#ff9a9e', '#fecfef']}
      style={[styles.barFill, animatedStyle]}
    />
  );
}

export default function TrendsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSamples, setCurrentSamples] = useState(0);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      const response = await fetch(`${Config.API_URL}/insights/trends/${Config.USER_ID}`);
      const data = await response.json();
      
      setTrends(data.trends.reverse()); 
      setIsReady(data.is_ready);
      setCurrentSamples(data.current_sample_count);
      setProgress(data.current_sample_count / data.min_samples_required);
    } catch (error) {
      console.error("Failed to fetch trends:", error);
    } finally {
      // Small delay for shimmer/spinner effect parity with dashboard
      setTimeout(() => setLoading(false), 600);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </ThemedView>
    );
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chart.bar.fill"
          style={styles.headerImage}
        />
      }>
      <AnimatedCard delay={100}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title" style={{ fontFamily: Fonts.rounded }}>Weekly Trends</ThemedText>
        </ThemedView>
      </AnimatedCard>

      {!isReady ? (
        <AnimatedCard delay={200}>
          <ThemedView style={styles.baselineContainer}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Building Your Baseline</ThemedText>
            <ThemedText style={styles.description}>
              We're learning your behavioral patterns. More data ensures higher accuracy for your insights.
            </ThemedText>
            
            <View style={styles.progressWrapper}>
              <View style={styles.progressBarBackground}>
                <LinearGradient
                  colors={['#4facfe', '#00f2fe']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${Math.min(100, progress * 100)}%` }]}
                />
              </View>
              <ThemedText style={styles.progressText}>
                {currentSamples} / {Config.MIN_SAMPLES_FOR_SCORE} samples collected
              </ThemedText>
            </View>
          </ThemedView>
        </AnimatedCard>
      ) : (
        <View style={styles.chartSection}>
          <AnimatedCard delay={200}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>7-Day Risk Index</ThemedText>
          </AnimatedCard>
          
          <View style={styles.chartContainer}>
            {trends.map((day, index) => {
              const barHeight = (day.risk_score / 100) * 150;
              const isLowConfidence = day.confidence < 0.5;
              
              return (
                <View key={day.date} style={styles.barWrapper}>
                  <View style={styles.barBackground}>
                    <AnimatedBar height={barHeight} isLowConfidence={isLowConfidence} index={index} />
                  </View>
                  <AnimatedCard delay={800 + index * 50}>
                    <ThemedText style={styles.barLabel}>
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                    </ThemedText>
                  </AnimatedCard>
                </View>
              );
            })}
          </View>
          
          <AnimatedCard delay={1500}>
            <ThemedView style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: '#ff9a9e' }]} />
                <ThemedText style={styles.legendText}>High Confidence</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: '#D1D1D1' }]} />
                <ThemedText style={styles.legendText}>Initial Baseline</ThemedText>
              </View>
            </ThemedView>
          </AnimatedCard>
        </View>
      )}

      <AnimatedCard delay={1800}>
        <ThemedView style={styles.infoCard}>
          <ThemedText type="defaultSemiBold">About Observations</ThemedText>
          <ThemedText style={styles.infoText}>
            Trends show shifts in your digital behavior relative to your personal baseline. These are observations, not medical diagnoses.
          </ThemedText>
        </ThemedView>
      </AnimatedCard>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    paddingBottom: 20,
  },
  baselineContainer: {
    padding: 20,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    borderRadius: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 10,
    fontFamily: Fonts.rounded,
  },
  description: {
    opacity: 0.7,
    marginBottom: 25,
    lineHeight: 20,
  },
  progressWrapper: {
    gap: 12,
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
  },
  chartSection: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 20,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 200,
    paddingTop: 20,
    marginBottom: 20,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barBackground: {
    height: 150,
    width: 25,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 12,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 10,
    opacity: 0.5,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    opacity: 0.6,
    textAlign: 'center',
  },
  infoCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: 40,
  },
  infoText: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.6,
    lineHeight: 18,
  },
});
