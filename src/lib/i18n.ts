// Tiny dictionary-based translations. English text is the key.
import { useEffect, useState } from "react";
import { loadPrefs, type Lang } from "./prefs";

const DICT: Record<string, { ro: string; ru: string }> = {
  "Plan runs": { ro: "Planificare curse", ru: "План рейсов" },
  Drivers: { ro: "Șoferi", ru: "Водители" },
  Vehicles: { ro: "Vehicule", ru: "Транспорт" },
  Settings: { ro: "Setări", ru: "Настройки" },
  Appearance: { ro: "Aspect", ru: "Внешний вид" },
  Theme: { ro: "Temă", ru: "Тема" },
  "Follow your device, or pick light or dark.": { ro: "Ca pe dispozitiv, sau alege luminos ori întunecat.", ru: "Как на устройстве, или выберите светлую или тёмную." },
  System: { ro: "Sistem", ru: "Система" },
  Light: { ro: "Luminos", ru: "Светлая" },
  Dark: { ro: "Întunecat", ru: "Тёмная" },
  Language: { ro: "Limbă", ru: "Язык" },
  "Interface language": { ro: "Limba interfeței", ru: "Язык интерфейса" },
  Accessibility: { ro: "Accesibilitate", ru: "Доступность" },
  "Text size": { ro: "Mărimea textului", ru: "Размер текста" },
  "Drag to make all text smaller or bigger.": { ro: "Trage pentru a micșora sau mări tot textul.", ru: "Перетащите, чтобы уменьшить или увеличить текст." },
  Reset: { ro: "Resetează", ru: "Сбросить" },
  Account: { ro: "Cont", ru: "Аккаунт" },
  Email: { ro: "Email", ru: "Эл. почта" },
  "Your name": { ro: "Numele tău", ru: "Ваше имя" },
  Save: { ro: "Salvează", ru: "Сохранить" },
  "Sign out": { ro: "Ieșire", ru: "Выйти" },
  "You'll need to sign in again on this device.": { ro: "Va trebui să te autentifici din nou pe acest dispozitiv.", ru: "Нужно будет снова войти на этом устройстве." },
  "Profile saved": { ro: "Profil salvat", ru: "Профиль сохранён" },
  "Couldn't save your name": { ro: "Numele nu a putut fi salvat", ru: "Не удалось сохранить имя" },
};

export function translate(lang: Lang, s: string) {
  return lang === "en" ? s : DICT[s]?.[lang] ?? s;
}

export function useT() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const up = () => setLang(loadPrefs().lang);
    up();
    window.addEventListener("greenlogix-prefs", up);
    return () => window.removeEventListener("greenlogix-prefs", up);
  }, []);
  return (s: string) => translate(lang, s);
}
