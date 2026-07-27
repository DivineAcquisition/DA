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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_invite: {
        Row: {
          accepted_at: string | null
          accepted_profile_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          email: string
          expires_at: string
          expires_on: string | null
          full_name: string | null
          id: string
          invited_by: string | null
          last_sent_at: string
          resent_count: number
          role: Database["public"]["Enums"]["user_role"]
          scope_case_file_ids: string[]
          scope_kind: Database["public"]["Enums"]["scope_kind"]
          time_zone: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          expires_on?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          resent_count?: number
          role: Database["public"]["Enums"]["user_role"]
          scope_case_file_ids?: string[]
          scope_kind?: Database["public"]["Enums"]["scope_kind"]
          time_zone?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          expires_on?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          last_sent_at?: string
          resent_count?: number
          role?: Database["public"]["Enums"]["user_role"]
          scope_case_file_ids?: string[]
          scope_kind?: Database["public"]["Enums"]["scope_kind"]
          time_zone?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invite_accepted_profile_id_fkey"
            columns: ["accepted_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invite_accepted_profile_id_fkey"
            columns: ["accepted_profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "account_invite_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invite_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "account_invite_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invite_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      account_notice: {
        Row: {
          acknowledged_at: string | null
          blocking: boolean
          body: string
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          created_by: string | null
          id: string
          profile_id: string
          severity: Database["public"]["Enums"]["notification_severity"]
        }
        Insert: {
          acknowledged_at?: string | null
          blocking?: boolean
          body: string
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          profile_id: string
          severity?: Database["public"]["Enums"]["notification_severity"]
        }
        Update: {
          acknowledged_at?: string | null
          blocking?: boolean
          body?: string
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          profile_id?: string
          severity?: Database["public"]["Enums"]["notification_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "account_notice_cleared_by_fkey"
            columns: ["cleared_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_notice_cleared_by_fkey"
            columns: ["cleared_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "account_notice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_notice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "account_notice_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_notice_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      account_permission: {
        Row: {
          created_at: string
          created_by: string | null
          effect: Database["public"]["Enums"]["permission_effect"]
          expires_at: string | null
          permission_key: string
          profile_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effect: Database["public"]["Enums"]["permission_effect"]
          expires_at?: string | null
          permission_key: string
          profile_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effect?: Database["public"]["Enums"]["permission_effect"]
          expires_at?: string | null
          permission_key?: string
          profile_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_permission_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_permission_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "account_permission_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "account_permission_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_permission_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      account_scope: {
        Row: {
          kind: Database["public"]["Enums"]["scope_kind"]
          profile_id: string
          set_by: string | null
          updated_at: string
        }
        Insert: {
          kind?: Database["public"]["Enums"]["scope_kind"]
          profile_id: string
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          kind?: Database["public"]["Enums"]["scope_kind"]
          profile_id?: string
          set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_scope_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_scope_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "account_scope_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_scope_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      account_scope_client: {
        Row: {
          added_at: string
          added_by: string | null
          case_file_id: string
          profile_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          case_file_id: string
          profile_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          case_file_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_scope_client_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_scope_client_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "account_scope_client_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_scope_client_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_scope_client_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "account_scope_client_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "account_scope_client_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "account_scope_client_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_scope_client_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      account_scope_placement: {
        Row: {
          added_at: string
          added_by: string | null
          placement_id: string
          profile_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          placement_id: string
          profile_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          placement_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_scope_placement_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_scope_placement_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "account_scope_placement_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_scope_placement_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_scope_placement_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      anonymisation_flag: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          document_id: string
          id: string
          kind: Database["public"]["Enums"]["anonymisation_kind"]
          section_key: string
          snippet: string
          suggestion: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          document_id: string
          id?: string
          kind: Database["public"]["Enums"]["anonymisation_kind"]
          section_key: string
          snippet: string
          suggestion?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          document_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["anonymisation_kind"]
          section_key?: string
          snippet?: string
          suggestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anonymisation_flag_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anonymisation_flag_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "anonymisation_flag_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anonymisation_flag_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_document_index"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_event: {
        Row: {
          acting_as_profile_id: string | null
          action: string
          actor_email: string | null
          actor_profile_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          after_value: Json | null
          at: string
          before_value: Json | null
          case_file_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: number
          impersonation_id: string | null
          ip: unknown
          summary: string | null
          surface: string | null
          user_agent: string | null
        }
        Insert: {
          acting_as_profile_id?: string | null
          action: string
          actor_email?: string | null
          actor_profile_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after_value?: Json | null
          at?: string
          before_value?: Json | null
          case_file_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          impersonation_id?: string | null
          ip?: unknown
          summary?: string | null
          surface?: string | null
          user_agent?: string | null
        }
        Update: {
          acting_as_profile_id?: string | null
          action?: string
          actor_email?: string | null
          actor_profile_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after_value?: Json | null
          at?: string
          before_value?: Json | null
          case_file_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          impersonation_id?: string | null
          ip?: unknown
          summary?: string | null
          surface?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_event_acting_as_profile_id_fkey"
            columns: ["acting_as_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_event_acting_as_profile_id_fkey"
            columns: ["acting_as_profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "audit_event_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_event_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "audit_event_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_event_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_event_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "audit_event_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "audit_event_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
        ]
      }
      booking: {
        Row: {
          case_file_id: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          id: string
          matched_booking_id: string | null
          operator_id: string
          operator_note: string | null
          placement_id: string
          recorded_at: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_for: string
          source: Database["public"]["Enums"]["booking_source"]
          state: Database["public"]["Enums"]["booking_state"]
        }
        Insert: {
          case_file_id: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          matched_booking_id?: string | null
          operator_id: string
          operator_note?: string | null
          placement_id: string
          recorded_at?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for: string
          source: Database["public"]["Enums"]["booking_source"]
          state: Database["public"]["Enums"]["booking_state"]
        }
        Update: {
          case_file_id?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          matched_booking_id?: string | null
          operator_id?: string
          operator_note?: string | null
          placement_id?: string
          recorded_at?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string
          source?: Database["public"]["Enums"]["booking_source"]
          state?: Database["public"]["Enums"]["booking_state"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "booking_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "booking_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "booking_matched_booking_id_fkey"
            columns: ["matched_booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_operator"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "booking_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      case_file_drive_folder: {
        Row: {
          case_file_id: string
          category: Database["public"]["Enums"]["evidence_category"]
          created_at: string
          folder_id: string
          folder_url: string | null
          id: string
        }
        Insert: {
          case_file_id: string
          category: Database["public"]["Enums"]["evidence_category"]
          created_at?: string
          folder_id: string
          folder_url?: string | null
          id?: string
        }
        Update: {
          case_file_id?: string
          category?: Database["public"]["Enums"]["evidence_category"]
          created_at?: string
          folder_id?: string
          folder_url?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_file_drive_folder_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_file_drive_folder_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_file_drive_folder_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "case_file_drive_folder_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "case_file_drive_folder_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
        ]
      }
      client_account: {
        Row: {
          accepted_at: string | null
          access_until: string | null
          case_file_id: string
          created_at: string
          full_name: string | null
          invited_by: string | null
          is_primary: boolean
          job_title: string | null
          profile_id: string
          state: Database["public"]["Enums"]["client_account_state"]
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          access_until?: string | null
          case_file_id: string
          created_at?: string
          full_name?: string | null
          invited_by?: string | null
          is_primary?: boolean
          job_title?: string | null
          profile_id: string
          state?: Database["public"]["Enums"]["client_account_state"]
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          access_until?: string | null
          case_file_id?: string
          created_at?: string
          full_name?: string | null
          invited_by?: string | null
          is_primary?: boolean
          job_title?: string | null
          profile_id?: string
          state?: Database["public"]["Enums"]["client_account_state"]
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_account_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_account_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_account_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_account_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_account_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_account_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_account_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "client_account_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_account_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_case_file: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          engagement_end: string | null
          engagement_start: string | null
          id: string
          install_started_at: string | null
          logo_url: string | null
          name: string
          notes: string | null
          retainer_amount: number | null
          revenue_goal_monthly: number | null
          slug: string
          status: Database["public"]["Enums"]["engagement_status"]
          updated_at: string
          vertical: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          engagement_end?: string | null
          engagement_start?: string | null
          id?: string
          install_started_at?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          retainer_amount?: number | null
          revenue_goal_monthly?: number | null
          slug: string
          status?: Database["public"]["Enums"]["engagement_status"]
          updated_at?: string
          vertical?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          drive_folder_id?: string | null
          drive_folder_url?: string | null
          engagement_end?: string | null
          engagement_start?: string | null
          id?: string
          install_started_at?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          retainer_amount?: number | null
          revenue_goal_monthly?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["engagement_status"]
          updated_at?: string
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_case_file_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_case_file_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_credential: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          case_file_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string
          last_rotated_at: string
          notes: string | null
          rotation_interval_days: number
          secret_id: string
          updated_at: string
          url: string | null
          username: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          case_file_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          label: string
          last_rotated_at?: string
          notes?: string | null
          rotation_interval_days?: number
          secret_id: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          case_file_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          label?: string
          last_rotated_at?: string
          notes?: string | null
          rotation_interval_days?: number
          secret_id?: string
          updated_at?: string
          url?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_credential_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credential_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_credential_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credential_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_dashboard_link: {
        Row: {
          case_file_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          label: string | null
          last_viewed_at: string | null
          password_hash: string | null
          revoked_at: string | null
          token: string
          view_count: number
        }
        Insert: {
          case_file_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          password_hash?: string | null
          revoked_at?: string | null
          token: string
          view_count?: number
        }
        Update: {
          case_file_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          password_hash?: string | null
          revoked_at?: string | null
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_dashboard_link_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_dashboard_link_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_dashboard_link_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_dashboard_link_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_dashboard_link_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_dashboard_link_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_dashboard_link_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_dashboard_link_view: {
        Row: {
          id: string
          ip_address: unknown
          link_id: string
          user_agent: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          ip_address?: unknown
          link_id: string
          user_agent?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          ip_address?: unknown
          link_id?: string
          user_agent?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_dashboard_link_view_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_link"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invite: {
        Row: {
          case_file_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          job_title: string | null
          revoked_at: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          case_file_id: string
          created_at?: string
          email: string
          expires_at: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          job_title?: string | null
          revoked_at?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          case_file_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          job_title?: string | null
          revoked_at?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invite_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invite_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invite_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_invite_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_invite_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_invite_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invite_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_message: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          author_name: string
          author_profile_id: string | null
          body: string
          case_file_id: string
          closed_at: string | null
          created_at: string
          id: string
          response_due_at: string
          status: Database["public"]["Enums"]["client_message_status"]
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          author_name: string
          author_profile_id?: string | null
          body: string
          case_file_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          response_due_at: string
          status?: Database["public"]["Enums"]["client_message_status"]
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          author_name?: string
          author_profile_id?: string | null
          body?: string
          case_file_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          response_due_at?: string
          status?: Database["public"]["Enums"]["client_message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "client_message_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_message_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "client_message_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_message_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "client_message_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_message_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_message_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_message_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_message_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
        ]
      }
      client_notification_pref: {
        Row: {
          milestone_alerts: boolean
          profile_id: string
          report_published: boolean
          updated_at: string
          weekly_digest: boolean
        }
        Insert: {
          milestone_alerts?: boolean
          profile_id: string
          report_published?: boolean
          updated_at?: string
          weekly_digest?: boolean
        }
        Update: {
          milestone_alerts?: boolean
          profile_id?: string
          report_published?: boolean
          updated_at?: string
          weekly_digest?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_notification_pref_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notification_pref_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      contractor_task: {
        Row: {
          case_file_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_on: string | null
          id: string
          profile_id: string
          spec: string | null
          title: string
        }
        Insert: {
          case_file_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          profile_id: string
          spec?: string | null
          title: string
        }
        Update: {
          case_file_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_on?: string | null
          id?: string
          profile_id?: string
          spec?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_task_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_task_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_task_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "contractor_task_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "contractor_task_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "contractor_task_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_task_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "contractor_task_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_task_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      credential_grant: {
        Row: {
          credential_id: string
          expires_at: string
          granted_at: string
          granted_by: string | null
          id: string
          profile_id: string
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          credential_id: string
          expires_at: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          credential_id?: string
          expires_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id?: string
          reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_grant_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "client_credential"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_grant_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "v_credential"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_grant_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_grant_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "credential_grant_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_grant_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "credential_grant_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_grant_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      credential_view: {
        Row: {
          audit_event_id: number | null
          credential_id: string
          id: number
          impersonation_id: string | null
          via_grant_id: string | null
          viewed_at: string
          viewed_by: string | null
          viewed_by_email: string | null
        }
        Insert: {
          audit_event_id?: number | null
          credential_id: string
          id?: never
          impersonation_id?: string | null
          via_grant_id?: string | null
          viewed_at?: string
          viewed_by?: string | null
          viewed_by_email?: string | null
        }
        Update: {
          audit_event_id?: number | null
          credential_id?: string
          id?: never
          impersonation_id?: string | null
          via_grant_id?: string | null
          viewed_at?: string
          viewed_by?: string | null
          viewed_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_view_audit_event_id_fkey"
            columns: ["audit_event_id"]
            isOneToOne: false
            referencedRelation: "audit_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_view_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "client_credential"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_view_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "v_credential"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_view_via_grant_id_fkey"
            columns: ["via_grant_id"]
            isOneToOne: false
            referencedRelation: "credential_grant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_view_viewed_by_fkey"
            columns: ["viewed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_view_viewed_by_fkey"
            columns: ["viewed_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      credit_note: {
        Row: {
          amount: number
          created_by: string | null
          id: string
          invoice_id: string
          issued_at: string
          number: string | null
          reason: string
        }
        Insert: {
          amount: number
          created_by?: string | null
          id?: string
          invoice_id: string
          issued_at?: string
          number?: string | null
          reason: string
        }
        Update: {
          amount?: number
          created_by?: string | null
          id?: string
          invoice_id?: string
          issued_at?: string
          number?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "credit_note_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      decision: {
        Row: {
          against_recommendation: boolean
          case_file_id: string
          correction_reason: string | null
          created_at: string
          created_by: string | null
          decided_by: string
          decided_on: string
          id: string
          reasoning: string
          superseded_by_id: string | null
          supersedes_id: string | null
          version: number
          what_was_decided: string
        }
        Insert: {
          against_recommendation?: boolean
          case_file_id: string
          correction_reason?: string | null
          created_at?: string
          created_by?: string | null
          decided_by: string
          decided_on: string
          id?: string
          reasoning: string
          superseded_by_id?: string | null
          supersedes_id?: string | null
          version?: number
          what_was_decided: string
        }
        Update: {
          against_recommendation?: boolean
          case_file_id?: string
          correction_reason?: string | null
          created_at?: string
          created_by?: string | null
          decided_by?: string
          decided_on?: string
          id?: string
          reasoning?: string
          superseded_by_id?: string | null
          supersedes_id?: string | null
          version?: number
          what_was_decided?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "decision_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "decision_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "decision_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "decision_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "decision"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "decision"
            referencedColumns: ["id"]
          },
        ]
      }
      document: {
        Row: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        Insert: {
          anonymisation_confirmed_at?: string | null
          anonymisation_confirmed_by?: string | null
          anonymised_descriptor?: string | null
          archived_at?: string | null
          case_file_id: string
          correction_note?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          frozen_payload?: Json | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          include_effort?: boolean
          is_case_study?: boolean
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          published_by?: string | null
          share_link_id?: string | null
          state?: Database["public"]["Enums"]["document_state"]
          superseded_by_id?: string | null
          supersedes_id?: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          anonymisation_confirmed_at?: string | null
          anonymisation_confirmed_by?: string | null
          anonymised_descriptor?: string | null
          archived_at?: string | null
          case_file_id?: string
          correction_note?: string | null
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          frozen_payload?: Json | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          include_effort?: boolean
          is_case_study?: boolean
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          published_by?: string | null
          share_link_id?: string | null
          state?: Database["public"]["Enums"]["document_state"]
          superseded_by_id?: string | null
          supersedes_id?: string | null
          template_id?: string
          template_version?: number
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_anonymisation_confirmed_by_fkey"
            columns: ["anonymisation_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_anonymisation_confirmed_by_fkey"
            columns: ["anonymisation_confirmed_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "document_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "document_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "document_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "v_document_index"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "v_document_index"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_template"
            referencedColumns: ["id"]
          },
        ]
      }
      document_delivery: {
        Row: {
          channel: string
          delivered_at: string
          detail: string | null
          document_id: string
          id: string
          status: string
        }
        Insert: {
          channel: string
          delivered_at?: string
          detail?: string | null
          document_id: string
          id?: string
          status: string
        }
        Update: {
          channel?: string
          delivered_at?: string
          detail?: string | null
          document_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_delivery_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_delivery_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_document_index"
            referencedColumns: ["id"]
          },
        ]
      }
      document_open: {
        Row: {
          document_id: string
          id: string
          opened_at: string
          opened_by: string | null
          user_agent: string | null
          via: string
        }
        Insert: {
          document_id: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          user_agent?: string | null
          via?: string
        }
        Update: {
          document_id?: string
          id?: string
          opened_at?: string
          opened_by?: string | null
          user_agent?: string | null
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_open_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_open_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_document_index"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_open_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_open_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      document_section: {
        Row: {
          body: string | null
          bound_data: Json | null
          created_at: string
          document_id: string
          has_gap: boolean
          id: string
          key: string
          kind: Database["public"]["Enums"]["section_kind"]
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          bound_data?: Json | null
          created_at?: string
          document_id: string
          has_gap?: boolean
          id?: string
          key: string
          kind: Database["public"]["Enums"]["section_kind"]
          sort_order: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          bound_data?: Json | null
          created_at?: string
          document_id?: string
          has_gap?: boolean
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["section_kind"]
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_section_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_section_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "v_document_index"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          name: string
          producer_line: string
          type: Database["public"]["Enums"]["document_type"]
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          name: string
          producer_line?: string
          type: Database["public"]["Enums"]["document_type"]
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          name?: string
          producer_line?: string
          type?: Database["public"]["Enums"]["document_type"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_template_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_template_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      document_template_section: {
        Row: {
          body: string | null
          bound_source: string | null
          created_at: string
          id: string
          key: string
          kind: Database["public"]["Enums"]["section_kind"]
          required: boolean
          sort_order: number
          template_id: string
          title: string
          vertical: string | null
        }
        Insert: {
          body?: string | null
          bound_source?: string | null
          created_at?: string
          id?: string
          key: string
          kind: Database["public"]["Enums"]["section_kind"]
          required?: boolean
          sort_order: number
          template_id: string
          title: string
          vertical?: string | null
        }
        Update: {
          body?: string | null
          bound_source?: string | null
          created_at?: string
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["section_kind"]
          required?: boolean
          sort_order?: number
          template_id?: string
          title?: string
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_template_section_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_template"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_sync_run: {
        Row: {
          case_file_id: string | null
          detail: string | null
          discovered_count: number
          id: string
          ran_at: string
          status: string
        }
        Insert: {
          case_file_id?: string | null
          detail?: string | null
          discovered_count?: number
          id?: string
          ran_at?: string
          status?: string
        }
        Update: {
          case_file_id?: string | null
          detail?: string | null
          discovered_count?: number
          id?: string
          ran_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_sync_run_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_sync_run_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_sync_run_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "drive_sync_run_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "drive_sync_run_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
        ]
      }
      dunning_event: {
        Row: {
          action: string
          detail: string | null
          id: string
          invoice_id: string
          next_attempt_at: string | null
          occurred_at: string
          step: number
        }
        Insert: {
          action: string
          detail?: string | null
          id?: string
          invoice_id: string
          next_attempt_at?: string | null
          occurred_at?: string
          step: number
        }
        Update: {
          action?: string
          detail?: string | null
          id?: string
          invoice_id?: string
          next_attempt_at?: string | null
          occurred_at?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "dunning_event_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      effort_entry: {
        Row: {
          case_file_id: string
          correction_reason: string | null
          created_at: string
          created_by: string | null
          description: string
          hours: number | null
          id: string
          performed_on: string
          phase: string
          superseded_by_id: string | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          case_file_id: string
          correction_reason?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          hours?: number | null
          id?: string
          performed_on: string
          phase: string
          superseded_by_id?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Update: {
          case_file_id?: string
          correction_reason?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          hours?: number | null
          id?: string
          performed_on?: string
          phase?: string
          superseded_by_id?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "effort_entry_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effort_entry_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effort_entry_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "effort_entry_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "effort_entry_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "effort_entry_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effort_entry_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "effort_entry_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "effort_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effort_entry_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "effort_entry"
            referencedColumns: ["id"]
          },
        ]
      }
      eod_comment: {
        Row: {
          author_name: string
          author_profile_id: string | null
          body: string
          created_at: string
          eod_report_id: string
          id: string
        }
        Insert: {
          author_name: string
          author_profile_id?: string | null
          body: string
          created_at?: string
          eod_report_id: string
          id?: string
        }
        Update: {
          author_name?: string
          author_profile_id?: string | null
          body?: string
          created_at?: string
          eod_report_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eod_comment_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eod_comment_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "eod_comment_eod_report_id_fkey"
            columns: ["eod_report_id"]
            isOneToOne: false
            referencedRelation: "eod_report"
            referencedColumns: ["id"]
          },
        ]
      }
      eod_report: {
        Row: {
          appointments_booked: number
          blockers: string
          configured: Json
          conversations_handled: number
          correction_reason: string | null
          created_at: string
          escalations_raised: number
          follow_ups_completed: number
          id: string
          notes: string
          operator_id: string
          placement_id: string
          shift_date: string
          shift_end_actual: string
          shift_start_actual: string
          submitted_at: string
          superseded_by_id: string | null
          supersedes_id: string | null
          version: number
        }
        Insert: {
          appointments_booked?: number
          blockers?: string
          configured?: Json
          conversations_handled?: number
          correction_reason?: string | null
          created_at?: string
          escalations_raised?: number
          follow_ups_completed?: number
          id?: string
          notes?: string
          operator_id: string
          placement_id: string
          shift_date: string
          shift_end_actual: string
          shift_start_actual: string
          submitted_at?: string
          superseded_by_id?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Update: {
          appointments_booked?: number
          blockers?: string
          configured?: Json
          conversations_handled?: number
          correction_reason?: string | null
          created_at?: string
          escalations_raised?: number
          follow_ups_completed?: number
          id?: string
          notes?: string
          operator_id?: string
          placement_id?: string
          shift_date?: string
          shift_end_actual?: string
          shift_start_actual?: string
          submitted_at?: string
          superseded_by_id?: string | null
          supersedes_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "eod_report_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eod_report_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_operator"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "eod_report_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eod_report_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "eod_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eod_report_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "eod_report"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          case_file_id: string
          category: Database["public"]["Enums"]["escalation_category"]
          closed_at: string | null
          customer_context: string
          id: string
          needed: string
          operator_id: string
          placement_id: string
          raised_at: string
          response_due_at: string
          routed_to: string[]
          status: Database["public"]["Enums"]["escalation_status"]
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          case_file_id: string
          category: Database["public"]["Enums"]["escalation_category"]
          closed_at?: string | null
          customer_context: string
          id?: string
          needed: string
          operator_id: string
          placement_id: string
          raised_at?: string
          response_due_at: string
          routed_to?: string[]
          status?: Database["public"]["Enums"]["escalation_status"]
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          case_file_id?: string
          category?: Database["public"]["Enums"]["escalation_category"]
          closed_at?: string | null
          customer_context?: string
          id?: string
          needed?: string
          operator_id?: string
          placement_id?: string
          raised_at?: string
          response_due_at?: string
          routed_to?: string[]
          status?: Database["public"]["Enums"]["escalation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "escalation_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "escalation_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "escalation_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "escalation_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "escalation_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_operator"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "escalation_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_item: {
        Row: {
          byte_size: number | null
          case_file_id: string
          category: Database["public"]["Enums"]["evidence_category"]
          created_at: string
          created_by: string | null
          discovered_by_sync: boolean
          drive_file_id: string
          drive_url: string | null
          filename: string
          happened_on: string | null
          id: string
          mime_type: string | null
          needs_metadata: boolean
          reviewed_by_admin_at: string | null
          thumbnail_url: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by_client: boolean
          what_it_proves: string | null
        }
        Insert: {
          byte_size?: number | null
          case_file_id: string
          category?: Database["public"]["Enums"]["evidence_category"]
          created_at?: string
          created_by?: string | null
          discovered_by_sync?: boolean
          drive_file_id: string
          drive_url?: string | null
          filename: string
          happened_on?: string | null
          id?: string
          mime_type?: string | null
          needs_metadata?: boolean
          reviewed_by_admin_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_client?: boolean
          what_it_proves?: string | null
        }
        Update: {
          byte_size?: number | null
          case_file_id?: string
          category?: Database["public"]["Enums"]["evidence_category"]
          created_at?: string
          created_by?: string | null
          discovered_by_sync?: boolean
          drive_file_id?: string
          drive_url?: string | null
          filename?: string
          happened_on?: string | null
          id?: string
          mime_type?: string | null
          needs_metadata?: boolean
          reviewed_by_admin_at?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by_client?: boolean
          what_it_proves?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_item_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_item_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_item_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "evidence_item_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "evidence_item_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "evidence_item_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_item_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      evidence_link: {
        Row: {
          created_at: string
          effort_entry_id: string | null
          evidence_id: string
          id: string
          milestone_id: string | null
          snapshot_id: string | null
        }
        Insert: {
          created_at?: string
          effort_entry_id?: string | null
          evidence_id: string
          id?: string
          milestone_id?: string | null
          snapshot_id?: string | null
        }
        Update: {
          created_at?: string
          effort_entry_id?: string | null
          evidence_id?: string
          id?: string
          milestone_id?: string | null
          snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_link_effort_entry_id_fkey"
            columns: ["effort_entry_id"]
            isOneToOne: false
            referencedRelation: "effort_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_link_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_link_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_link_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshot"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_share_link: {
        Row: {
          access_count: number
          created_at: string
          created_by: string | null
          evidence_id: string
          expires_at: string
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          shared_with: string | null
          token: string
        }
        Insert: {
          access_count?: number
          created_at?: string
          created_by?: string | null
          evidence_id: string
          expires_at: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          shared_with?: string | null
          token: string
        }
        Update: {
          access_count?: number
          created_at?: string
          created_by?: string | null
          evidence_id?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          shared_with?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_share_link_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_share_link_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "evidence_share_link_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_item"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_report: {
        Row: {
          case_file_id: string
          drive_file_id: string | null
          drive_url: string | null
          generated_at: string
          generated_by: string | null
          id: string
          included_evidence_ids: string[]
          mode: Database["public"]["Enums"]["report_mode"]
          payload: Json
          period_end: string
          period_start: string
          published_by: string | null
          published_to_client_at: string | null
        }
        Insert: {
          case_file_id: string
          drive_file_id?: string | null
          drive_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          included_evidence_ids?: string[]
          mode: Database["public"]["Enums"]["report_mode"]
          payload: Json
          period_end: string
          period_start: string
          published_by?: string | null
          published_to_client_at?: string | null
        }
        Update: {
          case_file_id?: string
          drive_file_id?: string | null
          drive_url?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          included_evidence_ids?: string[]
          mode?: Database["public"]["Enums"]["report_mode"]
          payload?: Json
          period_end?: string
          period_start?: string
          published_by?: string | null
          published_to_client_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_report_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_report_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_report_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "growth_report_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "growth_report_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "growth_report_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_report_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "growth_report_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "growth_report_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      impersonation: {
        Row: {
          actor_profile_id: string
          ended_at: string | null
          ended_reason: string | null
          expires_at: string
          id: string
          notified_target_at: string | null
          reason: string | null
          started_at: string
          step_up_id: string | null
          target_profile_id: string
        }
        Insert: {
          actor_profile_id: string
          ended_at?: string | null
          ended_reason?: string | null
          expires_at: string
          id?: string
          notified_target_at?: string | null
          reason?: string | null
          started_at?: string
          step_up_id?: string | null
          target_profile_id: string
        }
        Update: {
          actor_profile_id?: string
          ended_at?: string | null
          ended_reason?: string | null
          expires_at?: string
          id?: string
          notified_target_at?: string | null
          reason?: string | null
          started_at?: string
          step_up_id?: string | null
          target_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "impersonation_step_up_id_fkey"
            columns: ["step_up_id"]
            isOneToOne: false
            referencedRelation: "step_up_verification"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      invoice: {
        Row: {
          case_file_id: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string
          created_by: string | null
          credited_total: number
          currency: string
          due_at: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          processor: string | null
          processor_invoice_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          case_file_id: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          created_by?: string | null
          credited_total?: number
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          processor?: string | null
          processor_invoice_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          case_file_id?: string
          charge_type?: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          created_by?: string | null
          credited_total?: number
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          processor?: string | null
          processor_invoice_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "invoice_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "invoice_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "invoice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      invoice_line: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          unit_amount: number
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          unit_amount: number
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      known_device: {
        Row: {
          fingerprint: string
          first_seen_at: string
          label: string | null
          last_seen_at: string
          profile_id: string
        }
        Insert: {
          fingerprint: string
          first_seen_at?: string
          label?: string | null
          last_seen_at?: string
          profile_id: string
        }
        Update: {
          fingerprint?: string
          first_seen_at?: string
          label?: string | null
          last_seen_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "known_device_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "known_device_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      lockdown: {
        Row: {
          engaged_at: string
          engaged_by: string
          id: string
          reason: string
          released_at: string | null
          released_by: string | null
        }
        Insert: {
          engaged_at?: string
          engaged_by: string
          id?: string
          reason: string
          released_at?: string | null
          released_by?: string | null
        }
        Update: {
          engaged_at?: string
          engaged_by?: string
          id?: string
          reason?: string
          released_at?: string | null
          released_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lockdown_engaged_by_fkey"
            columns: ["engaged_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockdown_engaged_by_fkey"
            columns: ["engaged_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "lockdown_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockdown_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      login_event: {
        Row: {
          at: string
          city: string | null
          country: string | null
          detail: string | null
          email: string
          id: number
          ip: unknown
          outcome: string
          profile_id: string | null
          session_id: string | null
          surface: string | null
          user_agent: string | null
        }
        Insert: {
          at?: string
          city?: string | null
          country?: string | null
          detail?: string | null
          email: string
          id?: never
          ip?: unknown
          outcome: string
          profile_id?: string | null
          session_id?: string | null
          surface?: string | null
          user_agent?: string | null
        }
        Update: {
          at?: string
          city?: string | null
          country?: string | null
          detail?: string | null
          email?: string
          id?: never
          ip?: unknown
          outcome?: string
          profile_id?: string | null
          session_id?: string | null
          surface?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_event_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_event_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      metric_definition: {
        Row: {
          aggregation: Database["public"]["Enums"]["metric_aggregation"]
          category: string
          direction: Database["public"]["Enums"]["metric_direction"]
          help: string | null
          key: string
          label: string
          sort_order: number
          unit: string
        }
        Insert: {
          aggregation?: Database["public"]["Enums"]["metric_aggregation"]
          category: string
          direction: Database["public"]["Enums"]["metric_direction"]
          help?: string | null
          key: string
          label: string
          sort_order: number
          unit: string
        }
        Update: {
          aggregation?: Database["public"]["Enums"]["metric_aggregation"]
          category?: string
          direction?: Database["public"]["Enums"]["metric_direction"]
          help?: string | null
          key?: string
          label?: string
          sort_order?: number
          unit?: string
        }
        Relationships: []
      }
      milestone: {
        Row: {
          auto_generated: boolean
          case_file_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          occurred_on: string
          title: string
          type: Database["public"]["Enums"]["milestone_type"]
        }
        Insert: {
          auto_generated?: boolean
          case_file_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_on: string
          title: string
          type: Database["public"]["Enums"]["milestone_type"]
        }
        Update: {
          auto_generated?: boolean
          case_file_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_on?: string
          title?: string
          type?: Database["public"]["Enums"]["milestone_type"]
        }
        Relationships: [
          {
            foreignKeyName: "milestone_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "milestone_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "milestone_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "milestone_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      notification_attempt: {
        Row: {
          attempted_at: string
          channel: Database["public"]["Enums"]["notification_channel"]
          detail: string | null
          id: string
          notification_id: string
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          attempted_at?: string
          channel: Database["public"]["Enums"]["notification_channel"]
          detail?: string | null
          id?: string
          notification_id: string
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          attempted_at?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          detail?: string | null
          id?: string
          notification_id?: string
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_attempt_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "operator_notification"
            referencedColumns: ["id"]
          },
        ]
      }
      offboarding: {
        Row: {
          archived_at: string | null
          completed_at: string | null
          credentials_listed_at: string | null
          credentials_to_rotate: number | null
          notes: string | null
          pay_period_closed_at: string | null
          profile_id: string
          sessions_revoked_at: string | null
          started_at: string
          started_by: string | null
          suspended_at: string | null
          work_reassigned_at: string | null
        }
        Insert: {
          archived_at?: string | null
          completed_at?: string | null
          credentials_listed_at?: string | null
          credentials_to_rotate?: number | null
          notes?: string | null
          pay_period_closed_at?: string | null
          profile_id: string
          sessions_revoked_at?: string | null
          started_at?: string
          started_by?: string | null
          suspended_at?: string | null
          work_reassigned_at?: string | null
        }
        Update: {
          archived_at?: string | null
          completed_at?: string | null
          credentials_listed_at?: string | null
          credentials_to_rotate?: number | null
          notes?: string | null
          pay_period_closed_at?: string | null
          profile_id?: string
          sessions_revoked_at?: string | null
          started_at?: string
          started_by?: string | null
          suspended_at?: string | null
          work_reassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offboarding_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "offboarding_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      operator: {
        Row: {
          base_monthly: number
          certified_on: string | null
          country: string | null
          created_at: string
          email: string
          handle: string | null
          id: string
          joined_on: string | null
          name: string
          payout_method: Database["public"]["Enums"]["payout_method"] | null
          payout_reference: string | null
          phone: string | null
          preferred_channel: Database["public"]["Enums"]["notification_channel"]
          profile_id: string | null
          status: Database["public"]["Enums"]["operator_status"]
          tax_doc_reference: string | null
          tax_doc_reviewed_on: string | null
          tax_doc_status: Database["public"]["Enums"]["tax_doc_status"]
          tier: number
          time_zone: string
          updated_at: string
        }
        Insert: {
          base_monthly?: number
          certified_on?: string | null
          country?: string | null
          created_at?: string
          email: string
          handle?: string | null
          id?: string
          joined_on?: string | null
          name: string
          payout_method?: Database["public"]["Enums"]["payout_method"] | null
          payout_reference?: string | null
          phone?: string | null
          preferred_channel?: Database["public"]["Enums"]["notification_channel"]
          profile_id?: string | null
          status?: Database["public"]["Enums"]["operator_status"]
          tax_doc_reference?: string | null
          tax_doc_reviewed_on?: string | null
          tax_doc_status?: Database["public"]["Enums"]["tax_doc_status"]
          tier?: number
          time_zone?: string
          updated_at?: string
        }
        Update: {
          base_monthly?: number
          certified_on?: string | null
          country?: string | null
          created_at?: string
          email?: string
          handle?: string | null
          id?: string
          joined_on?: string | null
          name?: string
          payout_method?: Database["public"]["Enums"]["payout_method"] | null
          payout_reference?: string | null
          phone?: string | null
          preferred_channel?: Database["public"]["Enums"]["notification_channel"]
          profile_id?: string | null
          status?: Database["public"]["Enums"]["operator_status"]
          tax_doc_reference?: string | null
          tax_doc_reviewed_on?: string | null
          tax_doc_status?: Database["public"]["Enums"]["tax_doc_status"]
          tier?: number
          time_zone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      operator_notification: {
        Row: {
          body: string
          created_at: string
          id: string
          operator_id: string
          placement_id: string | null
          read_at: string | null
          sent_by: string
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          operator_id: string
          placement_id?: string | null
          read_at?: string | null
          sent_by?: string
          severity: Database["public"]["Enums"]["notification_severity"]
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          operator_id?: string
          placement_id?: string | null
          read_at?: string | null
          sent_by?: string
          severity?: Database["public"]["Enums"]["notification_severity"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_notification_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_notification_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_operator"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_notification_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_task: {
        Row: {
          assigned_by: string | null
          completed_on: string | null
          created_at: string
          detail: string
          due_on: string | null
          id: string
          operator_id: string
          placement_id: string | null
          title: string
        }
        Insert: {
          assigned_by?: string | null
          completed_on?: string | null
          created_at?: string
          detail?: string
          due_on?: string | null
          id?: string
          operator_id: string
          placement_id?: string | null
          title: string
        }
        Update: {
          assigned_by?: string | null
          completed_on?: string | null
          created_at?: string
          detail?: string
          due_on?: string | null
          id?: string
          operator_id?: string
          placement_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_task_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_task_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "operator_task_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_task_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_operator"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "operator_task_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_training: {
        Row: {
          completed_on: string | null
          created_at: string
          detail: string
          id: string
          operator_id: string
          title: string
        }
        Insert: {
          completed_on?: string | null
          created_at?: string
          detail?: string
          id?: string
          operator_id: string
          title: string
        }
        Update: {
          completed_on?: string | null
          created_at?: string
          detail?: string
          id?: string
          operator_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_training_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_training_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_operator"
            referencedColumns: ["operator_id"]
          },
        ]
      }
      owner_alert: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          at: string
          audit_event_id: number | null
          id: number
          kind: string
          severity: Database["public"]["Enums"]["notification_severity"]
          subject_profile_id: string | null
          summary: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          at?: string
          audit_event_id?: number | null
          id?: never
          kind: string
          severity?: Database["public"]["Enums"]["notification_severity"]
          subject_profile_id?: string | null
          summary: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          at?: string
          audit_event_id?: number | null
          id?: never
          kind?: string
          severity?: Database["public"]["Enums"]["notification_severity"]
          subject_profile_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_alert_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_alert_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "owner_alert_audit_event_id_fkey"
            columns: ["audit_event_id"]
            isOneToOne: false
            referencedRelation: "audit_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_alert_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_alert_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      pass_through_cost: {
        Row: {
          amount: number
          case_file_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          occurred_on: string
        }
        Insert: {
          amount: number
          case_file_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          occurred_on: string
        }
        Update: {
          amount?: number
          case_file_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          occurred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "pass_through_cost_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pass_through_cost_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pass_through_cost_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "pass_through_cost_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "pass_through_cost_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "pass_through_cost_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pass_through_cost_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      pay_adjustment: {
        Row: {
          added_at: string
          added_by: string | null
          amount: number
          id: string
          label: string
          reason: string
          statement_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          amount: number
          id?: string
          label: string
          reason: string
          statement_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          amount?: number
          id?: string
          label?: string
          reason?: string
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_adjustment_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_adjustment_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "pay_adjustment_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "pay_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_period: {
        Row: {
          closed_at: string | null
          closes_month: boolean
          end_date: string
          id: string
          start_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closes_month?: boolean
          end_date: string
          id: string
          start_date: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closes_month?: boolean
          end_date?: string
          id?: string
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      pay_statement: {
        Row: {
          adjustment_total: number
          base_amount: number
          base_detail: string | null
          commission_amount: number
          commission_booking_ids: string[]
          commission_detail: string | null
          created_at: string
          id: string
          locked: boolean
          locked_at: string | null
          operator_id: string
          period_id: string
          placement_id: string
          speed_bonus_amount: number
          speed_bonus_detail: string | null
          total: number
        }
        Insert: {
          adjustment_total?: number
          base_amount?: number
          base_detail?: string | null
          commission_amount?: number
          commission_booking_ids?: string[]
          commission_detail?: string | null
          created_at?: string
          id?: string
          locked?: boolean
          locked_at?: string | null
          operator_id: string
          period_id: string
          placement_id: string
          speed_bonus_amount?: number
          speed_bonus_detail?: string | null
          total?: number
        }
        Update: {
          adjustment_total?: number
          base_amount?: number
          base_detail?: string | null
          commission_amount?: number
          commission_booking_ids?: string[]
          commission_detail?: string | null
          created_at?: string
          id?: string
          locked?: boolean
          locked_at?: string | null
          operator_id?: string
          period_id?: string
          placement_id?: string
          speed_bonus_amount?: number
          speed_bonus_detail?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pay_statement_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_statement_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_operator"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "pay_statement_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "pay_period"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_statement_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempt: {
        Row: {
          amount: number
          attempted_at: string
          failure_code: string | null
          failure_message: string | null
          id: string
          invoice_id: string
          processor: string
          processor_intent_id: string | null
          status: Database["public"]["Enums"]["payment_attempt_status"]
        }
        Insert: {
          amount: number
          attempted_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          invoice_id: string
          processor?: string
          processor_intent_id?: string | null
          status: Database["public"]["Enums"]["payment_attempt_status"]
        }
        Update: {
          amount?: number
          attempted_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          invoice_id?: string
          processor?: string
          processor_intent_id?: string | null
          status?: Database["public"]["Enums"]["payment_attempt_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempt_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      payout: {
        Row: {
          adjustment_total: number
          amount: number
          base_amount: number
          batch_id: string
          bonus_amount: number
          commission_amount: number
          confirmed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          locked: boolean
          method: Database["public"]["Enums"]["payout_method"] | null
          operator_id: string
          payout_reference: string | null
          period_id: string
          placement_id: string | null
          rolled_from_payout_id: string | null
          rolled_into_payout_id: string | null
          sent_at: string | null
          sent_reference: string | null
          statement_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          adjustment_total?: number
          amount: number
          base_amount?: number
          batch_id: string
          bonus_amount?: number
          commission_amount?: number
          confirmed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          locked?: boolean
          method?: Database["public"]["Enums"]["payout_method"] | null
          operator_id: string
          payout_reference?: string | null
          period_id: string
          placement_id?: string | null
          rolled_from_payout_id?: string | null
          rolled_into_payout_id?: string | null
          sent_at?: string | null
          sent_reference?: string | null
          statement_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          adjustment_total?: number
          amount?: number
          base_amount?: number
          batch_id?: string
          bonus_amount?: number
          commission_amount?: number
          confirmed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          locked?: boolean
          method?: Database["public"]["Enums"]["payout_method"] | null
          operator_id?: string
          payout_reference?: string | null
          period_id?: string
          placement_id?: string | null
          rolled_from_payout_id?: string | null
          rolled_into_payout_id?: string | null
          sent_at?: string | null
          sent_reference?: string | null
          statement_id?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payout_batch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_operator"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "payout_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "pay_period"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_rolled_from_payout_id_fkey"
            columns: ["rolled_from_payout_id"]
            isOneToOne: false
            referencedRelation: "payout"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_rolled_into_payout_id_fkey"
            columns: ["rolled_into_payout_id"]
            isOneToOne: false
            referencedRelation: "payout"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "pay_statement"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_adjustment: {
        Row: {
          added_at: string
          added_by: string | null
          amount: number
          id: string
          label: string
          payout_id: string
          reason: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          amount: number
          id?: string
          label: string
          payout_id: string
          reason: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          amount?: number
          id?: string
          label?: string
          payout_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_adjustment_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_adjustment_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payout_adjustment_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payout"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_batch: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payout_count: number
          period_id: string
          status: Database["public"]["Enums"]["payout_batch_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payout_count?: number
          period_id: string
          status?: Database["public"]["Enums"]["payout_batch_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payout_count?: number
          period_id?: string
          status?: Database["public"]["Enums"]["payout_batch_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_batch_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payout_batch_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_batch_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payout_batch_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: true
            referencedRelation: "pay_period"
            referencedColumns: ["id"]
          },
        ]
      }
      permission: {
        Row: {
          blocked_during_impersonation: boolean
          category: string
          description: string
          is_destructive: boolean
          key: string
          label: string
          requires_step_up: boolean
          sort_order: number
        }
        Insert: {
          blocked_during_impersonation?: boolean
          category: string
          description: string
          is_destructive?: boolean
          key: string
          label: string
          requires_step_up?: boolean
          sort_order?: number
        }
        Update: {
          blocked_during_impersonation?: boolean
          category?: string
          description?: string
          is_destructive?: boolean
          key?: string
          label?: string
          requires_step_up?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      placement: {
        Row: {
          case_file_id: string
          client_rate_per_booking: number | null
          closed_on: string | null
          commission_per_booking: number
          created_at: string
          end_date: string
          escalation_response_hours: number
          id: string
          monthly_booking_quota: number
          operator_id: string
          renewed_from_id: string | null
          response_standard_minutes: number
          shift_end: string
          shift_start: string
          start_date: string
          status: Database["public"]["Enums"]["placement_status"]
          term_months: number
          time_zone: string
        }
        Insert: {
          case_file_id: string
          client_rate_per_booking?: number | null
          closed_on?: string | null
          commission_per_booking?: number
          created_at?: string
          end_date: string
          escalation_response_hours?: number
          id?: string
          monthly_booking_quota?: number
          operator_id: string
          renewed_from_id?: string | null
          response_standard_minutes?: number
          shift_end?: string
          shift_start?: string
          start_date: string
          status?: Database["public"]["Enums"]["placement_status"]
          term_months?: number
          time_zone?: string
        }
        Update: {
          case_file_id?: string
          client_rate_per_booking?: number | null
          closed_on?: string | null
          commission_per_booking?: number
          created_at?: string
          end_date?: string
          escalation_response_hours?: number
          id?: string
          monthly_booking_quota?: number
          operator_id?: string
          renewed_from_id?: string | null
          response_standard_minutes?: number
          shift_end?: string
          shift_start?: string
          start_date?: string
          status?: Database["public"]["Enums"]["placement_status"]
          term_months?: number
          time_zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "placement_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "placement_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "placement_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operator"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_operator"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "placement_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          archived_at?: string | null
          created_at?: string
          email: string
          expires_on?: string | null
          failed_attempts?: number
          full_name?: string | null
          id: string
          invited_by?: string | null
          ip_allowlist?: unknown[] | null
          last_sign_in_at?: string | null
          locked_reason?: string | null
          locked_until?: string | null
          mfa_required?: boolean | null
          must_change_password?: boolean
          notes?: string | null
          purge_after?: string | null
          restrict_to_shift?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes?: number | null
          shift_override?: boolean
          soft_deleted_at?: string | null
          soft_deleted_by?: string | null
          state?: Database["public"]["Enums"]["account_state"]
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          time_zone?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          archived_at?: string | null
          created_at?: string
          email?: string
          expires_on?: string | null
          failed_attempts?: number
          full_name?: string | null
          id?: string
          invited_by?: string | null
          ip_allowlist?: unknown[] | null
          last_sign_in_at?: string | null
          locked_reason?: string | null
          locked_until?: string | null
          mfa_required?: boolean | null
          must_change_password?: boolean
          notes?: string | null
          purge_after?: string | null
          restrict_to_shift?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes?: number | null
          shift_override?: boolean
          soft_deleted_at?: string | null
          soft_deleted_by?: string | null
          state?: Database["public"]["Enums"]["account_state"]
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_reason?: string | null
          time_zone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "profile_soft_deleted_by_fkey"
            columns: ["soft_deleted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_soft_deleted_by_fkey"
            columns: ["soft_deleted_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "profile_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      response_day: {
        Row: {
          conversations: number
          day: string
          id: string
          placement_id: string
          within_standard: number
        }
        Insert: {
          conversations?: number
          day: string
          id?: string
          placement_id: string
          within_standard?: number
        }
        Update: {
          conversations?: number
          day?: string
          id?: string
          placement_id?: string
          within_standard?: number
        }
        Relationships: [
          {
            foreignKeyName: "response_day_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placement"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_record: {
        Row: {
          amount: number
          case_file_id: string
          created_at: string
          id: string
          invoice_id: string | null
          occurred_on: string
          revenue_type: Database["public"]["Enums"]["charge_type"]
        }
        Insert: {
          amount: number
          case_file_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          occurred_on: string
          revenue_type: Database["public"]["Enums"]["charge_type"]
        }
        Update: {
          amount?: number
          case_file_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          occurred_on?: string
          revenue_type?: Database["public"]["Enums"]["charge_type"]
        }
        Relationships: [
          {
            foreignKeyName: "revenue_record_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_record_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_record_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "revenue_record_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "revenue_record_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "revenue_record_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permission: {
        Row: {
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          permission_key?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permission_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission"
            referencedColumns: ["key"]
          },
        ]
      }
      scope_quote: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          decided_on: string | null
          decision_note: string | null
          id: string
          proposed_on: string
          scope_request_id: string
          status: Database["public"]["Enums"]["quote_status"]
          summary: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          decided_on?: string | null
          decision_note?: string | null
          id?: string
          proposed_on: string
          scope_request_id: string
          status?: Database["public"]["Enums"]["quote_status"]
          summary: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          decided_on?: string | null
          decision_note?: string | null
          id?: string
          proposed_on?: string
          scope_request_id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_quote_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_quote_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "scope_quote_scope_request_id_fkey"
            columns: ["scope_request_id"]
            isOneToOne: false
            referencedRelation: "scope_request"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_request: {
        Row: {
          case_file_id: string
          created_at: string
          created_by: string | null
          detail: string | null
          id: string
          reason: string
          requested_by_name: string | null
          requested_on: string
          summary: string
          verdict: Database["public"]["Enums"]["scope_verdict"]
        }
        Insert: {
          case_file_id: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          reason: string
          requested_by_name?: string | null
          requested_on: string
          summary: string
          verdict: Database["public"]["Enums"]["scope_verdict"]
        }
        Update: {
          case_file_id?: string
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          reason?: string
          requested_by_name?: string | null
          requested_on?: string
          summary?: string
          verdict?: Database["public"]["Enums"]["scope_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "scope_request_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_request_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_request_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "scope_request_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "scope_request_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "scope_request_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_request_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      snapshot: {
        Row: {
          case_file_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["snapshot_kind"]
          locked_at: string | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          taken_at: string
          tooling: string[]
          trigger: Database["public"]["Enums"]["snapshot_trigger"]
        }
        Insert: {
          case_file_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["snapshot_kind"]
          locked_at?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          taken_at?: string
          tooling?: string[]
          trigger?: Database["public"]["Enums"]["snapshot_trigger"]
        }
        Update: {
          case_file_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["snapshot_kind"]
          locked_at?: string | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          taken_at?: string
          tooling?: string[]
          trigger?: Database["public"]["Enums"]["snapshot_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "snapshot_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "snapshot_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "snapshot_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      snapshot_annotation: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          snapshot_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_annotation_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_annotation_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "snapshot_annotation_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshot"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_lead_source: {
        Row: {
          id: string
          leads_per_month: number | null
          snapshot_id: string
          source: string
        }
        Insert: {
          id?: string
          leads_per_month?: number | null
          snapshot_id: string
          source: string
        }
        Update: {
          id?: string
          leads_per_month?: number | null
          snapshot_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_lead_source_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshot"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_metric: {
        Row: {
          created_at: string
          id: string
          measurement_note: string | null
          metric_key: string
          snapshot_id: string
          source: Database["public"]["Enums"]["measurement_source"]
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          measurement_note?: string | null
          metric_key: string
          snapshot_id: string
          source?: Database["public"]["Enums"]["measurement_source"]
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          measurement_note?: string | null
          metric_key?: string
          snapshot_id?: string
          source?: Database["public"]["Enums"]["measurement_source"]
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_metric_metric_key_fkey"
            columns: ["metric_key"]
            isOneToOne: false
            referencedRelation: "metric_definition"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "snapshot_metric_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshot"
            referencedColumns: ["id"]
          },
        ]
      }
      step_up_verification: {
        Row: {
          consumed_at: string | null
          expires_at: string
          id: string
          ip: unknown
          profile_id: string
          purpose: string
          verified_at: string
        }
        Insert: {
          consumed_at?: string | null
          expires_at: string
          id?: string
          ip?: unknown
          profile_id: string
          purpose: string
          verified_at?: string
        }
        Update: {
          consumed_at?: string | null
          expires_at?: string
          id?: string
          ip?: unknown
          profile_id?: string
          purpose?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_up_verification_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_up_verification_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_account_onboarding"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      subscription: {
        Row: {
          amount: number
          cancelled_on: string | null
          case_file_id: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          interval_months: number
          processor_subscription_id: string | null
          started_on: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled_on?: string | null
          case_file_id: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval_months?: number
          processor_subscription_id?: string | null
          started_on: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled_on?: string | null
          case_file_id?: string
          charge_type?: Database["public"]["Enums"]["charge_type"]
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval_months?: number
          processor_subscription_id?: string | null
          started_on?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "subscription_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "subscription_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
        ]
      }
      tracking_funnel_daily: {
        Row: {
          ad_spend: number
          avg_response_minutes: number | null
          booked: number
          case_file_id: string
          closed: number
          day: string
          id: string
          ingested_at: string
          leads: number
          reactivation_revenue: number
          responded_within_standard: number
          revenue: number
          shows: number
          source: string
        }
        Insert: {
          ad_spend?: number
          avg_response_minutes?: number | null
          booked?: number
          case_file_id: string
          closed?: number
          day: string
          id?: string
          ingested_at?: string
          leads?: number
          reactivation_revenue?: number
          responded_within_standard?: number
          revenue?: number
          shows?: number
          source: string
        }
        Update: {
          ad_spend?: number
          avg_response_minutes?: number | null
          booked?: number
          case_file_id?: string
          closed?: number
          day?: string
          id?: string
          ingested_at?: string
          leads?: number
          reactivation_revenue?: number
          responded_within_standard?: number
          revenue?: number
          shows?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_funnel_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_funnel_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_funnel_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "tracking_funnel_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "tracking_funnel_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
        ]
      }
      tracking_metric_daily: {
        Row: {
          case_file_id: string
          day: string
          id: string
          ingested_at: string
          metric_key: string
          value: number
        }
        Insert: {
          case_file_id: string
          day: string
          id?: string
          ingested_at?: string
          metric_key: string
          value: number
        }
        Update: {
          case_file_id?: string
          day?: string
          id?: string
          ingested_at?: string
          metric_key?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tracking_metric_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_metric_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_metric_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "tracking_metric_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "tracking_metric_daily_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "tracking_metric_daily_metric_key_fkey"
            columns: ["metric_key"]
            isOneToOne: false
            referencedRelation: "metric_definition"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      v_account_onboarding: {
        Row: {
          accepted: boolean | null
          certification_required: boolean | null
          certified: boolean | null
          created_at: string | null
          email: string | null
          first_assignment_made: boolean | null
          invited: boolean | null
          name: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          scope_populated: boolean | null
          scope_set: boolean | null
          second_factor_enabled: boolean | null
          second_factor_required: boolean | null
          state: Database["public"]["Enums"]["account_state"] | null
          training_assigned: boolean | null
        }
        Insert: {
          accepted?: never
          certification_required?: never
          certified?: never
          created_at?: string | null
          email?: string | null
          first_assignment_made?: never
          invited?: never
          name?: never
          profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          scope_populated?: never
          scope_set?: never
          second_factor_enabled?: never
          second_factor_required?: never
          state?: never
          training_assigned?: never
        }
        Update: {
          accepted?: never
          certification_required?: never
          certified?: never
          created_at?: string | null
          email?: string | null
          first_assignment_made?: never
          invited?: never
          name?: never
          profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          scope_populated?: never
          scope_set?: never
          second_factor_enabled?: never
          second_factor_required?: never
          state?: never
          training_assigned?: never
        }
        Relationships: []
      }
      v_case_file_health: {
        Row: {
          baseline_locked: boolean | null
          baseline_revenue: number | null
          current_revenue: number | null
          days_since_snapshot: number | null
          effort_entry_count: number | null
          engagement_start: string | null
          evidence_count: number | null
          evidence_needing_metadata: number | null
          failing_invoices: number | null
          has_baseline: boolean | null
          headline_revenue_change_pct: number | null
          id: string | null
          install_started_at: string | null
          last_period_end: string | null
          last_snapshot_at: string | null
          milestone_count: number | null
          name: string | null
          open_client_messages: number | null
          out_of_scope_count: number | null
          slug: string | null
          snapshot_overdue: boolean | null
          status: Database["public"]["Enums"]["engagement_status"] | null
          vertical: string | null
        }
        Relationships: []
      }
      v_contractor_brief: {
        Row: {
          case_file_id: string | null
          client_name: string | null
          completed_at: string | null
          due_on: string | null
          spec: string | null
          task_id: string | null
          title: string | null
          vertical: string | null
        }
        Relationships: []
      }
      v_credential: {
        Row: {
          archived_at: string | null
          case_file_id: string | null
          client_name: string | null
          client_slug: string | null
          id: string | null
          is_stale: boolean | null
          kind: string | null
          label: string | null
          last_rotated_at: string | null
          last_viewed_at: string | null
          live_grants: number | null
          notes: string | null
          rotation_interval_days: number | null
          url: string | null
          username: string | null
          view_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "client_credential_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
        ]
      }
      v_document_attention: {
        Row: {
          awaiting_review: number | null
          case_file_id: string | null
          client_name: string | null
          client_slug: string | null
          has_baseline: boolean | null
          last_monthly_at: string | null
          monthly_overdue: boolean | null
          open_drafts: number | null
          status: Database["public"]["Enums"]["engagement_status"] | null
          unconfirmed_case_studies: number | null
          unopened_published: number | null
        }
        Insert: {
          awaiting_review?: never
          case_file_id?: string | null
          client_name?: string | null
          client_slug?: string | null
          has_baseline?: never
          last_monthly_at?: never
          monthly_overdue?: never
          open_drafts?: never
          status?: Database["public"]["Enums"]["engagement_status"] | null
          unconfirmed_case_studies?: never
          unopened_published?: never
        }
        Update: {
          awaiting_review?: never
          case_file_id?: string | null
          client_name?: string | null
          client_slug?: string | null
          has_baseline?: never
          last_monthly_at?: never
          monthly_overdue?: never
          open_drafts?: never
          status?: Database["public"]["Enums"]["engagement_status"] | null
          unconfirmed_case_studies?: never
          unopened_published?: never
        }
        Relationships: []
      }
      v_document_index: {
        Row: {
          anonymisation_confirmed_at: string | null
          case_file_id: string | null
          channels: string | null
          client_name: string | null
          client_slug: string | null
          correction_note: string | null
          drive_url: string | null
          generated_at: string | null
          id: string | null
          is_case_study: boolean | null
          last_opened_at: string | null
          open_count: number | null
          open_flags: number | null
          period_end: string | null
          period_start: string | null
          published_at: string | null
          sections_with_gaps: number | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"] | null
          superseded_by_id: string | null
          supersedes_id: string | null
          title: string | null
          type: Database["public"]["Enums"]["document_type"] | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "client_case_file"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_case_file_health"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_contractor_brief"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_document_attention"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "document_case_file_id_fkey"
            columns: ["case_file_id"]
            isOneToOne: false
            referencedRelation: "v_margin_by_client"
            referencedColumns: ["case_file_id"]
          },
          {
            foreignKeyName: "document_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_link"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "v_document_index"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "v_document_index"
            referencedColumns: ["id"]
          },
        ]
      }
      v_margin_by_client: {
        Row: {
          case_file_id: string | null
          last_payment_on: string | null
          margin_pct: number | null
          margin_to_date: number | null
          name: string | null
          operator_cost_to_date: number | null
          pass_through_to_date: number | null
          revenue_to_date: number | null
          slug: string | null
          status: Database["public"]["Enums"]["engagement_status"] | null
        }
        Relationships: []
      }
      v_margin_by_operator: {
        Row: {
          clients_served: number | null
          name: string | null
          operator_id: string | null
          paid_to_date: number | null
          revenue_on_served_clients: number | null
          tier: number | null
        }
        Relationships: []
      }
      v_monthly_margin: {
        Row: {
          margin: number | null
          month: string | null
          operator_cost: number | null
          pass_through: number | null
          revenue: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_account_invite: {
        Args: { p_full_name?: string; p_time_zone?: string; p_token: string }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_client_invite: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string | null
          access_until: string | null
          case_file_id: string
          created_at: string
          full_name: string | null
          invited_by: string | null
          is_primary: boolean
          job_title: string | null
          profile_id: string
          state: Database["public"]["Enums"]["client_account_state"]
          suspended_reason: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "client_account"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      account_sessions: {
        Args: { p_profile_id: string }
        Returns: {
          aal: string
          city: string
          country: string
          ip: unknown
          is_current: boolean
          last_activity: string
          session_id: string
          started_at: string
          user_agent: string
        }[]
      }
      acknowledge_notice: {
        Args: { p_notice_id: string }
        Returns: {
          acknowledged_at: string | null
          blocking: boolean
          body: string
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          created_by: string | null
          id: string
          profile_id: string
          severity: Database["public"]["Enums"]["notification_severity"]
        }
        SetofOptions: {
          from: "*"
          to: "account_notice"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_invoice_line: {
        Args: {
          p_description: string
          p_invoice_id: string
          p_quantity?: number
          p_unit_amount: number
        }
        Returns: string
      }
      advance_offboarding: {
        Args: { p_profile_id: string; p_step: string }
        Returns: Record<string, unknown>[]
      }
      annotate_snapshot: {
        Args: { p_body: string; p_snapshot_id: string }
        Returns: string
      }
      answer_client_message: {
        Args: { p_answer: string; p_message_id: string }
        Returns: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          author_name: string
          author_profile_id: string | null
          body: string
          case_file_id: string
          closed_at: string | null
          created_at: string
          id: string
          response_due_at: string
          status: Database["public"]["Enums"]["client_message_status"]
        }
        SetofOptions: {
          from: "*"
          to: "client_message"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_payout_batch: {
        Args: { p_batch_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payout_count: number
          period_id: string
          status: Database["public"]["Enums"]["payout_batch_status"]
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payout_batch"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_account: {
        Args: { p_profile_id: string }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_client_accounts: {
        Args: { p_case_file_id: string; p_window_days?: number }
        Returns: number
      }
      archive_credential: {
        Args: { p_credential_id: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          case_file_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string
          last_rotated_at: string
          notes: string | null
          rotation_interval_days: number
          secret_id: string
          updated_at: string
          url: string | null
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_credential"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_document: {
        Args: { p_document_id: string }
        Returns: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "document"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_document_to_drive: {
        Args: {
          p_document_id: string
          p_drive_file_id: string
          p_drive_url: string
        }
        Returns: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "document"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      attach_report_to_drive: {
        Args: {
          p_drive_file_id: string
          p_drive_url: string
          p_report_id: string
        }
        Returns: undefined
      }
      attempt_sign_in: {
        Args: {
          p_city?: string
          p_country?: string
          p_email: string
          p_ip?: unknown
          p_password: string
          p_surface?: string
          p_user_agent?: string
        }
        Returns: {
          code: string
          message: string
          ok: boolean
        }[]
      }
      begin_install: {
        Args: { p_case_file_id: string }
        Returns: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          engagement_end: string | null
          engagement_start: string | null
          id: string
          install_started_at: string | null
          logo_url: string | null
          name: string
          notes: string | null
          retainer_amount: number | null
          revenue_goal_monthly: number | null
          slug: string
          status: Database["public"]["Enums"]["engagement_status"]
          updated_at: string
          vertical: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_case_file"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      booking_is_creditable: {
        Args: {
          p_matched: string
          p_source: Database["public"]["Enums"]["booking_source"]
          p_state: Database["public"]["Enums"]["booking_state"]
        }
        Returns: boolean
      }
      build_payout_batch: {
        Args: { p_period_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payout_count: number
          period_id: string
          status: Database["public"]["Enums"]["payout_batch_status"]
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payout_batch"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      build_performance_invoice: {
        Args: {
          p_case_file_id: string
          p_due_at?: string
          p_period_end: string
          p_period_start: string
          p_rate_override?: number
        }
        Returns: {
          case_file_id: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string
          created_by: string | null
          credited_total: number
          currency: string
          due_at: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          processor: string | null
          processor_invoice_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoice"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_invite: {
        Args: { p_invite_id: string }
        Returns: {
          accepted_at: string | null
          accepted_profile_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          email: string
          expires_at: string
          expires_on: string | null
          full_name: string | null
          id: string
          invited_by: string | null
          last_sent_at: string
          resent_count: number
          role: Database["public"]["Enums"]["user_role"]
          scope_case_file_ids: string[]
          scope_kind: Database["public"]["Enums"]["scope_kind"]
          time_zone: string | null
          token_hash: string
        }
        SetofOptions: {
          from: "*"
          to: "account_invite"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      capture_baseline: {
        Args: {
          p_case_file_id: string
          p_lead_sources?: Json
          p_metrics: Json
          p_notes?: string
          p_tooling?: string[]
        }
        Returns: string
      }
      change_account_role: {
        Args: {
          p_new_role: Database["public"]["Enums"]["user_role"]
          p_profile_id: string
        }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clear_account_notice: {
        Args: { p_notice_id: string }
        Returns: undefined
      }
      clear_permission_override: {
        Args: { p_permission_key: string; p_profile_id: string }
        Returns: undefined
      }
      client_funnel: {
        Args: {
          p_case_file_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      commission_bookings: {
        Args: { p_statement_id: string }
        Returns: {
          booking_id: string
          customer_name: string
          scheduled_for: string
          source: Database["public"]["Enums"]["booking_source"]
          state: Database["public"]["Enums"]["booking_state"]
        }[]
      }
      complete_password_reset: { Args: never; Returns: undefined }
      confirm_payout: {
        Args: {
          p_method?: Database["public"]["Enums"]["payout_method"]
          p_payout_id: string
          p_sent_at?: string
          p_sent_reference: string
        }
        Returns: {
          adjustment_total: number
          amount: number
          base_amount: number
          batch_id: string
          bonus_amount: number
          commission_amount: number
          confirmed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          locked: boolean
          method: Database["public"]["Enums"]["payout_method"] | null
          operator_id: string
          payout_reference: string | null
          period_id: string
          placement_id: string | null
          rolled_from_payout_id: string | null
          rolled_into_payout_id: string | null
          sent_at: string | null
          sent_reference: string | null
          statement_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payout"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      correct_decision: {
        Args: {
          p_against_recommendation: boolean
          p_decided_by: string
          p_decided_on: string
          p_decision_id: string
          p_reason: string
          p_reasoning: string
          p_what_was_decided: string
        }
        Returns: string
      }
      correct_document: {
        Args: { p_correction_note: string; p_document_id: string }
        Returns: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "document"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      correct_effort: {
        Args: {
          p_description: string
          p_effort_id: string
          p_hours?: number
          p_performed_on: string
          p_phase: string
          p_reason: string
        }
        Returns: string
      }
      create_case_file: {
        Args: {
          p_contact_email?: string
          p_contact_name?: string
          p_engagement_start?: string
          p_name: string
          p_retainer_amount?: number
          p_revenue_goal_monthly?: number
          p_vertical?: string
        }
        Returns: {
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          drive_folder_id: string | null
          drive_folder_url: string | null
          engagement_end: string | null
          engagement_start: string | null
          id: string
          install_started_at: string | null
          logo_url: string | null
          name: string
          notes: string | null
          retainer_amount: number | null
          revenue_goal_monthly: number | null
          slug: string
          status: Database["public"]["Enums"]["engagement_status"]
          updated_at: string
          vertical: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_case_file"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_case_study_draft: {
        Args: { p_descriptor: string; p_document_id: string }
        Returns: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "document"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_dashboard_link: {
        Args: {
          p_case_file_id: string
          p_label?: string
          p_passphrase?: string
          p_valid_days?: number
        }
        Returns: {
          case_file_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          label: string | null
          last_viewed_at: string | null
          password_hash: string | null
          revoked_at: string | null
          token: string
          view_count: number
        }
        SetofOptions: {
          from: "*"
          to: "client_dashboard_link"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invoice_draft: {
        Args: {
          p_case_file_id: string
          p_charge_type: Database["public"]["Enums"]["charge_type"]
          p_due_at?: string
          p_notes?: string
          p_period_end?: string
          p_period_start?: string
        }
        Returns: {
          case_file_id: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string
          created_by: string | null
          credited_total: number
          currency: string
          due_at: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          processor: string | null
          processor_invoice_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoice"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_share_link: {
        Args: {
          p_evidence_id: string
          p_shared_with?: string
          p_ttl_minutes?: number
        }
        Returns: {
          access_count: number
          created_at: string
          created_by: string | null
          evidence_id: string
          expires_at: string
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          shared_with: string | null
          token: string
        }
        SetofOptions: {
          from: "*"
          to: "evidence_share_link"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credentials_reachable_by: {
        Args: { p_profile_id: string }
        Returns: {
          client_name: string
          credential_id: string
          ever_viewed: boolean
          kind: string
          label: string
          last_rotated_at: string
          reached_via: string
        }[]
      }
      decide_quote: {
        Args: {
          p_decided_on?: string
          p_note?: string
          p_quote_id: string
          p_status: Database["public"]["Enums"]["quote_status"]
        }
        Returns: {
          amount: number | null
          created_at: string
          created_by: string | null
          decided_on: string | null
          decision_note: string | null
          id: string
          proposed_on: string
          scope_request_id: string
          status: Database["public"]["Enums"]["quote_status"]
          summary: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "scope_quote"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      detect_milestones: { Args: { p_case_file_id: string }; Returns: number }
      end_impersonation: { Args: never; Returns: undefined }
      engage_lockdown: {
        Args: { p_reason: string; p_typed_confirmation: string }
        Returns: {
          engaged_at: string
          engaged_by: string
          id: string
          reason: string
          released_at: string | null
          released_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lockdown"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      explain_permission: {
        Args: { p_permission: string; p_profile_id?: string }
        Returns: {
          allowed: boolean
          layer: string
          reason: string
        }[]
      }
      fail_payout: {
        Args: { p_payout_id: string; p_reason: string; p_returned?: boolean }
        Returns: {
          adjustment_total: number
          amount: number
          base_amount: number
          batch_id: string
          bonus_amount: number
          commission_amount: number
          confirmed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          locked: boolean
          method: Database["public"]["Enums"]["payout_method"] | null
          operator_id: string
          payout_reference: string | null
          period_id: string
          placement_id: string | null
          rolled_from_payout_id: string | null
          rolled_into_payout_id: string | null
          sent_at: string | null
          sent_reference: string | null
          statement_id: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payout"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_document: {
        Args: {
          p_case_file_id: string
          p_include_effort?: boolean
          p_period_end?: string
          p_period_start?: string
          p_title?: string
          p_type: Database["public"]["Enums"]["document_type"]
        }
        Returns: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "document"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_growth_report: {
        Args: {
          p_case_file_id: string
          p_evidence_ids?: string[]
          p_mode: Database["public"]["Enums"]["report_mode"]
          p_period_end: string
          p_period_start: string
        }
        Returns: {
          case_file_id: string
          drive_file_id: string | null
          drive_url: string | null
          generated_at: string
          generated_by: string | null
          id: string
          included_evidence_ids: string[]
          mode: Database["public"]["Enums"]["report_mode"]
          payload: Json
          period_end: string
          period_start: string
          published_by: string | null
          published_to_client_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "growth_report"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      grant_credential_access: {
        Args: {
          p_credential_id: string
          p_expires_at: string
          p_profile_id: string
          p_reason?: string
        }
        Returns: {
          credential_id: string
          expires_at: string
          granted_at: string
          granted_by: string | null
          id: string
          profile_id: string
          reason: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "credential_grant"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      growth_for_case_file: {
        Args: { p_case_file_id: string }
        Returns: {
          absolute_change: number
          baseline_source: Database["public"]["Enums"]["measurement_source"]
          baseline_value: number
          category: string
          current_snapshot_at: string
          current_source: Database["public"]["Enums"]["measurement_source"]
          current_value: number
          direction: Database["public"]["Enums"]["metric_direction"]
          improved: boolean
          label: string
          metric_key: string
          percent_change: number
          sort_order: number
          unit: string
        }[]
      }
      growth_series: {
        Args: { p_case_file_id: string; p_metric_key: string }
        Returns: {
          annotation_count: number
          kind: Database["public"]["Enums"]["snapshot_kind"]
          period_end: string
          period_start: string
          snapshot_id: string
          source: Database["public"]["Enums"]["measurement_source"]
          taken_at: string
          value: number
        }[]
      }
      impersonation_context: {
        Args: never
        Returns: {
          actor_name: string
          actor_profile_id: string
          expires_at: string
          impersonation_id: string
          reason: string
          started_at: string
          target_name: string
          target_profile_id: string
          target_role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      invite_account: {
        Args: {
          p_email: string
          p_expires_on?: string
          p_full_name?: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_scope_case_file_ids?: string[]
          p_scope_kind?: Database["public"]["Enums"]["scope_kind"]
          p_time_zone?: string
          p_valid_days?: number
        }
        Returns: {
          invite_id: string
          token: string
        }[]
      }
      invite_client: {
        Args: {
          p_case_file_id: string
          p_email: string
          p_full_name?: string
          p_job_title?: string
          p_valid_days?: number
        }
        Returns: {
          case_file_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          job_title: string | null
          revoked_at: string | null
          token: string
          used_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_invite"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      invite_preview: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          full_name: string
          reason: string
          role: Database["public"]["Enums"]["user_role"]
          valid: boolean
        }[]
      }
      issue_credit_note: {
        Args: { p_amount: number; p_invoice_id: string; p_reason: string }
        Returns: {
          amount: number
          created_by: string | null
          id: string
          invoice_id: string
          issued_at: string
          number: string | null
          reason: string
        }
        SetofOptions: {
          from: "*"
          to: "credit_note"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      issue_invoice: {
        Args: { p_invoice_id: string }
        Returns: {
          case_file_id: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string
          created_by: string | null
          credited_total: number
          currency: string
          due_at: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          processor: string | null
          processor_invoice_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoice"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      link_evidence: {
        Args: {
          p_effort_entry_id?: string
          p_evidence_id: string
          p_milestone_id?: string
          p_snapshot_id?: string
        }
        Returns: string
      }
      lockdown_status: {
        Args: never
        Returns: {
          engaged_at: string
          engaged_by_email: string
          id: string
          is_mine: boolean
          reason: string
        }[]
      }
      log_decision: {
        Args: {
          p_against_recommendation?: boolean
          p_case_file_id: string
          p_decided_by: string
          p_decided_on: string
          p_reasoning: string
          p_what_was_decided: string
        }
        Returns: string
      }
      log_effort: {
        Args: {
          p_case_file_id: string
          p_description: string
          p_hours?: number
          p_performed_on: string
          p_phase: string
        }
        Returns: string
      }
      log_scope_request: {
        Args: {
          p_case_file_id: string
          p_detail?: string
          p_reason: string
          p_requested_by_name?: string
          p_requested_on: string
          p_summary: string
          p_verdict: Database["public"]["Enums"]["scope_verdict"]
        }
        Returns: string
      }
      margin_for_case_file: {
        Args: {
          p_case_file_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: {
          margin: number
          margin_pct: number
          operator_cost: number
          pass_through: number
          revenue: number
        }[]
      }
      mark_case_study_ready: {
        Args: { p_document_id: string }
        Returns: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "document"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_overdue_invoices: { Args: never; Returns: number }
      offboarding_state: {
        Args: { p_profile_id: string }
        Returns: {
          blocked: boolean
          blocker: string
          detail: string
          done: boolean
          key: string
          label: string
          step: number
        }[]
      }
      open_work_for: {
        Args: { p_profile_id: string }
        Returns: {
          count: number
          kind: string
          label: string
        }[]
      }
      permanently_delete_account: {
        Args: { p_profile_id: string; p_typed_email: string }
        Returns: undefined
      }
      publish_document: {
        Args: { p_document_id: string }
        Returns: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "document"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_report: {
        Args: { p_report_id: string }
        Returns: {
          case_file_id: string
          drive_file_id: string | null
          drive_url: string | null
          generated_at: string
          generated_by: string | null
          id: string
          included_evidence_ids: string[]
          mode: Database["public"]["Enums"]["report_mode"]
          payload: Json
          period_end: string
          period_start: string
          published_by: string | null
          published_to_client_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "growth_report"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      quote_scope_request: {
        Args: {
          p_amount?: number
          p_proposed_on: string
          p_scope_request_id: string
          p_summary: string
        }
        Returns: string
      }
      reactivate_account: {
        Args: { p_profile_id: string }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalculate_invoice: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      record_document_open: {
        Args: { p_document_id: string; p_user_agent?: string; p_via?: string }
        Returns: undefined
      }
      record_drive_sync: {
        Args: { p_case_file_id: string; p_files: Json }
        Returns: number
      }
      record_evidence: {
        Args: {
          p_byte_size?: number
          p_case_file_id: string
          p_category: Database["public"]["Enums"]["evidence_category"]
          p_drive_file_id: string
          p_drive_url?: string
          p_filename: string
          p_happened_on: string
          p_mime_type?: string
          p_thumbnail_url?: string
          p_what_it_proves: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          p_amount?: number
          p_failure_code?: string
          p_failure_message?: string
          p_invoice_id: string
          p_processor_intent_id?: string
          p_status: Database["public"]["Enums"]["payment_attempt_status"]
        }
        Returns: {
          case_file_id: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string
          created_by: string | null
          credited_total: number
          currency: string
          due_at: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          processor: string | null
          processor_invoice_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoice"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_document_bindings: {
        Args: { p_document_id: string }
        Returns: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "document"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_drive_folders: {
        Args: {
          p_case_file_id: string
          p_root_folder_id: string
          p_root_folder_url: string
          p_subfolders: Json
        }
        Returns: undefined
      }
      release_lockdown: {
        Args: never
        Returns: {
          engaged_at: string
          engaged_by: string
          id: string
          reason: string
          released_at: string | null
          released_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "lockdown"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      require_password_reset: {
        Args: { p_profile_id: string }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resend_invite: {
        Args: { p_invite_id: string }
        Returns: {
          invite_id: string
          token: string
        }[]
      }
      reset_second_factor: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      resolve_anonymisation_flag: {
        Args: { p_flag_id: string; p_replacement?: string }
        Returns: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          document_id: string
          id: string
          kind: Database["public"]["Enums"]["anonymisation_kind"]
          section_key: string
          snippet: string
          suggestion: string | null
        }
        SetofOptions: {
          from: "*"
          to: "anonymisation_flag"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_account: {
        Args: { p_profile_id: string }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reveal_credential: {
        Args: { p_credential_id: string }
        Returns: {
          label: string
          secret: string
          url: string
          username: string
        }[]
      }
      revoke_account_sessions: {
        Args: { p_profile_id: string }
        Returns: number
      }
      revoke_credential_access: {
        Args: { p_grant_id: string }
        Returns: undefined
      }
      revoke_dashboard_link: { Args: { p_link_id: string }; Returns: undefined }
      revoke_one_session: {
        Args: { p_profile_id: string; p_session_id: string }
        Returns: undefined
      }
      revoke_share_link: { Args: { p_link_id: string }; Returns: undefined }
      role_change_preview: {
        Args: {
          p_new_role: Database["public"]["Enums"]["user_role"]
          p_profile_id: string
        }
        Returns: {
          category: string
          change: string
          label: string
          permission_key: string
        }[]
      }
      rollup_tracking: {
        Args: {
          p_case_file_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: Json
      }
      rotate_credential: {
        Args: { p_credential_id: string; p_new_secret: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          case_file_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string
          last_rotated_at: string
          notes: string | null
          rotation_interval_days: number
          secret_id: string
          updated_at: string
          url: string | null
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_credential"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      scoped_case_files: { Args: { p_profile_id?: string }; Returns: string[] }
      send_client_message: {
        Args: {
          p_body: string
          p_case_file_id: string
          p_response_hours?: number
        }
        Returns: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          author_name: string
          author_profile_id: string | null
          body: string
          case_file_id: string
          closed_at: string | null
          created_at: string
          id: string
          response_due_at: string
          status: Database["public"]["Enums"]["client_message_status"]
        }
        SetofOptions: {
          from: "*"
          to: "client_message"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_account_expiry: {
        Args: { p_expires_on: string; p_profile_id: string }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_account_notice: {
        Args: {
          p_blocking?: boolean
          p_body: string
          p_profile_id: string
          p_severity?: Database["public"]["Enums"]["notification_severity"]
        }
        Returns: {
          acknowledged_at: string | null
          blocking: boolean
          body: string
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          created_by: string | null
          id: string
          profile_id: string
          severity: Database["public"]["Enums"]["notification_severity"]
        }
        SetofOptions: {
          from: "*"
          to: "account_notice"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_account_scope: {
        Args: {
          p_case_file_ids?: string[]
          p_kind: Database["public"]["Enums"]["scope_kind"]
          p_placement_ids?: string[]
          p_profile_id: string
        }
        Returns: {
          kind: Database["public"]["Enums"]["scope_kind"]
          profile_id: string
          set_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "account_scope"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_document_narrative: {
        Args: { p_body: string; p_document_id: string; p_section_key: string }
        Returns: {
          body: string | null
          bound_data: Json | null
          created_at: string
          document_id: string
          has_gap: boolean
          id: string
          key: string
          kind: Database["public"]["Enums"]["section_kind"]
          sort_order: number
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "document_section"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_mfa_requirement: {
        Args: { p_profile_id: string; p_required: boolean }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_permission_override: {
        Args: {
          p_effect: Database["public"]["Enums"]["permission_effect"]
          p_expires_at?: string
          p_permission_key: string
          p_profile_id: string
          p_reason?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          effect: Database["public"]["Enums"]["permission_effect"]
          expires_at: string | null
          permission_key: string
          profile_id: string
          reason: string | null
        }
        SetofOptions: {
          from: "*"
          to: "account_permission"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_sign_in_restrictions: {
        Args: {
          p_ip_allowlist?: unknown[]
          p_profile_id: string
          p_restrict_to_shift?: boolean
          p_session_timeout_minutes?: number
          p_shift_override?: boolean
        }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shared_dashboard: {
        Args: {
          p_passphrase?: string
          p_period_days?: number
          p_token: string
          p_user_agent?: string
        }
        Returns: Json
      }
      snapshots_due: {
        Args: never
        Returns: {
          case_file_id: string
          days_since: number
          last_period_end: string
          name: string
        }[]
      }
      soft_delete_account: {
        Args: { p_profile_id: string; p_recovery_days?: number }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_impersonation: {
        Args: {
          p_minutes?: number
          p_reason: string
          p_target_profile_id: string
        }
        Returns: {
          actor_profile_id: string
          ended_at: string | null
          ended_reason: string | null
          expires_at: string
          id: string
          notified_target_at: string | null
          reason: string | null
          started_at: string
          step_up_id: string | null
          target_profile_id: string
        }
        SetofOptions: {
          from: "*"
          to: "impersonation"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      step_up_needed: { Args: { p_purpose: string }; Returns: boolean }
      store_credential: {
        Args: {
          p_case_file_id: string
          p_kind: string
          p_label: string
          p_notes?: string
          p_rotation_interval_days?: number
          p_secret: string
          p_url?: string
          p_username?: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          case_file_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          label: string
          last_rotated_at: string
          notes: string | null
          rotation_interval_days: number
          secret_id: string
          updated_at: string
          url: string | null
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_credential"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_document_for_review: {
        Args: { p_document_id: string }
        Returns: {
          anonymisation_confirmed_at: string | null
          anonymisation_confirmed_by: string | null
          anonymised_descriptor: string | null
          archived_at: string | null
          case_file_id: string
          correction_note: string | null
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          frozen_payload: Json | null
          generated_at: string
          generated_by: string | null
          id: string
          include_effort: boolean
          is_case_study: boolean
          period_end: string | null
          period_start: string | null
          published_at: string | null
          published_by: string | null
          share_link_id: string | null
          state: Database["public"]["Enums"]["document_state"]
          superseded_by_id: string | null
          supersedes_id: string | null
          template_id: string
          template_version: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "document"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suspend_account: {
        Args: { p_profile_id: string; p_reason: string }
        Returns: {
          accepted_at: string | null
          archived_at: string | null
          created_at: string
          email: string
          expires_on: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          ip_allowlist: unknown[] | null
          last_sign_in_at: string | null
          locked_reason: string | null
          locked_until: string | null
          mfa_required: boolean | null
          must_change_password: boolean
          notes: string | null
          purge_after: string | null
          restrict_to_shift: boolean
          role: Database["public"]["Enums"]["user_role"]
          session_timeout_minutes: number | null
          shift_override: boolean
          soft_deleted_at: string | null
          soft_deleted_by: string | null
          state: Database["public"]["Enums"]["account_state"]
          suspended_at: string | null
          suspended_by: string | null
          suspended_reason: string | null
          time_zone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profile"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suspend_for_billing: {
        Args: { p_threshold_days?: number }
        Returns: number
      }
      take_due_snapshots: { Args: never; Returns: number }
      take_snapshot: {
        Args: {
          p_case_file_id: string
          p_metrics?: Json
          p_notes?: string
          p_period_end?: string
          p_period_start?: string
          p_trigger?: Database["public"]["Enums"]["snapshot_trigger"]
        }
        Returns: string
      }
      verify_step_up: {
        Args: { p_password: string; p_purpose: string }
        Returns: {
          message: string
          ok: boolean
        }[]
      }
      write_off_invoice: {
        Args: { p_invoice_id: string; p_reason: string }
        Returns: {
          case_file_id: string
          charge_type: Database["public"]["Enums"]["charge_type"]
          created_at: string
          created_by: string | null
          credited_total: number
          currency: string
          due_at: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          processor: string | null
          processor_invoice_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "invoice"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_state:
        | "pending"
        | "active"
        | "suspended"
        | "expired"
        | "locked"
        | "archived"
      anonymisation_kind:
        | "client_name"
        | "person"
        | "location"
        | "brand"
        | "other"
      booking_source: "ghl" | "manual"
      booking_state: "confirmed" | "pending_review" | "system_only" | "rejected"
      charge_type:
        | "audit_fee"
        | "install_fee"
        | "retainer"
        | "bundled_term"
        | "performance"
      client_account_state:
        | "invited"
        | "active"
        | "suspended"
        | "archived"
        | "closed"
      client_message_status: "open" | "answered" | "closed"
      delivery_status: "delivered" | "failed" | "skipped"
      document_state: "draft" | "in_review" | "published" | "archived"
      document_type:
        | "audit_findings"
        | "install_completion"
        | "monthly_performance"
        | "quarterly_review"
        | "proposal_scope"
        | "case_study"
      engagement_status: "audit" | "installing" | "active" | "paused" | "ended"
      escalation_category:
        | "clinical"
        | "pricing_exception"
        | "complaint"
        | "scheduling_conflict"
        | "scope"
        | "other"
      escalation_status: "open" | "answered" | "closed"
      evidence_category:
        | "evidence"
        | "deliverables"
        | "reports"
        | "client_provided"
      invoice_status:
        | "draft"
        | "issued"
        | "paid"
        | "overdue"
        | "failed"
        | "refunded"
        | "written_off"
      measurement_source: "measured" | "client_estimate"
      metric_aggregation: "average" | "monthly_rate" | "latest"
      metric_direction: "up_is_good" | "down_is_good"
      milestone_type:
        | "install_complete"
        | "operator_placed"
        | "campaign_launched"
        | "first_lead"
        | "first_booking"
        | "first_reactivation_revenue"
        | "first_month_over_goal"
        | "custom"
      notification_channel: "in_app" | "discord" | "email" | "whatsapp"
      notification_severity: "informational" | "important" | "urgent"
      operator_status:
        | "applicant"
        | "in_training"
        | "certified"
        | "placed"
        | "on_bench"
        | "inactive"
      payment_attempt_status:
        | "requires_action"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
      payout_batch_status: "draft" | "approved" | "executing" | "completed"
      payout_method:
        | "wise"
        | "payoneer"
        | "bank_transfer"
        | "paypal"
        | "crypto_usdc"
      payout_status: "pending" | "sent" | "confirmed" | "failed" | "returned"
      permission_effect: "grant" | "deny"
      placement_status: "draft" | "active" | "ended" | "renewed"
      quote_status: "draft" | "sent" | "accepted" | "declined"
      report_mode: "client_facing" | "internal" | "case_study_draft"
      scope_kind: "all_clients" | "clients" | "placements"
      scope_verdict: "in_scope" | "out_of_scope"
      section_kind:
        | "fixed"
        | "narrative"
        | "bound_metrics"
        | "bound_table"
        | "milestones"
        | "evidence"
        | "effort"
        | "scope"
      snapshot_kind: "baseline" | "progress"
      snapshot_trigger: "automatic" | "manual"
      subscription_status: "active" | "past_due" | "paused" | "cancelled"
      tax_doc_status: "missing" | "requested" | "on_file" | "expired"
      user_role:
        | "owner"
        | "admin"
        | "manager"
        | "operator"
        | "contractor"
        | "client"
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
      account_state: [
        "pending",
        "active",
        "suspended",
        "expired",
        "locked",
        "archived",
      ],
      anonymisation_kind: [
        "client_name",
        "person",
        "location",
        "brand",
        "other",
      ],
      booking_source: ["ghl", "manual"],
      booking_state: ["confirmed", "pending_review", "system_only", "rejected"],
      charge_type: [
        "audit_fee",
        "install_fee",
        "retainer",
        "bundled_term",
        "performance",
      ],
      client_account_state: [
        "invited",
        "active",
        "suspended",
        "archived",
        "closed",
      ],
      client_message_status: ["open", "answered", "closed"],
      delivery_status: ["delivered", "failed", "skipped"],
      document_state: ["draft", "in_review", "published", "archived"],
      document_type: [
        "audit_findings",
        "install_completion",
        "monthly_performance",
        "quarterly_review",
        "proposal_scope",
        "case_study",
      ],
      engagement_status: ["audit", "installing", "active", "paused", "ended"],
      escalation_category: [
        "clinical",
        "pricing_exception",
        "complaint",
        "scheduling_conflict",
        "scope",
        "other",
      ],
      escalation_status: ["open", "answered", "closed"],
      evidence_category: [
        "evidence",
        "deliverables",
        "reports",
        "client_provided",
      ],
      invoice_status: [
        "draft",
        "issued",
        "paid",
        "overdue",
        "failed",
        "refunded",
        "written_off",
      ],
      measurement_source: ["measured", "client_estimate"],
      metric_aggregation: ["average", "monthly_rate", "latest"],
      metric_direction: ["up_is_good", "down_is_good"],
      milestone_type: [
        "install_complete",
        "operator_placed",
        "campaign_launched",
        "first_lead",
        "first_booking",
        "first_reactivation_revenue",
        "first_month_over_goal",
        "custom",
      ],
      notification_channel: ["in_app", "discord", "email", "whatsapp"],
      notification_severity: ["informational", "important", "urgent"],
      operator_status: [
        "applicant",
        "in_training",
        "certified",
        "placed",
        "on_bench",
        "inactive",
      ],
      payment_attempt_status: [
        "requires_action",
        "processing",
        "succeeded",
        "failed",
        "refunded",
      ],
      payout_batch_status: ["draft", "approved", "executing", "completed"],
      payout_method: [
        "wise",
        "payoneer",
        "bank_transfer",
        "paypal",
        "crypto_usdc",
      ],
      payout_status: ["pending", "sent", "confirmed", "failed", "returned"],
      permission_effect: ["grant", "deny"],
      placement_status: ["draft", "active", "ended", "renewed"],
      quote_status: ["draft", "sent", "accepted", "declined"],
      report_mode: ["client_facing", "internal", "case_study_draft"],
      scope_kind: ["all_clients", "clients", "placements"],
      scope_verdict: ["in_scope", "out_of_scope"],
      section_kind: [
        "fixed",
        "narrative",
        "bound_metrics",
        "bound_table",
        "milestones",
        "evidence",
        "effort",
        "scope",
      ],
      snapshot_kind: ["baseline", "progress"],
      snapshot_trigger: ["automatic", "manual"],
      subscription_status: ["active", "past_due", "paused", "cancelled"],
      tax_doc_status: ["missing", "requested", "on_file", "expired"],
      user_role: [
        "owner",
        "admin",
        "manager",
        "operator",
        "contractor",
        "client",
      ],
    },
  },
} as const
