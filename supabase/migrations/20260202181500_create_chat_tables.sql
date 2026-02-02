-- Migration: Create Chat Tables (chat_sessions, messages)

-- 1. CHAT SESSIONS (Conversas)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL, -- Logical tenant
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL, -- Optional linking to a deal
  
  provider TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'instagram', etc
  provider_id TEXT, -- remoteJid (e.g. 551199999999@s.whatsapp.net)
  
  last_message_at TIMESTAMPTZ DEFAULT now(),
  unread_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Sessions
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sessions in their org" ON public.chat_sessions
  FOR SELECT USING (organization_id = (auth.jwt() ->> 'organization_id'));

CREATE POLICY "Users can insert sessions in their org" ON public.chat_sessions
  FOR INSERT WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id'));

CREATE POLICY "Users can update sessions in their org" ON public.chat_sessions
  FOR UPDATE USING (organization_id = (auth.jwt() ->> 'organization_id'));

-- 2. MESSAGES (Mensagens)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL, -- Logical tenant
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  
  direction TEXT CHECK (direction IN ('inbound', 'outbound')), -- 'inbound' (client says), 'outbound' (we say)
  content TEXT,
  messsage_type TEXT DEFAULT 'text', -- 'text', 'image', 'audio', 'video', 'document'
  media_url TEXT,
  
  status TEXT DEFAULT 'sent', -- 'sending', 'sent', 'delivered', 'read', 'failed'
  external_id TEXT, -- ID no WhatsApp/Evolution
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their org" ON public.messages
  FOR SELECT USING (organization_id = (auth.jwt() ->> 'organization_id'));

CREATE POLICY "Users can insert messages in their org" ON public.messages
  FOR INSERT WITH CHECK (organization_id = (auth.jwt() ->> 'organization_id'));

CREATE POLICY "Users can update messages in their org" ON public.messages
  FOR UPDATE USING (organization_id = (auth.jwt() ->> 'organization_id'));

-- 3. REALTIME PUBLICATION
-- Enable Realtime for messages so UI updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;

-- 4. UTILITY FUNCTION (Update last_message_at on new message)
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_sessions
  SET 
    last_message_at = NEW.created_at,
    updated_at = now(),
    unread_count = CASE 
        WHEN NEW.direction = 'inbound' THEN unread_count + 1 
        ELSE unread_count 
    END
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();
