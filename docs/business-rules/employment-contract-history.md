# Historia umów i zakończenie zatrudnienia

- Status: zaimplementowana podstawa operacyjna
- Zakres: historia pokrycia zatrudnienia, decyzja o zakończeniu, migracja
  danych legacy i limit 18 miesięcy

## Źródło prawdy

Każda umowa jest osobnym dokumentem `/employeeContracts/{contractId}`:

```text
employee_id
teta_number
start_date
end_date
sequence_number
status: ACTIVE | CANCELLED
note
created_at / created_by
updated_at / updated_by
cancelled_at / cancelled_by
```

Nazwisko pracownika nie jest kopiowane do dokumentu operacyjnego. Umowy
`CANCELLED` nie tworzą pokrycia zatrudnienia. Status `Przyszła`, `Aktualna`
lub `Zakończona` jest wyliczany z dat i dzisiejszego dnia.

Pola `employment_start` i `employment_end` na dokumencie pracownika pozostają
wyłącznie polami zgodności dla starszego kodu. Są wyprowadzane z historii
umów i nie mogą być niezależnie nadpisywane przez formularz lub import.
`first_toyota_employment_date` pozostaje najwcześniejszą historyczną datą i
nie zmienia się przy powrocie pracownika.

## Walidacja i ciągłość

Zakres umowy jest domknięty. Data końca nie może poprzedzać daty początku.
Aktywne umowy jednego pracownika nie mogą być duplikatami ani nakładać się.
Okresy nie są automatycznie scalane.

Umowa zaczynająca się dzień po poprzedniej jest kontynuacją bez przerwy.
Późniejszy początek tworzy dozwoloną przerwę. W dniach przerwy pracownik nie
uczestniczy w rozliczeniu, nie otrzymuje planu ani wirtualnych godzin.

## Udział w miesiącu

Pracownik uczestniczy w miesiącu, jeżeli co najmniej jedna nieanulowana umowa
przecina miesiąc. Kalkulacja używa sumy zbiorów dni pokrytych wszystkimi
umowami, dzięki czemu:

- historyczna umowa zachowuje udział w historycznym miesiącu;
- ciągłe umowy nie liczą dnia podwójnie;
- przerwa wewnątrz miesiąca nie generuje nominału ani planu;
- dzisiejszy status i zakładka `Archiwum` nie sterują udziałem historycznym.

Te same selektory pokrycia są używane przez uczestników miesiąca, nominał,
plan, readiness, dodatki, zakwaterowanie, eksporty oraz stan bieżącej umowy.

## Wygaśnięcie umowy i decyzja

Samo zakończenie ostatniej umowy nie archiwizuje pracownika. Jeżeli nie istnieje
kolejna umowa ani jawna decyzja, stan brzmi:
`Umowa zakończona — brak decyzji`.

Koordynator wybiera jedną z operacji:

- `Dodaj kolejną umowę`;
- `Zakończ zatrudnienie`.

Jawne zakończenie tworzy nieusuwalny dokument
`/employmentEndEvents/{eventId}` ze wskazaniem pracownika, numeru sekwencji,
daty ostatniego dnia, notatki i aktora. Data musi być pokryta najnowszą umową
i zwykle jest jej datą końcową. Po ostatnim dniu pracownik trafia do archiwum,
ale pozostaje w historycznych rozliczeniach.

Jeżeli zakwaterowanie firmowe nadal trwa i kaucja jest zatrzymana, zakończenie
zatrudnienia zwraca ją w końcowym miesiącu. Identyfikator epizodu zapobiega
podwójnemu zwrotowi, a istniejące ręczne pomniejszenie zwrotu jest zachowane.

## Powrót pracownika

Powrót nie tworzy drugiego pracownika. Nowa umowa rozpoczyna nową sekwencję,
a poprzednie umowy, zdarzenia zakończenia, rozliczenia i epizody
zakwaterowania pozostają w historii.

## Limit 18 miesięcy

Limit jest liczony jako 18 miesięcy kalendarzowych faktycznego pokrycia
umowami w bieżącym cyklu:

1. aktywne umowy są porządkowane po dacie początku;
2. zużycie to liczba unikalnych, domkniętych dni pokrycia, z uwzględnieniem
   części miesięcy, końców miesięcy i lat przestępnych;
3. przerwy nie zużywają limitu;
4. powrót przed upływem 18 miesięcy od dnia po końcu poprzedniej sekwencji
   kontynuuje cykl;
5. powrót w dniu, w którym minęło pełne 18 miesięcy bez zatrudnienia, albo
   później, rozpoczyna nowy pełny cykl;
6. projektowana data limitu dla aktualnie zatrudnionego dodaje pozostałą
   liczbę dni pokrycia do dzisiejszej daty.

Starsze cykle nie są usuwane. Pierwsza historyczna data Toyota pozostaje
oddzielna od początku bieżącego cyklu.

## Migracja i import

Migracja tworzy dokładnie jedną umowę z prawidłowego legacy
`employment_start` / `employment_end`, tylko gdy pracownik nie ma historii
umów. Ponowne uruchomienie jest idempotentne, nie nadpisuje nowszej historii
i zapisuje audyt. Jeżeli stary dokument był nieaktywny wyłącznie dlatego, że
umowa wygasła, a nie ma zgodnego jawnego zdarzenia zakończenia, migracja
przywraca go do widoku operacyjnego i pozostawia stan wymagający decyzji.
Zgodne jawne zakończenie zachowuje swój identyfikator sekwencji i archiwum.

Import masowy zmienia wyłącznie konkretne dokumenty umów przez ten sam serwis,
którego używa ręczna korekta. Legacy daty pracownika są ignorowane. Pola
zgodności na dokumencie pracownika mogą pozostać przejściowo tylko jako
wyliczony, nieedytowalny snapshot historii umów.

## Korekta i anulowanie umowy

Przed korektą lub anulowaniem wyliczane są miesiące dotknięte zmianą. Zmiana:

- jest blokowana, jeżeli przecina zamknięty miesiąc;
- dla otwartych miesięcy zapisuje kolejkę istniejącego automatycznego
  przeliczenia;
- nie usuwa fizycznie używanej historii — błędna umowa otrzymuje status
  `CANCELLED`;
- zapisuje poprzedni i nowy zakres, miesiące wpływu, użytkownika i czas w
  `auditLog`.

Firestore Rules chronią kształt pojedynczego dokumentu, tożsamość pracownika,
zatwierdzonego użytkownika i brak hard-delete. Walidacja nakładania okresów i
wpływu na inne dokumenty jest obecnie wykonywana przez współdzielony serwis
klienta. Przeniesienie tej kontroli do zaufanego backendu pozostaje
utwardzeniem przyszłościowym.
