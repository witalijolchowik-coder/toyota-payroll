# Masowy import umów, ciągłość i decyzje po terminie

## Szablon

Szablon pracowników zawiera pięć par `Umowa N od` / `Umowa N do`. Umowy
nieanulowane są wpisywane od najstarszej. Puste dalsze pary oznaczają brak
instrukcji i nigdy nie usuwają historii. Gdy istnieje więcej niż pięć umów,
koordynator otrzymuje ostrzeżenie, a szósta i kolejne pozostają nietknięte.

`Data pierwszego zatrudnienia w Toyota` jest oddzielnym faktem historycznym.
Nie oznacza początku bieżącej umowy ani sekwencji. Kolumny `Data rozpoczęcia
pracy` i `Data zakończenia pracy` są usunięte. Stary arkusz z tymi kolumnami
jest odczytany, ale wartości są jawnie ignorowane i nie zmieniają umów,
statusu, archiwum ani rozliczeń.

## Podgląd i dopasowanie

Wiersz jest dopasowany do pracownika przez TETA. Umowa najpierw szuka
dokładnego odpowiednika po datach. Jeżeli liczba pozycji odpowiada historii,
jednoznaczna zmiana pozycyjna jest pokazana jako korekta dat. Niepewne
dopasowanie, częściowa para, błędny zakres, duplikat lub nakładanie blokuje
wiersz. Import nie zgaduje i nie anuluje umów.

Nowa umowa i korekta przechodzą przez wspólny serwis umów. Serwis analizuje
oba zakresy korekty, blokuje miesiące zamknięte, kolejkuje przeliczenie miesięcy
otwartych i zapisuje audyt. Podgląd pokazuje zablokowane miesiące przed
zastosowaniem. Dokładnie niezmienione umowy również mają ślad pominięcia.

## Ciągłość

Umowy są ciągłe, gdy następna zaczyna się w dniu kalendarzowym bezpośrednio po
końcu poprzedniej. Ich suma pokrycia jest jednym okresem: nie powstaje nowy
start, zakończenie, rotacja ani zdarzenie kaucji. Pełne pokrycie miesiąca przez
kilka kolejnych umów kwalifikuje się do istniejących zasad pełnego miesiąca,
w tym UDT, własnego mieszkania i premii miesięcznych. Dzień bez pokrycia jest
rzeczywistą przerwą i nie jest ukrywany.

## Wygaśnięcie i archiwum

Wygaśnięcie umowy bez jawnego `/employmentEndEvents` nie archiwizuje
pracownika. Pracownik pozostaje w `Aktywni` ze stanem `Umowa po terminie` i
wymaga dodania umowy albo jawnego zakończenia. Dashboard liczy takie przypadki
razem z nadchodzącymi umowami jako wymagające uwagi i przypina przeterminowane
pozycje przed terminami przyszłymi.

Archiwum wynika wyłącznie ze zgodnego jawnego zdarzenia zakończenia ostatniej
sekwencji. Migracja legacy jest idempotentna: tworzy deterministyczny dokument
tylko bez istniejącej historii, nie fabrykuje zakończeń i naprawia stary
automatyczny stan nieaktywny wyłącznie bez prawdziwego zdarzenia końcowego.
