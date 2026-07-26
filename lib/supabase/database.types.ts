// Generated from the Supabase schema. Do not edit by hand.
// Regenerate with the Supabase MCP generate_typescript_types tool or
// `supabase gen types typescript --project-id onobzewvjsicwxbsdlzw`.

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
            foreignKeyName: "decision_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
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
            foreignKeyName: "effort_entry_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
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
          thumbnail_url: string | null
          updated_at: string
          uploaded_at: string
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
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_at?: string
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
          thumbnail_url?: string | null
          updated_at?: string
          uploaded_at?: string
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
            foreignKeyName: "evidence_item_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
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
            foreignKeyName: "growth_report_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
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
            foreignKeyName: "milestone_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "scope_request_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
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
            foreignKeyName: "snapshot_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
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
          has_baseline: boolean | null
          headline_revenue_change_pct: number | null
          id: string | null
          install_started_at: string | null
          last_period_end: string | null
          last_snapshot_at: string | null
          milestone_count: number | null
          name: string | null
          out_of_scope_count: number | null
          slug: string | null
          snapshot_overdue: boolean | null
          status: Database["public"]["Enums"]["engagement_status"] | null
          vertical: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      annotate_snapshot: {
        Args: { p_body: string; p_snapshot_id: string }
        Returns: string
      }
      attach_report_to_drive: {
        Args: {
          p_drive_file_id: string
          p_drive_url: string
          p_report_id: string
        }
        Returns: undefined
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
        }
        SetofOptions: {
          from: "*"
          to: "growth_report"
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
      link_evidence: {
        Args: {
          p_effort_entry_id?: string
          p_evidence_id: string
          p_milestone_id?: string
          p_snapshot_id?: string
        }
        Returns: string
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
      quote_scope_request: {
        Args: {
          p_amount?: number
          p_proposed_on: string
          p_scope_request_id: string
          p_summary: string
        }
        Returns: string
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
      register_drive_folders: {
        Args: {
          p_case_file_id: string
          p_root_folder_id: string
          p_root_folder_url: string
          p_subfolders: Json
        }
        Returns: undefined
      }
      revoke_share_link: { Args: { p_link_id: string }; Returns: undefined }
      rollup_tracking: {
        Args: {
          p_case_file_id: string
          p_period_end: string
          p_period_start: string
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
    }
    Enums: {
      engagement_status: "audit" | "installing" | "active" | "paused" | "ended"
      evidence_category:
        | "evidence"
        | "deliverables"
        | "reports"
        | "client_provided"
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
      quote_status: "draft" | "sent" | "accepted" | "declined"
      report_mode: "client_facing" | "internal" | "case_study_draft"
      scope_verdict: "in_scope" | "out_of_scope"
      snapshot_kind: "baseline" | "progress"
      snapshot_trigger: "automatic" | "manual"
      user_role: "admin" | "operator"
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
      engagement_status: ["audit", "installing", "active", "paused", "ended"],
      evidence_category: [
        "evidence",
        "deliverables",
        "reports",
        "client_provided",
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
      quote_status: ["draft", "sent", "accepted", "declined"],
      report_mode: ["client_facing", "internal", "case_study_draft"],
      scope_verdict: ["in_scope", "out_of_scope"],
      snapshot_kind: ["baseline", "progress"],
      snapshot_trigger: ["automatic", "manual"],
      user_role: ["admin", "operator"],
    },
  },
} as const
