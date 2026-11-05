import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AudioGuidanceButton } from '../AudioGuidanceButton';
import type { WorkerAudioGuideProps } from './types';

export function WorkerAudioGuide({
  text,
  language,
  label,
  size = 'medium',
  style,
  testID,
}: WorkerAudioGuideProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <AudioGuidanceButton
        text={text}
        language={language}
        label={label}
        size={size}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
