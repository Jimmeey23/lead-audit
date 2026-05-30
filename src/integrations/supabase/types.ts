export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string;
          email: string;
          role: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_response_files: {
        Row: {
          id: string;
          response_id: string;
          touchpoint_id: string;
          uploaded_by: string;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_bucket: string;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          response_id: string;
          touchpoint_id: string;
          uploaded_by: string;
          file_name: string;
          file_type: string;
          file_size: number;
          storage_bucket?: string;
          storage_path: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          response_id?: string;
          touchpoint_id?: string;
          uploaded_by?: string;
          file_name?: string;
          file_type?: string;
          file_size?: number;
          storage_bucket?: string;
          storage_path?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      lead_response_touchpoints: {
        Row: {
          id: string;
          response_id: string;
          touchpoint_key: string;
          touchpoint_order: number;
          label: string;
          occurred_at: string | null;
          medium: string | null;
          comment: string | null;
          evidence_unavailable: boolean;
          evidence_unavailable_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          response_id: string;
          touchpoint_key: string;
          touchpoint_order: number;
          label: string;
          occurred_at?: string | null;
          medium?: string | null;
          comment?: string | null;
          evidence_unavailable?: boolean;
          evidence_unavailable_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          response_id?: string;
          touchpoint_key?: string;
          touchpoint_order?: number;
          label?: string;
          occurred_at?: string | null;
          medium?: string | null;
          comment?: string | null;
          evidence_unavailable?: boolean;
          evidence_unavailable_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_responses: {
        Row: {
          id: string;
          lead_id: string;
          lead_name: string;
          lead_email: string | null;
          lead_phone: string | null;
          center: string;
          associate: string | null;
          stage_name: string | null;
          class_type: string | null;
          source_name: string | null;
          response_notes: string | null;
          submitted_by: string;
          submitted_by_email: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          lead_name: string;
          lead_email?: string | null;
          lead_phone?: string | null;
          center: string;
          associate?: string | null;
          stage_name?: string | null;
          class_type?: string | null;
          source_name?: string | null;
          response_notes?: string | null;
          submitted_by: string;
          submitted_by_email: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          lead_name?: string;
          lead_email?: string | null;
          lead_phone?: string | null;
          center?: string;
          associate?: string | null;
          stage_name?: string | null;
          class_type?: string | null;
          source_name?: string | null;
          response_notes?: string | null;
          submitted_by?: string;
          submitted_by_email?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
