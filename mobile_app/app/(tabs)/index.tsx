import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Config } from '@/constants/Config';
import { AnimatedCard } from '@/components/ui/animated-card';
import { SkeletonLoader } from '@/components/ui/skeleton-loader';

const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '😔', label: 'Sad' },
  { emoji: '😠', label: 'Stressed' },
  { emoji: '😴', label: 'Tired' },
];

const MetricSlider = ({ label, value, max, onSelect }: { label: string, value: number, max: number, onSelect: (v: number) => void }) => (
  <View style={sliderStyles.container}>
    <Text style={sliderStyles.label}>{label} ({value}/{max})</Text>
    <View style={sliderStyles.row}>
      {Array.from({ length: max }, (_, i) => i + 1).map(val => (
        <TouchableOpacity 
          key={val} 
          onPress={() => onSelect(val)} 
          style={[sliderStyles.dot, value >= val && sliderStyles.dotActive]} 
        />
      ))}
    </View>
  </View>
);

const sliderStyles = StyleSheet.create({
  container: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0' },
  dotActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
});

import { logEvent } from '@/services/telemetry-sync';
import { AppState, AppStateStatus } from 'react-native';

export default function DashboardScreen() {
  const [userName, setUserName] = useState<string>('User');
  const [currentRiskScore, setCurrentRiskScore] = useState<number | null>(null);
  const [isStable, setIsStable] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<{ insights: any[], check_ins: any[] }>({ insights: [], check_ins: [] });
  
  // Modal State
  const [isModalVisible, setModalVisible] = useState(false);
  const [selectedMood, setSelectedMood] = useState('Happy');
  const [energyLevel, setEnergyLevel] = useState(5);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [focusLevel, setFocusLevel] = useState(3);
  const [socialEngagement, setSocialEngagement] = useState(3);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [serverStatus, setServerStatus] = useState<'ok' | 'error' | 'checking'>('checking');

  useEffect(() => {
    checkServerHealth();
    fetchData();

    // AppState listener for telemetry
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        logEvent('app_session_start', { context: 'dashboard_entry' });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkServerHealth = async () => {
    try {
      const res = await fetch(`${Config.API_URL}/health`);
      if (res.ok) setServerStatus('ok');
      else setServerStatus('error');
    } catch {
      setServerStatus('error');
    }
  };

  const fetchData = async () => {
    try {
      const [userRes, latestRes, historyRes] = await Promise.all([
        fetch(`${Config.API_URL}/users/${Config.USER_ID}`),
        fetch(`${Config.API_URL}/insights/${Config.USER_ID}`),
        fetch(`${Config.API_URL}/insights/history/${Config.USER_ID}`)
      ]);
      
      const user = await userRes.json();
      const latest = await latestRes.json();
      const historyData = await historyRes.json();
      
      if (user && user.name) {
        setUserName(user.name);
      }

      if (latest && typeof latest.risk_score === 'number') {
        setCurrentRiskScore(latest.risk_score);
        setIsStable(latest.risk_score < 50);
      }
      
      setHistory(historyData);
    } catch (err) {
      console.error("Could not fetch dashboard data:", err);
    } finally {
      // Small artificial delay to show off the skeleton beauty
      setTimeout(() => setLoading(false), 800);
    }
  };

  const handleMoodSelect = (mood: string) => {
    setSelectedMood(mood);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleEnergySelect = (val: number) => {
    setEnergyLevel(val);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleCheckIn = async () => {
    setIsSubmitting(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      // Map numeric mood input for demo compatibility
      const moodValue = typeof selectedMood === 'number' ? MOODS[selectedMood-1]?.label || 'Neutral' : selectedMood;

      const response = await fetch(`${Config.API_URL}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Config.USER_ID,
          mood: moodValue,
          energy_level: energyLevel,
          sleep_quality: sleepQuality,
          focus_level: focusLevel,
          social_engagement: socialEngagement,
          note: note
        })
      });

      if (response.ok) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setModalVisible(false);
          resetForm();
        }, 1500);
        fetchData(); // Refresh history
      }
    } catch (err) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert("Error", "Could not log check-in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedMood('Happy');
    setEnergyLevel(5);
    setSleepQuality(3);
    setFocusLevel(3);
    setSocialEngagement(3);
    setNote('');
  };

  const simulateTelemetry = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    try {
      const response = await fetch(`${Config.API_URL}/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Config.USER_ID,
          date: new Date().toISOString().split('T')[0],
          late_night_usage_mins: Math.floor(Math.random() * 120),
          notification_responses_per_hour: Math.random() * 2,
          context_switching_index: Math.floor(Math.random() * 100),
          social_interaction_mins: Math.floor(Math.random() * 60)
        })
      });

      if (response.ok) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert("Success", "Real-world telemetry simulated and processed.");
        fetchData();
      }
    } catch (err) {
      Alert.alert("Error", "Could not connect to backend simulation.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scrollContent}>
          <SkeletonLoader width="60%" height={24} style={{ marginBottom: 16 }} />
          <SkeletonLoader width="40%" height={32} style={{ marginBottom: 32 }} />
          <SkeletonLoader width="100%" height={160} borderRadius={24} style={{ marginBottom: 32 }} />
          <SkeletonLoader width={120} height={24} style={{ marginBottom: 16 }} />
          <SkeletonLoader width="100%" height={80} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={80} style={{ marginBottom: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {serverStatus === 'error' && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ Cannot reach server. Check LAN connection.</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AnimatedCard delay={100}>
          <View style={styles.header}>
            <Text style={styles.greeting}>Good Morning,</Text>
            <Text style={styles.username}>Alex</Text>
          </View>
        </AnimatedCard>

        {/* Baseline Risk Score Card */}
        <AnimatedCard delay={200}>
          <LinearGradient
            colors={isStable ? ['#4CAF50', '#81C784'] : ['#FFA726', '#FFB74D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scoreCard}
          >
            <Text style={styles.scoreCardTitle}>Current Baseline Status</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreValue}>{currentRiskScore ?? '--'}</Text>
              <Text style={styles.scoreUnit}>/ 100</Text>
            </View>
            <Text style={styles.scoreDescription}>
              {isStable 
                ? "Your behavioral patterns are stable and within your typical baseline." 
                : "We've noticed some slight deviations from your typical baseline."}
            </Text>
          </LinearGradient>
        </AnimatedCard>

        <View style={styles.section}>
          <AnimatedCard delay={300}>
            <Text style={styles.sectionTitle}>Recent Insights</Text>
          </AnimatedCard>
          {history.insights.map((insight, idx) => (
            <AnimatedCard key={insight.id || idx} delay={400 + idx * 100}>
              <View style={styles.insightCard}>
                <View style={styles.insightIconWrapper}>
                  <Text style={styles.insightIcon}>✨</Text>
                </View>
                <View style={styles.insightTextContent}>
                  <Text style={styles.insightTitle}>{insight.top_factor}</Text>
                  <Text style={styles.insightDetail}>{insight.intervention_message}</Text>
                </View>
              </View>
            </AnimatedCard>
          ))}
          {history.insights.length === 0 && <Text style={styles.emptyText}>No insights available yet.</Text>}
        </View>

        {/* Recent Check-ins Section */}
        <View style={styles.section}>
          <AnimatedCard delay={500}>
            <Text style={styles.sectionTitle}>Your Mood Check-ins</Text>
          </AnimatedCard>
          {history.check_ins.map((checkin, idx) => (
            <AnimatedCard key={checkin.id || idx} delay={600 + idx * 100}>
              <View style={styles.checkinCard}>
                <Text style={styles.checkinMood}>{MOODS.find(m => m.label === checkin.mood)?.emoji || '📝'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkinLabel}>{checkin.mood} • Energy: {checkin.energy_level}/10</Text>
                  <View style={styles.metricTags}>
                    {checkin.sleep_quality && <View style={styles.tag}><Text style={styles.tagText}>🌙 Sleep: {checkin.sleep_quality}/5</Text></View>}
                    {checkin.focus_level && <View style={styles.tag}><Text style={styles.tagText}>🧠 Focus: {checkin.focus_level}/5</Text></View>}
                    {checkin.social_engagement && <View style={styles.tag}><Text style={styles.tagText}>🤝 Social: {checkin.social_engagement}/5</Text></View>}
                  </View>
                  {checkin.note && <Text style={styles.checkinNote}>{checkin.note}</Text>}
                </View>
                <Text style={styles.checkinTime}>{new Date(checkin.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </AnimatedCard>
          ))}
           {history.check_ins.length === 0 && <Text style={styles.emptyText}>No check-ins today.</Text>}
        </View>

        {/* Action Buttons */}
        <AnimatedCard delay={800}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setModalVisible(true);
            }}
          >
            <Text style={styles.actionButtonText}>Log a Check-in</Text>
          </TouchableOpacity>
        </AnimatedCard>

        <AnimatedCard delay={900}>
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={simulateTelemetry}
          >
            <Text style={styles.secondaryButtonText}>Simulate Activity</Text>
          </TouchableOpacity>
        </AnimatedCard>

        {/* Check-in Modal */}
        <Modal visible={isModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {showSuccess ? (
                <View style={styles.successContainer}>
                  <Text style={styles.successEmoji}>✅</Text>
                  <Text style={styles.successText}>Log Saved</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.modalTitle}>Daily Wellness Check-in</Text>
                  
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={styles.inputLabel}>How's your mood?</Text>
                    <View style={styles.moodRow}>
                      {MOODS.map(m => (
                        <TouchableOpacity 
                          key={m.label} 
                          onPress={() => handleMoodSelect(m.label)}
                          style={[styles.moodItem, selectedMood === m.label && styles.moodItemSelected]}
                        >
                          <Text style={styles.moodEmoji}>{m.emoji}</Text>
                          <Text style={styles.moodLabel}>{m.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <MetricSlider 
                      label="Energy Level" 
                      value={energyLevel} 
                      max={10} 
                      onSelect={(v) => { setEnergyLevel(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} 
                    />
                    
                    <MetricSlider 
                      label="Sleep Quality (Last Night)" 
                      value={sleepQuality} 
                      max={5} 
                      onSelect={(v) => { setSleepQuality(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} 
                    />

                    <MetricSlider 
                      label="Focus & Clarity" 
                      value={focusLevel} 
                      max={5} 
                      onSelect={(v) => { setFocusLevel(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} 
                    />

                    <MetricSlider 
                      label="Social Connection" 
                      value={socialEngagement} 
                      max={5} 
                      onSelect={(v) => { setSocialEngagement(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} 
                    />

                    <Text style={styles.inputLabel}>Any notes?</Text>
                    <TextInput 
                      style={styles.textInput} 
                      placeholder="Optional notes..." 
                      value={note}
                      onChangeText={setNote}
                      multiline
                    />

                    <TouchableOpacity style={styles.submitButton} onPress={handleCheckIn} disabled={isSubmitting}>
                      {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>Save Check-in</Text>}
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA', 
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 32,
  },
  greeting: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  username: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 4,
  },
  scoreCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
  },
  scoreCardTitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scoreUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 8,
  },
  scoreDescription: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  insightIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  insightIcon: {
    fontSize: 24,
  },
  insightTextContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  insightDetail: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  checkinCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  checkinMood: {
    fontSize: 32,
    marginRight: 16,
  },
  checkinLabel: {
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2,
  },
  checkinNote: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  checkinTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontStyle: 'italic',
    padding: 20,
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  metricTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 4,
  },
  tag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 48,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 24,
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  moodItem: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
  },
  moodItemSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  moodEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  energyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  energyDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  energyDotActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 32,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingSquare: 16,
    alignItems: 'center',
    paddingVertical: 18,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#EF4444',
    padding: 10,
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  errorBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  }
});
