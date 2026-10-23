export const lightColors = {
  // Phase 14 Luxury Palette (Light)
  background: '#FFFCF7', // Warm ivory
  champagne: '#F4EBDD',  // Champagne beige
  taupe: '#B8A58C',      // Soft taupe
  gold: '#B08D57',       // Elegant muted gold
  goldSoft: '#F6EFE6',   // Soft gold accent tint
  goldLight: '#FAF4EB',  // Subtle gold background tint
  goldDark: '#8C6C38',   // Deep antique gold
  espresso: '#30231F',   // Espresso brown (primary luxury tone)
  charcoal: '#49413D',   // Warm charcoal
  ink: '#30231F',        // Primary text (espresso brown)
  muted: '#7A6E65',      // Secondary text (warm muted)
  subtle: '#A89B8F',     // Tertiary/placeholder
  surface: '#FFFFFF',    // Crisp surface
  surfaceWarm: '#FAF6F0',// Warm card surface
  card: '#FFFFFF',       // Card surface
  border: '#EFE7DC',     // Subtle champagne border
  borderLight: '#F7F2EA',// Light border
  success: '#4E7055',    // Soft sage green
  successSoft: '#EBF1EC',// Sage background tint
  successBorder: '#D4E2D6',
  warning: '#B57C32',    // Warm amber
  warningSoft: '#FDF6EB',
  warningBorder: '#F0DEC2',
  danger: '#B85D43',     // Muted terracotta
  dangerSoft: '#F9ECE8', // Terracotta background tint
  dangerBorder: '#F0D5CE',
  sand: '#F4EBDD',
  slate: '#49413D'
};

export const darkColors = {
  // Luxury Dark Palette for Book My Salon
  background: '#12100E', // Deep warm obsidian/black
  champagne: '#2D251F',  // Dark champagne
  taupe: '#C4B5A5',      // Soft warm taupe
  gold: '#D4AF37',       // Luminous warm gold
  goldSoft: '#2B2319',   // Dark gold tint
  goldLight: '#241D14',  // Dark gold background tint
  goldDark: '#F5E4B8',   // Bright antique gold
  espresso: '#F5EFEB',   // Inverse of espresso: warm crisp light tone
  charcoal: '#D5CDC4',   // Muted light
  ink: '#F8F4EE',        // Primary text: crisp warm ivory
  muted: '#A89D93',      // Secondary text: clear readable warm gray
  subtle: '#786E66',     // Placeholder text
  surface: '#1B1714',    // Elevated card surface
  surfaceWarm: '#241E1A',// Elevated warmer card surface
  card: '#1B1714',       // Card background
  border: '#332B25',     // Clearly visible dark border
  borderLight: '#26201B',// Subtle dark border
  success: '#629E6C',    // Luminous sage
  successSoft: '#172B1C',// Dark sage tint
  successBorder: '#2B4A30',
  warning: '#E29A38',    // Luminous warm amber
  warningSoft: '#302110',// Dark amber tint
  warningBorder: '#543818',
  danger: '#E26B50',     // Luminous terracotta
  dangerSoft: '#301813', // Dark terracotta tint
  dangerBorder: '#5A261C',
  sand: '#26201B',
  slate: '#E8DFD5'
};

export type ThemeColors = typeof lightColors;
export const colors = lightColors;

export const typography = {
  displayLarge: { fontSize: 26, fontWeight: '700' as const, letterSpacing: 0.4, lineHeight: 32 },
  displayMedium: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.3, lineHeight: 28 },
  title: { fontSize: 18, fontWeight: '600' as const, letterSpacing: 0.2, lineHeight: 24 },
  titleSmall: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.1, lineHeight: 22 },
  bodyLarge: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: '500' as const, lineHeight: 17 },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.3 },
  brandOverline: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1.6, textTransform: 'uppercase' as const }
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };