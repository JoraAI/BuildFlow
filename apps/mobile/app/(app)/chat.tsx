/**
 * Legacy /chat route - do not open the assistant here.
 *
 * History back (especially on web) can land on /chat after an earlier visit;
 * opening the overlay on mount caused the assistant to pop up unexpectedly.
 * Use the FAB or useAssistantStore.open() instead.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAssistantStore } from '@/stores/assistant.store';

export default function ChatRedirectScreen() {
  const router = useRouter();

  useEffect(() => {
    useAssistantStore.getState().close();
    router.replace('/dashboard');
  }, [router]);

  return null;
}
