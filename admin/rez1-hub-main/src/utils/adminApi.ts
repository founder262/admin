import { supabase } from "@/lib/supabase";

export const adminApi = {
  fetch: async (table: string, query: string = "*", id?: string, filters?: { column: string, value: any }[]) => {
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action: 'SELECT', table, query, id, filters }
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error?.message || "Fetch failed");
    return data.data;
  },

  update: async (table: string, id: string, payload: any) => {
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action: 'UPDATE', table, id, data: payload }
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error?.message || "Update failed");
    return data.data;
  },

  insert: async (table: string, payload: any) => {
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action: 'INSERT', table, data: payload }
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error?.message || "Insert failed");
    return data.data;
  },

  delete: async (table: string, id: string) => {
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action: 'DELETE', table, id }
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error?.message || "Delete failed");
    return data.data;
  },

  analytics: async () => {
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action: 'ANALYTICS' }
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error?.message || "Analytics fetch failed");
    return data.data;
  },

  syncLocationCount: async (locationId: string) => {
    if (!locationId) return;
    try {
      const { data: salonsData, error: salonsErr } = await supabase
        .from("salons")
        .select("id")
        .eq("location_id", locationId)
        .eq("is_approved", true)
        .eq("is_suspended", false)
        .eq("is_visible", true);
      
      if (salonsErr) throw salonsErr;
      const count = salonsData ? salonsData.length : 0;

      const { data, error } = await supabase.functions.invoke('admin-api', {
        body: {
          action: 'UPDATE',
          table: 'locations',
          id: locationId,
          data: { salons_count: count }
        }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error?.message || "Sync failed");
      return data.data;
    } catch (err) {
      console.error(`Failed to sync salons_count for location ${locationId}:`, err);
    }
  }
};
