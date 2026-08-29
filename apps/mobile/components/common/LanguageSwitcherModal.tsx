/**
 * BuildFlow - 1-Tap Vernacular Language Switcher Modal (Module 3).
 * Renders a clean grid of languages in their native Indian scripts.
 */
import React from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/constants/i18n';
import { useTranslation } from '@/hooks/useTranslation';

interface LanguageSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSwitcherModal({ visible, onClose }: LanguageSwitcherModalProps) {
  const { language, setLanguage } = useTranslation();

  const handleSelect = (code: SupportedLanguage) => {
    void setLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/60 items-center justify-center p-4"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-card rounded-2xl max-w-md w-full p-5 border border-border shadow-2xl"
        >
          <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-border">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                <Ionicons name="globe-outline" size={20} color="#1E3A5F" />
              </View>
              <View>
                <Text className="text-base font-bold text-text">Choose Language</Text>
                <Text className="text-xs text-muted">भाषा चुनें · மொழியைத் தேர்வுசெய்க</Text>
              </View>
            </View>
            <Pressable onPress={onClose} className="p-1">
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
            <View className="flex-row flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <Pressable
                    key={lang.code}
                    onPress={() => handleSelect(lang.code)}
                    className={`flex-row items-center justify-between p-3 rounded-xl border w-[48%] ${
                      isSelected
                        ? 'bg-primary border-primary'
                        : 'bg-surface border-border active:bg-surface-dark'
                    }`}
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-lg">{lang.flag}</Text>
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-white' : 'text-text'
                        }`}
                      >
                        {lang.label}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
