import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SettingsNavigation } from './SettingsPage';
import { resolveSettingsSection } from './settingsNavigation';

describe('settings navigation', () => {
  it('restores a valid section and falls back safely after refresh', () => {
    expect(resolveSettingsSection('interface')).toBe('interface');
    expect(resolveSettingsSection('unknown')).toBe('shifts');
    expect(resolveSettingsSection(null)).toBe('shifts');
  });

  it('offers all business subsections without rendering their page content', () => {
    const onChange = vi.fn();
    render(<SettingsNavigation section="shifts" onChange={onChange} />);

    expect(screen.getAllByText('Zmiany i grafiki').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Zakwaterowanie').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Premie i dodatki').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Interfejs').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Interfejs/i }));
    expect(onChange).toHaveBeenCalledWith('interface');
  });
});
