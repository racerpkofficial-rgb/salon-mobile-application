import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { colors, radius } from '../constants/theme';

export interface SearchBarHandle {
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
}

export interface SearchBarProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSubmitEditing?: () => void;
}

export const SearchBar = React.memo(
  forwardRef<SearchBarHandle, SearchBarProps>(function SearchBar(
    {
      value,
      onChangeText,
      placeholder = 'Search salons, rituals, or location',
      onClear,
      onSubmitEditing
    },
    ref
  ) {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      isFocused: () => inputRef.current?.isFocused() ?? false
    }));

    const handleClear = useCallback(() => {
      onChangeText('');
      onClear?.();
      inputRef.current?.focus();
    }, [onChangeText, onClear]);

    return (
      <Pressable
        style={[s.box, isFocused && s.boxFocused]}
        onPress={() => inputRef.current?.focus()}
      >
        <Text style={s.icon}>🔍</Text>
        <TextInput
          ref={inputRef}
          value={value ?? ''}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          style={s.input}
          editable={true}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          returnKeyType="search"
          onSubmitEditing={onSubmitEditing}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search salons"
        />
        {Boolean(value && value.length > 0) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            onPress={handleClear}
            style={s.clearBtn}
          >
            <Text style={s.clearIcon}>✕</Text>
          </Pressable>
        )}
      </Pressable>
    );
  })
);

const s = StyleSheet.create({
  box: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14
  },
  boxFocused: {
    borderColor: colors.gold,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3
  },
  icon: {
    fontSize: 16,
    color: colors.muted,
    marginRight: 10
  },
  input: {
    flex: 1,
    height: 48,
    color: colors.espresso,
    fontSize: 14,
    paddingVertical: 0
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6
  },
  clearIcon: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '700'
  }
});