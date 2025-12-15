-- Remove duplicate contacts, keeping the most recent one
DELETE FROM contacts a
WHERE EXISTS (
  SELECT 1 FROM contacts b
  WHERE a.user_id = b.user_id
    AND a.phone = b.phone
    AND a.created_at < b.created_at
);

-- Also remove exact duplicates (same created_at) keeping lowest id
DELETE FROM contacts a
WHERE EXISTS (
  SELECT 1 FROM contacts b
  WHERE a.user_id = b.user_id
    AND a.phone = b.phone
    AND a.created_at = b.created_at
    AND a.id > b.id
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_contacts_user_phone_unique ON contacts(user_id, phone);