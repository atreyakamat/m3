import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Dimensions,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkerIllustration } from './WorkerIllustration';
import { WorkerStepIndicator } from './WorkerStepIndicator';
import { WorkerAudioGuide } from './WorkerAudioGuide';
import type { WorkerGuidedTourProps, IllustrationName } from './types';

export const TOUR_COMPLETION_STORAGE_KEY = '@m3_worker_tour_completed_v1';

interface TourSlide {
  title: string;
  subtitle: string;
  illustration: IllustrationName;
  audioText: string;
}

const TOUR_SLIDES: TourSlide[] = [
  {
    title: 'Welcome to M3 Malaria Surveillance',
    subtitle: 'Protecting your health and your family while working on construction sites in Goa.',
    illustration: 'worker_holding_phone',
    audioText: 'Welcome to M3 Health Surveillance. We protect you and your family from malaria while working in Goa.',
  },
  {
    title: 'Choose Your Language',
    subtitle: 'The app speaks and displays in your native language across 18 Indian languages.',
    illustration: 'worker_selecting_language',
    audioText: 'Select your native language. The app speaks and displays in 18 Indian languages.',
  },
  {
    title: 'Worker Registration',
    subtitle: 'Get your digital health card with simple registration and field worker support.',
    illustration: 'worker_completing_registration',
    audioText: 'Your health identity card. Simple registration with health worker support.',
  },
  {
    title: 'Health Screening',
    subtitle: 'Regular fever checks and rapid malaria tests conducted by local PHC and UHC teams.',
    illustration: 'health_worker_helping_screening',
    audioText: 'Answer fever questions. Health workers help you test for malaria and stay healthy.',
  },
  {
    title: 'Family & Roommates',
    subtitle: 'Add your spouse, children, and accommodation roommates for free medical coverage.',
    illustration: 'worker_adding_family_member',
    audioText: 'Register your spouse, children, and roommates for free health coverage.',
  },
  {
    title: 'QR Worker Pass',
    subtitle: 'Show your instant QR pass to contractors for safe site access and verification.',
    illustration: 'worker_showing_qr_to_contractor',
    audioText: 'Show your QR code on construction sites for safe verification and site assignment.',
  },
  {
    title: 'Travel Outside Goa',
    subtitle: 'Report trips home. We provide testing and health advice when you return.',
    illustration: 'worker_leaving_goa',
    audioText: 'Report when leaving Goa and returning. We ensure you receive testing and medicine upon return.',
  },
  {
    title: 'Feeling Unwell?',
    subtitle: 'Send a quick illness alert or voice message. Doctors and health workers respond quickly.',
    illustration: 'worker_reporting_fever',
    audioText: 'Report fever or sickness anytime. The healthcare team contacts you immediately.',
  },
  {
    title: 'Works Offline Without Internet',
    subtitle: 'Save records anywhere on site. Everything syncs automatically when connection returns.',
    illustration: 'worker_saving_offline',
    audioText: 'Works without internet on your work site. Automatically syncs when internet returns.',
  },
  {
    title: 'You are Ready to Begin!',
    subtitle: 'Tap the button below to enter your M3 Worker application.',
    illustration: 'worker_viewing_completed_submission',
    audioText: 'You are ready to use M3. Tap enter to begin.',
  },
];

export function WorkerGuidedTour({
  visible,
  onFinish,
  initialSlide = 0,
}: WorkerGuidedTourProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(initialSlide);

  if (!visible) return null;

  const currentSlide = TOUR_SLIDES[currentSlideIndex];
  const isFirstSlide = currentSlideIndex === 0;
  const isLastSlide = currentSlideIndex === TOUR_SLIDES.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      void handleComplete();
    } else {
      setCurrentSlideIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstSlide) {
      setCurrentSlideIndex((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(TOUR_COMPLETION_STORAGE_KEY, 'true');
    } catch {
      /* non-fatal */
    }
    onFinish();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <Text style={styles.stepCounterText}>
            Step {currentSlideIndex + 1} of {TOUR_SLIDES.length}
          </Text>
          {!isLastSlide && (
            <Pressable
              onPress={handleComplete}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Skip tour"
            >
              <Text style={styles.skipButtonText}>Skip Tour</Text>
            </Pressable>
          )}
        </View>

        {/* Step Indicator */}
        <WorkerStepIndicator
          currentStep={currentSlideIndex + 1}
          totalSteps={TOUR_SLIDES.length}
        />

        {/* Slide Content */}
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* Main Visual Illustration */}
          <View style={styles.illustrationBox}>
            <WorkerIllustration
              name={currentSlide.illustration}
              width={200}
              height={200}
            />
          </View>

          {/* Heading */}
          <Text style={styles.title}>{currentSlide.title}</Text>

          {/* Subtitle / Plain Explanation */}
          <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>

          {/* Large Audio Guidance Button */}
          <View style={styles.audioContainer}>
            <WorkerAudioGuide
              text={currentSlide.audioText}
              size="large"
              label="Listen in Spoken Audio"
            />
          </View>
        </ScrollView>

        {/* Bottom Navigation Buttons */}
        <View style={styles.bottomBar}>
          {!isFirstSlide && (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.nextButton,
              isFirstSlide && styles.nextButtonFull,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isLastSlide ? 'Enter Application' : 'Next'}
          >
            <Text style={styles.nextButtonText}>
              {isLastSlide ? 'Enter Application ✓' : 'Next →'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  stepCounterText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  skipButton: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  skipButtonText: {
    color: '#0D9488',
    fontSize: 14,
    fontWeight: '700',
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  illustrationBox: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    maxWidth: width * 0.85,
  },
  audioContainer: {
    marginBottom: 10,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
  },
  nextButton: {
    flex: 2,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
