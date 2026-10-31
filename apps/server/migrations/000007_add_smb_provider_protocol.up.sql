-- Register the "smb" provider protocol: SMB2/3 network shares (NAS, Windows
-- file servers) connected with host/share/password credentials.
ALTER TABLE "providers" DROP CONSTRAINT "providers_protocol_check";
ALTER TABLE "providers" ADD CONSTRAINT "providers_protocol_check"
    CHECK ("protocol" IN ('oauth2_cloud', 's3_compatible', 'webdav', 'ftp', 'smb'));
