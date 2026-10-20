import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { images } from '../constants/images';
import { colors, radius } from '../constants/theme';
import { UserRole } from '../types';

const choices: { role: UserRole; title: string; copy: string; mark: string }[] = [
  {
    role: 'CUSTOMER',
    title: 'Find your next salon',
    copy: 'Discover trusted beauty specialists and book with ease.',
    mark: '✦'
  },
  {
    role: 'SALON_OWNER',
    title: 'Grow your salon',
    copy: 'Join a refined marketplace built around memorable client moments.',
    mark: '◌'
  }
];

export function RoleSelectionScreen({
  onBack,
  onSelect
}: {
  onBack: () => void;
  onSelect: (role: UserRole) => void;
}) {
  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <AppHeader title="Welcome" onBack={onBack} />
      <Text style={s.eyebrow}>BOOK MY SALON MEMBERSHIP</Text>
      <Text style={s.title}>How will you use{'\n'}Book My Salon?</Text>
      <Text style={s.copy}>A thoughtfully designed place for beauty appointments.</Text>
      <Image source={{ uri: images.salon }} style={s.image} />
      {choices.map((c) => (
        <Pressable
          key={c.role}
          onPress={() => onSelect(c.role)}
          style={s.choice}
        >
          <Text style={s.mark}>{c.mark}</Text>
          <View style={s.choiceCopy}>
            <Text style={s.choiceTitle}>{c.title}</Text>
            <Text style={s.choiceBody}>{c.copy}</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </Pressable>
      ))}
      <Text style={s.footer}>Customer accounts are always free.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 35 },
  eyebrow: { color: colors.gold, fontWeight: '700', letterSpacing: 1.5, fontSize: 11, marginTop: 25 },
  title: { fontSize: 32, lineHeight: 37, letterSpacing: -1, color: colors.ink, fontWeight: '700', marginTop: 10 },
  copy: { color: colors.muted, lineHeight: 22, marginTop: 12 },
  image: { height: 155, width: '100%', borderRadius: radius.lg, marginVertical: 25 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 17,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12
  },
  mark: { fontSize: 25, color: colors.gold, width: 40 },
  choiceCopy: { flex: 1 },
  choiceTitle: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  choiceBody: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  arrow: { fontSize: 30, color: colors.ink },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 18 }
});