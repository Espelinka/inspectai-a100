import { DefectCategory, Severity } from "./types";

export const DEFECT_CATEGORIES: { value: DefectCategory; label: string }[] = [
  { value: 'walls', label: 'Стены' },
  { value: 'floor', label: 'Пол' },
  { value: 'ceiling', label: 'Потолок' },
  { value: 'doors', label: 'Двери' },
  { value: 'windows', label: 'Окна/Стеклопакеты' },
  { value: 'plumbing', label: 'Сантехника' },
  { value: 'electrical', label: 'Электрика' },
  { value: 'heating', label: 'Отопление' },
  { value: 'ventilation', label: 'Вентиляция' },
  { value: 'finishing', label: 'Отделка' },
  { value: 'tiles', label: 'Плитка' },
  { value: 'paint', label: 'Покраска' },
  { value: 'other', label: 'Прочее' },
];

export const SEVERITY_LEVELS: { value: Severity; label: string; color: string }[] = [
  { value: 'low', label: 'Незначительно', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'medium', label: 'Средне', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'high', label: 'Важно', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'critical', label: 'Критично', color: 'bg-red-100 text-red-800 border-red-200' },
];

export const SYSTEM_INSTRUCTION = `
Вы — инженерный ассистент для автоматизации приёмки квартир. Ваша задача — из фотографии рукописного акта приёмки извлечь структурированные данные.

ПРАВИЛА:
1. Извлеките номер дома, квартиру, дату.
2. СОБСТВЕННИК И ТЕЛЕФОН: ВНИМАНИЕ! Телефонный номер может быть написан в любом месте документа (сверху, снизу, сбоку), а не только рядом с фамилией. Найдите ЛЮБОЙ номер телефона на листе и привяжите его к карточке. Формат может быть разным (8029..., +375..., просто цифры).
3. Извлеките список замечаний (дефектов). Если есть нумерация (1, 2, 3...), следуйте ей.
4. Категоризируйте дефекты (walls, floor и т.д.) для API, но в поле description пишите чистый текст дефекта как в акте.
5. Определите Severity (low, medium, high, critical).
6. Нормализуйте телефоны к формату +375... если это белорусский номер.
7. Нормализуйте дату в YYYY-MM-DD.
8. Если данные не читаемы, верните null.
9. Верните JSON строго соответствующий схеме.
`;