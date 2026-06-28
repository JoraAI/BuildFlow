import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { Card, Button, LoadingSkeleton, EmptyState, Badge } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';
import { useAuthStore } from '@/stores/auth.store';
import { useProjectMembers, useSetProjectMembers, type ProjectMemberRow } from '@/services/project.queries';
import { useUsers, type UserRow } from '@/services/settings.queries';
import type { Role } from '@buildflow/shared';

const ASSIGNABLE_ROLES: Role[] = ['PM', 'SUPERVISOR', 'ACCOUNTANT'];

interface MemberDraft {
  userId: string;
  role: Role;
}

export function ProjectMembersSection({ projectId }: { projectId: string }) {
  const { isDesktop } = useViewport();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'OWNER';

  const { data: members, isLoading } = useProjectMembers(projectId);
  const { data: users } = useUsers();
  const setMembers = useSetProjectMembers(projectId);

  const [draft, setDraft] = useState<MemberDraft[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (members) {
      setDraft(
        members.map((m: ProjectMemberRow) => ({
          userId: m.userId,
          role: m.role as Role,
        })),
      );
      setDirty(false);
    }
  }, [members]);

  const companyUsers = (users ?? []).filter((u: UserRow) => u.isActive && u.role !== 'OWNER');

  const toggleUser = (u: UserRow) => {
    if (!canEdit) return;
    setDraft((prev) => {
      const exists = prev.find((m) => m.userId === u.id);
      if (exists) {
        setDirty(true);
        return prev.filter((m) => m.userId !== u.id);
      }
      setDirty(true);
      return [...prev, { userId: u.id, role: (u.role === 'OWNER' ? 'PM' : u.role) as Role }];
    });
  };

  const setRole = (userId: string, role: Role) => {
    setDraft((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
    setDirty(true);
  };

  const onSave = () => {
    setMembers.mutate(
      { members: draft },
      {
        onSuccess: () => {
          setDirty(false);
          Alert.alert('Saved', 'Project members updated.');
        },
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  if (isLoading) return <LoadingSkeleton className="h-32 rounded-xl" />;

  return (
    <Card>
      <Text className="text-sm font-bold text-text mb-1">Project Team</Text>
      <Text className="text-xs text-muted mb-3">
        Assign company users to this project with project-specific roles.
      </Text>

      {companyUsers.length === 0 ? (
        <EmptyState title="No users" description="Invite team members from Settings, Users & Roles." />
      ) : (
        <View className="gap-2">
          {companyUsers.map((u: UserRow) => {
            const assigned = draft.find((m) => m.userId === u.id);
            return (
              <View
                key={u.id}
                className={`rounded-lg border p-3 ${
                  assigned ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <Pressable
                  onPress={() => toggleUser(u)}
                  disabled={!canEdit}
                  className="flex-row justify-between items-center"
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-text">{u.name}</Text>
                    <Text className="text-xs text-muted">{u.email}</Text>
                  </View>
                  <Badge
                    color={assigned ? 'success' : 'neutral'}
                    label={assigned ? 'Assigned' : 'Tap to assign'}
                  />
                </Pressable>
                {assigned && canEdit && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                    <View className="flex-row gap-1">
                      {ASSIGNABLE_ROLES.map((role) => (
                        <Pressable
                          key={role}
                          onPress={() => setRole(u.id, role)}
                          className={`px-3 py-1 rounded-full ${
                            assigned.role === role ? 'bg-primary' : 'bg-border'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              assigned.role === role ? 'text-white' : 'text-muted'
                            }`}
                          >
                            {role}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
            );
          })}
        </View>
      )}

      {canEdit && dirty && (
        <View className={`mt-4 ${isDesktop ? 'flex-row justify-end' : ''}`}>
          <Button
            label={setMembers.isPending ? 'Saving...' : 'Save members'}
            onPress={onSave}
            disabled={setMembers.isPending}
            fullWidth={!isDesktop}
          />
        </View>
      )}
    </Card>
  );
}
