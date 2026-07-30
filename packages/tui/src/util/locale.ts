export type Language = "ru" | "en"

const russian: Record<string, string> = {
  BUILD: "СБОРКА",
  Build: "Сборка",
  SHELL: "ОБОЛОЧКА",
  EXIT: "ВЫХОД",
  Prompt: "Ввод",
  Session: "Сессия",
  Model: "Модель",
  Agent: "Агент",
  System: "Система",
  Dialog: "Диалог",
  Provider: "Провайдер",
  Providers: "Провайдеры",
  Direct: "Напрямую",
  "Kote Gateway": "Kote Gateway",
  Permission: "Разрешение",
  Question: "Вопрос",
  Terminal: "Терминал",
  Workspace: "Рабочая область",
  Version: "Версия",
  Help: "Помощь",
  Date: "Дата",
  Other: "Другое",
  "(Recommended)": "(Рекомендуется)",
  "(API key)": "(API-ключ)",
  "(ChatGPT Plus/Pro or API key)": "(ChatGPT Plus/Pro или API-ключ)",
  "Low cost subscription for everyone": "Недорогая подписка для всех",
  Suggested: "Рекомендуемые",
  Favorite: "Избранное",
  Popular: "Популярное",
  None: "Нет",
  Shell: "Оболочка",
  auto: "авто",
  agents: "агенты",
  commands: "команды",
  "exit shell mode": "выйти из оболочки",
  Directory: "Каталог",
  File: "Файл",
  QUEUED: "В ОЧЕРЕДИ",
  Compaction: "Сжатие",
  interrupted: "прервано",
  Thinking: "Размышление",
  Thought: "Мысль",
  Autocomplete: "Автодополнение",
  "Project Commands": "Команды проекта",
  "MCP Commands": "Команды MCP",
  'Ask anything... "Fix a TODO in the codebase"': "Спросите что угодно… «Исправь TODO в кодовой базе»",
  'Run a command... "git status"': "Введите команду… «git status»",
  interrupt: "прервать",
  "again to interrupt": "ещё раз для остановки",
  background: "в фон",
  queued: "в очереди",
  subagents: "субагенты",
  normal: "обычный режим",
  cmd: "команды",
  "Shell mode": "Режим оболочки",
  "Open command palette": "Открыть палитру команд",
  "Cycle model variant": "Переключить вариант модели",
  "Background subagents": "Отправить субагентов в фон",
  "View subagents": "Показать субагентов",
  "Manage queued prompts": "Управлять запросами в очереди",
  "Open editor": "Открыть редактор",
  "New session": "Новая сессия",
  "Rename session": "Переименовать сессию",
  "Switch session": "Сменить сессию",
  "Fork session": "Ответвить сессию",
  "Compact session": "Сжать сессию",
  "Delete session": "Удалить сессию",
  "Connect provider": "Подключить провайдера",
  "Getting started": "Начало работы",
  "KoteCode includes free models so you can start immediately.":
    "В KoteCode есть бесплатные модели — можно начать сразу.",
  "Connect from 75+ providers to use other models, including Claude, GPT, Gemini etc":
    "Подключите одного из 75+ провайдеров, чтобы использовать Claude, GPT, Gemini и другие модели.",
  "Custom provider": "Свой провайдер",
  "API key": "API-ключ",
  "Provider id": "ID провайдера",
  "Select auth method": "Выбор способа авторизации",
  "Authorization code": "Код авторизации",
  "Invalid code": "Неверный код",
  "Waiting for authorization...": "Ожидание авторизации…",
  "Copied to clipboard": "Скопировано в буфер обмена",
  "OAuth authorization failed. Try /connect again.": "Ошибка OAuth-авторизации. Повторите /connect.",
  "This only stores a credential. Configure the provider in opencode.json to use it.":
    "Будут сохранены только учётные данные. Настройте провайдера в opencode.json, чтобы использовать его.",
  "Provider ids must start with a lowercase letter or number and only use lowercase letters, numbers, hyphens, and underscores":
    "ID провайдера должен начинаться со строчной буквы или цифры и содержать только строчные буквы, цифры, дефисы и подчёркивания.",
  Skills: "Навыки",
  "Switch model": "Сменить модель",
  "Variant cycle": "Переключить вариант",
  "Switch model variant": "Сменить вариант модели",
  Exit: "Выйти",
  Commands: "Команды",
  Search: "Поиск",
  "No results found": "Ничего не найдено",
  "No variants available": "Нет доступных вариантов",
  "No matching items": "Нет подходящих элементов",
  "Select subagent": "Выбор субагента",
  "No subagents found": "Субагенты не найдены",
  "Queued prompts": "Запросы в очереди",
  "No queued prompts": "Очередь запросов пуста",
  "No skills found": "Навыки не найдены",
  "Skills loading": "Загрузка навыков",
  Default: "По умолчанию",
  current: "текущий",
  "Select variant": "Выбор варианта",
  "Select model": "Выбор модели",
  "Select item": "Выбрать",
  "Models loading": "Загрузка моделей",
  Free: "Бесплатно",
  done: "готово",
  cancelled: "отменено",
  error: "ошибка",
  running: "выполняется",
  "compose in your external editor": "написать во внешнем редакторе",
  "start a new session": "начать новую сессию",
  "close KoteCode": "закрыть KoteCode",
  "browse available skills": "посмотреть доступные навыки",
  "Clear prompt or exit": "Очистить ввод или выйти",
  "Clear prompt": "Очистить ввод",
  "Submit prompt": "Отправить запрос",
  "Submit dialog prompt": "Отправить ответ",
  "Enter text": "Введите текст",
  "Working...": "Выполняется…",
  "processing...": "обработка…",
  copy: "копировать",
  "Interrupt session": "Прервать сессию",
  "Previous prompt history": "Предыдущий запрос в истории",
  "Next prompt history": "Следующий запрос в истории",
  "Exit shell mode": "Выйти из режима оболочки",
  "Previous autocomplete item": "Предыдущий вариант автодополнения",
  "Next autocomplete item": "Следующий вариант автодополнения",
  "Hide autocomplete": "Скрыть автодополнение",
  "Select autocomplete item": "Выбрать вариант автодополнения",
  "Complete autocomplete item": "Дополнить выбранным вариантом",
  "failed to open editor": "не удалось открыть редактор",
  "Connect a provider to send prompts": "Подключите провайдера, чтобы отправлять запросы",
  "waiting for current response": "ожидание текущего ответа",
  "empty prompt ignored": "пустой запрос пропущен",
  "loading commands": "загрузка команд",
  "awaiting permission": "ожидание разрешения",
  "awaiting answer": "ожидание ответа",
  "running shell": "выполнение команды",
  "assistant responding": "ассистент отвечает",
  "waiting for assistant": "ожидание ассистента",
  "unknown error": "неизвестная ошибка",
  "no variants available": "нет доступных вариантов",
  "failed to start new session": "не удалось начать новую сессию",
  "Permission required": "Требуется разрешение",
  "Always allow": "Разрешать всегда",
  "Allow once": "Разрешить один раз",
  "Allow always": "Разрешать всегда",
  Reject: "Отклонить",
  Cancel: "Отмена",
  "Reject permission": "Отклонить разрешение",
  "Tell KoteCode what to do differently": "Подскажите KoteCode, что нужно сделать иначе",
  "No diff provided": "Изменения не предоставлены",
  Patterns: "Шаблоны",
  fullscreen: "на весь экран",
  minimize: "свернуть",
  "This keeps the session running despite repeated failures.":
    "Сессия продолжит работу, несмотря на повторяющиеся ошибки.",
  "Continue after repeated failures": "Продолжить после повторяющихся ошибок",
  "This will allow the following patterns until KoteCode is restarted.":
    "Эти шаблоны будут разрешены до перезапуска KoteCode.",
  "Waiting for permission event...": "Ожидание ответа на запрос разрешения…",
  "Waiting for question event...": "Ожидание ответа на вопрос…",
  "Fix a TODO in the codebase": "Исправь TODO в кодовой базе",
  "What is the tech stack of this project?": "Какой стек технологий используется в проекте?",
  "Fix broken tests": "Исправь сломанные тесты",
  "Show command palette": "Показать палитру команд",
  "Switch theme": "Сменить тему",
  "Switch agent": "Сменить агента",
  "Toggle MCPs": "Управлять MCP",
  "Show key bindings": "Показать горячие клавиши",
  "View status": "Показать состояние",
  "View debug info": "Показать отладочную информацию",
  "Open docs": "Открыть документацию",
  "Exit the app": "Выйти из приложения",
  "Switch to light mode": "Переключить на светлую тему",
  "Switch to dark mode": "Переключить на тёмную тему",
  "Lock theme mode": "Заблокировать режим темы",
  "Unlock theme mode": "Разблокировать режим темы",
  "Toggle debug panel": "Показать панель отладки",
  "Toggle console": "Показать консоль",
  "Write heap snapshot": "Сохранить дамп кучи",
  "Heap snapshot written to {{files}}": "Дамп кучи сохранён в {{files}}",
  "Disable terminal title": "Отключить заголовок терминала",
  "Enable terminal title": "Включить заголовок терминала",
  "Disable animations": "Отключить анимации",
  "Enable animations": "Включить анимации",
  "Disable file context": "Отключить файловый контекст",
  "Enable file context": "Включить файловый контекст",
  "Disable diff wrapping": "Отключить перенос строк в diff",
  "Enable diff wrapping": "Включить перенос строк в diff",
  "Disable paste summary": "Отключить сводку вставки",
  "Enable paste summary": "Включить сводку вставки",
  "Disable session directory filtering": "Отключить фильтрацию каталога сессий",
  "Enable session directory filtering": "Включить фильтрацию каталога сессий",
  "Disable auto-approve permissions": "Отключить автоодобрение разрешений",
  "Enable auto-approve permissions": "Включить автоодобрение разрешений",
  "Show tips": "Показать подсказки",
  "Hide tips": "Скрыть подсказки",
  "Plugins": "Плагины",
  "Install plugin": "Установить плагин",
  "Open diff viewer": "Открыть просмотрщик изменений",
  "Suspend terminal": "Приостановить терминал",
  "Update Failed": "Ошибка обновления",
  "Update failed": "Не удалось обновить",
  "Update Complete": "Обновление завершено",
  Copy: "Копировать",
  Paste: "Вставить",
  Open: "Открыть",
  Delete: "Удалить",
  Refresh: "Обновить",
  Confirm: "Подтверждение",
  Review: "Проверка",
  "(not answered)": "(нет ответа)",
  " (select all that apply)": " (можно выбрать несколько)",
  "Type your own answer": "Ввести свой ответ",
  submit: "отправить",
  toggle: "переключить",
  confirm: "подтвердить",
  cancel: "отмена",
  reject: "отклонить",
  select: "выбрать",
  save: "сохранить",
  tab: "вкладки",
  dismiss: "закрыть",
  "No subagent activity yet": "Активности субагента пока нет",
  "assistant interrupted": "ответ ассистента прерван",
  "reasoning interrupted": "рассуждение прервано",
  "# Todos": "# Задачи",
  "# Questions": "# Вопросы",
  "Model default": "Модель по умолчанию",
}

