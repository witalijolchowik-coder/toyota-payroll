import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import type { MonthId } from '../../types/firestore';
import { currentPayrollMonthId } from '../../utils/payroll';

export interface AccommodationCategoryInput {
  key: string;
  name: string;
  description: string;
  mediaAmount: number;
  accommodationAmount: number;
  validFrom: MonthId;
}

interface Props {
  onClose: () => void;
  onSubmit: (input: AccommodationCategoryInput) => Promise<void>;
}

export function AccommodationCategoryFormDialog({ onClose, onSubmit }: Props) {
  const t = useTranslations();
  const [key, setKey] = useState('A');
  const [name, setName] = useState('A');
  const [description, setDescription] = useState('');
  const [mediaAmount, setMediaAmount] = useState('500');
  const [accommodationAmount, setAccommodationAmount] = useState('150');
  const [validFrom, setValidFrom] = useState<MonthId>(() =>
    currentPayrollMonthId(new Date()),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const normalizedKey = key
    .trim()
    .toLocaleLowerCase('pl-PL')
    .replace(/\s+/g, '-');
  const media = Number(mediaAmount.replace(',', '.'));
  const accommodation = Number(accommodationAmount.replace(',', '.'));
  const invalid =
    !normalizedKey ||
    !name.trim() ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(validFrom) ||
    !Number.isFinite(media) ||
    media < 0 ||
    !Number.isFinite(accommodation) ||
    accommodation < 0;

  const submit = async () => {
    setShowValidation(true);
    setSaveFailed(false);
    if (invalid) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        key: normalizedKey,
        name: name.trim(),
        description: description.trim(),
        mediaAmount: media,
        accommodationAmount: accommodation,
        validFrom,
      });
      onClose();
    } catch (error) {
      console.error(error);
      setSaveFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{t.settings.accommodation.form.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Alert severity="info">
            {t.settings.accommodation.form.versionInfo}
          </Alert>
          {saveFailed ? (
            <Alert severity="error">
              {t.settings.accommodation.form.saveFailed}
            </Alert>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              required
              fullWidth
              label={t.settings.accommodation.form.key}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              error={showValidation && !normalizedKey}
            />
            <TextField
              required
              fullWidth
              label={t.settings.accommodation.form.name}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={showValidation && !name.trim()}
            />
          </Stack>
          <TextField
            label={t.settings.accommodation.form.description}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            helperText={t.settings.accommodation.form.descriptionHelper}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              required
              fullWidth
              label={t.settings.accommodation.form.media}
              value={mediaAmount}
              onChange={(event) => setMediaAmount(event.target.value)}
              error={showValidation && (!Number.isFinite(media) || media < 0)}
              inputMode="decimal"
            />
            <TextField
              required
              fullWidth
              label={t.settings.accommodation.form.accommodation}
              value={accommodationAmount}
              onChange={(event) => setAccommodationAmount(event.target.value)}
              error={
                showValidation &&
                (!Number.isFinite(accommodation) || accommodation < 0)
              }
              inputMode="decimal"
            />
          </Stack>
          <TextField
            required
            type="month"
            label={t.settings.accommodation.form.validFrom}
            value={validFrom}
            onChange={(event) => setValidFrom(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t.settings.accommodation.form.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={isSubmitting}
        >
          {t.settings.accommodation.form.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
