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
      department: 'Dział',
      shiftAssignment: 'Zmiana',
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
      department: 'Dział',
      shiftAssignment: 'Zmiana',
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
    entitlements: {
      title: 'Uprawnienia i przypisania',
      description:
        'Historyczne fakty pracownika używane w rozliczeniu miesięcznym: UDT, własne mieszkanie i mieszkanie firmowe.',
      add: 'Dodaj uprawnienie',
      loadError: 'Nie udało się wczytać uprawnień i przypisań.',
      empty: 'Brak uprawnień i przypisań.',
      table: {
        employee: 'Pracownik',
        type: 'Rodzaj',
        variant: 'Wariant',
        validity: 'Obowiązuje',
        status: 'Status',
        note: 'Notatka',
        actions: 'Działania',
        noVariant: '—',
        noNote: '—',
        noEndDate: 'bezterminowo',
        edit: 'Zmień okres / notatkę',
        cancel: 'Anuluj',
      },
      types: {
        UDT: 'UDT',
        OWN_HOUSING_ALLOWANCE: 'Dodatek za własne mieszkanie',
        COMPANY_ACCOMMODATION: 'Mieszkanie firmowe',
      },
      status: {
        ACTIVE: 'Aktywne',
        CANCELLED: 'Anulowane',
      },
      form: {
        addTitle: 'Dodaj uprawnienie lub przypisanie',
        editTitle: 'Zmień uprawnienie lub przypisanie',
        employee: 'Pracownik',
        type: 'Rodzaj',
        variant: 'Wariant mieszkania',
        validFrom: 'Od',
        validTo: 'Do',
        note: 'Notatka',
        cancel: 'Anuluj',
        create: 'Dodaj',
        save: 'Zapisz zmiany',
        optionalEnd: 'Opcjonalnie',
        noVariants: 'Brak aktywnych wariantów zakwaterowania w ustawieniach.',
        validation: {
          'employee-required': 'Wybierz pracownika.',
          'variant-required': 'Wybierz wariant mieszkania firmowego.',
          'date-required': 'Wprowadź datę początku.',
          'invalid-date-range': 'Data końca nie może poprzedzać daty początku.',
          'housing-conflict':
            'Wybrany okres pokrywa się z drugim typem mieszkaniowym dla tego pracownika.',
        },
      },
      notifications: {
        created: 'Uprawnienie zostało dodane.',
        updated: 'Uprawnienie zostało zaktualizowane.',
        cancelled: 'Uprawnienie zostało anulowane.',
      },
      errors: {
        saveFailed: 'Nie udało się zapisać uprawnienia.',
        cancelFailed: 'Nie udało się anulować uprawnienia.',
      },
    },
  },
  organization: {
    departments: {
      unassigned: 'Brak działu',
      loadTitle: 'Nie udało się wczytać działów',
      loadDescription:
        'Pracownicy pozostają dostępni, ale lista działów wymaga ponownego wczytania.',
      settingsTitle: 'Działy i zmiany',
      settingsDescription:
        'Słownik działów używany w pracownikach i filtrach konstruktora kalendarza.',
      add: 'Dodaj dział',
      emptyTitle: 'Brak działów',
      emptyDescription:
        'Dodaj pierwszy dział, aby przypisywać pracowników do struktury organizacyjnej.',
      table: {
        name: 'Dział',
        shiftMode: 'Tryb zmianowy',
        status: 'Status',
        actions: 'Działania',
        edit: 'Edytuj dział',
      },
      status: {
        active: 'Aktywny',
        inactive: 'Nieaktywny',
      },
      form: {
        addTitle: 'Dodaj dział',
        editTitle: 'Edytuj dział',
        description:
          'Identyfikator działu pozostaje stabilny w dokumentach pracowników. Nazwę można później poprawić.',
        name: 'Nazwa działu',
        shiftMode: 'Tryb zmianowy',
        active: 'Dział aktywny',
        generatedId: 'Identyfikator',
        stableId: 'Identyfikator pozostaje bez zmian.',
        required: 'Nazwa działu jest wymagana.',
        saveFailed: 'Nie udało się zapisać działu. Sprawdź dane i uprawnienia.',
        cancel: 'Anuluj',
        create: 'Dodaj',
        save: 'Zapisz zmiany',
      },
      notifications: {
        created: 'Dział został dodany.',
        updated: 'Dział został zaktualizowany.',
      },
    },
    shifts: {
      unassigned: 'Brak zmiany',
      RED: 'Zmiana Red',
      WHITE: 'Zmiana White',
      BLUE: 'Zmiana Blue',
    },
    shiftModes: {
      UNKNOWN: 'Nie skonfigurowano',
      TWO_SHIFT: 'Dwuzmianowy',
      THREE_SHIFT: 'Trzyzmianowy',
    },
    actualWorkingShifts: {
      FIRST: 'Pierwsza zmiana',
      SECOND: 'Druga zmiana',
      NIGHT: 'Nocna zmiana',
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
    draft: {
      title: 'Rozliczenie miesięczne',
      description:
        'Zestawienie komponentów przygotowywanych przez koordynatora. To nie jest lista płac, kwota netto ani rozliczenie ZUS/PIT.',
      missingFrequencySetting:
        'Brakuje aktywnej konfiguracji premii frekwencyjnej dla tego miesiąca. Kwota premii pozostaje nierozstrzygnięta.',
      warningWithDate: '{{date}}: {{warning}}',
      moreWarnings: '+{{count}} kolejne uwagi',
      totals: {
        nominal: 'Nominał',
        worked: 'Praca',
        virtual: 'Wirtualne',
        privateTime: 'Czas prywatny',
        niedoczas: 'Niedoczas',
        overtime50: 'Nadgodz. 50%',
        overtime100: 'Nadgodz. 100%',
        l4: 'L4',
        vacation: 'Urlop',
        otherAbsences: 'Inne nieobecności',
        frequencyBonus: 'Premia frekw.',
        holidayBonus: 'Święto',
        transportNetto: 'Transport netto',
        laundry: 'Pranie',
        udt: 'UDT',
        housingDeduction: 'Mieszkanie firmowe',
        increases: 'Zwiększenia',
        decreases: 'Potrącenia',
        bruttoAdditions: 'Dodatki brutto',
        nettoAllowances: 'Dodatki netto',
        deductions: 'Potrącenia',
        warnings: 'Uwagi',
      },
      table: {
        teta: 'TETA',
        employee: 'Pracownik',
        nominal: 'Nominał',
        worked: 'Godziny pracy',
        virtual: 'Wirtualne',
        privateTime: 'Czas prywatny',
        overtime: 'Nadgodziny',
        overtimeSplit: '50%: {{overtime50}} h / 100%: {{overtime100}} h',
        niedoczas: 'Niedoczas',
        absences: 'Nieobecności',
        absenceSplit:
          'L4: {{l4}} h / urlop: {{vacation}} h / inne: {{other}} h',
        frequencyBonus: 'Premia frekwencyjna',
        transportNetto: 'Transport netto',
        bruttoAdditions: 'Dodatki brutto',
        deductions: 'Potrącenia',
        adjustments: 'Korekty',
        warnings: 'Uwagi',
        department: 'Dział',
        shiftAssignment: 'Zmiana',
        noWarnings: 'Brak uwag',
        unknownEmployee: 'Nieznany pracownik',
      },
      warnings: {
        'employee-not-participating':
          'Pracownik nie należy do tego miesiąca według okresu zatrudnienia.',
        'missing-employment-start': 'Brakuje daty rozpoczęcia zatrudnienia.',
        'attendance-absence-conflict':
          'Jawne godziny pracy pokrywają się z aktywną nieobecnością.',
        'explicit-non-working-day': 'Jawne godziny zapisano w dniu wolnym.',
        'attendance-outside-employment':
          'Godziny pracy znajdują się poza okresem zatrudnienia.',
        'absence-outside-employment':
          'Nieobecność wychodzi poza okres zatrudnienia.',
        'ambiguous-absence':
          'Kilka nieobecności ma taki sam priorytet dla tego dnia.',
        'unresolved-frequency-bonus-setting':
          'Nie znaleziono aktywnej konfiguracji premii frekwencyjnej.',
        'unresolved-work-time-classification':
          'Brakuje faktycznego startu/końca dla nietypowej liczby godzin.',
        'housing-entitlement-conflict':
          'Dodatek za własne mieszkanie pokrywa się z mieszkaniem firmowym.',
        'company-accommodation-missing-variant':
          'Przypisanie mieszkania firmowego nie ma wariantu.',
        'unresolved-company-accommodation-variant':
          'Nie znaleziono aktywnej stawki dla wariantu mieszkania firmowego.',
        'unresolved-own-housing-setting':
          'Nie znaleziono aktywnej stawki dodatku za własne mieszkanie.',
      },
    },
    review: {
      title: 'Przegląd rozliczenia',
      description:
        'Kontrola miesięcznego rozliczenia przed przyszłym eksportem lub zamknięciem. To nie zamyka miesiąca i nie tworzy finalnej listy płac.',
      ready: 'Miesiąc gotowy do przyszłego eksportu',
      notReady: 'Miesiąc wymaga jeszcze sprawdzenia lub korekt',
      readOnly:
        'Miesiąc jest zamknięty. Statusy przeglądu są dostępne tylko do odczytu.',
      counters: {
        total: 'Pracownicy',
        checked: 'Sprawdzone',
        correction: 'Do korekty',
        warnings: 'Z uwagami',
        unresolved: 'Nierozstrzygnięte',
        notReviewed: 'Nieprzejrzane',
      },
      status: {
        DRAFT: 'Robocze',
        NEEDS_REVIEW: 'Wymaga sprawdzenia',
        NEEDS_CORRECTION: 'Wymaga korekty',
        CHECKED: 'Sprawdzone',
      },
      table: {
        teta: 'TETA',
        employee: 'Pracownik',
        department: 'Dział',
        shift: 'Zmiana',
        status: 'Status',
        warnings: 'Uwagi',
        unresolved: 'Nierozstrzygnięte',
        components: 'Komponenty',
        note: 'Notatka',
        actions: 'Działania',
        details: 'Przegląd',
        noNote: '—',
      },
      components:
        'Brutto: {{brutto}} · Netto: {{netto}} · Potrącenia: {{deductions}}',
      details: {
        title: 'Przegląd pracownika',
        employee: '{{employee}} · TETA {{teta}}',
        workTime: 'Czas pracy',
        absences: 'Nieobecności',
        overtime: 'Nadgodziny / czas prywatny',
        components: 'Dodatki i potrącenia',
        adjustments: 'Korekty ręczne',
        warnings: 'Uwagi i nierozstrzygnięte elementy',
        noWarnings: 'Brak uwag dla tego pracownika.',
        reviewNote: 'Notatka przeglądu',
        save: 'Zapisz status',
        close: 'Zamknij',
        updatedBy: 'Ostatnia zmiana: {{actor}} · {{date}}',
        notSaved: 'Status nie był jeszcze zapisany.',
      },
      actions: {
        calendar: 'Otwórz kalendarz pracownika',
        employees: 'Pracownicy / uprawnienia',
        absences: 'Nieobecności',
        adjustments: 'Korekty',
        settings: 'Ustawienia',
      },
      groups: {
        employment: 'Zatrudnienie',
        attendance: 'Czas pracy',
        absences: 'Nieobecności',
        workTime: 'Nadgodziny / czas prywatny',
        components: 'Komponenty',
        configuration: 'Konfiguracja',
      },
      issues: {
        'uncovered-private-time':
          'Czas prywatny nie został w pełni pokryty w bilansie miesiąca.',
        'uncovered-coverable-ni':
          'NI możliwe do pokrycia nie zostało w pełni rozliczone.',
        niedoczas: 'Występuje niedoczas wymagający decyzji koordynatora.',
      },
      notifications: {
        saved: 'Status przeglądu został zapisany.',
      },
      errors: {
        saveFailed: 'Nie udało się zapisać statusu przeglądu.',
      },
    },
    export: {
      title: 'Eksport',
      description:
        'Przygotuj pliki robocze dla Toyota oraz osobne CSV do SOZ dla grup PL i cudzoziemców.',
      ready: 'Eksport bez ostrzeżeń',
      warningCount: 'Ostrzeżenia: {{count}}',
      downloadToyota: 'Pobierz zestawienie dla Toyota',
      downloadSozPl: 'Pobierz CSV do SOZ — PL',
      downloadSozForeign: 'Pobierz CSV do SOZ — cudzoziemcy',
      downloadNote: 'Pobierz notatkę SOZ',
      identityLimitation:
        'Split SOZ wymaga danych PESEL/paszport. Obecny model pracownika jeszcze ich nie przechowuje, dlatego brakujące dokumenty są pokazane jako braki danych.',
      counters: {
        toyota: 'Toyota: {{count}} prac.',
        sozPl: 'SOZ PL: {{count}} prac.',
        sozForeign: 'SOZ cudzoziemcy: {{count}} prac.',
        note: 'Notatka: {{count}} poz.',
      },
      warnings: {
        'not-reviewed': 'Nieprzejrzane rekordy: {{count}}.',
        'unresolved-issues':
          'Rekordy z nierozstrzygniętymi uwagami: {{count}}.',
        'missing-identity':
          'Brak danych PESEL/paszport wymaganych do splitu SOZ: {{count}}.',
        'empty-export': 'Brak pracowników do eksportu: {{count}}.',
      },
    },
    constructor: {
      title: 'Konstruktor kalendarza',
      description:
        'Wybierz narzędzie, zaznacz dzień lub zakres dla jednego pracownika i zastosuj zmianę w istniejących dokumentach czasu pracy lub nieobecności.',
      settledReadOnly:
        'Zamknięty miesiąc jest tylko do odczytu. Narzędzia zapisu są zablokowane.',
      tools: {
        review: 'Przegląd',
        hours: 'Godziny',
        L4: 'L4',
        UW: 'Urlop',
        UZ: 'UŻ / UZ',
        NN: 'NN',
        'clear-manual': 'Wyczyść',
      },
      hours: 'Liczba godzin',
      note: 'Notatka / powód',
      apply: 'Zastosuj',
      clearSelection: 'Wyczyść zaznaczenie',
      noSelection:
        'Kliknij komórkę, aby otworzyć kalendarz pracownika albo zaznaczyć zakres dla wybranego narzędzia.',
      selection: '{{employee}}: {{start}} – {{end}}',
      blocked: {
        'settled-month': 'Nie można zapisywać zmian w zamkniętym miesiącu.',
        'outside-employment':
          'Zaznaczony zakres wychodzi poza okres zatrudnienia pracownika.',
      },
      filters: {
        employee: 'Szukaj pracownika',
        department: 'Dział',
        allDepartments: 'Wszystkie działy',
        unassignedDepartment: 'Brak działu',
        shift: 'Zmiana',
        allShifts: 'Wszystkie zmiany',
        unassignedShift: 'Brak zmiany',
        type: 'Filtr kalendarza',
        all: 'Wszyscy uczestnicy miesiąca',
        conflicts: 'Konflikty',
        warnings: 'Uwagi',
        result: 'Widoczni pracownicy: {{count}}',
      },
      notifications: {
        applied: 'Zmiana została zastosowana.',
      },
      errors: {
        invalidHours: 'Wprowadź prawidłową liczbę godzin od 0 do 24.',
        applyFailed:
          'Nie udało się zastosować zmiany. Sprawdź zakres, uprawnienia i reguły nieobecności.',
      },
    },
    employeeCalendar: {
      title: 'Kalendarz pracownika',
      teta: 'TETA: {{teta}}',
      employment: 'Zatrudnienie: {{start}} – {{end}}',
      noStartDate: 'brak daty rozpoczęcia',
      noEndDate: 'bez daty końcowej',
      departmentAndShift: '{{department}} · {{shift}}',
      departmentUnavailable: 'Dział / zmiana: brak w modelu danych',
      helper:
        'Kliknij dzień, aby edytować godziny. Nieobecności dodawaj z konstruktora kalendarza w widoku ogólnym.',
      settledReadOnly:
        'Ten miesiąc jest zamknięty, dlatego kalendarz pracownika jest tylko do odczytu.',
      warning: 'Wymaga weryfikacji',
      actualInterval: 'Rzeczywiście: {{start}}–{{end}}',
      close: 'Zamknij',
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
      workTime: {
        title: 'Korekta czasu pracy',
        plannedShift: 'Planowana zmiana',
        plannedInterval: 'Plan: {{start}}–{{end}}',
        actualStart: 'Rzeczywisty start',
        actualEnd: 'Rzeczywisty koniec',
        optional: 'Opcjonalnie, format GG:MM.',
        invalidTime: 'Wprowadź godzinę w formacie GG:MM.',
        preview:
          'Rozbicie: praca normalna {{normal}} h, czas prywatny {{private}} h, nadgodziny 50% {{overtime50}} h, nadgodziny 100% {{overtime100}} h.',
      },
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
