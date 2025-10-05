-- Enable RLS on services table
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for services table
CREATE POLICY "Anyone can view available services"
  ON public.services
  FOR SELECT
  USING (availability_status = 'available');

CREATE POLICY "Providers can view their own services"
  ON public.services
  FOR SELECT
  USING (auth.uid() = provider_id);

CREATE POLICY "Providers can insert their own services"
  ON public.services
  FOR INSERT
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Providers can update their own services"
  ON public.services
  FOR UPDATE
  USING (auth.uid() = provider_id);

CREATE POLICY "Providers can delete their own services"
  ON public.services
  FOR DELETE
  USING (auth.uid() = provider_id);