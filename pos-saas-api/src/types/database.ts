export type Database = {
  public: {
    Tables: {
      roles: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          password_hash: string | null;
          is_blocked: boolean;
          theme: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          password_hash?: string | null;
          is_blocked?: boolean;
          theme?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          password_hash?: string | null;
          is_blocked?: boolean;
          theme?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
        };
        Update: {
          user_id?: string;
          role_id?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          price: number;
          description: string | null;
          image_url: string | null;
          is_available: boolean;
          prep_time_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          price?: number;
          description?: string | null;
          image_url?: string | null;
          is_available?: boolean;
          prep_time_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          price?: number;
          description?: string | null;
          image_url?: string | null;
          is_available?: boolean;
          prep_time_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      tables_restaurant: {
        Row: {
          id: string;
          name: string;
          capacity: number;
          status: Database["public"]["Enums"]["table_status"];
          position_x: number | null;
          position_y: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          capacity?: number;
          status?: Database["public"]["Enums"]["table_status"];
          position_x?: number | null;
          position_y?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          capacity?: number;
          status?: Database["public"]["Enums"]["table_status"];
          position_x?: number | null;
          position_y?: number | null;
          created_at?: string;
        };
      };
      shifts: {
        Row: {
          id: string;
          user_id: string;
          opened_at: string;
          closed_at: string | null;
          opening_amount: number;
          closing_amount: number | null;
          status: Database["public"]["Enums"]["shift_status"];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          opened_at?: string;
          closed_at?: string | null;
          opening_amount?: number;
          closing_amount?: number | null;
          status?: Database["public"]["Enums"]["shift_status"];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          opened_at?: string;
          closed_at?: string | null;
          opening_amount?: number;
          closing_amount?: number | null;
          status?: Database["public"]["Enums"]["shift_status"];
          created_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          table_id: string | null;
          user_id: string;
          status: Database["public"]["Enums"]["order_status"];
          total_amount: number;
          tax_amount: number;
          discount_amount: number;
          notes: string | null;
          guests: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          table_id?: string | null;
          user_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          total_amount?: number;
          tax_amount?: number;
          discount_amount?: number;
          notes?: string | null;
          guests?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          table_id?: string | null;
          user_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          total_amount?: number;
          tax_amount?: number;
          discount_amount?: number;
          notes?: string | null;
          guests?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
          status: Database["public"]["Enums"]["order_item_status"];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          status?: Database["public"]["Enums"]["order_item_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          status?: Database["public"]["Enums"]["order_item_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          amount: number;
          change_amount: number;
          shift_id: string | null;
          reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          amount?: number;
          change_amount?: number;
          shift_id?: string | null;
          reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          user_id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          amount?: number;
          change_amount?: number;
          shift_id?: string | null;
          reference?: string | null;
          created_at?: string;
        };
      };
      cash_movements: {
        Row: {
          id: string;
          shift_id: string;
          type: Database["public"]["Enums"]["cash_movement_type"];
          amount: number;
          description: string | null;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          type: Database["public"]["Enums"]["cash_movement_type"];
          amount?: number;
          description?: string | null;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          type?: Database["public"]["Enums"]["cash_movement_type"];
          amount?: number;
          description?: string | null;
          user_id?: string;
          created_at?: string;
        };
      };
      order_discounts: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          type: Database["public"]["Enums"]["discount_type"];
          value: number;
          amount: number;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          type: Database["public"]["Enums"]["discount_type"];
          value?: number;
          amount?: number;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          user_id?: string;
          type?: Database["public"]["Enums"]["discount_type"];
          value?: number;
          amount?: number;
          reason?: string | null;
          created_at?: string;
        };
      };
      refunds: {
        Row: {
          id: string;
          order_id: string;
          payment_id: string;
          user_id: string;
          amount: number;
          reason: string;
          status: Database["public"]["Enums"]["refund_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          payment_id: string;
          user_id: string;
          amount?: number;
          reason: string;
          status?: Database["public"]["Enums"]["refund_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          payment_id?: string;
          user_id?: string;
          amount?: number;
          reason?: string;
          status?: Database["public"]["Enums"]["refund_status"];
          created_at?: string;
          updated_at?: string;
        };
      };
      kitchen_stations: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      inventory_categories: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          created_at?: string;
        };
      };
      inventory_items: {
        Row: {
          id: string;
          inventory_category_id: string;
          name: string;
          unit: string;
          current_stock: number;
          minimum_stock: number;
          cost_per_unit: number;
          supplier_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          inventory_category_id: string;
          name: string;
          unit?: string;
          current_stock?: number;
          minimum_stock?: number;
          cost_per_unit?: number;
          supplier_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          inventory_category_id?: string;
          name?: string;
          unit?: string;
          current_stock?: number;
          minimum_stock?: number;
          cost_per_unit?: number;
          supplier_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      purchase_orders: {
        Row: {
          id: string;
          supplier_id: string;
          user_id: string;
          status: Database["public"]["Enums"]["purchase_order_status"];
          total_amount: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          user_id: string;
          status?: Database["public"]["Enums"]["purchase_order_status"];
          total_amount?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          user_id?: string;
          status?: Database["public"]["Enums"]["purchase_order_status"];
          total_amount?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          inventory_item_id: string;
          quantity: number;
          unit_cost: number;
          total_cost: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          inventory_item_id: string;
          quantity?: number;
          unit_cost?: number;
          total_cost?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          inventory_item_id?: string;
          quantity?: number;
          unit_cost?: number;
          total_cost?: number;
          created_at?: string;
        };
      };
      stock_movements: {
        Row: {
          id: string;
          inventory_item_id: string;
          type: Database["public"]["Enums"]["stock_movement_type"];
          quantity: number;
          unit_cost: number;
          description: string | null;
          user_id: string;
          reference_type: string | null;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inventory_item_id: string;
          type: Database["public"]["Enums"]["stock_movement_type"];
          quantity?: number;
          unit_cost?: number;
          description?: string | null;
          user_id: string;
          reference_type?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          inventory_item_id?: string;
          type?: Database["public"]["Enums"]["stock_movement_type"];
          quantity?: number;
          unit_cost?: number;
          description?: string | null;
          user_id?: string;
          reference_type?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          auditable_type: string;
          auditable_id: string | null;
          old_values: Record<string, unknown> | null;
          new_values: Record<string, unknown> | null;
          ip: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          auditable_type: string;
          auditable_id?: string | null;
          old_values?: Record<string, unknown> | null;
          new_values?: Record<string, unknown> | null;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          auditable_type?: string;
          auditable_id?: string | null;
          old_values?: Record<string, unknown> | null;
          new_values?: Record<string, unknown> | null;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
    Enums: {
      table_status: "available" | "occupied" | "reserved";
      shift_status: "open" | "closed";
      order_status: "pending" | "confirmed" | "preparing" | "ready" | "served" | "paid" | "cancelled";
      order_item_status: "pending" | "preparing" | "ready" | "served" | "cancelled";
      payment_method: "cash" | "card" | "yape" | "plin" | "transfer" | "qr";
      cash_movement_type: "sale" | "refund" | "withdrawal" | "deposit" | "adjustment";
      discount_type: "percentage" | "fixed";
      refund_status: "pending" | "approved" | "rejected";
      purchase_order_status: "draft" | "ordered" | "received" | "cancelled";
      stock_movement_type: "in" | "out" | "adjustment";
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
