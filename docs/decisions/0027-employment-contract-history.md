# ADR 0027: Historia umów jest źródłem pokrycia zatrudnienia

## Status

Accepted

## Context

Jedna modyfikowalna para dat na dokumencie pracownika traciła historię po
przedłużeniu umowy i mogła zmienić wcześniejsze rozliczenia.

## Decision

Wprowadzamy globalne kolekcje `/employeeContracts` i
`/employmentEndEvents`. Nieanulowane umowy tworzą kanoniczną sumę dni
zatrudnienia. Bieżąca umowa, udział miesięczny, archiwum i limit 18 miesięcy
są wyliczane przez wspólne selektory.

Wygaśnięcie umowy nie jest decyzją o zakończeniu zatrudnienia. Archiwizacja
następuje dopiero po jawnym zdarzeniu zakończenia. Powrót tworzy nową sekwencję
umów na istniejącym pracowniku.

Legacy daty pracownika są jedynie wyprowadzanymi polami zgodności. Migracja
tworzy z nich pierwszą umowę tylko wtedy, gdy historia jeszcze nie istnieje.

## Consequences

- historyczne miesiące zachowują właściwe pokrycie;
- przerwy i kontynuacje są reprezentowane jednoznacznie;
- korekty przecinające zamknięty miesiąc są blokowane;
- otwarte miesiące są kierowane do automatycznego przeliczenia;
- dokumenty umów i zakończeń nie są fizycznie usuwane;
- kontrola nakładania okresów pozostaje w serwisie aplikacji do czasu
  wprowadzenia zaufanego backendu.
