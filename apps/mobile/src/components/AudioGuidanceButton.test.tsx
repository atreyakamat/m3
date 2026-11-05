import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { AudioGuidanceButton, mapSpeechLanguage, audioButtonStyles } from './AudioGuidanceButton';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

describe('AudioGuidanceButton & Low-Literacy Audio Controls (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Accessibility & Touch Targets (Phase 2.1)', () => {
    it('enforces a minimum touch target height of at least 48 dp on all button variants', () => {
      // Standard / medium button must be at least 48 dp
      expect(audioButtonStyles.button.minHeight).toBeGreaterThanOrEqual(48);
      // Small button variant must also meet the 48 dp minimum touch target
      expect(audioButtonStyles.buttonSmall.minHeight).toBeGreaterThanOrEqual(48);
      // Large button variant must be at least 48 dp
      expect(audioButtonStyles.buttonLarge.minHeight).toBeGreaterThanOrEqual(48);
    });
  });

  describe('Speech Language Mapping for 18 Supported Languages (Phase 2.2)', () => {
    it('correctly maps all 18 supported Indian languages', () => {
      // Primary scheduled languages
      expect(mapSpeechLanguage('en')).toBe('en-IN');
      expect(mapSpeechLanguage('hi')).toBe('hi-IN');
      expect(mapSpeechLanguage('bn')).toBe('bn-IN');
      expect(mapSpeechLanguage('mr')).toBe('mr-IN');
      expect(mapSpeechLanguage('kn')).toBe('kn-IN');
      expect(mapSpeechLanguage('te')).toBe('te-IN');
      expect(mapSpeechLanguage('ta')).toBe('ta-IN');
      expect(mapSpeechLanguage('ml')).toBe('ml-IN');
      expect(mapSpeechLanguage('gu')).toBe('gu-IN');
      expect(mapSpeechLanguage('pa')).toBe('pa-IN');
      expect(mapSpeechLanguage('ur')).toBe('ur-IN');
      expect(mapSpeechLanguage('or')).toBe('or-IN');
      expect(mapSpeechLanguage('as')).toBe('as-IN');

      // Dialects & regional Indic languages
      expect(mapSpeechLanguage('kok')).toBe('hi-IN');
      expect(mapSpeechLanguage('bho')).toBe('hi-IN');
      expect(mapSpeechLanguage('mai')).toBe('hi-IN');
      expect(mapSpeechLanguage('hne')).toBe('hi-IN');

      // Santali (sat) must map to an Indic speech synthesizer (hi-IN / bn-IN) NOT en-IN
      expect(mapSpeechLanguage('sat')).toBe('hi-IN');
    });
  });

  describe('Audio Playback & Toggle Controls', () => {
    it('initiates speech with slower playback rate (0.9) for low-literacy clarity when pressed', async () => {
      const { getByRole } = render(
        <AudioGuidanceButton text="Test malaria surveillance instruction" language="hi" label="Listen" />
      );

      const button = getByRole('button');
      await act(async () => {
        fireEvent.press(button);
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          'Test malaria surveillance instruction',
          expect.objectContaining({
            language: 'hi-IN',
            rate: 0.9,
            pitch: 1.0,
          })
        );
      });
    });

    it('stops speech when pressed while already speaking', async () => {
      (Speech.isSpeakingAsync as jest.Mock).mockResolvedValueOnce(true);

      const { getByRole } = render(
        <AudioGuidanceButton text="Test stop instruction" language="en" />
      );

      const button = getByRole('button');
      await act(async () => {
        fireEvent.press(button);
      });

      await waitFor(() => {
        expect(Speech.stop).toHaveBeenCalled();
      });
    });

    it('stops speech when the component unmounts', () => {
      const { unmount } = render(
        <AudioGuidanceButton text="Test unmount instruction" language="en" />
      );

      unmount();
      expect(Speech.stop).toHaveBeenCalled();
    });
  });
});

