import { supabase } from '@/lib/supabase-client'

export interface CompanySettings {
  id: string
  name: string
  mission: string | null
  vision: string | null
  goals: string[]
  updated_at: string
}

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', 'default')
    .single()
  if (error) {
    console.error('Error fetching company settings:', error)
    return null
  }
  return {
    ...data,
    goals: Array.isArray(data.goals) ? data.goals : [],
  } as CompanySettings
}

export async function updateCompanySettings(
  updates: Partial<Pick<CompanySettings, 'name' | 'mission' | 'vision' | 'goals'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('company_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'default')
  if (error) {
    console.error('Error updating company settings:', error)
    return false
  }
  return true
}
