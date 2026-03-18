import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing organizations query...');
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
    console.error('QUERY ERROR:', JSON.stringify(error, null, 2));
  } else {
    console.log('SUCCESS!');
    console.log('Count of orgs:', data?.length);
    if (data && data.length > 0) {
      console.log('Sample Org:', JSON.stringify(data[0], null, 2));
    }
  }
}

run();
