import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'owner'].includes(profile.role ?? '')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const body = await req.json();
    const orgId = body.orgId;

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Missing orgId' }), { status: 400 });
    }

    const adminClient = createStaticAdminClient();
    
    // Verify if the organization exists
    const { data: org } = await adminClient
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (!org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), { status: 404 });
    }

    // Update the profile's organization_id to perform the switch
    const { error } = await adminClient
      .from('profiles')
      .update({ organization_id: orgId })
      .eq('id', user.id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    console.error('IMPERSONATE ERROR:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
