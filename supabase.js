// supabase.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('SUPABASE_URL is required');
if (!supabaseKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

const supabase = createClient(supabaseUrl, supabaseKey);

export async function fetchSites() {
  const { data, error } = await supabase
    .from('Facilitairinfo')
    .select('sitekey, url, active, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchArticles(siteKey) {
  const { data, error } = await supabase
    .from('Articles')
    .select('id, title, url, published_at, summary, image, created_at')
    .eq('sitekey', siteKey)
    .order('published_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}
