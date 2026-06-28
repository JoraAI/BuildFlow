import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { AdaptiveSheet } from '@/components/layout/AdaptiveSheet';
import {
  Card,
  Badge,
  Button,
  EmptyState,
  LoadingSkeleton,
  Input,
  DateField,
  ProgressBar,
} from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { alertAsync } from '@/utils/confirm';
import { formatDate, daysBetween } from '@/utils/format';
import { todayDateOnly } from '@/utils/date-field';
import {
  useGantt,
  useTasks,
  useCreateTask,
  useUpdateTaskProgress,
  useDeleteTask,
  type GanttTask,
  type TaskRow,
} from '@/services/project.queries';

const TASK_BAR_COLORS: Record<string, string> = {
  NOT_STARTED: '#94A3B8',
  IN_PROGRESS: '#1E3A5F',
  COMPLETED: '#10B981',
  DELAYED: '#EF4444',
  ON_HOLD: '#F59E0B',
};

const PROGRESS_PRESETS = [0, 25, 50, 75, 100];

function dateOnlyToIso(dateOnly: string): string {
  return new Date(`${dateOnly}T12:00:00`).toISOString();
}

interface ScheduleTabProps {
  projectId: string;
}

export function ScheduleTab({ projectId }: ScheduleTabProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'PM';
  const canUpdateProgress =
    user?.role === 'OWNER' || user?.role === 'PM' || user?.role === 'SUPERVISOR';

  const ganttQ = useGantt(projectId);
  const tasksQ = useTasks(projectId);
  const createTask = useCreateTask(projectId);
  const updateProgress = useUpdateTaskProgress(projectId);
  const deleteTask = useDeleteTask(projectId);

  const [addOpen, setAddOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [startDate, setStartDate] = useState(todayDateOnly());
  const [durationDays, setDurationDays] = useState('5');
  const [formError, setFormError] = useState<string | null>(null);

  const isLoading = ganttQ.isLoading || tasksQ.isLoading;
  const gantt = ganttQ.data;
  const tasks = tasksQ.data ?? [];

  const resetForm = () => {
    setTaskName('');
    setStartDate(todayDateOnly());
    setDurationDays('5');
    setFormError(null);
  };

  const onCreateTask = () => {
    if (!taskName.trim()) {
      setFormError('Task name is required.');
      return;
    }
    const duration = parseInt(durationDays, 10);
    if (!duration || duration < 1) {
      setFormError('Duration must be at least 1 day.');
      return;
    }
    setFormError(null);
    createTask.mutate(
      {
        name: taskName.trim(),
        startDate: dateOnlyToIso(startDate),
        durationDays: duration,
        progressPct: 0,
        status: 'NOT_STARTED',
      },
      {
        onSuccess: async () => {
          setAddOpen(false);
          resetForm();
          await alertAsync('Task added', 'The schedule has been updated.');
        },
        onError: async (e: Error) => {
          setFormError(e.message);
        },
      },
    );
  };

  const onProgressChange = (taskId: string, progressPct: number) => {
    updateProgress.mutate(
      { taskId, progressPct },
      {
        onError: (e: Error) => Alert.alert('Error', e.message),
      },
    );
  };

  const onDeleteTask = (taskId: string, name: string) => {
    Alert.alert('Delete task?', `Remove "${name}" from the schedule?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTask.mutate(taskId, {
            onError: (e: Error) => Alert.alert('Error', e.message),
          });
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="gap-3">
        {[1, 2, 3, 4].map((i) => (
          <LoadingSkeleton key={i} className="h-12 rounded-lg" />
        ))}
      </View>
    );
  }

  return (
    <View className="gap-4">
      {canManage && tasks.length > 0 && (
        <Button
          label="Add task"
          onPress={() => {
            resetForm();
            setAddOpen(true);
          }}
          fullWidth
        />
      )}

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks scheduled"
          description={
            canManage
              ? 'Add tasks with start dates and durations to build your Gantt chart and critical path. BOQ conversion does not create schedule tasks automatically.'
              : 'The project manager has not added schedule tasks yet. Daily site updates are logged under the Reports tab.'
          }
          action={
            canManage ? (
              <Button
                label="Add first task"
                onPress={() => {
                  resetForm();
                  setAddOpen(true);
                }}
              />
            ) : undefined
          }
        />
      ) : (
        <>
          {gantt && gantt.tasks.length > 0 && (
            <GanttChart gantt={gantt} />
          )}

          <Text className="text-sm font-bold text-text">Task list</Text>
          {canManage && (
            <Text className="text-xs text-muted">
              Schedule % tracks time progress. For client billing quantities use BOQ tab → Record
              measurement, then Accounting → Running Account invoice.
            </Text>
          )}
          {tasks.map((task: TaskRow) => (
            <Card key={task.id}>
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-2">
                  <Text className="text-sm font-semibold text-text">{task.name}</Text>
                  {task.startDate && task.endDate ? (
                    <Text className="text-xs text-muted mt-0.5">
                      {formatDate(task.startDate)} – {formatDate(task.endDate)} ({task.durationDays}d)
                    </Text>
                  ) : (
                    <Text className="text-xs text-muted mt-0.5 italic">Dates not set</Text>
                  )}
                  {task.assignee && (
                    <Text className="text-xs text-muted mt-0.5">Assigned: {task.assignee.name}</Text>
                  )}
                </View>
                <Badge
                  color={
                    task.status === 'COMPLETED'
                      ? 'success'
                      : task.status === 'DELAYED'
                        ? 'danger'
                        : task.status === 'IN_PROGRESS'
                          ? 'primary'
                          : 'neutral'
                  }
                  label={task.status.replace('_', ' ')}
                />
              </View>

              <View className="mb-2">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-muted">Progress</Text>
                  <Text className="text-xs font-medium text-text">{task.progressPct}%</Text>
                </View>
                <ProgressBar value={task.progressPct} color="#1E3A5F" />
              </View>

              {canUpdateProgress && (
                <View className="flex-row flex-wrap gap-2 mb-2">
                  {PROGRESS_PRESETS.map((pct) => (
                    <Pressable
                      key={pct}
                      onPress={() => onProgressChange(task.id, pct)}
                      disabled={updateProgress.isPending}
                      className={`px-3 py-1.5 rounded-full border ${
                        task.progressPct === pct
                          ? 'bg-primary border-primary'
                          : 'bg-card border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          task.progressPct === pct ? 'text-white' : 'text-muted'
                        }`}
                      >
                        {pct}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {canManage && (
                <Button
                  label="Delete"
                  variant="secondary"
                  onPress={() => onDeleteTask(task.id, task.name)}
                  disabled={deleteTask.isPending}
                />
              )}
            </Card>
          ))}
        </>
      )}

      <AdaptiveSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add schedule task"
        subtitle="Tasks appear on the Gantt chart once start date and duration are set."
        footer={
          <View className="flex-row gap-3">
            <Button label="Cancel" variant="secondary" onPress={() => setAddOpen(false)} />
            <Button
              label={createTask.isPending ? 'Saving...' : 'Add task'}
              onPress={onCreateTask}
              disabled={createTask.isPending}
            />
          </View>
        }
      >
        {formError ? (
          <Text className="text-sm text-danger mb-3">{formError}</Text>
        ) : null}
        <Input
          label="Task name"
          value={taskName}
          onChangeText={setTaskName}
          placeholder="e.g. Earthwork excavation"
        />
        <DateField label="Start date" value={startDate} onChange={setStartDate} />
        <Input
          label="Duration (days)"
          value={durationDays}
          onChangeText={setDurationDays}
          keyboardType="numeric"
          placeholder="5"
        />
      </AdaptiveSheet>
    </View>
  );
}

function GanttChart({ gantt }: { gantt: { tasks: GanttTask[]; criticalPath: string[]; projectStart: string | null; projectEnd: string | null } }) {
  const projectStart = gantt.projectStart ? new Date(gantt.projectStart) : new Date();
  const projectEnd = gantt.projectEnd ? new Date(gantt.projectEnd) : new Date();
  const totalDays = Math.max(1, daysBetween(projectStart, projectEnd));

  return (
    <Card>
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-sm font-bold text-text">Gantt chart</Text>
        <Badge color="danger" label={`${gantt.criticalPath.length} critical`} />
      </View>

      <View className="flex-row flex-wrap gap-2 mb-3">
        {Object.entries(TASK_BAR_COLORS).map(([status, color]) => (
          <View key={status} className="flex-row items-center gap-1">
            <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <Text className="text-xs text-muted">{status.replace('_', ' ')}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: 600 }}>
          <View className="flex-row border-b border-border pb-1 mb-1">
            <View style={{ width: 200 }}>
              <Text className="text-xs font-semibold text-muted">Task</Text>
            </View>
            <View className="flex-1 flex-row justify-between px-2">
              <Text className="text-xs text-muted">{formatDate(projectStart)}</Text>
              <Text className="text-xs text-muted">{formatDate(projectEnd)}</Text>
            </View>
          </View>
          {gantt.tasks.map((task) => (
            <GanttRow key={task.id} task={task} projectStart={projectStart} totalDays={totalDays} />
          ))}
        </View>
      </ScrollView>
    </Card>
  );
}

function GanttRow({
  task,
  projectStart,
  totalDays,
}: {
  task: GanttTask;
  projectStart: Date;
  totalDays: number;
}) {
  if (!task.startDate || !task.endDate) {
    return (
      <View className="flex-row items-center py-1.5 border-b border-border/50">
        <View style={{ width: 200 }} className="pr-2">
          <Text className="text-xs text-text" numberOfLines={1}>
            {task.isCritical ? '🔴 ' : ''}
            {task.name}
          </Text>
        </View>
        <View className="flex-1 px-2">
          <Text className="text-xs text-muted italic">No dates set</Text>
        </View>
      </View>
    );
  }

  const start = new Date(task.startDate);
  const end = new Date(task.endDate);
  const offsetDays = Math.max(0, daysBetween(projectStart, start));
  const duration = Math.max(1, daysBetween(start, end));
  const offsetPct = (offsetDays / totalDays) * 100;
  const widthPct = Math.min(100 - offsetPct, (duration / totalDays) * 100);
  const barColor = task.isCritical ? '#EF4444' : TASK_BAR_COLORS[task.status] ?? '#1E3A5F';

  return (
    <View className="flex-row items-center py-1.5 border-b border-border/50">
      <View style={{ width: 200 }} className="pr-2">
        <Text className="text-xs text-text" numberOfLines={1}>
          {task.isCritical ? '🔴 ' : ''}
          {task.name}
        </Text>
      </View>
      <View className="flex-1 px-2">
        <View className="h-5 bg-border/40 rounded relative">
          <View
            className="h-5 rounded absolute flex-row items-center"
            style={{
              left: `${offsetPct}%`,
              width: `${widthPct}%`,
              backgroundColor: barColor,
            }}
          >
            {task.progressPct > 0 && (
              <View
                className="h-5 rounded absolute left-0 top-0 opacity-30 bg-white"
                style={{ width: `${task.progressPct}%` }}
              />
            )}
            <Text className="text-[10px] text-white px-1" numberOfLines={1}>
              {task.progressPct}%
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
