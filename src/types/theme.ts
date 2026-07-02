import type { PaletteMode } from '@mui/material';

export interface ThemeModeContextValue {
  mode: PaletteMode;
  toggleMode: () => void;
}
