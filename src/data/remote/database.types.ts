
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "categories": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_prices": {
                  Row: {
                    "created_at": string,"id": string,"min_quantity": number,"package_price": number,"package_quantity": number,"price_list": string,"product_id": string,"product_uom_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"min_quantity": number,"package_price": number,"package_quantity": number,"price_list"?: string,"product_id": string,"product_uom_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"min_quantity"?: number,"package_price"?: number,"package_quantity"?: number,"price_list"?: string,"product_id"?: string,"product_uom_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_prices_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_prices_product_uom_id_product_id_fkey"
      columns: ["product_uom_id","product_id"]
isOneToOne: false
      referencedRelation: "product_uoms"
      referencedColumns: ["id","product_id"]
    }
                  ]
                },"product_purchase_prices": {
                  Row: {
                    "created_at": string,"id": string,"product_id": string,"product_uom_id": string,"purchase_price": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"product_id": string,"product_uom_id": string,"purchase_price": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"product_id"?: string,"product_uom_id"?: string,"purchase_price"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_purchase_prices_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_purchase_prices_product_uom_id_product_id_fkey"
      columns: ["product_uom_id","product_id"]
isOneToOne: false
      referencedRelation: "product_uoms"
      referencedColumns: ["id","product_id"]
    }
                  ]
                },"product_uoms": {
                  Row: {
                    "conversion_mode": "global" | "local","created_at": string,"id": string,"parent_product_uom_id": string | null,"product_id": string,"quantity_in_parent": number,"uom_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversion_mode"?: "global" | "local","created_at"?: string,"id"?: string,"parent_product_uom_id"?: string | null,"product_id": string,"quantity_in_parent": number,"uom_id": string,"updated_at"?: string
                  }
                  Update: {
                    "conversion_mode"?: "global" | "local","created_at"?: string,"id"?: string,"parent_product_uom_id"?: string | null,"product_id"?: string,"quantity_in_parent"?: number,"uom_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_uoms_parent_product_uom_id_product_id_fkey"
      columns: ["parent_product_uom_id","product_id"]
isOneToOne: false
      referencedRelation: "product_uoms"
      referencedColumns: ["id","product_id"]
    },{
      foreignKeyName: "product_uoms_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_uoms_uom_id_fkey"
      columns: ["uom_id"]
isOneToOne: false
      referencedRelation: "uoms"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "base_uom_id": string,"category_id": string | null,"created_at": string,"deleted_at": string | null,"description": string | null,"id": string,"is_active": boolean,"name": string,"price": number,"sku": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_uom_id": string,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"price"?: number,"sku"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "base_uom_id"?: string,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"price"?: number,"sku"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_base_uom_id_fkey"
      columns: ["base_uom_id"]
isOneToOne: false
      referencedRelation: "uoms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"uoms": {
                  Row: {
                    "created_at": string,"global_parent_uom_id": string | null,"global_quantity_in_parent": number | null,"id": string,"name": string,"symbol": string,"uom_type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"global_parent_uom_id"?: string | null,"global_quantity_in_parent"?: number | null,"id"?: string,"name": string,"symbol": string,"uom_type": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"global_parent_uom_id"?: string | null,"global_quantity_in_parent"?: number | null,"id"?: string,"name"?: string,"symbol"?: string,"uom_type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "uoms_global_parent_uom_id_fkey"
      columns: ["global_parent_uom_id"]
isOneToOne: false
      referencedRelation: "uoms"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "current_user_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"has_role":
{ Args: { "required_roles": (Database["public"]['Enums']["app_role"])[] }; Returns: boolean
                           },
"is_active_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "admin"|"manager"|"cashier"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["admin", "manager", "cashier"]
          }
        }
} as const
