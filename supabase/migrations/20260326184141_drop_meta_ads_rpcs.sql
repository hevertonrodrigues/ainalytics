-- Drop the analytics RPC functions as logic has moved to edge functions
DROP FUNCTION IF EXISTS get_meta_ads_overview(DATE, DATE);
DROP FUNCTION IF EXISTS get_meta_ads_daily(DATE, DATE);
DROP FUNCTION IF EXISTS get_meta_ads_campaigns(DATE, DATE);
DROP FUNCTION IF EXISTS get_meta_ads_roi(DATE, DATE);
