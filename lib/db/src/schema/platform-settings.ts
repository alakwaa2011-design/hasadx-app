import { pgTable, serial, text, integer, boolean, jsonb } from "drizzle-orm/pg-core";

/* Default caps for the regular (free) tier of the interactive
   presentations feature. Admins can override these from the admin
   panel; the values are persisted in the `presentation_limits` JSONB
   column. T7 wires up the resolver and the admin UI. */
export const DEFAULT_PRESENTATION_LIMITS = {
  maxImagesRegular: 5,
  maxFilesRegular: 1,
  maxSlidesRegular: 20,
  maxSizeMbRegular: 50,
} as const;

export type PresentationLimits = typeof DEFAULT_PRESENTATION_LIMITS;

export const platformSettingsTable = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  publicVisibility: text("public_visibility").notNull().default("selective"),
  guestLimit: integer("guest_limit").notNull().default(1),
  primaryColor: text("primary_color"),
  accentColor: text("accent_color"),
  fontFamily: text("font_family"),
  platformName: text("platform_name"),
  logoUrl: text("logo_url"),
  showAdventureGamesHome: boolean("show_adventure_games_home").notNull().default(false),
  showSpaceRaceGamesHome: boolean("show_space_race_games_home").notNull().default(false),
  showFlagsGame: boolean("show_flags_game").notNull().default(true),
  showColorGame: boolean("show_color_game").notNull().default(true),
  showMemoryGame: boolean("show_memory_game").notNull().default(true),
  showMultiplyGame: boolean("show_multiply_game").notNull().default(true),
  showScrambleGame: boolean("show_scramble_game").notNull().default(true),
  showTugGame: boolean("show_tug_game").notNull().default(false),
  showCapitalsGame: boolean("show_capitals_game").notNull().default(true),
  proAiForAll: boolean("pro_ai_for_all").notNull().default(false),
  presentationsProForAll: boolean("presentations_pro_for_all").notNull().default(false),
  presentationLimits: jsonb("presentation_limits").$type<PresentationLimits>().notNull().default(DEFAULT_PRESENTATION_LIMITS),
  showQuranSection: boolean("show_quran_section").notNull().default(false),
  showGeneralCertificates: boolean("show_general_certificates").notNull().default(false),
  showMaraqui: boolean("show_maraqui").notNull().default(false),
});
