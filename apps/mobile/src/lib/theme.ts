import { useColorScheme } from 'react-native';

const light = {
  bg: '#faf7f2',
  surface: '#ffffff',
  surface2: '#f3eee6',
  ink: '#1d1a16',
  muted: '#6b645a',
  line: '#e7e0d5',
  brand: '#e2603a',
  brandInk: '#ffffff',
  ok: '#2f7d4f',
  warn: '#9a6400',
  danger: '#b4372b',
};

const dark: typeof light = {
  bg: '#16130f',
  surface: '#201c17',
  surface2: '#2a251f',
  ink: '#f3ede4',
  muted: '#a99f92',
  line: '#3a332b',
  brand: '#f07a52',
  brandInk: '#1a0d07',
  ok: '#6fcf94',
  warn: '#f2bd5c',
  danger: '#f08070',
};

export function useTheme() {
  const scheme = useColorScheme();
  return { dark: scheme === 'dark', c: scheme === 'dark' ? dark : light };
}