export function resolveLanguage(input?: string): Language {
  const value = input?.trim().toLowerCase()
  if (value && (value === "en" || value.startsWith("en_") || value.startsWith("en-"))) return "en"
  return "ru"
}

export function translate(input: string, language: Language = "ru", variables?: Record<string, string | number>) {
  // exact dictionary matches take priority over dynamic regex rules,
  // otherwise "Write heap snapshot" is mangled into "Запись heap snapshot" before lookup
  const dynamic =
    language === "ru"
      ? russian[input] ??
        input
          .replace(/^(\d+) queued$/, "$1 в очереди")
          .replace(/^(\d+) active$/, "$1 активных")
          .replace(/^(\d+) recent$/, "$1 недавних")
          .replace(/^(\d+) of (\d+)$/, "$1 из $2")
          .replace(/^queued · ctrl\+e edit · ctrl\+d remove$/, "в очереди · ctrl+e изменить · ctrl+d удалить")
          .replace(/^Access external directory (.+)$/, "Доступ к внешнему каталогу $1")
          .replace(/^Call tool (.+)$/, "Вызвать инструмент $1")
          .replace(/^Tool: (.+)$/, "Инструмент: $1")
          .replace(/^This will allow (.+) until KoteCode is restarted\.$/, "$1 будет разрешён до перезапуска KoteCode.")
          .replace(/^Read (.+)$/, "Чтение $1")
          .replace(/^Write (.+)$/, "Запись $1")
          .replace(/^Edit (.+)$/, "Изменение $1")
          .replace(/^List (.+)$/, "Список $1")
          .replace(/^model (.+)$/, "модель $1")
          .replace(/^variant (.+) unavailable$/, "вариант $1 недоступен")
          .replace(/^Cannot connect to API: (.+)$/, "Не удалось подключиться к API: $1")
      : input
  const template = language === "ru" ? (russian[dynamic] ?? dynamic) : input
  if (!variables) return template
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template,
  )
}

