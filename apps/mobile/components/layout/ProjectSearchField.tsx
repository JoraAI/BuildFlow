import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  type ViewStyle,
} from 'react-native';
import { createPortal } from 'react-dom';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useProjectSearch, type ProjectListItem } from '@/services/project.queries';

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Planning',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

type AnchorRect = { top: number; left: number; width: number };

function SearchResultRow({
  project,
  index,
  onSelect,
}: {
  project: ProjectListItem;
  index: number;
  onSelect: (project: ProjectListItem) => void;
}) {
  const activate = useCallback(() => onSelect(project), [onSelect, project]);

  if (Platform.OS === 'web') {
    const webPressHandlers = {
      onMouseDown: (e: { preventDefault: () => void }) => {
        e.preventDefault();
        activate();
      },
    };

    return (
      <Pressable
        {...webPressHandlers}
        className={`px-3 py-2.5 active:bg-surface cursor-pointer ${index > 0 ? 'border-t border-border' : ''}`}
      >
        <ResultCopy project={project} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={activate}
      className={`px-3 py-2.5 active:bg-surface ${index > 0 ? 'border-t border-border' : ''}`}
    >
      <ResultCopy project={project} />
    </Pressable>
  );
}

function ResultCopy({ project }: { project: ProjectListItem }) {
  return (
    <>
      <Text className="text-sm font-semibold text-text" numberOfLines={1}>
        {project.name}
      </Text>
      <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
        {project.code}
        {project.clientName ? ` · ${project.clientName}` : ''}
        {STATUS_LABEL[project.status] ? ` · ${STATUS_LABEL[project.status]}` : ''}
      </Text>
    </>
  );
}

export function ProjectSearchField() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);
  const { data: results, isFetching } = useProjectSearch(debouncedQuery, open);
  const trimmed = debouncedQuery.trim();
  const showDropdown = open && trimmed.length > 0;
  const anchorRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (!showDropdown) {
      setAnchor(null);
      return;
    }
    const node = anchorRef.current;
    if (!node) return;

    const measure = () => {
      node.measureInWindow((x, y, width, height) => {
        setAnchor({ top: y + height + 4, left: x, width });
      });
    };

    measure();
    if (Platform.OS === 'web') {
      window.addEventListener('scroll', measure, true);
      window.addEventListener('resize', measure);
      return () => {
        window.removeEventListener('scroll', measure, true);
        window.removeEventListener('resize', measure);
      };
    }
  }, [showDropdown, query, results?.length, isFetching]);

  const clearBlurTimer = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };

  const close = useCallback(() => {
    clearBlurTimer();
    setOpen(false);
  }, []);

  const selectProject = useCallback(
    (project: ProjectListItem) => {
      clearBlurTimer();
      setOpen(false);
      setQuery('');
      router.push(`/projects/${project.id}` as never);
    },
    [router],
  );

  const onFocus = () => {
    clearBlurTimer();
    setOpen(true);
  };

  const onBlur = () => {
    blurTimer.current = setTimeout(close, 220);
  };

  const onSubmit = () => {
    if (results?.[0]) {
      selectProject(results[0]);
    }
  };

  const dropdownBody = isFetching ? (
    <View className="flex-row items-center gap-2 px-3 py-3">
      <ActivityIndicator size="small" color="#1E3A5F" />
      <Text className="text-sm text-muted">Searching…</Text>
    </View>
  ) : results && results.length > 0 ? (
    results.map((project: ProjectListItem, index: number) => (
      <SearchResultRow key={project.id} project={project} index={index} onSelect={selectProject} />
    ))
  ) : (
    <Text className="text-sm text-muted px-3 py-3">No projects match &quot;{trimmed}&quot;</Text>
  );

  const dropdownShellClass =
    'bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-80';

  const nativeDropdown =
    showDropdown && Platform.OS !== 'web' ? (
      <View
        className={`absolute left-0 right-0 top-full mt-1 ${dropdownShellClass}`}
        style={{ zIndex: 1000, elevation: 12 }}
      >
        {dropdownBody}
      </View>
    ) : null;

  const webDropdown =
    showDropdown && Platform.OS === 'web' && typeof document !== 'undefined'
      ? createPortal(
          <>
            <Pressable
              accessibilityLabel="Close project search"
              onPress={close}
              style={
                {
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 9998,
                } as unknown as ViewStyle
              }
            />
            <View
              className={dropdownShellClass}
              style={
                anchor
                  ? ({
                      position: 'fixed',
                      top: anchor.top,
                      left: anchor.left,
                      width: anchor.width,
                      zIndex: 9999,
                      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                    } as unknown as ViewStyle)
                  : ({
                      position: 'fixed',
                      top: 72,
                      left: '50%',
                      width: 280,
                      marginLeft: -140,
                      zIndex: 9999,
                      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                    } as unknown as ViewStyle)
              }
            >
              {dropdownBody}
            </View>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <View ref={anchorRef} className="relative" style={{ minWidth: 220, maxWidth: 280, zIndex: 100 }}>
        <View className="flex-row items-center bg-surface rounded-lg px-3 py-1.5 border border-border">
          <Ionicons name="search-outline" size={16} color="#94A3B8" />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={onFocus}
            onBlur={onBlur}
            onSubmitEditing={onSubmit}
            placeholder="Search projects…"
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            className="flex-1 text-sm text-text ml-2 py-1 min-w-0"
            accessibilityLabel="Search projects"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>
        {nativeDropdown}
      </View>
      {webDropdown}
    </>
  );
}
