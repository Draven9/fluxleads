import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      created_at,
      profiles:profiles(count),
      contacts:contacts(count),
      deals:deals(count)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('SUPABASE ERROR:', JSON.stringify(error, null, 2));
    process.exit(1);
  } else {
    console.log('SUCCESS');
  }
}

run();
