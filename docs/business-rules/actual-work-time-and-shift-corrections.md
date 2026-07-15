# Rzeczywisty czas pracy i korekty zmian

## Źródło czasu pracy

System nie ma wiarygodnego pliku wejść i wyjść. Planowany przedział jest więc wirtualnym domyślnym czasem rzeczywistym. Dokument `dailyValues` powstaje dopiero po jawnej korekcie koordynatora. Nie wdrażamy importu ewidencji wejść/wyjść.

Plan, rzeczywisty przedział, nieobecność oraz wyliczone składniki pozostają odrębnymi faktami. Zmiana planu nie usuwa ręcznej korekty ani potwierdzonej nieobecności.

## Godziny zmian

Domyślne wersjonowane przedziały to: zmiana 1 `06:00–14:00`, zmiana 2 `14:00–22:00`, zmiana N `22:00–06:00`. Obowiązuje najnowsza aktywna wersja z `valid_from <= data`. Późniejsza wersja nie zmienia historycznych dni.

Ścieżka: `/shiftHoursVersions/{versionId}`.

## Korekta zmian

Korekta jest lokalna dla działu i ma dokładną datę obowiązywania. Dopuszczalne działy: Metal, Szwalnia, Montaż, PU, Headliner i Magazyn.

- trzy zmiany: Red, White i Blue otrzymują unikalnie 1, 2 oraz N;
- dwie zmiany: Red i White otrzymują unikalnie 1 oraz 2; Blue i N nie są generowane;
- sekwencja trzyzmianowa do przodu: `1 → N → 2 → 1`;
- sekwencja dwuzmianowa: `1 ↔ 2`;
- granicą tygodnia jest poniedziałek 00:00 według daty ISO;
- dla daty obowiązuje najbliższa aktywna korekta nie późniejsza niż ta data; jeżeli data jest wcześniejsza od pierwszej korekty, faza jest liczona wstecz od pierwszej korekty;
- kolejna korekta zaczyna nowy segment rotacji i nie zmienia wcześniejszego segmentu.

PU i Headliner mogą przechodzić między trybem dwu- i trzyzmianowym przez kolejne punkty korekty. Ścieżka: `/departmentShiftCorrections/{correctionId}`.

### Podgląd wpływu przed zapisem

Przed zapisaniem punktu korekty system porównuje wygenerowany plan przed i po proponowanej zmianie. Analiza obejmuje wyłącznie wybrany dział, aktywne okresy zatrudnienia i efektywne przypisania działu oraz grupy. Uwzględnia BHP, ręczne wyjątki planu, wersjonowane godziny zmian i tryb dwu- lub trzyzmianowy.

Segment zaczyna się w dacie korekty. Kończy się w ostatnim dniu aktualnie otwartych miesięcy albo dzień przed następnym aktywnym punktem korekty tego samego działu — zależnie od tego, która granica wystąpi wcześniej. Poprzedni punkt określa plan „przed”, a kolejny punkt nie jest przeliczany przez wcześniejszą korektę. Zamkniętych miesięcy i innych działów podgląd nie skanuje.

Dzień jest zmieniony tylko wtedy, gdy różni się co najmniej jedna istotna wartość planu: zmiana, początek, koniec, czas trwania lub status dnia. Liczniki używają unikalnych par pracownik–dzień i pokazują: pracowników objętych zmianą, zmienione dni planu, ręczne przedziały czasu, nadgodziny, niedoczas/czas prywatny, nieobecności, potwierdzone L4 oraz dni wymagające ponownej weryfikacji. Szczegóły pokazują TETA, datę, plan przed i po oraz znaczniki danych istniejących w danym dniu.

Jeżeli wynik wynosi zero, punkt konfiguracji można zapisać bez alarmującego ostrzeżenia. Analiza nie wykonuje żadnych zapisów. Dla dużego zakresu interfejs pokazuje stan obliczania, blokuje podwójne zatwierdzenie i udostępnia przewijaną, filtrowaną tabelę szczegółów.

### Ochrona faktów i ponowna weryfikacja

Po zatwierdzeniu zapisywany jest wyłącznie nowy punkt konfiguracji. Wirtualny plan jest następnie generowany z aktualnej konfiguracji. Ręczny przedział rzeczywisty, potwierdzone L4, pozostałe nieobecności, daty zatrudnienia, przypisania i inne fakty pracownika nie są usuwane ani nadpisywane.

Zmiana planu może zmienić interpretację istniejącego faktu czasu. Gotowość miesiąca porównuje plan zapisany przy ręcznym przedziale z aktualnie generowanym planem. Rozbieżność tworzy precyzyjne ostrzeżenie dla ręcznego czasu, nadgodzin, czasu prywatnego albo pracy kolidującej z nowym dniem wolnym. Sama potwierdzona nieobecność nie staje się błędem wskutek zmiany planu.

Wpis audytowy korekty zawiera identyfikator korekty, dział, datę, zakres wpływu, poprzednie i nowe mapowanie oraz wszystkie liczniki podsumowania. Nie kopiuje listy nazwisk ani pełnej tabeli szczegółów.

## Plan dnia i BHP

Plan zawiera kod zmiany, początek, koniec i czas trwania. Brak grupy nie kasuje planu: po BHP stosowana jest zmiana 1 do czasu przypisania grupy lub wyjątku. BHP ma pierwszeństwo przed rotacją, obejmuje pierwsze dwa rzeczywiste dni robocze, odbywa się na zmianie 1 i liczy 8 godzin.

## Korekta od–do i plan–wykonanie

Wspólny edytor dnia przyjmuje rzeczywisty początek i koniec. Koniec wcześniejszy od początku oznacza przejście przez północ. System wylicza czas normalny, nadgodziny 50%, nadgodziny 100%, godziny nocne oraz niedobór/czas prywatny, używając istniejących reguł odchyleń.

Pełnodniowa nieobecność wyłącza wirtualny czas pracy. Potwierdzone L4 pozostaje chronione. Praca w dniu planowo wolnym zachowuje stan planu wolnego i jest klasyfikowana jako odchylenie, a nie zmiana stałego przypisania pracownika.

## Bezpieczeństwo i gotowość

Ustawienia może zapisywać tylko aktywny zatwierdzony użytkownik. Reguły odrzucają niepełne przedziały, niekanoniczny dział, powtórzone zmiany i nocną zmianę w trybie dwuzmianowym. Konfiguracja jest dopisywana wersjami; historia nie jest usuwana. Miesięczne korekty czasu nadal podlegają ochronie miesiąca zamkniętego.

Nierozwiązany plan, niepoprawny przedział, konflikt z potwierdzoną nieobecnością i nierozstrzygnięta klasyfikacja są ostrzeżeniem lub blokadą gotowości. Sam brak grupy nie jest blokadą, jeśli plan został rozwiązany zmianą 1.

## Poza zakresem

Ten blok nie wdraża importu ewidencji czasu, serwerowego końcowego przeliczenia, zamknięcia miesiąca, niezmiennego snapshotu ani finalnych eksportów.