export function agent(input: string, language: Language = "ru") {
  if (language === "en") return titlecase(input)
  const known: Record<string, string> = {
    build: "Сборка",
    plan: "План",
    explore: "Исследование",
    general: "Общий",
  }
  return known[input.toLowerCase()] ?? titlecase(input)
}

export function titlecase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function time(input: number): string {
  const date = new Date(input)
  return date.toLocaleTimeString(undefined, { timeStyle: "short" })
}

export function datetime(input: number): string {
  const date = new Date(input)
  const localTime = time(input)
  const localDate = date.toLocaleDateString()
  return `${localTime} · ${localDate}`
}

export function todayTimeOrDateTime(input: number): string {
  const date = new Date(input)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()

  if (isToday) {
    return time(input)
  } else {
    return datetime(input)
  }
}

export function number(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

export function duration(input: number) {
  if (input < 1000) {
    return `${input}ms`
  }
  if (input < 60000) {
    return `${(input / 1000).toFixed(1)}s`
  }
  if (input < 3600000) {
    const minutes = Math.floor(input / 60000)
    const seconds = Math.floor((input % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }
  if (input < 86400000) {
    const hours = Math.floor(input / 3600000)
    const minutes = Math.floor((input % 3600000) / 60000)
    return `${hours}h ${minutes}m`
  }
  const days = Math.floor(input / 86400000)
  const hours = Math.floor((input % 86400000) / 3600000)
  return `${days}d ${hours}h`
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len - 1) + "…"
}

export function truncateLeft(str: string, len: number): string {
  if (str.length <= len) return str
  return "…" + str.slice(-(len - 1))
}

export function truncateMiddle(str: string, maxLength: number = 35): string {
  if (str.length <= maxLength) return str

  const ellipsis = "…"
  const keepStart = Math.ceil((maxLength - ellipsis.length) / 2)
  const keepEnd = Math.floor((maxLength - ellipsis.length) / 2)

  return str.slice(0, keepStart) + ellipsis + str.slice(-keepEnd)
}

export function pluralize(count: number, singular: string, plural: string): string {
  const template = count === 1 ? singular : plural
  return template.replace("{}", count.toString())
}

export * as Locale from "./locale"
