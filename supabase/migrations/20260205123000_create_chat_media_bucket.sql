-- Create a new public bucket for chat media
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true);

-- Policy to allow any authenticated user to upload files
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'chat-media' );

-- Policy to allow public access to view/download (for Evolution API and frontend playback)
create policy "Allow public viewing"
on storage.objects for select
to public
using ( bucket_id = 'chat-media' );

-- Optional: Allow authenticated users to update/delete their own files (if needed later)
create policy "Allow owners to update their files"
on storage.objects for update
to authenticated
using ( bucket_id = 'chat-media' and auth.uid() = owner )
with check ( bucket_id = 'chat-media' and auth.uid() = owner );

create policy "Allow owners to delete their files"
on storage.objects for delete
to authenticated
using ( bucket_id = 'chat-media' and auth.uid() = owner );
