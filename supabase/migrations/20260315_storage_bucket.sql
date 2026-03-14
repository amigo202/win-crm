-- Create invoices storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  true,
  52428800,  -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'invoices_upload') THEN
    CREATE POLICY "invoices_upload" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'invoices_read') THEN
    CREATE POLICY "invoices_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'invoices_public_read') THEN
    CREATE POLICY "invoices_public_read" ON storage.objects
      FOR SELECT TO anon
      USING (bucket_id = 'invoices');
  END IF;
END $$;
