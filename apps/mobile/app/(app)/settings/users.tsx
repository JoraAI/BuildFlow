/**
 * BuildFlow — Users & Roles settings screen.
 *
 * Owner-only. Lists all users in the company with role + active status.
 * Tap to edit role / activate-deactivate.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Avatar, Badge, Button, LoadingSkeleton, EmptyState } from '@/components/ui';
import { useUsers, useUpdateUser, type UserRow } from '@/services/settings.queries';

const ROLES = ['OWNER', 'PM', 'SUPERVISOR', 'ACCOUNTANT'] as const;
type Role = (typeof ROLES)[number];

export default function UsersScreen() {
  const { data: users, isLoading, refetch, isFetching } = useUsers();
  const updateUser = useUpdateUser();
  const [editing, setEditing] = useState<UserRow | null>(null);

  const onSaveRole = (role: Role) => {
    if (!editing) return;
    updateUser.mutate(
      { userId: editing.id, data: { role } },
      {
        onSuccess: () => setEditing(null),
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const onToggleActive = (user: UserRow) => {
    updateUser.mutate(
      { userId: user.id, data: { isActive: !user.isActive } },
      {
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="p-4">
          <LoadingSkeleton className="h-16 mb-3" />
          <LoadingSkeleton className="h-16 mb-3" />
          <LoadingSkeleton className="h-16" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-6"
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      >
        <Text className="text-2xl font-bold text-text pt-4 pb-4">Users & Roles</Text>

        {!users || users.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Users appear here once they register."
          />
        ) : (
          users.map((u: UserRow) => (
            <Card key={u.id} className="mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <Avatar name={u.name} size={44} />
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-bold text-text">{u.name}</Text>
                    <Text className="text-xs text-text-muted">{u.email}</Text>
                  </View>
                </View>
                <Badge
                  label={u.role}
                  color={u.role === 'OWNER' ? 'primary' : 'neutral'}
                />
              </View>

              <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
                <Text
                  className={`text-xs font-semibold ${
                    u.isActive ? 'text-success' : 'text-danger'
                  }`}
                >
                  {u.isActive ? '● Active' : '○ Deactivated'}
                </Text>
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={() => setEditing(u)}
                    className="px-3 py-1.5 rounded-md bg-primary/10 mr-2"
                  >
                    <Text className="text-primary text-xs font-semibold">Change Role</Text>
                  </TouchableOpacity>
                  {u.role !== 'OWNER' && (
                    <TouchableOpacity
                      onPress={() => onToggleActive(u)}
                      className="px-3 py-1.5 rounded-md bg-border"
                    >
                      <Text className="text-text text-xs font-semibold">
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Role picker modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-card rounded-t-2xl p-5">
            <Text className="text-lg font-bold text-text mb-1">Change Role</Text>
            <Text className="text-sm text-text-muted mb-4">
              {editing?.name} · {editing?.email}
            </Text>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => onSaveRole(r)}
                className={`py-3.5 px-4 rounded-lg mb-2 ${
                  editing?.role === r ? 'bg-primary' : 'bg-surface'
                }`}
              >
                <Text
                  className={`text-base font-semibold ${
                    editing?.role === r ? 'text-white' : 'text-text'
                  }`}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
            <Button label="Cancel" variant="ghost" onPress={() => setEditing(null)} fullWidth />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}