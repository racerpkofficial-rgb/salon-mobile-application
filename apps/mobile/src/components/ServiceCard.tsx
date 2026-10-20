import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '../constants/theme';
import { Service } from '../types';

interface ServiceCardProps {
  service: Service;
  onBook?: (service: Service) => void;
  selected?: boolean;
}

export function ServiceCard({ service, onBook, selected = false }: ServiceCardProps) {
  const imageUrl =
    service.image ||
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80';

  const durationStr =
    service.duration ||
    (service.durationMinutes ? `${service.durationMinutes} mins` : '45 mins');

  const priceStr =
    typeof service.price === 'number'
      ? `₹${service.price}`
      : `${service.price}`.startsWith('₹')
      ? service.price
      : `₹${service.price}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Service: ${service.name}, ${priceStr}, ${durationStr}`}
      disabled={!onBook}
      onPress={() => onBook?.(service)}
      style={({ pressed }) => [
        s.card,
        selected && s.cardSelected,
        pressed && onBook && s.cardPressed
      ]}
    >
      <Image source={{ uri: imageUrl }} style={s.image} />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>
          {service.name}
        </Text>
        {service.description ? (
          <Text style={s.description} numberOfLines={2}>
            {service.description}
          </Text>
        ) : null}
        <View style={s.metaRow}>
          <Text style={s.price}>{priceStr}</Text>
          <Text style={s.dot}>•</Text>
          <Text style={s.duration}>⏱ {durationStr}</Text>
        </View>
      </View>
      {onBook && (
        <View style={[s.actionBtn, selected && s.actionBtnSelected]}>
          <Text style={[s.actionText, selected && s.actionTextSelected]}>
            {selected ? 'Selected' : 'Book'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: 10,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  cardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceWarm
  },
  cardPressed: {
    opacity: 0.92
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8
  },
  name: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.espresso,
    marginBottom: 2
  },
  description: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: 4,
    lineHeight: 15
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  price: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.goldDark
  },
  dot: {
    color: colors.border,
    marginHorizontal: 6,
    fontSize: 10
  },
  duration: {
    ...typography.caption,
    color: colors.muted
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionBtnSelected: {
    backgroundColor: colors.espresso,
    borderColor: colors.espresso
  },
  actionText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.espresso
  },
  actionTextSelected: {
    color: '#FFFCF7'
  }
});