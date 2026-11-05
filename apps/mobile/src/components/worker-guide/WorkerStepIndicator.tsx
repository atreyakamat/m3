import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { WorkerStepIndicatorProps } from './types';

export function WorkerStepIndicator({
  currentStep,
  totalSteps,
  style,
  testID,
}: WorkerStepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {steps.map((step) => {
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <View
            key={`step-${step}`}
            testID={`step-dot-${step}`}
            style={[
              styles.dot,
              isActive && styles.dotActive,
              isCompleted && styles.dotCompleted,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    width: 24,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0D9488',
  },
  dotCompleted: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#14B8A6',
  },
});
