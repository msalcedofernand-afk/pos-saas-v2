export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      api_idempotency_keys: {
        Row: {
          created_at: string;
          id: string;
          idempotency_key: string;
          operation: string;
          organization_id: string;
          request_hash: string;
          response: Json | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idempotency_key: string;
          operation: string;
          organization_id: string;
          request_hash: string;
          response?: Json | null;
          status: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          operation?: string;
          organization_id?: string;
          request_hash?: string;
          response?: Json | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "api_idempotency_keys_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          auditable_id: string | null;
          auditable_type: string;
          created_at: string;
          id: string;
          ip: string | null;
          new_values: Json | null;
          old_values: Json | null;
          organization_id: string;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          auditable_id?: string | null;
          auditable_type: string;
          created_at?: string;
          id?: string;
          ip?: string | null;
          new_values?: Json | null;
          old_values?: Json | null;
          organization_id: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          auditable_id?: string | null;
          auditable_type?: string;
          created_at?: string;
          id?: string;
          ip?: string | null;
          new_values?: Json | null;
          old_values?: Json | null;
          organization_id?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_login_rate_limits: {
        Row: {
          blocked_until: string | null;
          failed_attempts: number;
          rate_key: string;
          updated_at: string;
          window_started_at: string;
        };
        Insert: {
          blocked_until?: string | null;
          failed_attempts?: number;
          rate_key: string;
          updated_at?: string;
          window_started_at?: string;
        };
        Update: {
          blocked_until?: string | null;
          failed_attempts?: number;
          rate_key?: string;
          updated_at?: string;
          window_started_at?: string;
        };
        Relationships: [];
      };
      cash_movements: {
        Row: {
          amount: number;
          created_at: string;
          description: string | null;
          id: string;
          organization_id: string;
          shift_id: string;
          type: Database["public"]["Enums"]["cash_movement_type"];
          user_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          organization_id: string;
          shift_id: string;
          type: Database["public"]["Enums"]["cash_movement_type"];
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          organization_id?: string;
          shift_id?: string;
          type?: Database["public"]["Enums"]["cash_movement_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cash_movements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_movements_shift_org_fkey";
            columns: ["shift_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "cash_movements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_categories_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          cost_per_unit: number;
          created_at: string;
          current_stock: number;
          id: string;
          inventory_category_id: string;
          minimum_stock: number;
          name: string;
          organization_id: string;
          supplier_id: string | null;
          unit: string;
          updated_at: string;
        };
        Insert: {
          cost_per_unit?: number;
          created_at?: string;
          current_stock?: number;
          id?: string;
          inventory_category_id: string;
          minimum_stock?: number;
          name: string;
          organization_id: string;
          supplier_id?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          cost_per_unit?: number;
          created_at?: string;
          current_stock?: number;
          id?: string;
          inventory_category_id?: string;
          minimum_stock?: number;
          name?: string;
          organization_id?: string;
          supplier_id?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_org_fkey";
            columns: ["inventory_category_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_categories";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_items_supplier_org_fkey";
            columns: ["supplier_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      kitchen_stations: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          organization_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          organization_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kitchen_stations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      order_discounts: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          order_id: string;
          organization_id: string;
          reason: string | null;
          type: Database["public"]["Enums"]["discount_type"];
          user_id: string;
          value: number;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          id?: string;
          order_id: string;
          organization_id: string;
          reason?: string | null;
          type: Database["public"]["Enums"]["discount_type"];
          user_id: string;
          value?: number;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          order_id?: string;
          organization_id?: string;
          reason?: string | null;
          type?: Database["public"]["Enums"]["discount_type"];
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_discounts_order_org_fkey";
            columns: ["order_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "order_discounts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_discounts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          order_id: string;
          organization_id: string;
          product_id: string;
          quantity: number;
          status: Database["public"]["Enums"]["order_item_status"];
          subtotal: number;
          unit_price: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          order_id: string;
          organization_id: string;
          product_id: string;
          quantity?: number;
          status?: Database["public"]["Enums"]["order_item_status"];
          subtotal?: number;
          unit_price?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          order_id?: string;
          organization_id?: string;
          product_id?: string;
          quantity?: number;
          status?: Database["public"]["Enums"]["order_item_status"];
          subtotal?: number;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_org_fkey";
            columns: ["order_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "order_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_org_fkey";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          discount_amount: number;
          guests: number;
          id: string;
          notes: string | null;
          organization_id: string;
          status: Database["public"]["Enums"]["order_status"];
          table_id: string | null;
          tax_amount: number;
          total_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          discount_amount?: number;
          guests?: number;
          id?: string;
          notes?: string | null;
          organization_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          table_id?: string | null;
          tax_amount?: number;
          total_amount?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          discount_amount?: number;
          guests?: number;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          table_id?: string | null;
          tax_amount?: number;
          total_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_table_org_fkey";
            columns: ["table_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "tables_restaurant";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          is_default: boolean;
          organization_id: string;
          role_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          is_default?: boolean;
          organization_id: string;
          role_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          is_default?: boolean;
          organization_id?: string;
          role_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          last_activity_at: string | null;
          name: string;
          owner_user_id: string | null;
          slug: string;
          status: string;
          suspended_at: string | null;
          suspended_by: string | null;
          suspension_reason: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_activity_at?: string | null;
          name: string;
          owner_user_id?: string | null;
          slug: string;
          status?: string;
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspension_reason?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          last_activity_at?: string | null;
          name?: string;
          owner_user_id?: string | null;
          slug?: string;
          status?: string;
          suspended_at?: string | null;
          suspended_by?: string | null;
          suspension_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organizations_suspended_by_fkey";
            columns: ["suspended_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_audit_logs: {
        Row: {
          action: string;
          auditable_id: string | null;
          auditable_type: string;
          created_at: string;
          id: string;
          new_values: Json | null;
          old_values: Json | null;
          actor_user_id: string;
        };
        Insert: {
          action: string;
          auditable_id?: string | null;
          auditable_type: string;
          created_at?: string;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          actor_user_id: string;
        };
        Update: {
          action?: string;
          auditable_id?: string | null;
          auditable_type?: string;
          created_at?: string;
          id?: string;
          new_values?: Json | null;
          old_values?: Json | null;
          actor_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_audit_logs_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_support_access_requests: {
        Row: {
          actor_user_id: string;
          created_at: string;
          duration_minutes: number;
          entered_at: string | null;
          expires_at: string;
          id: string;
          idempotency_key: string;
          mode: string;
          organization_id: string;
          reason: string;
          request_hash: string;
          requested_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
          revoke_reason: string | null;
          revoke_idempotency_key: string | null;
          revoke_request_hash: string | null;
          revoke_response: Json | null;
          response: Json | null;
          starts_at: string;
          status: string;
          updated_at: string;
          write_enabled_at: string | null;
          write_enabled_by: string | null;
          write_idempotency_key: string | null;
          write_request_hash: string | null;
          write_response: Json | null;
        };
        Insert: {
          actor_user_id: string;
          created_at?: string;
          duration_minutes: number;
          entered_at?: string | null;
          expires_at: string;
          id?: string;
          idempotency_key: string;
          mode?: string;
          organization_id: string;
          reason: string;
          request_hash: string;
          requested_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
          revoke_idempotency_key?: string | null;
          revoke_request_hash?: string | null;
          revoke_response?: Json | null;
          response?: Json | null;
          starts_at?: string;
          status?: string;
          updated_at?: string;
          write_enabled_at?: string | null;
          write_enabled_by?: string | null;
          write_idempotency_key?: string | null;
          write_request_hash?: string | null;
          write_response?: Json | null;
        };
        Update: {
          actor_user_id?: string;
          created_at?: string;
          duration_minutes?: number;
          entered_at?: string | null;
          expires_at?: string;
          id?: string;
          idempotency_key?: string;
          mode?: string;
          organization_id?: string;
          reason?: string;
          request_hash?: string;
          requested_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
          revoke_idempotency_key?: string | null;
          revoke_request_hash?: string | null;
          revoke_response?: Json | null;
          response?: Json | null;
          starts_at?: string;
          status?: string;
          updated_at?: string;
          write_enabled_at?: string | null;
          write_enabled_by?: string | null;
          write_idempotency_key?: string | null;
          write_request_hash?: string | null;
          write_response?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_support_access_requests_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_support_access_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_operation_errors: {
        Row: {
          actor_user_id: string | null;
          details: Json;
          id: string;
          message: string;
          occurred_at: string;
          operation: string;
          organization_id: string | null;
          severity: string;
          source: string;
        };
        Insert: {
          actor_user_id?: string | null;
          details?: Json;
          id?: string;
          message: string;
          occurred_at?: string;
          operation: string;
          organization_id?: string | null;
          severity?: string;
          source: string;
        };
        Update: {
          actor_user_id?: string | null;
          details?: Json;
          id?: string;
          message?: string;
          occurred_at?: string;
          operation?: string;
          organization_id?: string | null;
          severity?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_operation_errors_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_operation_errors_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_organization_action_requests: {
        Row: {
          action: string;
          actor_user_id: string;
          created_at: string;
          idempotency_key: string;
          organization_id: string;
          request_hash: string;
          response: Json | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          action: string;
          actor_user_id: string;
          created_at?: string;
          idempotency_key: string;
          organization_id: string;
          request_hash: string;
          response?: Json | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string;
          created_at?: string;
          idempotency_key?: string;
          organization_id?: string;
          request_hash?: string;
          response?: Json | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_organization_action_requests_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_organization_action_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_provisioning_requests: {
        Row: {
          actor_user_id: string;
          created_at: string;
          idempotency_key: string;
          organization_id: string | null;
          request_hash: string;
          response: Json | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          actor_user_id: string;
          created_at?: string;
          idempotency_key: string;
          organization_id?: string | null;
          request_hash: string;
          response?: Json | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          actor_user_id?: string;
          created_at?: string;
          idempotency_key?: string;
          organization_id?: string | null;
          request_hash?: string;
          response?: Json | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_provisioning_requests_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_provisioning_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      passkeys: {
        Row: {
          backed_up: boolean;
          counter: number;
          created_at: string | null;
          credential_id: string;
          device_type: string;
          id: string;
          last_used: string | null;
          public_key: string;
          transports: string[] | null;
          user_id: string | null;
        };
        Insert: {
          backed_up: boolean;
          counter: number;
          created_at?: string | null;
          credential_id: string;
          device_type: string;
          id?: string;
          last_used?: string | null;
          public_key: string;
          transports?: string[] | null;
          user_id?: string | null;
        };
        Update: {
          backed_up?: boolean;
          counter?: number;
          created_at?: string | null;
          credential_id?: string;
          device_type?: string;
          id?: string;
          last_used?: string | null;
          public_key?: string;
          transports?: string[] | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          change_amount: number;
          created_at: string;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          organization_id: string;
          reference: string | null;
          shift_id: string | null;
          user_id: string;
        };
        Insert: {
          amount?: number;
          change_amount?: number;
          created_at?: string;
          id?: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          organization_id: string;
          reference?: string | null;
          shift_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          change_amount?: number;
          created_at?: string;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          order_id?: string;
          organization_id?: string;
          reference?: string | null;
          shift_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_org_fkey";
            columns: ["order_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "payments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_shift_org_fkey";
            columns: ["shift_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_available: boolean;
          name: string;
          organization_id: string;
          prep_time_minutes: number;
          price: number;
          updated_at: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          name: string;
          organization_id: string;
          prep_time_minutes?: number;
          price?: number;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          name?: string;
          organization_id?: string;
          prep_time_minutes?: number;
          price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_org_fkey";
            columns: ["category_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_items: {
        Row: {
          created_at: string;
          id: string;
          inventory_item_id: string;
          organization_id: string;
          purchase_order_id: string;
          quantity: number;
          total_cost: number;
          unit_cost: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          inventory_item_id: string;
          organization_id: string;
          purchase_order_id: string;
          quantity?: number;
          total_cost?: number;
          unit_cost?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          inventory_item_id?: string;
          organization_id?: string;
          purchase_order_id?: string;
          quantity?: number;
          total_cost?: number;
          unit_cost?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_item_org_fkey";
            columns: ["inventory_item_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "purchase_order_items_order_org_fkey";
            columns: ["purchase_order_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "purchase_order_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          organization_id: string;
          status: Database["public"]["Enums"]["purchase_order_status"];
          supplier_id: string;
          total_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          organization_id: string;
          status?: Database["public"]["Enums"]["purchase_order_status"];
          supplier_id: string;
          total_amount?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          status?: Database["public"]["Enums"]["purchase_order_status"];
          supplier_id?: string;
          total_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_org_fkey";
            columns: ["supplier_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "purchase_orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      refunds: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          order_id: string;
          organization_id: string;
          payment_id: string;
          reason: string;
          status: Database["public"]["Enums"]["refund_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          id?: string;
          order_id: string;
          organization_id: string;
          payment_id: string;
          reason: string;
          status?: Database["public"]["Enums"]["refund_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          order_id?: string;
          organization_id?: string;
          payment_id?: string;
          reason?: string;
          status?: Database["public"]["Enums"]["refund_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_order_org_fkey";
            columns: ["order_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "refunds_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_payment_org_fkey";
            columns: ["payment_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "refunds_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          organization_id: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          organization_id: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          organization_id?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: {
          closed_at: string | null;
          closing_amount: number | null;
          created_at: string;
          id: string;
          opened_at: string;
          opening_amount: number;
          organization_id: string;
          status: Database["public"]["Enums"]["shift_status"];
          user_id: string;
        };
        Insert: {
          closed_at?: string | null;
          closing_amount?: number | null;
          created_at?: string;
          id?: string;
          opened_at?: string;
          opening_amount?: number;
          organization_id: string;
          status?: Database["public"]["Enums"]["shift_status"];
          user_id: string;
        };
        Update: {
          closed_at?: string | null;
          closing_amount?: number | null;
          created_at?: string;
          id?: string;
          opened_at?: string;
          opening_amount?: number;
          organization_id?: string;
          status?: Database["public"]["Enums"]["shift_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shifts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          inventory_item_id: string;
          organization_id: string;
          quantity: number;
          reference_id: string | null;
          reference_type: string | null;
          type: Database["public"]["Enums"]["stock_movement_type"];
          unit_cost: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          inventory_item_id: string;
          organization_id: string;
          quantity?: number;
          reference_id?: string | null;
          reference_type?: string | null;
          type: Database["public"]["Enums"]["stock_movement_type"];
          unit_cost?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          inventory_item_id?: string;
          organization_id?: string;
          quantity?: number;
          reference_id?: string | null;
          reference_type?: string | null;
          type?: Database["public"]["Enums"]["stock_movement_type"];
          unit_cost?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_org_fkey";
            columns: ["inventory_item_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          organization_id: string;
          phone: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          phone?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      tables_restaurant: {
        Row: {
          capacity: number;
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          position_x: number | null;
          position_y: number | null;
          status: Database["public"]["Enums"]["table_status"];
        };
        Insert: {
          capacity?: number;
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          position_x?: number | null;
          position_y?: number | null;
          status?: Database["public"]["Enums"]["table_status"];
        };
        Update: {
          capacity?: number;
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          position_x?: number | null;
          position_y?: number | null;
          status?: Database["public"]["Enums"]["table_status"];
        };
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          role_id: string;
          user_id: string;
        };
        Insert: {
          role_id: string;
          user_id: string;
        };
        Update: {
          role_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_security: {
        Row: {
          failed_login_attempts: number;
          is_locked: boolean;
          last_failed_login_at: string | null;
          last_failed_login_ip: string | null;
          locked_at: string | null;
          locked_until: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          failed_login_attempts?: number;
          is_locked?: boolean;
          last_failed_login_at?: string | null;
          last_failed_login_ip?: string | null;
          locked_at?: string | null;
          locked_until?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          failed_login_attempts?: number;
          is_locked?: boolean;
          last_failed_login_at?: string | null;
          last_failed_login_ip?: string | null;
          locked_at?: string | null;
          locked_until?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          is_blocked: boolean;
          name: string | null;
          password_hash: string | null;
          theme: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          is_blocked?: boolean;
          name?: string | null;
          password_hash?: string | null;
          theme?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          is_blocked?: boolean;
          name?: string | null;
          password_hash?: string | null;
          theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_billing_events: {
        Row: {
          id: string;
          provider: string;
          external_event_id: string;
          event_type: string;
          organization_id: string | null;
          payload: Json;
          status: string;
          received_at: string;
          processed_at: string | null;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          provider?: string;
          external_event_id: string;
          event_type: string;
          organization_id?: string | null;
          payload?: Json;
          status?: string;
          received_at?: string;
          processed_at?: string | null;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          provider?: string;
          external_event_id?: string;
          event_type?: string;
          organization_id?: string | null;
          payload?: Json;
          status?: string;
          received_at?: string;
          processed_at?: string | null;
          error_message?: string | null;
        };
        Relationships: [];
      };
      platform_incidents: {
        Row: {
          id: string;
          organization_id: string | null;
          opened_by: string;
          title: string;
          summary: string;
          severity: string;
          status: string;
          started_at: string;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          opened_by: string;
          title: string;
          summary: string;
          severity?: string;
          status?: string;
          started_at?: string;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          opened_by?: string;
          title?: string;
          summary?: string;
          severity?: string;
          status?: string;
          started_at?: string;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_ticket_comments: {
        Row: {
          id: string;
          ticket_id: string;
          author_user_id: string;
          body: string;
          internal: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          author_user_id: string;
          body: string;
          internal?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          author_user_id?: string;
          body?: string;
          internal?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_tickets: {
        Row: {
          id: string;
          organization_id: string | null;
          requester_user_id: string;
          assigned_user_id: string | null;
          subject: string;
          description: string;
          priority: string;
          status: string;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          requester_user_id: string;
          assigned_user_id?: string | null;
          subject: string;
          description: string;
          priority?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          requester_user_id?: string;
          assigned_user_id?: string | null;
          subject?: string;
          description?: string;
          priority?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      process_platform_billing_event: {
        Args: {
          p_event_type: string;
          p_external_event_id: string;
          p_organization_id: string | null;
          p_payload: Json;
          p_provider: string;
        };
        Returns: Json;
      };
      create_platform_support_access: {
        Args: {
          p_actor_user_id: string;
          p_duration_minutes: number;
          p_idempotency_key: string;
          p_organization_id: string;
          p_reason: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      apply_platform_organization_action: {
        Args: {
          p_action: string;
          p_actor_user_id: string;
          p_idempotency_key: string;
          p_name?: string | null;
          p_organization_id: string;
          p_reason?: string | null;
          p_request_hash: string;
        };
        Returns: Json;
      };
      check_login_rate_limit: {
        Args: {
          p_lock_seconds?: number;
          p_max_attempts?: number;
          p_rate_key: string;
          p_window_seconds?: number;
        };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
        }[];
      };
      check_user_login_lock: {
        Args: { p_user_id: string };
        Returns: {
          locked: boolean;
          retry_after_seconds: number;
        }[];
      };
      close_cash_shift: {
        Args: {
          p_closing_amount: number;
          p_difference_reason?: string;
          p_user_id: string;
        };
        Returns: {
          closed_at: string;
          closing_amount: number;
          difference: number;
          difference_reason: string;
          expected_amount: number;
          id: string;
          status: Database["public"]["Enums"]["shift_status"];
        }[];
      };
      close_cash_shift_idempotent: {
        Args: {
          p_closing_amount: number;
          p_difference_reason: string;
          p_idempotency_key: string;
          p_request_hash: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      create_order_transaction: {
        Args: {
          p_guests: number;
          p_items: Json;
          p_notes: string;
          p_organization_id: string;
          p_table_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      create_order_transaction_idempotent: {
        Args: {
          p_guests: number;
          p_idempotency_key: string;
          p_items: Json;
          p_notes: string;
          p_organization_id: string;
          p_request_hash: string;
          p_table_id: string | null;
          p_user_id: string;
        };
        Returns: Json;
      };
      get_report_summary: {
        Args: { p_end: string; p_organization_id: string; p_start: string };
        Returns: Json;
      };
      get_dashboard_metrics: {
        Args: { p_end: string; p_organization_id: string; p_start: string };
        Returns: Json;
      };
      get_platform_operational_metrics: {
        Args: {
          p_actor_user_id: string;
          p_organization_id?: string | null;
          p_since?: string;
          p_until?: string | null;
        };
        Returns: Json;
      };
      get_kitchen_summary: {
        Args: { p_end: string; p_organization_id: string; p_start: string };
        Returns: Json;
      };
      get_user_roles: { Args: never; Returns: string[] };
      has_role: { Args: { role_name: string }; Returns: boolean };
      enable_platform_support_write: {
        Args: {
          p_access_id: string;
          p_actor_user_id: string;
          p_confirmation: string;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      expire_platform_support_access_sessions: { Args: never; Returns: number };
      mark_platform_support_access_entered: {
        Args: { p_access_id: string; p_actor_user_id: string; p_organization_id: string };
        Returns: boolean;
      };
      revoke_platform_support_access: {
        Args: {
          p_access_id: string;
          p_actor_user_id: string;
          p_idempotency_key: string;
          p_reason: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      open_cash_shift_idempotent: {
        Args: {
          p_idempotency_key: string;
          p_opening_amount: number;
          p_request_hash: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      record_login_failure: {
        Args: {
          p_lock_seconds?: number;
          p_max_attempts?: number;
          p_rate_key: string;
          p_window_seconds?: number;
        };
        Returns: {
          blocked: boolean;
          retry_after_seconds: number;
        }[];
      };
      record_user_login_failure: {
        Args: {
          p_ip?: string;
          p_lock_seconds?: number;
          p_max_attempts?: number;
          p_user_id: string;
        };
        Returns: {
          blocked: boolean;
          retry_after_seconds: number;
        }[];
      };
      register_inventory_movement: {
        Args: {
          p_description: string;
          p_inventory_item_id: string;
          p_quantity: number;
          p_type: Database["public"]["Enums"]["stock_movement_type"];
          p_unit_cost: number;
          p_user_id: string;
        };
        Returns: {
          current_stock: number;
          id: string;
          minimum_stock: number;
          name: string;
          unit: string;
        }[];
      };
      register_payment_transaction: {
        Args: {
          p_amount: number;
          p_method: Database["public"]["Enums"]["payment_method"];
          p_order_id: string;
          p_received_amount: number;
          p_reference: string;
          p_user_id: string;
        };
        Returns: {
          amount: number;
          change_amount: number;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          order_status: Database["public"]["Enums"]["order_status"];
          payment_id: string;
          remaining: number;
          total_paid: number;
        }[];
      };
      register_payment_transaction_idempotent: {
        Args: {
          p_amount: number;
          p_idempotency_key: string;
          p_method: Database["public"]["Enums"]["payment_method"];
          p_order_id: string;
          p_received_amount: number;
          p_reference: string;
          p_request_hash: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      reset_login_rate_limit: {
        Args: { p_rate_key: string };
        Returns: undefined;
      };
      reset_user_login_security: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      transition_kitchen_order_transaction: {
        Args: {
          p_order_id: string;
          p_reason?: string;
          p_status: Database["public"]["Enums"]["order_status"];
          p_user_id: string;
        };
        Returns: {
          id: string;
          notes: string;
          status: Database["public"]["Enums"]["order_status"];
          updated_at: string;
        }[];
      };
      transition_order_status_transaction: {
        Args: {
          p_order_id: string;
          p_reason?: string;
          p_status: Database["public"]["Enums"]["order_status"];
          p_user_id: string;
        };
        Returns: {
          id: string;
          status: Database["public"]["Enums"]["order_status"];
          table_id: string;
          updated_at: string;
        }[];
      };
      update_organization_member_roles_transaction: {
        Args: {
          p_actor_user_id: string;
          p_organization_id: string;
          p_role_ids: string[];
          p_target_user_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      cash_movement_type: "sale" | "refund" | "withdrawal" | "deposit" | "adjustment";
      discount_type: "percentage" | "fixed";
      order_item_status: "pending" | "preparing" | "ready" | "served" | "cancelled";
      order_status: "pending" | "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled";
      payment_method: "cash" | "card" | "yape" | "plin" | "transfer" | "qr";
      purchase_order_status: "draft" | "ordered" | "received" | "cancelled";
      refund_status: "pending" | "approved" | "rejected";
      shift_status: "open" | "closed";
      stock_movement_type: "in" | "out" | "adjustment";
      table_status: "available" | "occupied" | "reserved";
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
    Enums: {
      cash_movement_type: ["sale", "refund", "withdrawal", "deposit", "adjustment"],
      discount_type: ["percentage", "fixed"],
      order_item_status: ["pending", "preparing", "ready", "served", "cancelled"],
      order_status: ["pending", "confirmed", "preparing", "ready", "served", "paid", "cancelled"],
      payment_method: ["cash", "card", "yape", "plin", "transfer", "qr"],
      purchase_order_status: ["draft", "ordered", "received", "cancelled"],
      refund_status: ["pending", "approved", "rejected"],
      shift_status: ["open", "closed"],
      stock_movement_type: ["in", "out", "adjustment"],
      table_status: ["available", "occupied", "reserved"],
    },
  },
} as const;
