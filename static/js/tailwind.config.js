tailwind.config = {
  theme: {
    extend: {
      colors: {
        bg: '#05080d',
        surface: { 1: '#080e16', 2: '#0c1520', 3: '#111e2e' },
        line:    { 1: '#162030', 2: '#1e2e42' },
        ink:     { 1: '#eef4ff', 2: '#7a9bbf', 3: '#3a5470' },
        // Ghidorah: gold/amber gradient body + an electric yellow-white spark accent
        accent:  { DEFAULT: '#ffb800', 2: '#ff8c00' },
        spark:   '#fff4b8',
        danger:  '#ff3d6b',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow:     '0 0 32px rgba(255,184,0,.25), 0 0 0 1px rgba(255,184,0,.16)',
        'glow-sm':'0 0 14px rgba(255,184,0,.18), 0 0 0 1px rgba(255,184,0,.12)',
      },
      backgroundColor: theme => ({}),
    },
  },
};
