import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export const TRIAL_HERO_BENEFITS: { icon: IconName; label: string }[] = [
  { icon: 'checkmark-circle-outline', label: 'Full platform access' },
  { icon: 'card-outline', label: 'No credit card required' },
  { icon: 'close-circle-outline', label: 'Cancel anytime' },
];
