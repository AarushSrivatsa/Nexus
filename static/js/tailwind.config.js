tailwind.config = {
  theme: {
    extend: {
      colors: {
        bg: '#05080d',
        surface: { 1: '#080e16', 2: '#0c1520', 3: '#111e2e' },
        line:    { 1: '#162030', 2: '#1e2e42' },
        ink:     { 1: '#eef4ff', 2: '#7a9bbf', 3: '#3a5470' },
        accent:  { DEFAULT: '#00e5ff', 2: '#0066ff' },
        danger:  '#ff3d6b',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow:     '0 0 32px rgba(0,229,255,.22), 0 0 0 1px rgba(0,229,255,.14)',
        'glow-sm':'0 0 14px rgba(0,229,255,.16), 0 0 0 1px rgba(0,229,255,.10)',
      },
      backgroundColor: theme => ({}),
    },
  },
};
