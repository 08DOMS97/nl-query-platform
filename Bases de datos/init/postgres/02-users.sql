-- PostgreSQL 16 - usuario de aplicacion del banco de pruebas.
--
-- Credenciales FIJAS en este archivo. Deben coincidir con
-- TEST_DB_USER / TEST_DB_PASSWORD de .env. Si cambias esos valores,
-- actualiza tambien este archivo (y recrea el volumen pg_data).
--
-- testuser NO es superusuario: solo tiene permisos dentro de testdb.

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'testuser') THEN
      CREATE ROLE testuser LOGIN PASSWORD 'TestUser_2026_DB!';
   END IF;
END
$$;

GRANT CONNECT ON DATABASE testdb TO testuser;
GRANT USAGE, CREATE ON SCHEMA public TO testuser;

-- Permisos sobre lo que ya existe (las 8 tablas creadas en 01-schema.sql)
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO testuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO testuser;

-- Permisos sobre lo que cree el superusuario mas adelante
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO testuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO testuser;
