import { useMemo, useState } from 'react';
import {
  Autocomplete,
  CircularProgress,
  TextField,
  type SxProps,
  type Theme,
} from '@mui/material';

import { useTranslations } from '../../hooks/useTranslations';
import type { Employee } from '../../types/firestore';
import {
  filterEmployeeSelectorOptions,
  formatEmployeeSelectorLabel,
  sortEmployeeSelectorOptions,
} from './employeeSelector';

interface EmployeeAutocompleteProps {
  employees: readonly Employee[];
  value: string | null;
  onChange: (employeeId: string | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  error?: boolean;
  helperText?: string;
  loading?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

export function EmployeeAutocomplete({
  employees,
  value,
  onChange,
  label,
  placeholder,
  required = false,
  disabled = false,
  allowClear = false,
  error = false,
  helperText,
  loading = false,
  size = 'medium',
  sx,
}: EmployeeAutocompleteProps) {
  const t = useTranslations();
  const options = useMemo(
    () => sortEmployeeSelectorOptions(employees),
    [employees],
  );
  const selectedEmployee = useMemo(
    () => options.find((employee) => employee.id === value) ?? null,
    [options, value],
  );
  const selectedLabel = selectedEmployee
    ? formatEmployeeSelectorLabel(selectedEmployee)
    : '';
  const [inputState, setInputState] = useState(() => ({
    selectedValue: value,
    selectedLabel,
    inputValue: selectedLabel,
  }));
  const inputValue =
    inputState.selectedValue === value &&
    inputState.selectedLabel === selectedLabel
      ? inputState.inputValue
      : selectedLabel;

  return (
    <Autocomplete
      options={options}
      value={selectedEmployee}
      inputValue={inputValue}
      onChange={(_, employee) => {
        const nextValue = employee?.id ?? null;
        const nextLabel = employee ? formatEmployeeSelectorLabel(employee) : '';
        setInputState({
          selectedValue: nextValue,
          selectedLabel: nextLabel,
          inputValue: nextLabel,
        });
        onChange(nextValue);
      }}
      onInputChange={(_, nextInputValue, reason) => {
        if (reason === 'input' || reason === 'clear') {
          setInputState({
            selectedValue: value,
            selectedLabel,
            inputValue: nextInputValue,
          });
        }
      }}
      getOptionLabel={formatEmployeeSelectorLabel}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      filterOptions={(availableOptions, state) =>
        filterEmployeeSelectorOptions(availableOptions, state.inputValue)
      }
      disabled={disabled}
      disableClearable={!allowClear}
      loading={loading}
      openOnFocus
      autoHighlight
      noOptionsText={t.employeeSelector.noOptions}
      loadingText={t.employeeSelector.loading}
      clearText={t.employeeSelector.clear}
      openText={t.employeeSelector.open}
      closeText={t.employeeSelector.close}
      sx={sx}
      slotProps={{
        listbox: {
          sx: { maxHeight: 320 },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          required={required}
          label={label ?? t.employeeSelector.label}
          placeholder={placeholder ?? t.employeeSelector.placeholder}
          error={error}
          helperText={helperText}
          size={size}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={18} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
