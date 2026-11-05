import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WorkerIllustration } from './WorkerIllustration';
import type { WorkerEmptyStateIllustrationProps } from './types';

export function WorkerEmptyStateIllustration({
  illustration,
  title,
  message,
  actionLabel,
  onAction,
  style,
  testID,
}: WorkerEmptyStateIllustrationProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <WorkerIllustration name={illustration} width={140} height={140} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginVertical: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    maxWidth: 280,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 20,
    backgroundColor: '#0D9488',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: '#0F766E',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
