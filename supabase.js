// supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("❌ SUPABASE_URL is required");
if (!supabaseKey) throw new Error("❌ SUPABASE_SERVICE_ROLE_KEY is required");

export const supabase = createClient(supabaseUrl, supabaseKey);

//
// ---- Sites table ----
//
export async function getSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('id, created_at, siteKey, url, selectors, lastUpdated, label, active')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

//
// ---- Facilitairinfo table ----
//
export async function getFacilitairinfo(siteKey) {
  const { data, error } = await supabase
    .from('Facilitairinfo')
    .select('id, created_at, siteKey, url, selectors, active, lastUpdated, title, published_at, summary, image')
    .eq('siteKey', siteKey) // hoofdletter K in deze tabel
    .order('published_at', { ascending: false });

  if (error) throw error;
  return data;
}

//
// ---- Articles table ----
//
export async function getArticlesBySite(siteKey) {
  const { data, error } = await supabase
    .from('Articles')
    .select('id, sitekey, title, url, published_at, summary, image, created_at')
    .eq('sitekey', siteKey) // kleine letter k in deze tabel
    .order('published_at', { ascending: false });

  if (error) throw error;
  return data;
}