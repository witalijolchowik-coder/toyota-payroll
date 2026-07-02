import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import {
  createTheme,
  CssBaseline,
  ThemeProvider,
  type PaletteMode,
} from '@mui/material';

import { ThemeModeContext } from '../contexts/ThemeModeContext';

function createAppTheme(mode: PaletteMode) {
  const isLight = mode === 'light';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#c1121f',
        dark: '#8d0d17',
        light: '#e0525c',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#344054',
      },
      background: {
        default: isLight ? '#f4f6f8' : '#101318',
        paper: isLight ? '#ffffff' : '#181c23',
      },
      text: {
        primary: isLight ? '#1d2939' : '#f2f4f7',
        secondary: isLight ? '#667085' : '#98a2b3',
      },
      divider: isLight ? '#e4e7ec' : '#344054',
    },
    shape: {
      borderRadius: 14,
    },
    typography: {
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h4: {
        fontWeight: 750,
        letterSpacing: '-0.025em',
      },
      h5: {
        fontWeight: 720,
        letterSpacing: '-0.02em',
      },
      h6: {
        fontWeight: 700,
      },
      button: {
        fontWeight: 650,
        textTransform: 'none',
      },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isLight ? '#e4e7ec' : '#344054'}`,
            boxShadow: isLight
              ? '0 1px 2px rgb(16 24 40 / 4%)'
              : '0 1px 2px rgb(0 0 0 / 24%)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<PaletteMode>('light');
  const toggleMode = useCallback(() => {
    setMode((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);
  const contextValue = useMemo(
    () => ({ mode, toggleMode }),
    [mode, toggleMode],
  );
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
