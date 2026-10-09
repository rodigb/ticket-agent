/*
 * Single source of truth for colours.
 *  - applyTheme() writes the palette to CSS variables on <html> for the chosen light or dark mode.
 *  - tailwindColors maps semantic names to those variables, for tailwind.config.ts.
 * Components use bg-background, bg-surface, border-line, text-body, text-muted, bg-accent
 * and never need a dark: variant for colour.
 */

export type TokenName =
  | 'background'
  | 'surface'
  | 'border'
  | 'textPrimary'
  | 'textSecondary'
  | 'accent'
  | 'accentForeground';

export type Palette = Record<TokenName, string>;

export const light: Palette = {
  background: '#F8F9FA',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  accent: '#2563EB',
  accentForeground: '#FFFFFF',
};

export const dark: Palette = {
  background: '#121212',
  surface: '#1E1E1E',
  border: '#2D2D2D',
  textPrimary: '#E5E7EB',
  // #6B7280 is only 3.5:1 on this surface; #9CA3AF passes WCAG AA (6.6:1).
  textSecondary: '#9CA3AF',
  // Royal blue is 3.2:1 on dark. The green passes (12.4:1) and needs dark text on top.
  // To stay blue in dark mode use '#60A5FA' with accentForeground '#121212'.
  accent: '#00FF85',
  accentForeground: '#121212',
};

const toCssVar = (name: TokenName): string => `--${name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
const v = (name: TokenName): string => `var(${toCssVar(name)})`;

// For tailwind.config.ts: theme.extend.colors
export const tailwindColors = {
  background: v('background'),
  surface: v('surface'),
  line: v('border'),
  body: v('textPrimary'),
  muted: v('textSecondary'),
  accent: {
    DEFAULT: v('accent'),
    foreground: v('accentForeground'),
    hover: `color-mix(in srgb, ${v('accent')} 85%, black)`,
  },
} as const;

export type ThemeMode = 'light' | 'dark';

export function applyTheme(mode: ThemeMode = 'light'): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(mode === 'dark' ? dark : light) as [TokenName, string][]) {
    root.style.setProperty(toCssVar(name), value);
  }
  root.style.colorScheme = mode; // native controls and scrollbars match
  root.classList.toggle('dark', mode === 'dark'); // drives Tailwind's dark: variant
}