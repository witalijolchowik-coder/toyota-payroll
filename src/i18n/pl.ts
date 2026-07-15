export const pl = {
  auth: {
    loading: 'Sprawdzanie dostępu',
    signOut: 'Wyloguj',
    login: {
      title: 'Logowanie',
      description:
        'Zaloguj się kontem utworzonym przez administratora w Firebase.',
      email: 'E-mail',
      password: 'Hasło',
      submit: 'Zaloguj',
      signingIn: 'Trwa logowanie',
    },
    noAccess: {
      title: 'Brak dostępu',
      description:
        'Twoje konto Firebase nie ma aktywnego dostępu do aplikacji Toyota Payroll. Skontaktuj się z administratorem.',
    },
    errors: {
      invalidCredentials: 'Nieprawidłowy e-mail lub hasło.',
      configuration:
        'Nie można połączyć się z Firebase. Sprawdź konfigurację aplikacji.',
    },
    appBar: {
      openNavigation: 'Otwórz nawigację',
      expandNavigation: 'Rozwiń nawigację',
      collapseNavigation: 'Zwiń nawigację',
      notifications: 'Powiadomienia',
      currentUser: 'Zalogowany użytkownik',
    },
  },
  navigation: {
    dashboard: {
      label: 'Pulpit',
      description: 'Krótki przegląd stanu konfiguracji i najbliższych kroków.',
    },
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
    adjustments: {
      label: 'Korekty',
      description: 'Miesięczne premie, potrącenia i inne korekty pracowników.',
    },
    reports: {
      label: 'Raporty',
      description:
        'Wejście do eksportów przygotowywanych w rozliczeniu miesięcznym.',
    },
    settings: {
      label: 'Ustawienia płacowe',
      description: 'Historyczne globalne stawki i konfiguracja płacowa.',
    },
  },
  dashboard: {
    page: {
      eyebrow: 'Obszar koordynatora',
      title: 'Pulpit',
      description:
        'Najważniejsze kroki przygotowania systemu do kontrolowanej pracy operacyjnej.',
      status: 'Tryb pilotażowy',
    },
    cards: {
      employees: {
        title: 'Pracownicy',
        value: 'Rejestr dostępny',
        helper:
          'Uzupełnij daty zatrudnienia, dokumenty do SOZ, działy i zmiany.',
      },
      month: {
        title: 'Rozliczenie miesięczne',
        value: 'Utwórz miesiąc',
        helper: 'Miesiąc tworzysz ręcznie w module Rozliczenie miesięczne.',
      },
      absences: {
        title: 'Nieobecności',
        value: 'Gotowe do pracy',
        helper:
          'Dokumenty nieobecności są osobnym źródłem prawdy dla kalendarza.',
      },
      exports: {
        title: 'Eksporty',
        value: 'W rozliczeniu',
        helper: 'Eksporty robocze Toyota/SOZ są dostępne po otwarciu miesiąca.',
      },
    },
    workflow: {
      title: 'Sugerowana kolejność pracy',
      description:
        'Ten pulpit nie jest finalnym dashboardem analitycznym. Ma pomóc szybko przejść do właściwego miejsca.',
      employees: '1. Sprawdź pracowników i braki danych.',
      settings: '2. Uzupełnij ustawienia, działy i zmiany.',
      month: '3. Utwórz lub otwórz miesiąc rozliczeniowy.',
      absences: '4. Dodaj nieobecności i korekty.',
      review: '5. Zweryfikuj rozliczenie i robocze eksporty.',
    },
    actions: {
      employees: 'Przejdź do pracowników',
      settings: 'Przejdź do ustawień',
      settlement: 'Otwórz rozliczenie',
      absences: 'Otwórz nieobecności',
    },
    readiness: {
      title: 'Gotowość miesiąca',
      description:
        'Szybka kontrola danych pracowników, konfiguracji i kalendarza przed dalszą pracą operacyjną.',
      month: 'Miesiąc rozliczeniowy',
      loadError:
        'Nie udało się wczytać gotowości miesiąca. Sprawdź połączenie i uprawnienia.',
      monthExists: 'Utworzony',
      monthMissing: 'Brak miesiąca',
      noIssues: 'Nie wykryto problemów gotowości dla wybranego miesiąca.',
      moreIssues: 'Pozostałe problemy: {{count}}.',
      correct: 'Popraw',
      metrics: {
        participants: 'Uczestnicy miesiąca',
        blocking: 'Blokujące',
        warning: 'Ostrzeżenia',
        optional: 'Opcjonalne',
        month: 'Dokument miesiąca',
        preparation: 'Przygotowanie danych',
        draft: 'Wersja robocza',
        finalization: 'Finalizacja',
      },
      levels: {
        allowed: 'Możliwe',
        blocked: 'Zablokowane',
      },
      severity: {
        blocking: 'Blokuje',
        warning: 'Ostrzeżenie',
        optional: 'Opcjonalne',
        info: 'Informacja',
      },
      issues: {
        'month-missing': 'Miesiąc nie został jeszcze utworzony.',
        'calendar-overrides-unresolved':
          'Toyota-specyficzne wyjątki kalendarza nie są jeszcze potwierdzone.',
        'employee-missing-employment-start':
          'Brakuje daty rozpoczęcia zatrudnienia.',
        'employee-missing-identity': 'Brakuje danych identyfikacyjnych do SOZ.',
        'employee-missing-teta': 'Brakuje numeru TETA.',
        'employee-missing-citizenship': 'Brakuje informacji o obywatelstwie.',
        'employee-missing-pesel': 'Brak numeru PESEL.',
        'employee-missing-passport': 'Brak numeru paszportu.',
        'employee-missing-first-toyota-employment-date':
          'Brakuje daty pierwszego zatrudnienia w Toyota.',
        'employee-current-status-conflict':
          'Aktualny status techniczny jest sprzeczny z okresem zatrudnienia.',
        'unconfirmed-reported-l4':
          'Zgłoszone L4 nie zostało jeszcze potwierdzone raportem ZUS.',
        'employee-missing-department': 'Pracownik nie ma przypisanego działu.',
        'employee-missing-shift': 'Pracownik nie ma przypisanej zmiany.',
        'department-unresolved-na0':
          'Kod NA0 nie jest działem i wymaga ręcznego przypisania.',
        'department-missing-or-inactive':
          'Przypisany dział nie istnieje albo jest nieaktywny.',
        'schedule-unresolved-day':
          'Nie udało się wyznaczyć planu pracy dla co najmniej jednego dnia.',
        'payroll-setting-missing':
          'Brakuje aktywnej stawki dla wybranego miesiąca.',
        'payroll-setting-conflict':
          'Konfiguracja płacowa ma nakładające się okresy.',
        'entitlement-overlap':
          'Uprawnienia pracownika mają nakładające się okresy.',
        'housing-conflict':
          'Mieszkanie firmowe pokrywa się z dodatkiem za własne mieszkanie.',
        'company-accommodation-missing-variant':
          'Mieszkanie firmowe nie ma wybranego wariantu.',
        'company-accommodation-setting-missing':
          'Brakuje stawki czynszu lub mediów dla wariantu mieszkania.',
        'own-housing-setting-missing':
          'Brakuje stawki dodatku za własne mieszkanie.',
      },
    },
  },
  reports: {
    page: {
      eyebrow: 'Raporty',
      title: 'Raporty i eksporty',
      description:
        'Na tym etapie eksporty robocze są częścią rozliczenia miesięcznego.',
    },
    currentState: {
      title: 'Aktualny stan modułu',
      description:
        'Oddzielne archiwum raportów i historia eksportów nie są jeszcze wdrożone. Aby przygotować pliki Toyota lub SOZ, otwórz właściwy miesiąc w rozliczeniu miesięcznym i użyj sekcji Eksport.',
    },
    limitations: {
      title: 'Świadome ograniczenia',
      first: 'Eksport nie zamyka miesiąca i nie tworzy finalnej listy płac.',
      second:
        'Przed realnym użyciem trzeba usunąć ostrzeżenia dotyczące danych i zweryfikować miesiąc.',
    },
    actions: {
      settlement: 'Przejdź do rozliczenia miesięcznego',
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
      archive: 'Archiwum',
      clear: 'Wyczyść wyszukiwanie',
    },
    table: {
      teta: 'Numer TETA',
      employee: 'Pracownik',
      identity: 'Dokumenty',
      pesel: 'PESEL',
      passport: 'Paszport',
      foreignDocument: 'Dokument',
      noIdentity: 'Brak PESEL / paszportu',
      department: 'Dział',
      shiftAssignment: 'Zmiana',
      employmentPeriod: 'Okres zatrudnienia',
      activeEmploymentDates: 'Pierwsze zatrudnienie / aktualna umowa',
      archiveEmploymentDates: 'Pierwsze zatrudnienie / zakończenie',
      noFirstToyotaDate: 'brak pierwszej daty',
      noFinalEndDate: 'brak daty zakończenia',
      shiftShort: {
        RED: 'Red',
        WHITE: 'White',
        BLUE: 'Blue',
      },
      status: 'Status',
      actions: 'Działania',
      noEndDate: 'bez daty końcowej',
      noStartDate: 'brak daty rozpoczęcia',
      edit: 'Edytuj pracownika: {{name}}',
      deactivate: 'Dezaktywuj pracownika: {{name}}',
      statusConflict:
        'Status techniczny różni się od statusu wynikającego z dat zatrudnienia.',
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
      tetaReadinessHelper:
        'Możesz zapisać pracownika bez TETA, ale finalizacja miesiąca będzie zablokowana.',
      firstName: 'Imię',
      lastName: 'Nazwisko',
      pesel: 'PESEL',
      passportNumber: 'Paszport',
      foreignDocumentNumber: 'Inny dokument cudzoziemca',
      citizenship: 'Obywatelstwo',
      citizenshipHelper:
        'Obywatelstwo określa wymagane dokumenty do finalizacji.',
      citizenshipUnknown: 'Nie określono',
      citizenshipOptions: {
        PL: 'Polska',
        UA: 'Ukraina',
        OTHER: 'Inne',
      },
      firstToyotaEmploymentDate: 'Data pierwszego zatrudnienia w Toyota',
      firstToyotaEmploymentDateHelper:
        'Stała data używana do ustalenia podstawy wynagrodzenia. Nie zmienia się przy nowej umowie ani ponownym zatrudnieniu.',
      identityOptional: 'Opcjonalnie. Wymagane do poprawnego splitu SOZ.',
      foreignDocumentHelper:
        'Uzupełnij tylko wtedy, gdy dokument cudzoziemca nie jest paszportem.',
      department: 'Dział',
      shiftAssignment: 'Zmiana',
      assignmentEffectivePrompt:
        'Zmieniasz dział lub grupę. Wskaż, od jakiej daty ta zmiana ma obowiązywać.',
      assignmentEffectiveDate: 'Data obowiązywania zmiany',
      assignmentEffectiveHelper:
        'Poprzednie dni zachowają dotychczasowe przypisanie w historii.',
      employmentStartDate: 'Data rozpoczęcia zatrudnienia',
      employmentStartRequired:
        'Wymagane. Bez tej daty pracownik nie może bezpiecznie wejść do rozliczenia miesiąca.',
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
    accommodation: {
      companyActive: 'Zakwaterowanie firmowe aktywne',
      companyInactive: 'Brak zakwaterowania firmowego',
      moveInTitle: 'Zakwaterowanie pracownika',
      moveOutTitle: 'Wykwaterowanie pracownika',
      moveInDate: 'Data zakwaterowania',
      moveOutDate: 'Data wykwaterowania',
      moveInDateHelper:
        'Wybrana data jest pierwszym dniem zakwaterowania firmowego.',
      moveOutDateHelper:
        'Wybrana data jest pierwszym dniem, w którym pracownik nie mieszka już w zakwaterowaniu firmowym.',
      category: 'Kategoria zakwaterowania',
      noCategories:
        'Najpierw dodaj aktywną kategorię zakwaterowania w ustawieniach.',
      overlap:
        'Okres zakwaterowania pokrywa się z innym aktywnym okresem mieszkaniowym.',
      saveFailed: 'Nie udało się zapisać zmiany zakwaterowania.',
      moveInSaved: 'Zakwaterowanie zostało zapisane.',
      moveOutSaved: 'Wykwaterowanie zostało zapisane.',
      cancel: 'Anuluj',
      confirmMoveIn: 'Zapisz zakwaterowanie',
      confirmMoveOut: 'Zapisz wykwaterowanie',
    },
    import: {
      open: 'Import pracowników',
      title: 'Import początkowej bazy pracowników',
      description:
        'Wczytaj zestawienie Toyota jako źródło podstawowych danych pracownika. Pliki SOZ służą tylko do bezpiecznego uzupełnienia dokumentu i ostrzeżeń — nie importują godzin, nieobecności ani wartości rozliczenia.',
      empty: '—',
      noWarnings: 'Brak ostrzeżeń',
      summary:
        'Przeanalizowano {{total}} wierszy. Do utworzenia można zaznaczyć {{selectable}}.',
      employmentRange: '{{start}} – {{end}}',
      employmentOpenRange: 'od {{start}}',
      files: {
        toyota: 'Plik Toyota Excel',
        sozPl: 'SOZ PL CSV',
        sozUa: 'SOZ UA CSV',
        notSelected: 'Nie wybrano pliku',
      },
      actions: {
        analyze: 'Analizuj pliki',
        analyzing: 'Analizowanie',
        cancel: 'Anuluj',
        createSelected: 'Utwórz zaznaczonych: {{count}}',
        creating: 'Tworzenie pracowników',
      },
      table: {
        select: 'Wybór',
        selectRow: 'Zaznacz pracownika: {{employee}}',
        status: 'Status',
        teta: 'TETA',
        employee: 'Pracownik',
        identity: 'PESEL / paszport',
        employment: 'Zatrudnienie',
        department: 'Dział',
        housing: 'Mieszkanie',
        warnings: 'Uwagi',
      },
      status: {
        new: 'Nowy',
        existing: 'Istnieje',
        duplicate: 'Duplikat',
        conflict: 'Konflikt',
        blocked: 'Zablokowany',
      },
      housing: {
        media: 'Media {{amount}}',
        accommodation: 'Mieszkanie {{amount}}',
        ownAllowance: 'Dodatek własny {{amount}}',
      },
      warnings: {
        'missing-name': 'Brakuje imienia lub nazwiska.',
        'missing-teta': 'Brakuje numeru TETA.',
        'missing-employment-start': 'Brakuje daty rozpoczęcia zatrudnienia.',
        'duplicate-teta-in-import': 'Ten numer TETA powtarza się w imporcie.',
        'existing-employee':
          'Pracownik z tym numerem TETA już istnieje — import go nie nadpisze.',
        'identity-conflict':
          'PESEL lub paszport pasuje do innego istniejącego pracownika.',
        'soz-unmatched':
          'Wiersz SOZ nie ma jednoznacznego odpowiednika w pliku Toyota.',
        'soz-ambiguous-match':
          'Wiersz SOZ pasuje do kilku osób o tym samym imieniu i nazwisku.',
        'department-na0':
          'Dział NA0 nie jest mapowany automatycznie i wymaga decyzji.',
        'department-unmapped':
          'Dział nie został bezpiecznie rozpoznany i pozostanie pusty.',
        'company-housing-variant-required':
          'Wykryto mieszkanie firmowe, ale wariant mieszkania trzeba przypisać ręcznie.',
        'own-housing-detected':
          'Wykryto dodatek mieszkaniowy w SOZ PL; nie jest tworzony automatycznie.',
      },
      notifications: {
        created: 'Utworzono pracowników: {{count}}.',
      },
      errors: {
        toyotaRequired: 'Wybierz plik Toyota Excel.',
        analyzeFailed: 'Nie udało się przeanalizować plików importu.',
        createFailed: 'Nie udało się utworzyć zaznaczonych pracowników.',
      },
    },
    templateImport: {
      open: 'Import i aktualizacja pracowników',
      title: 'Import i aktualizacja pracowników',
      description:
        'Użyj szablonów aplikacji do tworzenia nowych pracowników albo uzupełniania danych istniejących osób. Pliki rozliczeniowe Toyota/SOZ nie są już standardowym importem pracowników.',
      clearMarkerInfo:
        'Puste komórki w szablonie aktualizacji oznaczają brak zmiany. Aby świadomie wyczyścić pole, wpisz {{marker}}.',
      updateTemplateInfo:
        'Szablon aktualizacji zostanie pobrany dla aktywnych pracowników, którzy nie mają zakończonego zatrudnienia przed dzisiejszą datą. Liczba wierszy: {{count}}.',
      empty: '—',
      noWarnings: 'Brak ostrzeżeń',
      noChanges: 'Bez zmian',
      fileNotSelected: 'Nie wybrano pliku',
      employmentRange: '{{start}} – {{end}}',
      employmentOpenRange: 'od {{start}}',
      changeDescription: '{{field}}: {{oldValue}} → {{newValue}}',
      resultSummary:
        'Zaktualizowano: {{updated}}, pominięto: {{skipped}}, zablokowano: {{blocked}}, błędy: {{errors}}.',
      tabs: {
        newEmployees: 'Nowi pracownicy',
        updateEmployees: 'Aktualizacja danych',
      },
      actions: {
        downloadNewTemplate: 'Pobierz szablon nowych pracowników',
        downloadUpdateTemplate: 'Pobierz szablon aktualizacji',
        chooseFile: 'Wybierz plik CSV',
        previewImport: 'Podgląd importu',
        previewUpdate: 'Podgląd zmian',
        createSelected: 'Utwórz pracowników: {{count}}',
        applySelected: 'Zastosuj zmiany: {{count}}',
        applyingSelected: 'Stosowanie zmian...',
        cancel: 'Anuluj',
      },
      table: {
        select: 'Wybór',
        selectRow: 'Zaznacz wiersz: {{employee}}',
        status: 'Status',
        teta: 'TETA',
        employee: 'Pracownik',
        identity: 'PESEL / paszport',
        employment: 'Zatrudnienie',
        department: 'Dział',
        shift: 'Zmiana',
        changes: 'Zmiany',
        warnings: 'Ostrzeżenia',
        result: 'Wynik zapisu',
      },
      newStatus: {
        new: 'Nowy',
        existing: 'Istnieje',
        duplicate: 'Duplikat',
        conflict: 'Konflikt',
        blocked: 'Zablokowany',
      },
      updateStatus: {
        ready: 'Gotowe',
        warning: 'Z ostrzeżeniem',
        blocked: 'Zablokowane',
        'no-changes': 'Bez zmian',
      },
      applyStatus: {
        updated: 'Zaktualizowano',
        skipped: 'Pominięto',
        blocked: 'Zablokowano',
        error: 'Błąd zapisu',
      },
      warnings: {
        'missing-teta': 'Brakuje numeru TETA.',
        'missing-first-name': 'Brakuje imienia.',
        'missing-last-name': 'Brakuje nazwiska.',
        'missing-employment-start': 'Brakuje daty rozpoczęcia zatrudnienia.',
        'invalid-employment-start':
          'Data rozpoczęcia zatrudnienia jest nieprawidłowa.',
        'invalid-employment-end':
          'Data zakończenia zatrudnienia jest nieprawidłowa.',
        'invalid-date-range':
          'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.',
        'duplicate-teta-in-file': 'Ten numer TETA powtarza się w pliku.',
        'existing-teta':
          'Pracownik z tym numerem TETA już istnieje — import go nie nadpisze.',
        'unknown-teta':
          'Nie znaleziono istniejącego pracownika z tym numerem TETA.',
        'name-mismatch':
          'Imię lub nazwisko w pliku różni się od danych w aplikacji.',
        'identity-conflict':
          'PESEL, paszport lub dokument pasuje do innego pracownika.',
        'department-na0':
          'Dział z pliku: NA0 — wymaga ręcznego przypisania do PU albo Headliner.',
        'department-unmapped':
          'Dział nie został bezpiecznie rozpoznany i pozostanie bez zmian lub pusty.',
        'invalid-shift':
          'Zmiana musi być pusta albo mieć wartość RED, WHITE lub BLUE.',
      },
      notifications: {
        created: 'Utworzono pracowników: {{count}}.',
        updated: 'Zaktualizowano pracowników: {{count}}.',
      },
      progress: {
        applying: 'Stosowanie zmian: {{completed}} / {{total}}',
      },
      errors: {
        fileRequired: 'Wybierz plik CSV przygotowany z szablonu.',
        analyzeFailed: 'Nie udało się przeanalizować pliku CSV.',
        createFailed: 'Nie udało się utworzyć zaznaczonych pracowników.',
        updateFailed: 'Nie udało się zastosować zaznaczonych zmian.',
      },
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
      importL4: 'Importuj L4',
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
      L4: 'L4',
      UW: 'Urlop wypoczynkowy',
      UZ: 'UŻ',
      NN: 'Nieobecność nieusprawiedliwiona',
      NU: 'Nieobecność usprawiedliwiona',
      NI: 'Nieobecność do wyjaśnienia',
      OPD: 'Opieka nad dzieckiem',
      KRW: 'Krwiodawstwo',
      WZN: 'Wezwanie / zwolnienie',
    },
    status: {
      ACTIVE: 'Aktywna',
      CANCELLED: 'Anulowana',
      L4_REPORTED: 'Zgłoszone',
      L4_ACTIVE: 'Aktywne',
      L4_INACTIVE: 'Nieaktywne',
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
      unconfirmedL4: 'L4 zgłoszone ręcznie — oczekuje na potwierdzenie ZUS',
      futureL4Anomaly: 'L4 z przyszłą datą rozpoczęcia wymaga weryfikacji',
      emptyStatus: '—',
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
    l4Import: {
      title: 'Import L4 z Excela',
      description:
        'Wczytaj raport L4, sprawdź podgląd i dopiero potem zapisz poprawne rekordy nieobecności.',
      expectedFormat:
        'Oczekiwany arkusz: RAPORT TBPL. Kolumny: l.p., nazwisko i imię pracownika, rodzaj nieobecności, data od, data do.',
      chooseFile: 'Wybierz plik Excel',
      noFile: 'Nie wybrano pliku',
      analyze: 'Analizuj',
      analyzing: 'Analizowanie',
      resolveEmployee: 'Dopasuj ręcznie',
      chooseEmployee: 'Wybierz pracownika',
      apply: 'Zapisz poprawne L4: {{count}}',
      applying: 'Zapisywanie',
      close: 'Zamknij',
      empty: '—',
      summary:
        'Przeanalizowano {{total}} wierszy. Do zapisu gotowe: {{create}}.',
      toCreate: 'Do utworzenia: {{count}}',
      result:
        'Utworzono: {{created}}, pominięto: {{skipped}}, błędy: {{failed}}.',
      table: {
        row: 'Wiersz',
        sourceName: 'Nazwa z raportu',
        employee: 'Dopasowany pracownik',
        teta: 'TETA',
        type: 'Typ',
        period: 'Okres',
        ownerMonth: 'Miesiąc źródłowy',
        status: 'Wynik',
      },
      status: {
        ready: 'Gotowe',
        'confirm-manual': 'Potwierdzi zgłoszenie',
        duplicate: 'Duplikat',
        'overlap-review': 'Wymaga weryfikacji',
        'continuation-review': 'Możliwa kontynuacja',
        unmatched: 'Nie znaleziono',
        ambiguous: 'Niejednoznaczne',
        invalid: 'Nieprawidłowe',
        'future-start': 'Przyszły początek',
        'unsupported-type': 'Nieobsługiwane',
        'month-missing': 'Brak miesiąca',
      },
      applyStatus: {
        created: 'Utworzono',
        'confirmed-manual': 'Potwierdzono zgłoszenie',
        duplicate: 'Pominięto duplikat',
        unresolved: 'Nie zapisano',
        blocked: 'Zablokowane',
        failed: 'Błąd zapisu',
      },
      messages: {
        ready: 'Rekord zostanie zapisany po potwierdzeniu.',
        'confirm-manual':
          'Import ZUS potwierdzi istniejące ręczne zgłoszenie L4 bez tworzenia drugiej skutecznej nieobecności.',
        created: 'Dokument L4 został zapisany w miesiącu źródłowym.',
        'confirmed-manual':
          'Ręczne zgłoszenie L4 zostało potwierdzone danymi z importu ZUS.',
        duplicate:
          'Taki aktywny dokument L4 już istnieje i zostanie pominięty.',
        'overlap-review':
          'Okres nachodzi na istniejącą nieobecność i wymaga ręcznej decyzji.',
        'continuation-review':
          'Okres sąsiaduje z istniejącym L4 i wymaga ręcznej decyzji.',
        unmatched: 'Nie znaleziono jednoznacznego pracownika w rejestrze.',
        ambiguous:
          'Kilku pracowników może pasować do tej nazwy. Rekord nie zostanie zapisany automatycznie.',
        'invalid-row': 'Wiersz ma brakujące lub nieprawidłowe dane.',
        'missing-name': 'Brakuje nazwy pracownika.',
        'missing-type': 'Brakuje rodzaju nieobecności.',
        'invalid-start-date': 'Data od jest nieprawidłowa.',
        'invalid-end-date': 'Data do jest nieprawidłowa.',
        'invalid-date-range': 'Data do jest wcześniejsza niż data od.',
        'future-start':
          'L4 z raportu zaczyna się w przyszłości. Wiersz wymaga weryfikacji i nie zostanie zapisany automatycznie.',
        'unsupported-type': 'Importer obsługuje w tym kroku tylko L4.',
        'month-missing':
          'Miesiąc źródłowy nie istnieje. Utwórz miesiąc przed importem.',
        'firebase-unavailable':
          'Nie można połączyć się z Firebase. Sprawdź konfigurację aplikacji.',
        'authentication-required':
          'Sesja Firebase wygasła albo użytkownik nie jest zalogowany.',
        'invalid-input': 'Dane wiersza nie spełniają walidacji aplikacji.',
        'month-unavailable': 'Miesiąc źródłowy nie został jeszcze utworzony.',
        'month-settled':
          'Miesiąc źródłowy jest zamknięty i nie pozwala na zapis.',
        'l4-overlap': 'Okres nachodzi na aktywne L4 i wymaga ręcznej decyzji.',
        'ownership-month-change':
          'Miesiąc źródłowy nie zgadza się z datą rozpoczęcia.',
        'permission-denied':
          'Firebase odrzucił zapis z powodu reguł bezpieczeństwa.',
        unavailable:
          'Firebase był chwilowo niedostępny podczas zapisu tego wiersza.',
        'unknown-error':
          'Nie udało się zapisać wiersza. Szczegóły są dostępne w konsoli deweloperskiej.',
      },
      errors: {
        fileRequired: 'Wybierz plik Excel z raportem L4.',
        analyzeFailed:
          'Nie udało się przeanalizować pliku. Sprawdź arkusz i wymagane kolumny.',
        applyFailed:
          'Nie udało się zapisać importu L4. Sprawdź miesiące, uprawnienia i reguły bezpieczeństwa.',
        resolveFailed:
          'Nie udało się sprawdzić ręcznego dopasowania pracownika.',
      },
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
    month: {
      missingTitle: 'Miesiąc {{month}} nie został jeszcze utworzony.',
      missingDescription:
        'Nieobecności można przeglądać, ale dodawanie nowych dokumentów wymaga utworzonego miesiąca rozpoczęcia.',
      createInSettlement: 'Utwórz w rozliczeniu',
      settled:
        'Wybrany miesiąc jest zamknięty. Nieobecności są dostępne tylko do odczytu.',
    },
  },
  adjustments: {
    page: {
      eyebrow: 'Miesięczne fakty',
      title: 'Korekty pracowników',
      description:
        'Premie, potrącenia i inne korekty wprowadzone ręcznie przez koordynatora.',
      add: 'Dodaj korektę',
    },
    table: {
      employee: 'Pracownik',
      category: 'Kategoria',
      direction: 'Kierunek',
      amount: 'Kwota',
      note: 'Notatka',
      status: 'Status',
      actions: 'Akcje',
      noNote: '—',
      edit: 'Edytuj',
      cancel: 'Anuluj korektę',
    },
    categories: {
      MANUAL_BONUS: 'Premia ręczna',
      MANUAL_DEDUCTION: 'Potrącenie ręczne',
      OTHER: 'Inna korekta',
    },
    directions: {
      INCREASE: 'Zwiększenie',
      DECREASE: 'Zmniejszenie',
    },
    status: {
      ACTIVE: 'Aktywna',
      CANCELLED: 'Anulowana',
    },
    empty: {
      title: 'Brak korekt w tym miesiącu',
      description:
        'Premie i potrącenia dodane przez koordynatora pojawią się tutaj.',
    },
    month: {
      missing:
        'Miesiąc {{month}} nie został utworzony. Korekty można dodawać dopiero po utworzeniu miesiąca w Rozliczeniu miesięcznym.',
      settled: 'Miesiąc jest rozliczony. Korekty są dostępne tylko do odczytu.',
      createInSettlement: 'Utwórz w rozliczeniu',
    },
    cancel: {
      title: 'Anulować korektę?',
      description: 'Rekord pozostanie w historii ze statusem Anulowana.',
      back: 'Wróć',
      confirm: 'Anuluj korektę',
    },
    notifications: {
      created: 'Korekta została dodana.',
      updated: 'Korekta została zaktualizowana.',
      cancelled: 'Korekta została anulowana.',
    },
    errors: {
      load: 'Nie udało się wczytać korekt. Sprawdź Firebase i uprawnienia.',
      cancelFailed: 'Nie udało się anulować korekty.',
    },
  },
  settings: {
    shiftConfiguration: {
      title: 'Godziny i korekta zmian',
      description:
        'Wersjonowane godziny zmian oraz lokalne dla działu punkty korekty rotacji.',
      hoursTitle: 'Godziny zmian',
      correctionTitle: 'Korekta zmian',
      validFrom: 'Obowiązuje od',
      startTime: 'Godzina rozpoczęcia',
      endTime: 'Godzina zakończenia',
      saveHours: 'Zapisz wersję godzin',
      correctionDate: 'Data korekty',
      department: 'Dział',
      mode: 'Tryb zmianowy',
      group: 'Grupa',
      preview: 'Podgląd rotacji',
      week: 'Tydzień od',
      history: 'Zapisane punkty korekty',
      impactWarning:
        'Zmiana może przeliczyć plan w otwartych miesiącach. Ręczne godziny i potwierdzone nieobecności pozostaną zapisane, ale wartości zależne od poprzedniego planu mogą wymagać weryfikacji.',
      reviewImpact: 'Sprawdź i potwierdź wpływ',
      impactConfirmed: 'Wpływ został potwierdzony',
      saveCorrection: 'Zapisz korektę zmian',
      invalidHours:
        'Każda zmiana musi mieć prawidłowy przedział od–do, nie dłuższy niż 12 godzin.',
      invalidMapping:
        'Każda grupa musi mieć inną dozwoloną zmianę. W trybie dwuzmianowym nie używa się grupy Blue ani zmiany nocnej.',
      loadError: 'Nie udało się wczytać konfiguracji zmian.',
      saveError: 'Nie udało się zapisać konfiguracji zmian.',
    },
    accommodation: {
      title: 'Kategorie zakwaterowania',
      description:
        'Wersjonowane stawki mediów i zakwaterowania. Zmiana ceny nie przepisuje historii.',
      add: 'Dodaj wersję kategorii',
      saved: 'Wersja kategorii zakwaterowania została zapisana.',
      empty: 'Brak skonfigurowanych kategorii zakwaterowania.',
      noEnd: 'bezterminowo',
      table: {
        name: 'Kategoria / adres',
        media: 'Media',
        accommodation: 'Zakwaterowanie',
        total: 'Razem',
        validity: 'Obowiązuje',
      },
      form: {
        title: 'Kategoria zakwaterowania',
        versionInfo:
          'Zapis tworzy nową wersję stawek. Wcześniejsze miesiące zachowują dotychczasowe wartości.',
        key: 'Kod kategorii',
        name: 'Nazwa kategorii',
        description: 'Opis lub adres',
        descriptionHelper:
          'Opcjonalnie: adres, budynek albo inna nazwa operacyjna.',
        media: 'Media miesięcznie (PLN)',
        accommodation: 'Zakwaterowanie miesięcznie (PLN)',
        validFrom: 'Obowiązuje od',
        saveFailed: 'Nie udało się zapisać wersji kategorii.',
        cancel: 'Anuluj',
        save: 'Zapisz wersję',
      },
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
        'missing-first-toyota-employment-date':
          'Brakuje daty pierwszego zatrudnienia w Toyota.',
        'attendance-absence-conflict':
          'Jawne godziny pracy pokrywają się z aktywną nieobecnością.',
        'explicit-non-working-day': 'Jawne godziny zapisano w dniu wolnym.',
        'attendance-outside-employment':
          'Godziny pracy znajdują się poza okresem zatrudnienia.',
        'absence-outside-employment':
          'Nieobecność wychodzi poza okres zatrudnienia.',
        'ambiguous-absence':
          'Kilka nieobecności ma taki sam priorytet dla tego dnia.',
        'unconfirmed-l4':
          'Ręcznie zgłoszone L4 nie jest jeszcze potwierdzone przez import ZUS i nie jest traktowane jak finalne źródło rozliczenia.',
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
      downloadIncomplete: 'Pobierz wersję niezakończoną',
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
        'unsupported-columns':
          'Część kolumn SOZ/Toyota nie jest jeszcze obsługiwana i pozostanie pusta lub 0: {{count}}.',
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
        UZ: 'UŻ',
        NN: 'NN',
        'clear-manual': 'Wyczyść',
      },
      hours: 'Liczba godzin',
      note: 'Notatka / powód',
      apply: 'Zastosuj',
      clearSelection: 'Wyczyść zaznaczenie',
      noSelection:
        'W trybie Przegląd kliknij nazwisko, aby otworzyć kalendarz pracownika, albo dzień, aby edytować ten dzień. Aktywne narzędzie zakresowe zmienia kliknięcie w zaznaczanie zakresu.',
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
        currentState: 'Aktualny stan',
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
        'Kliknij dzień, aby edytować rzeczywiste godziny lub nieobecność w tym samym edytorze.',
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
      scheduleAutomatic:
        'Plan miesięczny wyznaczony automatycznie na podstawie działu, grupy i rotacji.',
      scheduleBhp:
        'Dzień BHP — pierwsza zmiana, 8 godzin, liczony tylko w dni robocze.',
      scheduleManualCorrection:
        'Ręczna korekta planu miesięcznego. Nie zmienia rzeczywistych godzin pracy.',
      scheduleUnresolved:
        'Nie udało się wyznaczyć planu dla tego dnia. Wymagana jest korekta danych.',
      publicHoliday: 'Święto ustawowe.',
      publicHolidayName: 'Święto ustawowe: {{holiday}}.',
      nonWorkingDay: 'Dzień wolny — domyślna wartość 0 h jest wirtualna.',
      futureDay: 'Nie można edytować przyszłego dnia.',
      outsideEmployment: 'Data poza okresem zatrudnienia pracownika.',
      settledMonth: 'Zamknięty miesiąc jest tylko do odczytu.',
      edit: 'Edytuj dzień: {{employee}}, {{date}}',
      openEmployeeCalendar: 'Otwórz kalendarz pracownika: {{employee}}',
      absence:
        'Nieobecność {{code}} — edycja jest dostępna w module Nieobecności.',
      reportedL4Label: 'L4 zgł.',
      reportedL4Tooltip:
        'Ręcznie zgłoszone L4 — widoczne operacyjnie, ale niepotwierdzone przez import ZUS.',
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
      displayMode: {
        label: 'Tryb wyświetlania kalendarza',
        hours: 'Godziny',
        shifts: 'Zmiany',
      },
      workTime: {
        dayAriaLabel: 'Nadgodziny dzienne: {{hours}} h',
        nightAriaLabel: 'Nadgodziny nocne: {{hours}} h',
        tooltip:
          'Rozkład czasu: podstawowe {{normal}} h, nadgodziny dzienne {{day}} h, nadgodziny nocne {{night}} h.',
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
      title: 'Edycja dnia',
      description: '{{employee}} · {{date}}',
      tabs: {
        hours: 'Godziny',
        absence: 'Nieobecność',
      },
      planContext: 'Plan dnia: {{hours}} h · {{shift}}',
      actualHours: 'Godziny rzeczywiste',
      hours: 'Liczba godzin',
      helper:
        'Wprowadź wartość od 0 do 24. Wartość domyślna nie zostanie zapisana.',
      note: 'Powód lub notatka',
      noteHelper:
        'Opcjonalnie opisz ręczny wpis lub przyczynę korekty wartości z importu.',
      absenceType: 'Rodzaj nieobecności',
      hoursAbsenceConflict:
        'Zapis godzin zastąpi ręcznie wprowadzoną nieobecność dla tego dnia.',
      confirmReplacement:
        'Potwierdzam zastąpienie istniejących danych dla tego dnia.',
      confirmedL4ReadOnly:
        'Potwierdzone L4 pochodzi z importu ZUS i nie może być zmienione w tym oknie.',
      multiDayAbsenceReadOnly:
        'Ta nieobecność obejmuje kilka dni. Zmień jej zakres w module Nieobecności, aby nie usunąć pozostałych dni.',
      importedHoursReadOnly:
        'Oryginalne godziny z importu nie mogą zostać zastąpione nieobecnością w tym oknie.',
      manualL4Notice:
        'Ręczne L4 zostanie zapisane jako „Zgłoszone” i będzie wymagało potwierdzenia importem ZUS.',
      workTime: {
        title: 'Korekta czasu pracy',
        plannedShift: 'Planowana zmiana',
        planDetails: 'Planowane: {{start}}–{{end}}, {{hours}} h.',
        plannedInterval: 'Plan: {{start}}–{{end}}',
        actualStart: 'Rzeczywisty start',
        actualEnd: 'Rzeczywisty koniec',
        optional: 'Opcjonalnie, format GG:MM.',
        invalidTime: 'Wprowadź godzinę w formacie GG:MM.',
        unresolvedShift:
          'Nie udało się ustalić zmiany dla tego dnia. Wybierz zmianę przed zapisem; system nie zgaduje jej automatycznie.',
        preview:
          'Rozbicie: praca normalna {{normal}} h, czas prywatny {{private}} h, nadgodziny 50% {{overtime50}} h, nadgodziny 100% {{overtime100}} h.',
        previewExtended:
          'Plan {{planned}} h, rzeczywiście {{actual}} h, czas prywatny {{private}} h, nadgodziny 50% {{overtime50}} h, nadgodziny 100% {{overtime100}} h, nocne {{night}} h.',
        outcomes: {
          MATCHES_PLAN: 'Zgodne z planem',
          STARTED_EARLIER: 'Wcześniejsze rozpoczęcie',
          STARTED_LATER: 'Późniejsze rozpoczęcie',
          ENDED_EARLIER: 'Wcześniejsze zakończenie',
          ENDED_LATER: 'Późniejsze zakończenie',
          WORKED_MORE: 'Praca ponad plan',
          WORKED_LESS: 'Praca poniżej planu',
          PLANNED_DAY_OFF: 'Praca w planowany dzień wolny',
          SATURDAY: 'Praca w sobotę',
          SUNDAY: 'Praca w niedzielę',
          PUBLIC_HOLIDAY: 'Praca w święto',
          DIFFERENT_INTERVAL: 'Niezgodność z planem',
          REQUIRES_REVIEW: 'Wymaga weryfikacji',
        },
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
        absenceSave:
          'Nie udało się zapisać nieobecności. Wprowadzone dane pozostały w formularzu.',
      },
    },
    loading: 'Ładowanie rozliczenia miesięcznego',
    notifications: {
      created: 'Miesiąc został utworzony.',
      dailyValueSaved: 'Godziny zostały zapisane.',
      dailyValueCleared: 'Wartość ręczna została usunięta.',
      absenceSaved: 'Nieobecność została zapisana.',
      manualL4Saved:
        'L4 zapisano jako zgłoszone i oczekujące na potwierdzenie ZUS.',
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
