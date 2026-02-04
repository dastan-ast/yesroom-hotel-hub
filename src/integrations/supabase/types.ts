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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      booking_rooms: {
        Row: {
          booking_id: string
          created_at: string | null
          hotel_id: string
          id: string
          room_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          hotel_id: string
          id?: string
          room_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          hotel_id?: string
          id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rooms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rooms_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_services: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          quantity: number
          service_id: string | null
          service_name: string
          total_price: number | null
          unit_price: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          quantity?: number
          service_id?: string | null
          service_name: string
          total_price?: number | null
          unit_price?: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          quantity?: number
          service_id?: string | null
          service_name?: string
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          additional_info: Json | null
          check_in_date: string
          check_out_date: string
          client_id: string | null
          created_at: string
          daily_rate: number | null
          external_id: string | null
          external_source_data: Json | null
          final_total: number | null
          guest_comment: string | null
          guest_count: number
          guest_name: string
          guest_phone: string
          hotel_id: string | null
          id: string
          prepayment_amount: number | null
          prepayment_received: boolean
          room_id: string | null
          room_type_id: string | null
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number | null
          updated_at: string
        }
        Insert: {
          additional_info?: Json | null
          check_in_date: string
          check_out_date: string
          client_id?: string | null
          created_at?: string
          daily_rate?: number | null
          external_id?: string | null
          external_source_data?: Json | null
          final_total?: number | null
          guest_comment?: string | null
          guest_count?: number
          guest_name: string
          guest_phone: string
          hotel_id?: string | null
          id?: string
          prepayment_amount?: number | null
          prepayment_received?: boolean
          room_id?: string | null
          room_type_id?: string | null
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          additional_info?: Json | null
          check_in_date?: string
          check_out_date?: string
          client_id?: string | null
          created_at?: string
          daily_rate?: number | null
          external_id?: string | null
          external_source_data?: Json | null
          final_total?: number | null
          guest_comment?: string | null
          guest_count?: number
          guest_name?: string
          guest_phone?: string
          hotel_id?: string | null
          id?: string
          prepayment_amount?: number | null
          prepayment_received?: boolean
          room_id?: string | null
          room_type_id?: string | null
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types_public"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          document_number: string | null
          email: string | null
          full_name: string
          hotel_id: string | null
          id: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          email?: string | null
          full_name: string
          hotel_id?: string | null
          id?: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_number?: string | null
          email?: string | null
          full_name?: string
          hotel_id?: string | null
          id?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_api_keys: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          created_by: string | null
          hotel_id: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          created_by?: string | null
          hotel_id: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          created_by?: string | null
          hotel_id?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_api_keys_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_api_keys_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          settings: Json | null
          slug: string
          status: string
          subscription_status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          settings?: Json | null
          slug: string
          status?: string
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          settings?: Json | null
          slug?: string
          status?: string
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          hotel_id: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          hotel_id?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          hotel_id?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          amenities: string[] | null
          capacity: number
          created_at: string
          description: string | null
          hotel_id: string | null
          id: string
          image_url: string | null
          images: string[] | null
          name: string
          price_per_night: number
          updated_at: string
        }
        Insert: {
          amenities?: string[] | null
          capacity?: number
          created_at?: string
          description?: string | null
          hotel_id?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          name: string
          price_per_night: number
          updated_at?: string
        }
        Update: {
          amenities?: string[] | null
          capacity?: number
          created_at?: string
          description?: string | null
          hotel_id?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          name?: string
          price_per_night?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          floor: number
          hotel_id: string | null
          id: string
          notes: string | null
          room_number: string
          room_type_id: string
          status: Database["public"]["Enums"]["room_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          floor?: number
          hotel_id?: string | null
          id?: string
          notes?: string | null
          room_number: string
          room_type_id: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          floor?: number
          hotel_id?: string | null
          id?: string
          notes?: string | null
          room_number?: string
          room_type_id?: string
          status?: Database["public"]["Enums"]["room_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types_public"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          created_at: string
          default_price: number
          hotel_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_price?: number
          hotel_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_price?: number
          hotel_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      service_charges: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          created_by: string | null
          description: string
          hotel_id: string
          id: string
        }
        Insert: {
          amount?: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          description: string
          hotel_id: string
          id?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          hotel_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_charges_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_charges_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_charges_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          hotel_id: string
          id: string
          invited_by: string | null
          permissions: string[]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          hotel_id: string
          id?: string
          invited_by?: string | null
          permissions?: string[]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          hotel_id?: string
          id?: string
          invited_by?: string | null
          permissions?: string[]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          permissions: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          id?: string
          permissions?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          permissions?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permissions_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_history: {
        Row: {
          changed_by: string | null
          created_at: string
          hotel_id: string
          id: string
          new_status: string
          new_trial_ends_at: string | null
          previous_status: string | null
          previous_trial_ends_at: string | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          new_status: string
          new_trial_ends_at?: string | null
          previous_status?: string | null
          previous_trial_ends_at?: string | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          new_status?: string
          new_trial_ends_at?: string | null
          previous_status?: string | null
          previous_trial_ends_at?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      hotels_public: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          location: string | null
          logo_url: string | null
          name: string | null
          settings: Json | null
          slug: string | null
          status: string | null
          subscription_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string | null
          settings?: never
          slug?: string | null
          status?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string | null
          settings?: never
          slug?: string | null
          status?: string | null
          subscription_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      room_types_public: {
        Row: {
          amenities: string[] | null
          capacity: number | null
          description: string | null
          hotel_id: string | null
          id: string | null
          image_url: string | null
          images: string[] | null
          name: string | null
          price_per_night: number | null
        }
        Relationships: [
          {
            foreignKeyName: "room_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { _token: string; _user_id: string }
        Returns: undefined
      }
      assign_user_role: {
        Args: {
          _hotel_id: string
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      check_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      get_user_hotel_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_user_role_to_owner: {
        Args: { _user_id: string }
        Returns: undefined
      }
      validate_invitation_token: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          hotel_id: string
          id: string
          permissions: string[]
          status: string
          token: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "guest" | "superadmin" | "owner"
      booking_source: "manual" | "web" | "booking" | "telegram" | "whatsapp"
      booking_status:
        | "pending"
        | "approved"
        | "checked_in"
        | "checked_out"
        | "cancelled"
      room_status: "available" | "booked" | "occupied" | "maintenance"
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
      app_role: ["admin", "guest", "superadmin", "owner"],
      booking_source: ["manual", "web", "booking", "telegram", "whatsapp"],
      booking_status: [
        "pending",
        "approved",
        "checked_in",
        "checked_out",
        "cancelled",
      ],
      room_status: ["available", "booked", "occupied", "maintenance"],
    },
  },
} as const
