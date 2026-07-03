export const pl = {
  navigation: {
    employees: {
      label: 'Pracownicy',
      description:
        'Rejestr pracowników, numery TETA i informacje o zatrudnieniu.',
    },
    settlement: {
      label: 'Rozliczenie miesięczne',
      description:
        'Kalendarz obecności i wizualna przestrzeń rozliczenia wybranego miesiąca.',
    },
  },
  employees: {
    page: {
      eyebrow: 'Dane podstawowe',
      title: 'Pracownicy',
      description:
        'Zarządzaj rejestrem pracowników i ich podstawowymi danymi identyfikacyjnymi.',
      add: 'Dodaj pracownika',
    },
    search: {
      label: 'Szukaj pracownika',
      placeholder: 'Imię, nazwisko lub numer TETA',
      statusLabel: 'Status',
      all: 'Wszyscy',
      active: 'Aktywni',
      inactive: 'Nieaktywni',
      clear: 'Wyczyść wyszukiwanie',
    },
    table: {
      teta: 'Numer TETA',
      employee: 'Pracownik',
      employmentPeriod: 'Okres zatrudnienia',
      status: 'Status',
      actions: 'Działania',
      noEndDate: 'bez daty końcowej',
      noStartDate: 'brak daty rozpoczęcia',
      edit: 'Edytuj pracownika: {{name}}',
      deactivate: 'Dezaktywuj pracownika: {{name}}',
    },
    status: {
      active: 'Aktywny',
      inactive: 'Nieaktywny',
    },
    empty: {
      title: 'Brak pracowników',
      description:
        'Dodaj pierwszego pracownika, aby rozpocząć prowadzenie rejestru.',
      filteredTitle: 'Brak wyników',
      filteredDescription: 'Zmień wyszukiwaną frazę lub wybrany filtr statusu.',
    },
    loading: 'Ładowanie pracowników',
    errors: {
      loadTitle: 'Nie udało się pobrać pracowników',
      loadDescription:
        'Sprawdź połączenie z Firebase oraz stan uwierzytelnienia i spróbuj ponownie.',
      firebaseUnavailable:
        'Nie można połączyć się z Firebase. Sprawdź konfigurację aplikacji.',
      authenticationRequired:
        'Do zapisu danych wymagane jest aktywne uwierzytelnienie Firebase.',
      saveFailed:
        'Nie udało się zapisać pracownika. Sprawdź dane i spróbuj ponownie.',
      deactivateFailed:
        'Nie udało się dezaktywować pracownika. Spróbuj ponownie.',
      duplicateTeta: 'Aktywny pracownik z tym numerem TETA już istnieje.',
    },
    form: {
      addTitle: 'Dodaj pracownika',
      editTitle: 'Edytuj pracownika',
      description:
        'Numer TETA jest podstawowym identyfikatorem biznesowym pracownika.',
      teta: 'Numer TETA',
      firstName: 'Imię',
      lastName: 'Nazwisko',
      employmentStartDate: 'Data rozpoczęcia zatrudnienia',
      employmentEndDate: 'Data zakończenia zatrudnienia',
      cancel: 'Anuluj',
      create: 'Dodaj',
      save: 'Zapisz zmiany',
      required: 'To pole jest wymagane.',
      invalidDateRange:
        'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.',
    },
    deactivate: {
      title: 'Dezaktywować pracownika?',
      description:
        'Pracownik {{name}} pozostanie w rejestrze, ale otrzyma status nieaktywny.',
      cancel: 'Anuluj',
      confirm: 'Dezaktywuj',
    },
    notifications: {
      created: 'Pracownik został dodany.',
      updated: 'Dane pracownika zostały zapisane.',
      deactivated: 'Pracownik został dezaktywowany.',
    },
  },
  settlement: {
    page: {
      eyebrow: 'Rozliczenia',
      title: 'Rozliczenie miesięczne',
      description:
        'Wybierz miesiąc i sprawdź pracowników należących do danego okresu rozliczeniowego.',
    },
    monthSelector: {
      label: 'Miesiąc rozliczeniowy',
      helper: 'Domyślnie wybrano poprzedni miesiąc. Możesz wskazać inny okres.',
    },
    summary: {
      employees: 'Liczba pracowników w miesiącu: {{count}}',
      calculationVersion: 'Wersja obliczeń: {{version}}',
    },
    settled: {
      title: 'Miesiąc został zamknięty',
      description:
        'Dane tego miesiąca są tylko do odczytu. Zmiany w okresie rozliczeniowym są zablokowane.',
    },
    incompleteEmployment: {
      title: 'Niekompletne dane zatrudnienia',
      description:
        'Liczba pracowników bez daty rozpoczęcia, których nie można przypisać do miesiąca: {{count}}.',
    },
    grid: {
      teta: 'TETA',
      employee: 'Nazwisko i imię',
      empty: '—',
      hours: '{{hours}} h',
      virtualDefault:
        'Wirtualna wartość domyślna — nie jest zapisana w Firestore.',
      manualValue: 'Ręczna wartość koordynatora.',
      importedValue:
        'Wartość z importu — edycja ręczna jest obecnie zablokowana.',
      nonWorkingDay: 'Dzień wolny — domyślna wartość 0 h jest wirtualna.',
      futureDay: 'Nie można edytować przyszłego dnia.',
      outsideEmployment: 'Data poza okresem zatrudnienia pracownika.',
      settledMonth: 'Zamknięty miesiąc jest tylko do odczytu.',
      edit: 'Edytuj godziny: {{employee}}, {{date}}',
    },
    legend: {
      title: 'Oznaczenia kalendarza',
      workingDay: 'Dzień roboczy',
      weekend: 'Weekend',
      publicHoliday: 'Święto (obsługa przygotowana)',
      futureDay: 'Dzień przyszły',
      virtualDefault: 'Wirtualne 8 h / 0 h',
      virtualDefaultValue: '8/0',
    },
    empty: {
      title: 'Brak pracowników w wybranym miesiącu',
      description:
        'Żaden pracownik z kompletnymi datami zatrudnienia nie pokrywa się z wybranym okresem.',
    },
    missingMonth: {
      title: 'Miesiąc nie został jeszcze utworzony.',
      description:
        'Utwórz dokument miesiąca, aby przygotować przestrzeń rozliczeniową.',
      create: 'Utwórz miesiąc',
    },
    editor: {
      title: 'Godziny pracy',
      description: '{{employee}} · {{date}}',
      hours: 'Liczba godzin',
      helper:
        'Wprowadź wartość od 0 do 24. Wartość domyślna nie zostanie zapisana.',
      cancel: 'Anuluj',
      save: 'Zapisz',
      clear: 'Usuń wartość ręczną',
      validation: {
        notNumber: 'Wprowadź prawidłową liczbę.',
        negative: 'Liczba godzin nie może być ujemna.',
        aboveMaximum: 'Liczba godzin nie może przekraczać 24.',
      },
      errors: {
        save: 'Nie udało się zapisać wartości. Spróbuj ponownie.',
        clear: 'Nie udało się usunąć wartości. Spróbuj ponownie.',
        imported:
          'Wartość z importu jest tylko do odczytu i nie może zostać nadpisana.',
        authentication:
          'Do zapisu wymagane jest aktywne uwierzytelnienie Firebase.',
        firebase:
          'Nie można połączyć się z Firebase. Sprawdź konfigurację aplikacji.',
      },
    },
    loading: 'Ładowanie rozliczenia miesięcznego',
    notifications: {
      created: 'Miesiąc został utworzony.',
      dailyValueSaved: 'Godziny zostały zapisane.',
      dailyValueCleared: 'Wartość ręczna została usunięta.',
    },
    errors: {
      title: 'Nie udało się otworzyć miesiąca',
      firebaseUnavailable:
        'Nie można połączyć się z Firebase. Sprawdź konfigurację aplikacji.',
      authenticationRequired:
        'Do odczytu i utworzenia miesiąca wymagane jest aktywne uwierzytelnienie Firebase.',
      monthUnavailable:
        'Dokument miesiąca nie jest dostępny. Spróbuj ponownie.',
      generic:
        'Sprawdź połączenie z Firebase oraz uprawnienia i spróbuj ponownie.',
    },
  },
} as const;

export function interpolate(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
}
