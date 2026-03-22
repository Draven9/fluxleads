import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
    // Usamos a chave de admin para burlar RLS e podermos ver o que realmente está no banco
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

    if (!url || !key) {
        return NextResponse.json({ error: 'Supabase URL or Key is missing from environment variables' }, { status: 500 });
    }

    const supabaseAdmin = createClient(url, key);

    const { data, error } = await supabaseAdmin
        .from('social_comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comments: data });
}
