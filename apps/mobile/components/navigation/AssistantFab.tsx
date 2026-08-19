import React from 'react';
import { usePathname } from 'expo-router';
import { useAssistantStore } from '@/stores/assistant.store';
import { getProjectIdFromPath } from '@/constants/navigation';
import { AssistantEdgeHandle } from '@/components/assistant/AssistantEdgeHandle';

/**
 * Logged-in assistant launcher (Construction + Inventory).
 * Public pages use the same edge handle via MarketingAssistantFab.
 */
export function AssistantFab() {
  const pathname = usePathname();
  const isOpen = useAssistantStore((s) => s.isOpen);
  const open = useAssistantStore((s) => s.open);
  const projectId = getProjectIdFromPath(pathname) ?? undefined;

  if (isOpen) return null;

  return (
    <AssistantEdgeHandle
      onPress={() => open(projectId)}
      accessibilityLabel="Open BuildFlow Assistant"
    />
  );
}
