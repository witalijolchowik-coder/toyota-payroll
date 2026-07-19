import {
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
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
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
};

type NativePickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

function openNativePicker(input: NativePickerInput | null) {
  if (!input) return;
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
      return;
    } catch {
      // Some browsers require a stricter user-activation context for showPicker.
      // Keep the native input click as a safe fallback without surfacing an error.
    }
  }
  input.click();
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
  onKeyDown,
  slotProps,
  ...props
}: SharedFieldProps) {
  const pickerRef = useRef<NativePickerInput>(null);
  const [invalid, setInvalid] = useState(false);

  const updateDraft = (event: ChangeEvent<HTMLInputElement>) => {
    setInvalid(false);
    onValueChange(event.target.value);
  };

  const commitValue = (rawValue: string) => {
    const trimmed = rawValue.trim();
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
  };

  const normalizeOnBlur = (event: FocusEvent<HTMLInputElement>) => {
    commitValue(event.currentTarget.value);
    onBlur?.(event);
  };

  const normalizeOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== 'Enter') return;
    const rawValue = (event.target as HTMLInputElement).value;
    event.preventDefault();
    commitValue(rawValue);
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
      onKeyDown={normalizeOnEnter}
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
  onKeyDown,
  slotProps,
  ...props
}: SharedFieldProps) {
  const pickerRef = useRef<NativePickerInput>(null);
  const [invalid, setInvalid] = useState(false);

  const updateDraft = (event: ChangeEvent<HTMLInputElement>) => {
    setInvalid(false);
    onValueChange(event.target.value);
  };

  const commitValue = (rawValue: string) => {
    const trimmed = rawValue.trim();
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
  };

  const normalizeOnBlur = (event: FocusEvent<HTMLInputElement>) => {
    commitValue(event.currentTarget.value);
    onBlur?.(event);
  };

  const normalizeOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== 'Enter') return;
    const rawValue = (event.target as HTMLInputElement).value;
    event.preventDefault();
    commitValue(rawValue);
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
      onKeyDown={normalizeOnEnter}
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
