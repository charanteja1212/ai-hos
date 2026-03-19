ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_config jsonb DEFAULT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_config jsonb DEFAULT NULL;
