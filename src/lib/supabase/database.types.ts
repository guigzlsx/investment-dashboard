export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      asset_themes: {
        Row: {
          asset_id: string
          confidence: number | null
          created_at: string
          source: string
          theme: string
        }
        Insert: {
          asset_id: string
          confidence?: number | null
          created_at?: string
          source?: string
          theme: string
        }
        Update: {
          asset_id?: string
          confidence?: number | null
          created_at?: string
          source?: string
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_themes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"] | null
          country: string | null
          created_at: string
          currency: string | null
          exchange: string | null
          exchange_name: string | null
          id: string
          industry: string | null
          isin: string | null
          logo_url: string | null
          name: string
          provider_symbols: Json
          sector: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          asset_type?: Database["public"]["Enums"]["asset_type"] | null
          country?: string | null
          created_at?: string
          currency?: string | null
          exchange?: string | null
          exchange_name?: string | null
          id?: string
          industry?: string | null
          isin?: string | null
          logo_url?: string | null
          name: string
          provider_symbols?: Json
          sector?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"] | null
          country?: string | null
          created_at?: string
          currency?: string | null
          exchange?: string | null
          exchange_name?: string | null
          id?: string
          industry?: string | null
          isin?: string | null
          logo_url?: string | null
          name?: string
          provider_symbols?: Json
          sector?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          as_of_date: string
          fetched_at: string
          from_currency: string
          id: string
          rate: number
          source: string
          to_currency: string
        }
        Insert: {
          as_of_date: string
          fetched_at?: string
          from_currency: string
          id?: string
          rate: number
          source: string
          to_currency: string
        }
        Update: {
          as_of_date?: string
          fetched_at?: string
          from_currency?: string
          id?: string
          rate?: number
          source?: string
          to_currency?: string
        }
        Relationships: []
      }
      investment_notes: {
        Row: {
          asset_id: string | null
          created_at: string
          horizon: string | null
          id: string
          invalidation_conditions: string | null
          personal_notes: string | null
          portfolio_id: string | null
          review_status: string
          risks: string | null
          status: string
          target_expectations: string | null
          thesis: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          horizon?: string | null
          id?: string
          invalidation_conditions?: string | null
          personal_notes?: string | null
          portfolio_id?: string | null
          review_status?: string
          risks?: string | null
          status?: string
          target_expectations?: string | null
          thesis?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          horizon?: string | null
          id?: string
          invalidation_conditions?: string | null
          personal_notes?: string | null
          portfolio_id?: string | null
          review_status?: string
          risks?: string | null
          status?: string
          target_expectations?: string | null
          thesis?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_notes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_notes_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data_cache: {
        Row: {
          as_of_date: string | null
          asset_id: string | null
          cache_key: string
          expires_at: string
          fetched_at: string
          id: string
          payload: Json
          provider: string
          resource_type: string
        }
        Insert: {
          as_of_date?: string | null
          asset_id?: string | null
          cache_key: string
          expires_at: string
          fetched_at?: string
          id?: string
          payload: Json
          provider: string
          resource_type: string
        }
        Update: {
          as_of_date?: string | null
          asset_id?: string | null
          cache_key?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          payload?: Json
          provider?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_data_cache_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_quotes: {
        Row: {
          as_of: string | null
          asset_id: string
          change_1d: number | null
          change_1d_percent: number | null
          currency: string | null
          data_kind: string
          fetched_at: string
          id: string
          market_cap: number | null
          price: number | null
          source: string
          source_endpoint: string
          volume: number | null
        }
        Insert: {
          as_of?: string | null
          asset_id: string
          change_1d?: number | null
          change_1d_percent?: number | null
          currency?: string | null
          data_kind?: string
          fetched_at?: string
          id?: string
          market_cap?: number | null
          price?: number | null
          source: string
          source_endpoint: string
          volume?: number | null
        }
        Update: {
          as_of?: string | null
          asset_id?: string
          change_1d?: number | null
          change_1d_percent?: number | null
          currency?: string | null
          data_kind?: string
          fetched_at?: string
          id?: string
          market_cap?: number | null
          price?: number | null
          source?: string
          source_endpoint?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_quotes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          captured_at: string
          cash_base: number | null
          created_at: string
          currency: string | null
          data_quality: string
          fx_source: string | null
          id: string
          invested_cost_base: number | null
          pnl_base: number | null
          portfolio_id: string
          total_value_base: number | null
        }
        Insert: {
          captured_at?: string
          cash_base?: number | null
          created_at?: string
          currency?: string | null
          data_quality?: string
          fx_source?: string | null
          id?: string
          invested_cost_base?: number | null
          pnl_base?: number | null
          portfolio_id: string
          total_value_base?: number | null
        }
        Update: {
          captured_at?: string
          cash_base?: number | null
          created_at?: string
          currency?: string | null
          data_quality?: string
          fx_source?: string | null
          id?: string
          invested_cost_base?: number | null
          pnl_base?: number | null
          portfolio_id?: string
          total_value_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          asset_id: string
          condition_type: string
          cooldown_hours: number
          created_at: string
          currency: string | null
          enabled: boolean
          id: string
          last_triggered_at: string | null
          threshold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id: string
          condition_type: string
          cooldown_hours?: number
          created_at?: string
          currency?: string | null
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          threshold: number
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          condition_type?: string
          cooldown_hours?: number
          created_at?: string
          currency?: string | null
          enabled?: boolean
          id?: string
          last_triggered_at?: string | null
          threshold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          asset_id: string | null
          created_at: string
          currency: string
          executed_at: string
          fees: number
          fx_rate_as_of: string | null
          fx_rate_to_base: number | null
          fx_source: string | null
          id: string
          metadata: Json
          note: string | null
          portfolio_id: string
          price: number | null
          quantity: number | null
          quote_currency: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          currency: string
          executed_at: string
          fees?: number
          fx_rate_as_of?: string | null
          fx_rate_to_base?: number | null
          fx_source?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          portfolio_id: string
          price?: number | null
          quantity?: number | null
          quote_currency?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          currency?: string
          executed_at?: string
          fees?: number
          fx_rate_as_of?: string | null
          fx_rate_to_base?: number | null
          fx_source?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          portfolio_id?: string
          price?: number | null
          quantity?: number | null
          quote_currency?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_items: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          personal_note: string | null
          target_currency: string | null
          target_price: number | null
          updated_at: string
          watchlist_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          personal_note?: string | null
          target_currency?: string | null
          target_price?: number | null
          updated_at?: string
          watchlist_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          personal_note?: string | null
          target_currency?: string | null
          target_price?: number | null
          updated_at?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      asset_type: "STOCK" | "ETF"
      transaction_type:
        | "BUY"
        | "SELL"
        | "DIVIDEND"
        | "SPLIT"
        | "DEPOSIT"
        | "WITHDRAWAL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_type: ["STOCK", "ETF"],
      transaction_type: [
        "BUY",
        "SELL",
        "DIVIDEND",
        "SPLIT",
        "DEPOSIT",
        "WITHDRAWAL",
      ],
    },
  },
} as const

