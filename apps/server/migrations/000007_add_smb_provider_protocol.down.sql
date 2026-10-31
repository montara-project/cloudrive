-- Remove the "smb" provider protocol again. SMB provider rows must go first;
-- the FK from storage_accounts restricts the delete while SMB accounts are
-- still connected, which is the intended safety net for a downgrade.
DELETE FROM "providers" WHERE "protocol" = 'smb';
ALTER TABLE "providers" DROP CONSTRAINT "providers_protocol_check";
ALTER TABLE "providers" ADD CONSTRAINT "providers_protocol_check"
    CHECK ("protocol" IN ('oauth2_cloud', 's3_compatible', 'webdav', 'ftp'));
