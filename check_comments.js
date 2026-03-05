import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://coymhtpjshntpexcfzjh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveW1odHBqc2hudHBleGNmempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgxNjAsImV4cCI6MjA4NTU4NDE2MH0.jLgaa4vn6Str6c8Gp1Oe8joZq7XjVXEQFdE8DXJTXQ4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkComments() {
    console.log("Fetching comments...");
    const { data, error } = await supabase
        .from('social_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching comments:", error);
    } else {
        console.log("Comments:", JSON.stringify(data, null, 2));
    }
}

checkComments();
