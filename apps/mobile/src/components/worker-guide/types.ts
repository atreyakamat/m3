import type { StyleProp, ViewStyle } from 'react-native';

export type IllustrationName =
  | 'worker_holding_phone'
  | 'worker_selecting_language'
  | 'worker_giving_consent'
  | 'worker_completing_registration'
  | 'worker_answering_health_questions'
  | 'health_worker_helping_screening'
  | 'worker_adding_family_member'
  | 'worker_adding_roommate'
  | 'worker_viewing_qr_pass'
  | 'worker_showing_qr_to_contractor'
  | 'worker_leaving_goa'
  | 'worker_returning_to_goa'
  | 'worker_reporting_fever'
  | 'worker_recording_voice'
  | 'worker_viewing_completed_submission'
  | 'worker_saving_offline'
  | 'worker_syncing_online'
  | 'worker_viewing_test_result';

export const ALL_ILLUSTRATIONS: IllustrationName[] = [
  'worker_holding_phone',
  'worker_selecting_language',
  'worker_giving_consent',
  'worker_completing_registration',
  'worker_answering_health_questions',
  'health_worker_helping_screening',
  'worker_adding_family_member',
  'worker_adding_roommate',
  'worker_viewing_qr_pass',
  'worker_showing_qr_to_contractor',
  'worker_leaving_goa',
  'worker_returning_to_goa',
  'worker_reporting_fever',
  'worker_recording_voice',
  'worker_viewing_completed_submission',
  'worker_saving_offline',
  'worker_syncing_online',
  'worker_viewing_test_result',
];

export interface WorkerIllustrationProps {
  name: IllustrationName;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface WorkerStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface WorkerAudioGuideProps {
  text: string;
  language?: string;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface WorkerGuideCardProps {
  illustration: IllustrationName;
  title: string;
  audioText?: string;
  step1: string;
  step2: string;
  step3: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface WorkerGuidedTourProps {
  visible: boolean;
  onFinish: () => void;
  initialSlide?: number;
}

export type ActionGuideWorkflow =
  | 'add_household'
  | 'qr_pass'
  | 'travel'
  | 'screening'
  | 'unwell'
  | 'profile_correction'
  | 'offline_sync';

export interface WorkerActionGuideProps {
  visible: boolean;
  workflow: ActionGuideWorkflow;
  onClose: () => void;
}

export interface WorkerEmptyStateIllustrationProps {
  illustration: IllustrationName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}
