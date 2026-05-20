-- Avatar Data Cleanup Script for HappiWalk
-- Run this in Supabase SQL Editor to fix existing profile_photo_url values

-- Step 1: See current state of data
SELECT 
  CASE 
    WHEN profile_photo_url IS NULL THEN 'NULL'
    WHEN profile_photo_url LIKE 'http%' THEN 'FULL_URL'
    WHEN profile_photo_url LIKE 'avatars/%' THEN 'WITH_PREFIX'
    ELSE 'FILENAME_ONLY'
  END as format,
  COUNT(*) as count
FROM user_profiles 
WHERE profile_photo_url IS NOT NULL
GROUP BY 
  CASE 
    WHEN profile_photo_url IS NULL THEN 'NULL'
    WHEN profile_photo_url LIKE 'http%' THEN 'FULL_URL'
    WHEN profile_photo_url LIKE 'avatars/%' THEN 'WITH_PREFIX'
    ELSE 'FILENAME_ONLY'
  END;

-- Step 2: Fix entries that are just filenames (no http, no avatars/ prefix)
-- These need avatars/ prefix added
UPDATE user_profiles 
SET profile_photo_url = 'avatars/' || profile_photo_url
WHERE profile_photo_url IS NOT NULL 
AND profile_photo_url NOT LIKE 'http%' 
AND profile_photo_url NOT LIKE 'avatars/%';

-- Step 3: Fix entries that have double prefix (avatars/avatars/)
UPDATE user_profiles 
SET profile_photo_url = REPLACE(profile_photo_url, 'avatars/avatars/', 'avatars/')
WHERE profile_photo_url LIKE 'avatars/avatars/%';

-- Step 4: Verify all entries are now in correct format
SELECT 
  CASE 
    WHEN profile_photo_url IS NULL THEN 'NULL'
    WHEN profile_photo_url LIKE 'http%' THEN 'FULL_URL'
    WHEN profile_photo_url LIKE 'avatars/%' THEN 'WITH_PREFIX'
    ELSE 'FILENAME_ONLY'
  END as format,
  COUNT(*) as count
FROM user_profiles 
WHERE profile_photo_url IS NOT NULL
GROUP BY 
  CASE 
    WHEN profile_photo_url IS NULL THEN 'NULL'
    WHEN profile_photo_url LIKE 'http%' THEN 'FULL_URL'
    WHEN profile_photo_url LIKE 'avatars/%' THEN 'WITH_PREFIX'
    ELSE 'FILENAME_ONLY'
  END;

-- Note: After running this script, the getPublicAvatarUrl function in the app
-- will handle converting 'avatars/xxx.jpg' to full public URLs automatically
