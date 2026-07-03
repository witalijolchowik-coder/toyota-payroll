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
    absences: {
      label: 'Nieobecności',
      description:
        'Rejestr nieobecności, dokumentów L4 i bieżącego statusu pracowników.',
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
  absences: {
    page: {
      eyebrow: 'Czas pracy',
      title: 'Nieobecności',
      description:
        'Zarządzaj dokumentami nieobecności bez zmieniania danych bezpośrednio w kalendarzu rozliczenia.',
      add: 'Dodaj nieobecność',
    },
    summary: {
      l4: 'Na L4 dzisiaj',
      excused: 'Na urlopie / usprawiedliwione',
      unexplained: 'Nieobecności niewyjaśnione',
    },
    filters: {
      month: 'Miesiąc',
      employee: 'Pracownik',
      allEmployees: 'Wszyscy pracownicy',
      type: 'Rodzaj',
      allTypes: 'Wszystkie rodzaje',
      status: 'Status',
      allStatuses: 'Wszystkie statusy',
    },
    types: {
      UZ: 'UŻ / UZ',
    },
    status: {
      ACTIVE: 'Aktywna',
      CANCELLED: 'Anulowana',
    },
    table: {
      teta: 'TETA',
      employee: 'Pracownik',
      type: 'Rodzaj',
      period: 'Okres',
      status: 'Status',
      review: 'Weryfikacja',
      actions: 'Działania',
      outsideEmployment: 'Poza okresem zatrudnienia',
      noIssues: 'Brak uwag',
      unknownEmployee: 'Nieznany pracownik',
      edit: 'Edytuj nieobecność',
      cancel: 'Anuluj nieobecność',
      readOnly: 'Tylko odczyt',
    },
    empty: {
      title: 'Brak nieobecności',
      description:
        'Brak dokumentów pasujących do wybranego miesiąca i filtrów.',
    },
    form: {
      addTitle: 'Dodaj nieobecność',
      editTitle: 'Edytuj nieobecność',
      description: 'Każdy dokument źródłowy zapisuj jako osobną nieobecność.',
      employee: 'Pracownik',
      type: 'Rodzaj nieobecności',
      startDate: 'Data od',
      endDate: 'Data do',
      note: 'Notatka',
      cancel: 'Anuluj',
      create: 'Dodaj',
      save: 'Zapisz zmiany',
      validation: {
        required: 'To pole jest wymagane.',
        'unsupported-code': 'Wybierz obsługiwany rodzaj nieobecności.',
        'invalid-date': 'Wprowadź prawidłową datę.',
        'invalid-range':
          'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.',
        'ownership-month-change':
          'Zmiana miesiąca rozpoczęcia wymaga anulowania starego dokumentu i utworzenia nowego.',
      },
    },
    cancel: {
      title: 'Anulować nieobecność?',
      description:
        'Dokument {{code}} pozostanie w historii ze statusem anulowanym.',
      back: 'Wróć',
      confirm: 'Anuluj nieobecność',
    },
    notifications: {
      created: 'Nieobecność została dodana.',
      updated: 'Nieobecność została zaktualizowana.',
      cancelled: 'Nieobecność została anulowana.',
    },
    errors: {
      loadTitle: 'Nie udało się pobrać nieobecności',
      loadDescription: 'Sprawdź połączenie z Firebase i spróbuj ponownie.',
      firebaseUnavailable:
        'Nie można połączyć się z Firebase. Sprawdź konfigurację aplikacji.',
      authenticationRequired:
        'Do zarządzania nieobecnościami wymagane jest uwierzytelnienie Firebase.',
      saveFailed: 'Nie udało się zapisać nieobecności.',
      cancelFailed: 'Nie udało się anulować nieobecności.',
      l4Overlap:
        'Nie można dodać tej nieobecności, ponieważ wybrany okres obejmuje aktywne L4.',
      ownershipMonthChange:
        'Nie można zmienić miesiąca rozpoczęcia. Anuluj dokument i utwórz poprawny.',
      monthUnavailable: 'Miesiąc rozpoczęcia nie został jeszcze utworzony.',
      monthSettled: 'Miesiąc rozpoczęcia jest zamknięty i tylko do odczytu.',
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
        'Oryginalna wartość z importu. Możesz dodać korektę bez nadpisywania importu.',
      importedOverride:
        'Ręczna korekta wartości z importu. Oryginalna wartość: {{original}} h.',
      nonWorkingDay: 'Dzień wolny — domyślna wartość 0 h jest wirtualna.',
      futureDay: 'Nie można edytować przyszłego dnia.',
      outsideEmployment: 'Data poza okresem zatrudnienia pracownika.',
      settledMonth: 'Zamknięty miesiąc jest tylko do odczytu.',
      edit: 'Edytuj godziny: {{employee}}, {{date}}',
      absence:
        'Nieobecność {{code}} — edycja jest dostępna w module Nieobecności.',
      absenceAmbiguous:
        'Kilka różnych nieobecności obejmuje ten dzień. Wymagana jest weryfikacja.',
      warnings: {
        'absence-conflict':
          'Uwaga: dla tego dnia istnieją jednocześnie godziny pracy i aktywna nieobecność.',
        'non-working-explicit':
          'Uwaga: jawne godziny pracy zapisano w dniu wolnym.',
        'outside-employment':
          'Uwaga: jawne godziny znajdują się poza okresem zatrudnienia.',
      },
    },
    legend: {
      title: 'Oznaczenia kalendarza',
      workingDay: 'Dzień roboczy',
      weekend: 'Weekend',
      publicHoliday: 'Święto (obsługa przygotowana)',
      futureDay: 'Dzień przyszły',
      virtualDefault: 'Wirtualne 8 h / 0 h',
      virtualDefaultValue: '8/0',
      manualValue: 'Wartość ręczna',
      importedValue: 'Wartość z importu',
      importedOverride: 'Ręczna korekta importu',
      warning: 'Wymaga weryfikacji',
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
      note: 'Powód lub notatka',
      noteHelper:
        'Opcjonalnie opisz ręczny wpis lub przyczynę korekty wartości z importu.',
      cancel: 'Anuluj',
      save: 'Zapisz',
      clear: 'Usuń korektę ręczną',
      validation: {
        notNumber: 'Wprowadź prawidłową liczbę.',
        negative: 'Liczba godzin nie może być ujemna.',
        aboveMaximum: 'Liczba godzin nie może przekraczać 24.',
      },
      errors: {
        save: 'Nie udało się zapisać wartości. Spróbuj ponownie.',
        clear: 'Nie udało się usunąć wartości. Spróbuj ponownie.',
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
