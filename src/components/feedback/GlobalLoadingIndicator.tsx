import { Fade, LinearProgress } from '@mui/material';

interface GlobalLoadingIndicatorProps {
  visible: boolean;
}

export function GlobalLoadingIndicator({
  visible,
}: GlobalLoadingIndicatorProps) {
  return (
    <Fade in={visible} unmountOnExit>
      <LinearProgress
        aria-label="Application loading"
        sx={{
          position: 'fixed',
          inset: '0 0 auto',
          zIndex: (theme) => theme.zIndex.snackbar + 1,
        }}
      />
    </Fade>
  );
}
