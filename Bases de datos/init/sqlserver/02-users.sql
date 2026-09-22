-- SQL Server 2022 - login + usuario de aplicacion.
-- Variables $(APP_USER) $(APP_PASSWORD) $(DB_NAME) las pasa sqlcmd (-v)
-- desde el servicio sqlserver-init, tomando los valores de .env.
--
-- testuser NO tiene permisos a nivel servidor: solo db_owner dentro de testdb.

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(APP_USER)')
BEGIN
    CREATE LOGIN [$(APP_USER)] WITH PASSWORD = N'$(APP_PASSWORD)',
        CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
END
GO

USE [$(DB_NAME)];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(APP_USER)')
BEGIN
    CREATE USER [$(APP_USER)] FOR LOGIN [$(APP_USER)];
END
GO

ALTER ROLE db_owner ADD MEMBER [$(APP_USER)];
GO
