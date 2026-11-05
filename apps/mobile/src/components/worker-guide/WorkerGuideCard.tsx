import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WorkerIllustration } from './WorkerIllustration';
import { WorkerAudioGuide } from './WorkerAudioGuide';
import type { WorkerGuideCardProps } from './types';

export function WorkerGuideCard({
  illustration,
  title,
  audioText,
  step1,
  step2,
  step3,
  actionLabel,
  onAction,
  style,
  testID,
}: WorkerGuideCardProps) {
  const speechText =
    audioText || `${title}. Step 1: ${step1}. Step 2: ${step2}. Step 3: ${step3}.`;

  return (
    <View style={[styles.card, style]} testID={testID}>
      {/* Top Banner with Illustration & Title */}
      <View style={styles.header}>
        <WorkerIllustration name={illustration} width={100} height={100} />
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.audioRow}>
            <WorkerAudioGuide
              text={speechText}
              size="small"
              label="Listen"
            />
          </View>
        </View>
      </View>

      {/* 3-Step Human Visual Sequence */}
      <View style={styles.stepsContainer}>
        <View style={styles.stepRow}>
          <View style={styles.stepNumberBadge}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>1. {step1}</Text>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepNumberBadge}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>2. {step2}</Text>
        </View>

        <View style={styles.stepRow}>
          <View style={styles.stepNumberBadge}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>3. {step3}</Text>
        </View>
      </View>

      {/* Optional Action Button */}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  audioRow: {
    alignItems: 'flex-start',
  },
  stepsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
  },
  actionButton: {
    marginTop: 14,
    backgroundColor: '#0D9488',
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionButtonPressed: {
    backgroundColor: '#0F766E',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
