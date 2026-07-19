import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { MonthSelector } from '../../features/settlement/MonthSelector';
import type { MonthId } from '../../types/firestore';
import { ExactDateField, ExactTimeField } from './ExactDateTimeField';

function DateHarness({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <ExactDateField
        label="Data"
        value={value}
        onValueChange={setValue}
        invalidMessage="Nieprawidłowa data"
        pickerLabel="Otwórz kalendarz"
      />
      <output data-testid="date-value">{value}</output>
    </>
  );
}

function TimeHarness({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <ExactTimeField
        label="Godzina"
        value={value}
        onValueChange={setValue}
        invalidMessage="Nieprawidłowa godzina"
        pickerLabel="Otwórz wybór godziny"
      />
      <output data-testid="time-value">{value}</output>
    </>
  );
}

describe('ExactDateTimeField', () => {
  it('normalizes time shorthand on blur without changing partially typed input', () => {
    render(<TimeHarness />);
    const input = screen.getByLabelText('Godzina');

    fireEvent.change(input, { target: { value: '1408' } });
    expect(screen.getByTestId('time-value')).toHaveTextContent('1408');

    fireEvent.blur(input);
    expect(input).toHaveValue('14:08');
    expect(screen.getByTestId('time-value')).toHaveTextContent('14:08');
  });

  it('shows normal validation for invalid shorthand', () => {
    render(<TimeHarness />);
    const input = screen.getByLabelText('Godzina');

    fireEvent.change(input, { target: { value: '2365' } });
    fireEvent.blur(input);

    expect(input).toHaveValue('2365');
    expect(screen.getByText('Nieprawidłowa godzina')).toBeInTheDocument();
  });

  it('normalizes date shorthand and keeps full dates in localized display', () => {
    render(<DateHarness initialValue="2024-12-31" />);
    const input = screen.getByLabelText('Data');
    expect(input).toHaveValue('31.12.2024');

    fireEvent.change(input, { target: { value: '2507' } });
    fireEvent.blur(input);

    const expectedYear = new Date().getFullYear();
    expect(input).toHaveValue(`25.07.${expectedYear}`);
    expect(screen.getByTestId('date-value')).toHaveTextContent(
      `${expectedYear}-07-25`,
    );
  });

  it('keeps native date and time picker selection available', () => {
    const { container, rerender } = render(<DateHarness />);
    const datePicker = container.querySelector('input[type="date"]');
    expect(datePicker).not.toBeNull();
    fireEvent.change(datePicker!, { target: { value: '2025-03-04' } });
    expect(screen.getByTestId('date-value')).toHaveTextContent('2025-03-04');

    rerender(<TimeHarness />);
    const timePicker = container.querySelector('input[type="time"]');
    expect(timePicker).not.toBeNull();
    fireEvent.change(timePicker!, { target: { value: '22:15' } });
    expect(screen.getByTestId('time-value')).toHaveTextContent('22:15');
  });

  it('falls back to the native input click when showPicker is rejected', () => {
    const { container } = render(<DateHarness />);
    const datePicker = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement & { showPicker?: () => void };
    const click = vi.spyOn(datePicker, 'click');
    datePicker.showPicker = vi.fn(() => {
      throw new DOMException('User activation required', 'NotAllowedError');
    });

    fireEvent.click(screen.getByRole('button', { name: 'OtwĂłrz kalendarz' }));

    expect(datePicker.showPicker).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });

  it('does not replace the month-only selector', () => {
    const onChange = vi.fn();
    const { container } = render(
      <MonthSelector monthId={'2026-06' as MonthId} onChange={onChange} />,
    );

    expect(container.querySelector('input[type="month"]')).not.toBeNull();
    expect(container.querySelector('input[type="date"]')).toBeNull();
  });
});
