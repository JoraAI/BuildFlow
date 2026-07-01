import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import { GLOSSARY, type GlossaryTermId } from '@/constants/glossary';

interface TermHintProps {
  term: GlossaryTermId;
  /** Optional inline label; defaults to glossary title. */
  label?: string;
  size?: 'sm' | 'md';
}

export function TermHint({ term, label, size = 'sm' }: TermHintProps) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[term];
  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        className="flex-row items-center gap-0.5"
        accessibilityRole="button"
        accessibilityLabel={`Learn about ${entry.title}`}
      >
        {label ? (
          <Text className={`${size === 'sm' ? 'text-xs' : 'text-sm'} text-muted`}>{label}</Text>
        ) : null}
        <Ionicons name="information-circle-outline" size={iconSize} color="#64748B" />
      </Pressable>

      <AdaptiveSheet visible={open} onClose={() => setOpen(false)} title={entry.title} size="md">
        <View className="gap-4">
          <View>
            <Text className="text-xs font-bold text-muted uppercase tracking-wide mb-1">In plain English</Text>
            <Text className="text-sm text-text leading-5">{entry.plain}</Text>
          </View>
          <View>
            <Text className="text-xs font-bold text-muted uppercase tracking-wide mb-1">In BuildFlow</Text>
            <Text className="text-sm text-text leading-5">{entry.inApp}</Text>
          </View>
        </View>
      </AdaptiveSheet>
    </>
  );
}
