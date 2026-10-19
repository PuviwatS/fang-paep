// Generated from the Supabase schema. Regenerate after changing a migration:
//   npx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/database.types.ts
// Function results are `Json`; src/lib/api/types.ts describes their shapes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      artists: {
        Row: { aliases: string[]; id: number; name: string };
        Insert: { aliases?: string[]; id?: never; name: string };
        Update: { aliases?: string[]; id?: never; name?: string };
        Relationships: [];
      };
      daily_puzzles: {
        Row: { category: string; day: number; song_id: number };
        Insert: { category: string; day: number; song_id: number };
        Update: { category?: string; day?: number; song_id?: number };
        Relationships: [
          {
            foreignKeyName: "daily_puzzles_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      game_results: {
        Row: {
          category: string;
          created_at: string;
          day: number;
          finished_at: string | null;
          guesses: Json;
          id: number;
          source: string;
          tries: number;
          user_id: string;
          won: boolean;
        };
        Insert: {
          category: string;
          created_at?: string;
          day: number;
          finished_at?: string | null;
          guesses?: Json;
          id?: never;
          source?: string;
          tries?: number;
          user_id: string;
          won?: boolean;
        };
        Update: {
          category?: string;
          created_at?: string;
          day?: number;
          finished_at?: string | null;
          guesses?: Json;
          id?: never;
          source?: string;
          tries?: number;
          user_id?: string;
          won?: boolean;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_thb: number;
          created_at: string;
          id: number;
          plan_id: string;
          provider: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount_thb: number;
          created_at?: string;
          id?: never;
          plan_id: string;
          provider: string;
          status: string;
          user_id: string;
        };
        Update: {
          amount_thb?: number;
          created_at?: string;
          id?: never;
          plan_id?: string;
          provider?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          active: boolean;
          billing_interval: string;
          features: string[];
          id: string;
          name: string;
          price_thb: number;
          sort_order: number;
        };
        Insert: {
          active?: boolean;
          billing_interval: string;
          features?: string[];
          id: string;
          name: string;
          price_thb: number;
          sort_order?: number;
        };
        Update: {
          active?: boolean;
          billing_interval?: string;
          features?: string[];
          id?: string;
          name?: string;
          price_thb?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
      player_stats: {
        Row: {
          best_streak: number;
          category: string;
          last_day: number | null;
          played: number;
          streak: number;
          updated_at: string;
          user_id: string;
          wins: number;
        };
        Insert: {
          best_streak?: number;
          category: string;
          last_day?: number | null;
          played?: number;
          streak?: number;
          updated_at?: string;
          user_id: string;
          wins?: number;
        };
        Update: {
          best_streak?: number;
          category?: string;
          last_day?: number | null;
          played?: number;
          streak?: number;
          updated_at?: string;
          user_id?: string;
          wins?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: { created_at: string; display_name: string; id: string };
        Insert: { created_at?: string; display_name: string; id: string };
        Update: { created_at?: string; display_name?: string; id?: string };
        Relationships: [];
      };
      song_previews: {
        Row: {
          artwork_url: string | null;
          preview_url: string;
          song_id: number;
          track_url: string | null;
          updated_at: string;
        };
        Insert: {
          artwork_url?: string | null;
          preview_url: string;
          song_id: number;
          track_url?: string | null;
          updated_at?: string;
        };
        Update: {
          artwork_url?: string | null;
          preview_url?: string;
          song_id?: number;
          track_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      songs: {
        Row: {
          active: boolean;
          artist_id: number;
          category: string;
          created_at: string;
          id: number;
          title: string;
          year: number | null;
        };
        Insert: {
          active?: boolean;
          artist_id: number;
          category: string;
          created_at?: string;
          id: number;
          title: string;
          year?: number | null;
        };
        Update: {
          active?: boolean;
          artist_id?: number;
          category?: string;
          created_at?: string;
          id?: number;
          title?: string;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "songs_artist_id_fkey";
            columns: ["artist_id"];
            isOneToOne: false;
            referencedRelation: "artists";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string;
          current_period_start: string;
          id: number;
          plan_id: string;
          provider: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end: string;
          current_period_start: string;
          id?: never;
          plan_id: string;
          provider?: string;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string;
          current_period_start?: string;
          id?: never;
          plan_id?: string;
          provider?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      cancel_subscription: { Args: never; Returns: Json };
      get_leaderboard: { Args: { p_category: string; p_day?: number }; Returns: Json };
      get_my_account: { Args: never; Returns: Json };
      get_my_stats: { Args: { p_category: string }; Returns: Json };
      get_puzzle: { Args: { p_category: string; p_day?: number }; Returns: Json };
      import_local_games: { Args: { p_games: Json }; Returns: Json };
      mock_checkout: { Args: { p_plan_id: string }; Returns: Json };
      resume_subscription: { Args: never; Returns: Json };
      submit_guess: {
        Args: { p_attempt?: number; p_category: string; p_day: number; p_song_id?: number };
        Returns: Json;
      };
      update_display_name: { Args: { p_name: string }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
