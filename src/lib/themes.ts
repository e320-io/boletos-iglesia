// Theme configuration per event slug
export interface EventTheme {
  // CSS variables
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  accent: string;
  accentGlow: string;
  accentDark: string;
  success: string;
  warning: string;
  danger: string;
  text: string;
  textMuted: string;
  // Fonts
  fontDisplay: string;
  fontBody: string;
  fontImport: string;
  // Seat colors (for legacy women)
  seatAvailable: string;
  seatAvailableHover: string;
  seatOccupied: string;
  seatSelected: string;
  seatSelectedGlow: string;
  // Gradient
  gradient: string;
  gradientButton: string;
  // Email
  emailHeaderBg: string;
  emailAccent: string;
  // Logo/icon
  icon: string;
  // Mode
  isDark: boolean;
}

export const EVENT_THEMES: Record<string, EventTheme> = {
  // Default dark theme (Encuentro and fallback)
  default: {
    bg: '#0a0e1a',
    surface: '#111827',
    surfaceHover: '#1a2236',
    border: '#1e293b',
    accent: '#00bcd4',
    accentGlow: 'rgba(0, 188, 212, 0.15)',
    accentDark: '#0097a7',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    fontDisplay: "'Outfit', sans-serif",
    fontBody: "'DM Sans', sans-serif",
    fontImport: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap',
    seatAvailable: 'rgba(16, 185, 129, 0.2)',
    seatAvailableHover: 'rgba(16, 185, 129, 0.4)',
    seatOccupied: 'rgba(0, 188, 212, 0.3)',
    seatSelected: '#00bcd4',
    seatSelectedGlow: 'rgba(0, 188, 212, 0.5)',
    gradient: 'linear-gradient(135deg, #00bcd4, #0097a7)',
    gradientButton: 'linear-gradient(135deg, #00bcd4, #0097a7)',
    emailHeaderBg: 'linear-gradient(135deg,#1e3a5f,#0a1628)',
    emailAccent: '#00bcd4',
    icon: '✦',
    isDark: true,
  },

  // Legacy Women — editorial, elegant, warm
  'legacy-women': {
    bg: '#f5f0ea',
    surface: '#ffffff',
    surfaceHover: '#faf7f4',
    border: '#e0d5c7',
    accent: '#6b4c3b',
    accentGlow: 'rgba(107, 76, 59, 0.12)',
    accentDark: '#4a3428',
    success: '#6b8f5e',
    warning: '#c49a4a',
    danger: '#b85450',
    text: '#2c1f16',
    textMuted: '#8c7b6b',
    fontDisplay: "'Playfair Display', serif",
    fontBody: "'Source Sans 3', sans-serif",
    fontImport: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap',
    seatAvailable: 'rgba(107, 143, 94, 0.15)',
    seatAvailableHover: 'rgba(107, 143, 94, 0.3)',
    seatOccupied: 'rgba(107, 76, 59, 0.2)',
    seatSelected: '#6b4c3b',
    seatSelectedGlow: 'rgba(107, 76, 59, 0.4)',
    gradient: 'linear-gradient(135deg, #6b4c3b, #4a3428)',
    gradientButton: 'linear-gradient(135deg, #6b4c3b, #4a3428)',
    emailHeaderBg: 'linear-gradient(135deg, #6b4c3b, #4a3428)',
    emailAccent: '#6b4c3b',
    icon: '♛',
    isDark: false,
  },
};

export function getTheme(slug: string): EventTheme {
  return EVENT_THEMES[slug] || EVENT_THEMES['default'];
}

// Apply theme CSS variables to document
export function applyTheme(slug: string) {
  const theme = getTheme(slug);
  const root = document.documentElement;

  root.style.setProperty('--color-bg', theme.bg);
  root.style.setProperty('--color-surface', theme.surface);
  root.style.setProperty('--color-surface-hover', theme.surfaceHover);
  root.style.setProperty('--color-border', theme.border);
  root.style.setProperty('--color-accent', theme.accent);
  root.style.setProperty('--color-accent-glow', theme.accentGlow);
  root.style.setProperty('--color-success', theme.success);
  root.style.setProperty('--color-warning', theme.warning);
  root.style.setProperty('--color-danger', theme.danger);
  root.style.setProperty('--color-text', theme.text);
  root.style.setProperty('--color-text-muted', theme.textMuted);
  root.style.setProperty('--font-display', theme.fontDisplay);
  root.style.setProperty('--font-body', theme.fontBody);

  // Load fonts
  const existingLink = document.getElementById('theme-fonts');
  if (existingLink) existingLink.remove();
  const link = document.createElement('link');
  link.id = 'theme-fonts';
  link.rel = 'stylesheet';
  link.href = theme.fontImport;
  document.head.appendChild(link);

  // Update body classes for light/dark
  if (theme.isDark) {
    document.body.classList.add('theme-dark');
    document.body.classList.remove('theme-light');
  } else {
    document.body.classList.add('theme-light');
    document.body.classList.remove('theme-dark');
  }
}

// Reset to default
export function resetTheme() {
  applyTheme('default');
}
