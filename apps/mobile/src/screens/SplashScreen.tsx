import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { images } from '../constants/images';
import { colors, radius } from '../constants/theme';

export function SplashScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <ImageBackground source={{ uri: images.hero }} style={s.bg}>
      <View style={s.shade} />
      <View style={s.content}>
        <View>
          <Text style={s.brand}>Book My Salon</Text>
          <Text style={s.tag}>BEAUTY, ON YOUR TIME</Text>
        </View>
        <View>
          <Text style={s.title}>Your best{`\n`}appointment yet.</Text>
          <Text style={s.copy}>Discover exceptional salons and book time made just for you.</Text>
          <Pressable onPress={onContinue} style={s.button}>
            <Text style={s.btnText}>Begin your ritual  →</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(33,23,19,.38)' },
  content: { flex: 1, justifyContent: 'space-between', padding: 28, paddingTop: 78 },
  brand: { fontSize: 31, fontWeight: '700', letterSpacing: -0.5, color: '#fff' },
  tag: { fontSize: 10, letterSpacing: 2, color: '#F8E8CF', fontWeight: '700', marginTop: 5 },
  title: { fontSize: 43, lineHeight: 47, letterSpacing: -1.5, color: '#fff', fontWeight: '700' },
  copy: { fontSize: 16, lineHeight: 24, color: '#FFF7ED', marginTop: 15, maxWidth: 280 },
  button: {
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 29
  },
  btnText: { color: colors.ink, fontSize: 16, fontWeight: '700' }
});