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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      chat_rooms: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          participant_1: string
          participant_2: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participant_1: string
          participant_2: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participant_1?: string
          participant_2?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          category_id: string | null
          condition: string | null
          created_at: string
          daily_rate: number | null
          deposit_amount: number | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          location: string | null
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          condition?: string | null
          created_at?: string
          daily_rate?: number | null
          deposit_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          location?: string | null
          owner_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          condition?: string | null
          created_at?: string
          daily_rate?: number | null
          deposit_amount?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          location?: string | null
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      lending_transactions: {
        Row: {
          actual_return_date: string | null
          borrow_date: string
          borrower_id: string
          created_at: string
          delivery_address: string | null
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          delivery_notes: string | null
          delivery_type: string | null
          deposit_amount: number | null
          due_date: string
          id: string
          item_id: string
          lender_id: string
          notes: string | null
          paid_at: string | null
          payment_intent_id: string | null
          qr_delivery_code: string | null
          qr_return_code: string | null
          return_confirmed_at: string | null
          return_confirmed_by: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          actual_return_date?: string | null
          borrow_date: string
          borrower_id: string
          created_at?: string
          delivery_address?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_notes?: string | null
          delivery_type?: string | null
          deposit_amount?: number | null
          due_date: string
          id?: string
          item_id: string
          lender_id: string
          notes?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          qr_delivery_code?: string | null
          qr_return_code?: string | null
          return_confirmed_at?: string | null
          return_confirmed_by?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          actual_return_date?: string | null
          borrow_date?: string
          borrower_id?: string
          created_at?: string
          delivery_address?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_notes?: string | null
          delivery_type?: string | null
          deposit_amount?: number | null
          due_date?: string
          id?: string
          item_id?: string
          lender_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          qr_delivery_code?: string | null
          qr_return_code?: string | null
          return_confirmed_at?: string | null
          return_confirmed_by?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lending_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_room_id: string
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          message_type: string | null
          negotiation_status: string | null
          offer_amount: number | null
          offer_data: Json | null
          offer_status: string | null
          offer_type: string | null
          payment_status: string | null
          sender_id: string
        }
        Insert: {
          chat_room_id: string
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          negotiation_status?: string | null
          offer_amount?: number | null
          offer_data?: Json | null
          offer_status?: string | null
          offer_type?: string | null
          payment_status?: string | null
          sender_id: string
        }
        Update: {
          chat_room_id?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          negotiation_status?: string | null
          offer_amount?: number | null
          offer_data?: Json | null
          offer_status?: string | null
          offer_type?: string | null
          payment_status?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiations: {
        Row: {
          chat_room_id: string
          created_at: string | null
          id: string
          message: string | null
          offer_amount: number
          order_id: string
          order_type: string
          original_amount: number
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          chat_room_id: string
          created_at?: string | null
          id?: string
          message?: string | null
          offer_amount: number
          order_id: string
          order_type: string
          original_amount: number
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          chat_room_id?: string
          created_at?: string | null
          id?: string
          message?: string | null
          offer_amount?: number
          order_id?: string
          order_type?: string
          original_amount?: number
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiations_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_actions: {
        Row: {
          action: string
          actor_id: string
          created_at: string | null
          id: string
          order_id: string
          order_type: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string | null
          id?: string
          order_id: string
          order_type: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string | null
          id?: string
          order_id?: string
          order_type?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_top_borrowers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_top_lenders"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_top_referrers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          id: string
          metadata: Json | null
          reference_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status: string
          stripe_payment_intent_id?: string | null
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          location: string | null
          payment_enabled: boolean | null
          phone: string | null
          rating: number | null
          stripe_account_id: string | null
          stripe_account_verified: boolean | null
          total_ratings: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          payment_enabled?: boolean | null
          phone?: string | null
          rating?: number | null
          stripe_account_id?: string | null
          stripe_account_verified?: boolean | null
          total_ratings?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          payment_enabled?: boolean | null
          phone?: string | null
          rating?: number | null
          stripe_account_id?: string | null
          stripe_account_verified?: boolean | null
          total_ratings?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reference_id: string
          reviewee_id: string
          reviewer_id: string
          transaction_type: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reference_id: string
          reviewee_id: string
          reviewer_id: string
          transaction_type: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reference_id?: string
          reviewee_id?: string
          reviewer_id?: string
          transaction_type?: string
        }
        Relationships: []
      }
      service_bookings: {
        Row: {
          booking_date: string
          booking_time: string
          created_at: string
          customer_id: string
          duration_hours: number
          id: string
          paid_at: string | null
          payment_intent_id: string | null
          provider_id: string
          qr_service_complete_code: string | null
          qr_service_start_code: string | null
          service_address: string | null
          service_completed_at: string | null
          service_completed_by: string | null
          service_id: string
          service_notes: string | null
          service_started_at: string | null
          service_started_by: string | null
          service_type: string | null
          special_requests: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          created_at?: string
          customer_id: string
          duration_hours?: number
          id?: string
          paid_at?: string | null
          payment_intent_id?: string | null
          provider_id: string
          qr_service_complete_code?: string | null
          qr_service_start_code?: string | null
          service_address?: string | null
          service_completed_at?: string | null
          service_completed_by?: string | null
          service_id: string
          service_notes?: string | null
          service_started_at?: string | null
          service_started_by?: string | null
          service_type?: string | null
          special_requests?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          created_at?: string
          customer_id?: string
          duration_hours?: number
          id?: string
          paid_at?: string | null
          payment_intent_id?: string | null
          provider_id?: string
          qr_service_complete_code?: string | null
          qr_service_start_code?: string | null
          service_address?: string | null
          service_completed_at?: string | null
          service_completed_by?: string | null
          service_id?: string
          service_notes?: string | null
          service_started_at?: string | null
          service_started_by?: string | null
          service_type?: string | null
          special_requests?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          duration_hours: number | null
          hourly_rate: number
          id: string
          image_url: string | null
          is_available: boolean | null
          location: string | null
          provider_id: string
          rating: number | null
          title: string
          total_ratings: number | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          hourly_rate: number
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          location?: string | null
          provider_id: string
          rating?: number | null
          title: string
          total_ratings?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          hourly_rate?: number
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          location?: string | null
          provider_id?: string
          rating?: number | null
          title?: string
          total_ratings?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_category: Database["public"]["Enums"]["badge_category"]
          badge_description: string | null
          badge_icon: string | null
          badge_name: string
          earned_at: string | null
          id: string
          rarity: string | null
          user_id: string
        }
        Insert: {
          badge_category?: Database["public"]["Enums"]["badge_category"]
          badge_description?: string | null
          badge_icon?: string | null
          badge_name: string
          earned_at?: string | null
          id?: string
          rarity?: string | null
          user_id: string
        }
        Update: {
          badge_category?: Database["public"]["Enums"]["badge_category"]
          badge_description?: string | null
          badge_icon?: string | null
          badge_name?: string
          earned_at?: string | null
          id?: string
          rarity?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string | null
          last_activity_date: string | null
          level: number | null
          on_time_payments: number | null
          streak_days: number | null
          total_borrows: number | null
          total_lends: number | null
          total_referrals: number | null
          trust_score: number | null
          updated_at: string | null
          user_id: string
          xp: number | null
        }
        Insert: {
          created_at?: string | null
          last_activity_date?: string | null
          level?: number | null
          on_time_payments?: number | null
          streak_days?: number | null
          total_borrows?: number | null
          total_lends?: number | null
          total_referrals?: number | null
          trust_score?: number | null
          updated_at?: string | null
          user_id: string
          xp?: number | null
        }
        Update: {
          created_at?: string | null
          last_activity_date?: string | null
          level?: number | null
          on_time_payments?: number | null
          streak_days?: number | null
          total_borrows?: number | null
          total_lends?: number | null
          total_referrals?: number | null
          trust_score?: number | null
          updated_at?: string | null
          user_id?: string
          xp?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_top_borrowers: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          level: number | null
          on_time_payments: number | null
          rank: number | null
          total_borrows: number | null
          trust_score: number | null
          user_id: string | null
          xp: number | null
        }
        Relationships: []
      }
      leaderboard_top_lenders: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          level: number | null
          rank: number | null
          rating: number | null
          total_lends: number | null
          trust_score: number | null
          user_id: string | null
          xp: number | null
        }
        Relationships: []
      }
      leaderboard_top_referrers: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          level: number | null
          rank: number | null
          total_referrals: number | null
          user_id: string | null
          xp: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      award_xp: {
        Args: { p_user_id: string; p_xp_amount: number }
        Returns: undefined
      }
      check_and_award_badges: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      generate_qr_code: {
        Args: { action_type: string; transaction_id: string }
        Returns: string
      }
      verify_lending_qr_scan: {
        Args: {
          p_action: string
          p_qr_code: string
          p_transaction_id: string
          p_user_id: string
        }
        Returns: Json
      }
      verify_service_qr_scan: {
        Args: {
          p_action: string
          p_booking_id: string
          p_qr_code: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      badge_category:
        | "borrowing"
        | "lending"
        | "community"
        | "streak"
        | "special"
        | "referral"
        | "speed"
        | "quality"
        | "seasonal"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      badge_category: [
        "borrowing",
        "lending",
        "community",
        "streak",
        "special",
        "referral",
        "speed",
        "quality",
        "seasonal",
      ],
    },
  },
} as const
