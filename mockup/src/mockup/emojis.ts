// Avatar emojis are identity, not artwork: 48 options in three categories
// (m3-temas-cor.md §4.6). A profile keeps `emojiAvatar`; null falls back to the
// themed illustration or the animal icon.
export type EmojiCategoryId = "animais" | "objetos" | "comida";

export type EmojiCategory = {
  id: EmojiCategoryId;
  label: string;
  emojis: string[];
};

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "animais",
    label: "Animais",
    emojis: [
      "🦕",
      "🦖",
      "🐉",
      "🦁",
      "🐯",
      "🦊",
      "🐻",
      "🐼",
      "🦄",
      "🐴",
      "🐷",
      "🐵",
      "🐸",
      "🐧",
      "🦅",
      "🦆",
      "🦉",
      "🐬",
      "🐳",
      "🐙",
      "🦋",
      "🐝",
      "🐢",
      "🐞",
    ],
  },
  {
    id: "objetos",
    label: "Objetos",
    emojis: [
      "🚀",
      "⭐",
      "🌈",
      "🎨",
      "🎪",
      "🏰",
      "🌺",
      "🌻",
      "🍄",
      "🌙",
      "☀️",
      "⚡",
      "💎",
      "🔥",
      "❤️",
      "🎵",
    ],
  },
  {
    id: "comida",
    label: "Comida",
    emojis: ["🍕", "🍩", "🍉", "🧁", "🍭", "🍪", "🥑", "🍓"],
  },
];

export const AVATAR_EMOJIS: string[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
