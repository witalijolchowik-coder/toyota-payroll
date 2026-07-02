import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';

interface GlobalErrorBoundaryState {
  hasError: boolean;
}

export class GlobalErrorBoundary extends Component<
  PropsWithChildren,
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application error', error, info);
  }

  private resetApplication = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          component="main"
          sx={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            p: 3,
            bgcolor: 'background.default',
          }}
        >
          <Paper sx={{ width: 'min(100%, 520px)', p: { xs: 3, sm: 5 } }}>
            <Stack spacing={2.5} sx={{ alignItems: 'flex-start' }}>
              <ErrorOutlined color="error" sx={{ fontSize: 44 }} />
              <div>
                <Typography variant="h5" gutterBottom>
                  Something went wrong
                </Typography>
                <Typography color="text.secondary">
                  The application encountered an unexpected error. Reload the
                  workspace to try again.
                </Typography>
              </div>
              <Button variant="contained" onClick={this.resetApplication}>
                Reload application
              </Button>
            </Stack>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
