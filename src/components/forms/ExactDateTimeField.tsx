import { useRef, useState, type ChangeEvent, type FocusEvent } from 'react';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import {
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from '@mui/material';

import {
  formatExactDateForDisplay,
  normalizeExactDateInput,
  normalizeExactTimeInput,
} from '../../utils/forms/exactDateTimeInput';

type SharedFieldProps = Omit<
  TextFieldProps,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'onBlur'
> & {
  value: string;
  onValueChange: (value: string) => void;
  invalidMessage: string;
  pickerLabel: string;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
};

type NativePickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

function openNativePicker(input: NativePickerInput | null) {
  if (!input) return;
  if (typeof input.showPicker === 'function') {
    input.showPicker();
  } else {
    input.click();
  }
}

export function ExactDateField({
  value,
  onValueChange,
  invalidMessage,
  pickerLabel,
  error = false,
  helperText,
  disabled,
  onBlur,
  slotProps,
  ...props
}: SharedFieldProps) {
  const pickerRef = useRef<NativePickerInput>(null);
  const [invalid, setInvalid] = useState(false);

  const updateDraft = (event: ChangeEvent<HTMLInputElement>) => {
    setInvalid(false);
    onValueChange(event.target.value);
  };

  const normalizeOnBlur = (event: FocusEvent<HTMLInputElement>) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setInvalid(false);
      onValueChange('');
    } else {
      const normalized = normalizeExactDateInput(trimmed);
      if (normalized) {
        setInvalid(false);
        onValueChange(normalized);
      } else {
        setInvalid(true);
      }
    }
    onBlur?.(event);
  };

  const selectDate = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.value;
    if (!selected) return;
    setInvalid(false);
    onValueChange(selected);
  };

  return (
    <TextField
      {...props}
      value={formatExactDateForDisplay(value)}
      onChange={updateDraft}
      onBlur={normalizeOnBlur}
      disabled={disabled}
      error={Boolean(error) || invalid}
      helperText={invalid && !error ? invalidMessage : helperText}
      slotProps={{
        ...slotProps,
        input: {
          ...slotProps?.input,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                aria-label={pickerLabel}
                disabled={disabled}
                onClick={() => openNativePicker(pickerRef.current)}
              >
                <CalendarMonthOutlinedIcon fontSize="small" />
              </IconButton>
              <input
                ref={pickerRef}
                type="date"
                value={normalizeExactDateInput(value) ?? ''}
                onChange={selectDate}
                disabled={disabled}
                tabIndex={-1}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
            </InputAdornment>
          ),
        },
        htmlInput: {
          ...slotProps?.htmlInput,
          inputMode: 'numeric',
          autoComplete: 'off',
        },
        inputLabel: {
          ...slotProps?.inputLabel,
          shrink: true,
        },
      }}
    />
  );
}

export function ExactTimeField({
  value,
  onValueChange,
  invalidMessage,
  pickerLabel,
  error = false,
  helperText,
  disabled,
  onBlur,
  slotProps,
  ...props
}: SharedFieldProps) {
  const pickerRef = useRef<NativePickerInput>(null);
  const [invalid, setInvalid] = useState(false);

  const updateDraft = (event: ChangeEvent<HTMLInputElement>) => {
    setInvalid(false);
    onValueChange(event.target.value);
  };

  const normalizeOnBlur = (event: FocusEvent<HTMLInputElement>) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setInvalid(false);
      onValueChange('');
    } else {
      const normalized = normalizeExactTimeInput(trimmed);
      if (normalized) {
        setInvalid(false);
        onValueChange(normalized);
      } else {
        setInvalid(true);
      }
    }
    onBlur?.(event);
  };

  const selectTime = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.value;
    if (!selected) return;
    setInvalid(false);
    onValueChange(selected);
  };

  return (
    <TextField
      {...props}
      value={value}
      onChange={updateDraft}
      onBlur={normalizeOnBlur}
      disabled={disabled}
      error={Boolean(error) || invalid}
      helperText={invalid && !error ? invalidMessage : helperText}
      slotProps={{
        ...slotProps,
        input: {
          ...slotProps?.input,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                aria-label={pickerLabel}
                disabled={disabled}
                onClick={() => openNativePicker(pickerRef.current)}
              >
                <AccessTimeOutlinedIcon fontSize="small" />
              </IconButton>
              <input
                ref={pickerRef}
                type="time"
                value={normalizeExactTimeInput(value) ?? ''}
                onChange={selectTime}
                disabled={disabled}
                tabIndex={-1}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
            </InputAdornment>
          ),
        },
        htmlInput: {
          ...slotProps?.htmlInput,
          inputMode: 'numeric',
          autoComplete: 'off',
        },
        inputLabel: {
          ...slotProps?.inputLabel,
          shrink: true,
        },
      }}
    />
  );
}
