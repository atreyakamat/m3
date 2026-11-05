import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { WorkerIllustration } from './WorkerIllustration';
import { WorkerAudioGuide } from './WorkerAudioGuide';
import type { WorkerActionGuideProps, ActionGuideWorkflow, IllustrationName } from './types';

interface WorkflowDetails {
  title: string;
  illustration: IllustrationName;
  step1: string;
  step2: string;
  step3: string;
  audioText: string;
}

const WORKFLOW_MAP: Record<ActionGuideWorkflow, WorkflowDetails> = {
  add_household: {
    title: 'How to Add Family & Roommates',
    illustration: 'worker_adding_family_member',
    step1: 'Tap "Add Member" on the household screen',
    step2: 'Show family or roommate details with simple relationship buttons',
    step3: 'Your family is registered for free malaria testing and healthcare',
    audioText: 'To add a family member or roommate, tap add member. Select relationship like spouse or child. They receive free malaria testing.',
  },
  qr_pass: {
    title: 'How to Use Your QR Worker Pass',
    illustration: 'worker_showing_qr_to_contractor',
    step1: 'Tap "QR Worker Pass" to open your pass',
    step2: 'Show the screen to your construction contractor or supervisor',
    step3: 'The contractor scans the code to confirm your site assignment',
    audioText: 'Open your QR pass on the screen. Show it to your contractor. They scan your code to confirm your work site.',
  },
  travel: {
    title: 'How to Report Travel Outside Goa',
    illustration: 'worker_leaving_goa',
    step1: 'Tap "Travel Outside Goa" and choose "Leaving Goa"',
    step2: 'Select your departure date and destination state',
    step3: 'When you return, health workers assist you with arrival check',
    audioText: 'Before travelling home, report your journey in the app. When you return to Goa, healthcare teams check on your health.',
  },
  screening: {
    title: 'How Health Screening Works',
    illustration: 'health_worker_helping_screening',
    step1: 'Health worker or app asks basic fever and symptom questions',
    step2: 'Tap large green Yes or red No buttons',
    step3: 'If fever is present, free rapid blood test is provided',
    audioText: 'Answer simple fever questions. If you feel unwell, a health worker conducts a quick fingerprick test for malaria.',
  },
  unwell: {
    title: 'How to Report Feeling Unwell',
    illustration: 'worker_reporting_fever',
    step1: 'Tap the red "Feeling Unwell" button on your dashboard',
    step2: 'Select symptoms like fever or chills, or hold to record audio',
    step3: 'Your nearby Primary Health Centre receives an alert and visits you',
    audioText: 'If you have fever or chills, tap feeling unwell. You can record a voice message. Doctors receive an alert to help you.',
  },
  profile_correction: {
    title: 'How to Correct Profile Details',
    illustration: 'worker_completing_registration',
    step1: 'Tap "Request Correction" in your profile',
    step2: 'Select the field to update such as name or mobile number',
    step3: 'Platform administrator reviews and updates your card',
    audioText: 'If your name or phone is wrong, submit a correction request. Health administrators review and update your card.',
  },
  offline_sync: {
    title: 'How Offline Mode Protects Your Data',
    illustration: 'worker_saving_offline',
    step1: 'Use the app normally even when there is no mobile network',
    step2: 'Your reports are saved safely inside your phone storage',
    step3: 'Everything automatically synchronises as soon as network returns',
    audioText: 'You can use the app without internet. Your information is saved safely on your phone and sends automatically when network returns.',
  },
};

export function WorkerActionGuide({
  visible,
  workflow,
  onClose,
}: WorkerActionGuideProps) {
  if (!visible) return null;

  const info = WORKFLOW_MAP[workflow] || WORKFLOW_MAP.screening;

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <WorkerIllustration name={info.illustration} width={100} height={100} />
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{info.title}</Text>
              <WorkerAudioGuide text={info.audioText} size="small" label="Listen" />
            </View>
          </View>

          {/* Steps List */}
          <ScrollView style={styles.stepsScroll}>
            <View style={styles.stepItem}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>Step 1: What to do</Text>
                <Text style={styles.stepBody}>{info.step1}</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>Step 2: What to select</Text>
                <Text style={styles.stepBody}>{info.step2}</Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>Step 3: What happens next</Text>
                <Text style={styles.stepBody}>{info.step3}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Dismiss Button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.dismissButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Got it, close help guide"
          >
            <Text style={styles.dismissButtonText}>Got It, Return to App ✓</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 14,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  stepsScroll: {
    maxHeight: 280,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
    marginBottom: 2,
  },
  stepBody: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  dismissButton: {
    backgroundColor: '#0D9488',
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
