
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// const GROUP_PHONE = "120363405892277465@g.us"; 
const GROUP_PHONE_PARTIAL = "120363405892277465";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runDebug() {
    console.log("Searching for contacts with phone containing:", GROUP_PHONE_PARTIAL);

    const { data: contacts, error } = await supabase
        .from("contacts")
        .select("id, name, phone, source, organization_id, created_at")
        .ilike("phone", `%${GROUP_PHONE_PARTIAL}%`);

    if (error) {
        console.error("Error fetching contacts:", error);
        return;
    }

    console.log(`Found ${contacts.length} contacts:`);
    console.table(contacts);

    // Check chat sessions for these contacts
    for (const contact of contacts) {
        const { data: sessions } = await supabase
            .from("chat_sessions")
            .select("id, contact_id, last_message_at, organization_id")
            .eq("contact_id", contact.id);

        console.log(`Sessions for contact ${contact.id} (${contact.name}):`, sessions);
    }
}

runDebug();
