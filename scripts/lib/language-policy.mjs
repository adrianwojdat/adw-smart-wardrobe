// This heuristic reports likely Polish prose, not individual accented proper names.
export function isLikelyPolish(text) {
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const obvious =
    /\b(?:nie udało|zaloguj się|brak danych|nie można|spróbuj ponownie|lista na wyjazd|kod organizujemy|dane użytkownika)\b/iu;
  const markers = new Set([
    'anulowano',
    'zadanie',
    'zadania',
    'kolejka',
    'kolejce',
    'kolejkami',
    'sterowanie',
    'skonfigurowano',
    'skonfigurowana',
    'jest',
    'najpierw',
    'zapisz',
    'klucz',
    'wybierz',
    'ustawieniach',
    'przekroczono',
    'czas',
    'oczekiwania',
    'maksymalny',
    'konfiguracji',
    'szyfrowania',
    'brakuje',
    'wygenerowania',
    'stylizacji',
    'struktura',
    'publiczne',
    'granice',
    'poprawne',
    'nie',
    'oraz',
    'przez',
    'tylko',
    'zapis',
    'zapisano',
    'plik',
    'pliki',
    'pytania',
    'odpowiedzi',
    'ankieta',
    'stylu',
    'garderoby',
    'ubrania',
    'dodano',
    'zachowano',
    'przeniesiono',
    'konfiguracja',
    'weryfikacja',
    'przed',
    'ponownie',
    'wymagany',
    'zaloguj',
    'ustawienia',
    'brak',
    'danych',
    'wybranej',
    'konta',
    'strony',
  ]);
  const marked = words.filter((word) => markers.has(word)).length;
  const accented = words.filter((word) => /[ąćęłńóśźż]/u.test(word)).length;

  return (
    (words.length >= 2 &&
      words.some((word) =>
        ['zapisano', 'anulowano', 'przekroczono', 'skonfigurowano'].includes(word),
      )) ||
    obvious.test(text) ||
    marked >= 2 ||
    (accented >= 2 && words.length >= 3) ||
    (marked >= 1 && accented >= 1)
  );
}
