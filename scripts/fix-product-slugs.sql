-- Fix missing slugs (MySQL 5.7+ safe)
-- This guarantees a unique slug even if title has special characters.
UPDATE products
SET slug = CONCAT('product-', id)
WHERE slug IS NULL OR slug = '';

-- Optional: create slug from title for rows that are still empty
-- (keeps Unicode, just replaces spaces with dashes)
UPDATE products
SET slug = LOWER(REPLACE(TRIM(title), ' ', '-'))
WHERE slug IS NULL OR slug = '';
