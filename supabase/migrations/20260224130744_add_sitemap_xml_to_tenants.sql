-- Migration: add_sitemap_xml_to_tenants
-- Description: Adds sitemap_xml column to the tenants table

ALTER TABLE public.tenants
ADD COLUMN sitemap_xml text;
