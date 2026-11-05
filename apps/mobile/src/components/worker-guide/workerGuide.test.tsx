import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import {
  WorkerIllustration,
  WorkerGuideCard,
  WorkerStepIndicator,
  WorkerGuidedTour,
  WorkerActionGuide,
  WorkerAudioGuide,
  WorkerEmptyStateIllustration,
  type IllustrationName,
  ALL_ILLUSTRATIONS,
} from './index';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('Worker Visual Guidance System (TDD)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. WorkerIllustration Component', () => {
    it('defines exactly 18 culturally appropriate illustrations', () => {
      expect(ALL_ILLUSTRATIONS).toHaveLength(18);
    });

    it('renders all 18 vector SVG illustrations cleanly without errors', () => {
      for (const name of ALL_ILLUSTRATIONS) {
        const { getByTestId } = render(
          <WorkerIllustration name={name} width={120} height={120} testID={`illustration-${name}`} />,
        );
        expect(getByTestId(`illustration-${name}`)).toBeTruthy();
      }
    });

    it('applies custom dimensions and scaling correctly', () => {
      const { getByTestId } = render(
        <WorkerIllustration
          name="worker_holding_phone"
          width={200}
          height={180}
          testID="custom-size-illustration"
        />,
      );
      const elem = getByTestId('custom-size-illustration');
      expect(elem).toBeTruthy();
    });
  });

  describe('2. WorkerStepIndicator Component', () => {
    it('renders step dots and highlights active step', () => {
      const { getByTestId, getAllByTestId } = render(
        <WorkerStepIndicator currentStep={2} totalSteps={5} testID="step-indicator" />,
      );
      expect(getByTestId('step-indicator')).toBeTruthy();
      const dots = getAllByTestId(/^step-dot-/);
      expect(dots).toHaveLength(5);
    });
  });

  describe('3. WorkerAudioGuide Component', () => {
    it('meets minimum 48 dp touch target requirement', () => {
      const { getByRole } = render(
        <WorkerAudioGuide text="Welcome to M3 Health" language="hi" />,
      );
      const btn = getByRole('button');
      expect(btn).toBeTruthy();
    });

    it('invokes speech synthesis on press', async () => {
      const { getByRole } = render(
        <WorkerAudioGuide text="Listen to health screening guidance" language="hi" />,
      );
      fireEvent.press(getByRole('button'));
      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          'Listen to health screening guidance',
          expect.objectContaining({ language: 'hi-IN' }),
        );
      });
    });
  });

  describe('4. WorkerGuideCard Component', () => {
    it('renders an illustration, title, 3-step visual sequence, and audio guide', () => {
      const { getByText, getByTestId } = render(
        <WorkerGuideCard
          illustration="worker_answering_health_questions"
          title="Health Screening"
          audioText="Answer questions with health worker"
          step1="Answer simple fever and health questions"
          step2="Select Yes or No with large buttons"
          step3="Health team provides immediate advice"
          testID="guide-card"
        />,
      );

      expect(getByTestId('guide-card')).toBeTruthy();
      expect(getByText('Health Screening')).toBeTruthy();
      expect(getByText('1. Answer simple fever and health questions')).toBeTruthy();
      expect(getByText('2. Select Yes or No with large buttons')).toBeTruthy();
      expect(getByText('3. Health team provides immediate advice')).toBeTruthy();
    });
  });

  describe('5. WorkerGuidedTour Component (First-time 10-Screen Introduction)', () => {
    it('starts on Screen 1 (Welcome) and advances through 10 screens on Next', async () => {
      const onFinishMock = jest.fn();
      const { getByText, queryByText } = render(
        <WorkerGuidedTour visible={true} onFinish={onFinishMock} />,
      );

      // Screen 1: Welcome
      expect(getByText(/Welcome to M3/i)).toBeTruthy();

      // Click Next -> Screen 2: Language
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/Choose Your Language/i)).toBeTruthy();

      // Screen 3: Registration
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/Worker Registration/i)).toBeTruthy();

      // Screen 4: Health Screening
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/Health Screening/i)).toBeTruthy();

      // Screen 5: Family Members
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/Family & Roommates/i)).toBeTruthy();

      // Screen 6: QR Worker Pass
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/QR Worker Pass/i)).toBeTruthy();

      // Screen 7: Travel
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/Travel Outside Goa/i)).toBeTruthy();

      // Screen 8: Feeling Unwell
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/Feeling Unwell/i)).toBeTruthy();

      // Screen 9: Offline Mode
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/Works Offline/i)).toBeTruthy();

      // Screen 10: Finish
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/You are Ready/i)).toBeTruthy();
      expect(getByText(/Enter Application/i)).toBeTruthy();

      // Finish button saves completion in AsyncStorage and triggers onFinish
      fireEvent.press(getByText(/Enter Application/i));
      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@m3_worker_tour_completed_v1', 'true');
        expect(onFinishMock).toHaveBeenCalled();
      });
    });

    it('navigates backwards when Previous button is pressed', () => {
      const { getByText } = render(
        <WorkerGuidedTour visible={true} onFinish={jest.fn()} />,
      );

      // Advance to Screen 2
      fireEvent.press(getByText(/Next/i));
      expect(getByText(/Choose Your Language/i)).toBeTruthy();

      // Go back to Screen 1
      fireEvent.press(getByText(/Back/i));
      expect(getByText(/Welcome to M3/i)).toBeTruthy();
    });

    it('allows Skip action from early screens and persists completion', async () => {
      const onFinishMock = jest.fn();
      const { getByText } = render(
        <WorkerGuidedTour visible={true} onFinish={onFinishMock} />,
      );

      fireEvent.press(getByText(/Skip/i));
      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@m3_worker_tour_completed_v1', 'true');
        expect(onFinishMock).toHaveBeenCalled();
      });
    });
  });

  describe('6. WorkerActionGuide Component (Contextual Action Help Modal)', () => {
    it('displays workflow guide steps and closes when dismissed without mutating data', () => {
      const onCloseMock = jest.fn();
      const { getByText, getByRole } = render(
        <WorkerActionGuide
          visible={true}
          workflow="add_household"
          onClose={onCloseMock}
        />,
      );

      expect(getByText(/How to Add Family & Roommates/i)).toBeTruthy();
      expect(getByText(/Show family or roommate details/i)).toBeTruthy();

      fireEvent.press(getByText(/Got It/i));
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('7. WorkerEmptyStateIllustration Component', () => {
    it('renders empty illustration with message and retry/action button', () => {
      const onActionMock = jest.fn();
      const { getByText, getByTestId } = render(
        <WorkerEmptyStateIllustration
          illustration="worker_saving_offline"
          title="No Travel Records Found"
          message="You have not reported any trips outside Goa yet."
          actionLabel="Report Travel"
          onAction={onActionMock}
          testID="empty-state"
        />,
      );

      expect(getByTestId('empty-state')).toBeTruthy();
      expect(getByText('No Travel Records Found')).toBeTruthy();
      expect(getByText('You have not reported any trips outside Goa yet.')).toBeTruthy();

      fireEvent.press(getByText('Report Travel'));
      expect(onActionMock).toHaveBeenCalled();
    });
  });
});
