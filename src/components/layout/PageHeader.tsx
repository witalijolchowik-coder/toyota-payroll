import { Stack, Typography } from '@mui/material';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
      }}
    >
      <div>
        {eyebrow ? (
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 800, letterSpacing: '0.12em' }}
          >
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
          {description}
        </Typography>
      </div>
      {action}
    </Stack>
  );
}
