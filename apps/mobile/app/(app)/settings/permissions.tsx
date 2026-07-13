/**
 * BuildFlow - Settings > Role Permissions
 *
 * Owner-only screen for customizing which permissions each role has.
 * Renders a matrix of roles × permission groups with toggle switches.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiFetch } from '@/lib/api-client';
import type { Permission, Role } from '@buildflow/shared';
import { ROLE_LABELS, PERMISSION_GROUPS } from '@buildflow/shared';

interface RolePerms {
  role: Role;
  label: string;
  isCustomized: boolean;
  permissions: Permission[];
}

interface PermissionState {
  roles: RolePerms[];
  permissionCatalog: { key: Permission; label: string }[];
  permissionGroups: { label: string; permissions: Permission[] }[];
}

export default function PermissionsSettingsScreen() {
  const [state, setState] = useState<PermissionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRole, setExpandedRole] = useState<Role | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<PermissionState>('/settings/permissions');
      setState(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const togglePermission = (role: Role, perm: Permission) => {
    if (!state) return;
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        roles: prev.roles.map((r) => {
          if (r.role !== role) return r;
          const has = r.permissions.includes(perm);
          return {
            ...r,
            isCustomized: true,
            permissions: has
              ? r.permissions.filter((p) => p !== perm)
              : [...r.permissions, perm],
          };
        }),
      };
    });
  };

  const saveRole = async (role: Role) => {
    if (!state) return;
    const roleData = state.roles.find((r) => r.role === role);
    if (!roleData) return;

    try {
      setSaving(true);
      await apiFetch(`/settings/permissions/${role}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: roleData.permissions }),
      });
      Alert.alert('Success', `${roleData.label} permissions updated`);
    } catch (err) {
      Alert.alert('Error', 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const resetRole = async (role: Role) => {
    Alert.alert(
      'Reset to Default?',
      'This will restore the system default permissions for this role.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await apiFetch(`/settings/permissions/${role}/reset`, { method: 'POST' });
              await load();
              Alert.alert('Success', 'Permissions reset to default');
            } catch {
              Alert.alert('Error', 'Failed to reset permissions');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#1E3A5F" />
      </SafeAreaView>
    );
  }

  if (!state) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center p-6">
        <Text className="text-muted text-center">Unable to load permissions.</Text>
        <TouchableOpacity onPress={load} className="mt-4 px-4 py-2 bg-primary rounded-lg">
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Only non-OWNER roles can be edited
  const editableRoles = state.roles.filter((r) => r.role !== 'OWNER');

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary font-semibold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-text">Role Permissions</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
        {/* Info banner */}
        <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <Text className="text-blue-900 text-sm">
            Customize what each role can see and do. Changes apply immediately to all
            users with that role. Owner permissions cannot be modified.
          </Text>
        </View>

        {/* Role cards */}
        {editableRoles.map((roleData) => {
          const isExpanded = expandedRole === roleData.role;
          return (
            <View key={roleData.role} className="bg-card rounded-xl border border-border mb-3 overflow-hidden">
              {/* Role header */}
              <TouchableOpacity
                className="p-4 flex-row items-center justify-between"
                onPress={() => setExpandedRole(isExpanded ? null : roleData.role)}
              >
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-text font-semibold text-base">{roleData.label}</Text>
                    {roleData.isCustomized && (
                      <View className="ml-2 bg-amber-100 px-2 py-0.5 rounded">
                        <Text className="text-amber-700 text-xs font-medium">Customized</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-muted text-sm mt-0.5">
                    {roleData.permissions.length} permissions enabled
                  </Text>
                </View>
                <Text className="text-muted text-2xl">{isExpanded ? '−' : '+'}</Text>
              </TouchableOpacity>

              {/* Expanded permission groups */}
              {isExpanded && (
                <View className="border-t border-border px-4 py-3">
                  {state.permissionGroups.map((group) => (
                    <View key={group.label} className="mb-4">
                      <Text className="text-text font-semibold text-sm mb-2 uppercase tracking-wide">
                        {group.label}
                      </Text>
                      {group.permissions.map((perm) => {
                        const enabled = roleData.permissions.includes(perm);
                        const label =
                          state.permissionCatalog.find((p) => p.key === perm)?.label ?? perm;
                        return (
                          <View
                            key={perm}
                            className="flex-row items-center justify-between py-2 border-b border-border/50"
                          >
                            <Text className="text-text text-sm flex-1 pr-2">{label}</Text>
                            <Switch
                              value={enabled}
                              onValueChange={() => togglePermission(roleData.role, perm)}
                              trackColor={{ false: '#E2E8F0', true: '#1E3A5F' }}
                              thumbColor={enabled ? '#FFFFFF' : '#94A3B8'}
                            />
                          </View>
                        );
                      })}
                    </View>
                  ))}

                  {/* Action buttons */}
                  <View className="flex-row gap-3 mt-2">
                    <TouchableOpacity
                      className="flex-1 bg-primary rounded-lg py-2.5 items-center"
                      onPress={() => saveRole(roleData.role)}
                      disabled={saving}
                    >
                      <Text className="text-white font-semibold">
                        {saving ? 'Saving...' : 'Save Changes'}
                      </Text>
                    </TouchableOpacity>
                    {roleData.isCustomized && (
                      <TouchableOpacity
                        className="px-4 border border-border rounded-lg py-2.5 items-center"
                        onPress={() => resetRole(roleData.role)}
                      >
                        <Text className="text-muted font-medium">Reset</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}