import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card, Button, Badge } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { useProject, useUpdateProject } from '@/services/project.queries';
import { confirmAsync, alertAsync } from '@/utils/confirm';

const STATUSES = [
  { value: 'PLANNING', label: 'Planning', color: 'neutral' as const },
  { value: 'IN_PROGRESS', label: 'In progress', color: 'warning' as const },
  { value: 'ON_HOLD', label: 'On hold', color: 'neutral' as const },
  { value: 'COMPLETED', label: 'Completed', color: 'success' as const },
  { value: 'CANCELLED', label: 'Cancelled', color: 'danger' as const },
];

export function ProjectStatusSection({ projectId }: { projectId: string }) {
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'OWNER' || user?.role === 'PM';
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const [pending, setPending] = useState<string | null>(null);

  if (!project) return null;

  const current = STATUSES.find((s) => s.value === project.status) ?? STATUSES[0];

  const applyStatus = async (next: string) => {
    if (next === project.status) return;

    if (next === 'COMPLETED') {
      const ok = await confirmAsync(
        'Mark project completed?',
        'This marks the job as closed. You can reopen it later by changing status back to In progress.',
      );
      if (!ok) return;
    }
    if (next === 'CANCELLED') {
      const ok = await confirmAsync(
        'Cancel this project?',
        'Cancelled projects stay in the list for records but are treated as closed.',
      );
      if (!ok) return;
    }

    setPending(next);
    updateProject.mutate(
      { status: next as typeof project.status },
      {
        onSuccess: async () => {
          setPending(null);
          if (next === 'COMPLETED') {
            await alertAsync('Project completed', `${project.name} is now marked completed.`);
          }
        },
        onError: async (e: Error) => {
          setPending(null);
          await alertAsync('Error', e.message);
        },
      },
    );
  };

  return (
    <Card>
      <Text className="text-sm font-bold text-text mb-1">Project status</Text>
      <Text className="text-xs text-muted mb-3">
        Mark completed when handover and final billing are done. Status affects dashboards and project filters.
      </Text>
      <View className="flex-row items-center gap-2 mb-3">
        <Text className="text-xs text-muted">Current:</Text>
        <Badge color={current.color} label={current.label} />
      </View>

      {canEdit ? (
        <View className="gap-2">
          {project.status !== 'COMPLETED' && (
            <Button
              label="Mark project completed"
              onPress={() => applyStatus('COMPLETED')}
              loading={pending === 'COMPLETED' && updateProject.isPending}
              fullWidth
            />
          )}
          <View className="flex-row flex-wrap gap-2">
            {STATUSES.filter((s) => s.value !== 'COMPLETED').map((s) => (
              <Pressable
                key={s.value}
                onPress={() => applyStatus(s.value)}
                disabled={updateProject.isPending}
                className={`px-3 py-2 rounded-lg border ${
                  project.status === s.value ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    project.status === s.value ? 'text-primary' : 'text-muted'
                  }`}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <Text className="text-xs text-muted italic">Only Owner or PM can change project status.</Text>
      )}
    </Card>
  );
}
