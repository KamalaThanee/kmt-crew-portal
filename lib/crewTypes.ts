export type CrewMember = {
  id?: string
  full_name?: string
  position?: string
  is_active?: boolean | null
  resigned_at?: string | null
  resigned_by?: string | null
  registered?: boolean | null
  suit_color?: string | null
  suit_size?: string | null
  boot_size?: string | null
  [key: string]: unknown
}
