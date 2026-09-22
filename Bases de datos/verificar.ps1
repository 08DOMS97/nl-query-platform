# ============================================================================
#  verificar.ps1  -  Verificacion de INFRAESTRUCTURA y CONECTIVIDAD
# ----------------------------------------------------------------------------
#  Para cada motor comprueba:
#    1. contenedor en ejecucion
#    2. health check = healthy
#    3. puerto publicado accesible desde Windows (Test-NetConnection)
#    4. autenticacion con testuser + acceso a testdb
#    5. las 8 tablas del dataset existen y tienen filas
#    6. conexion al puerto publicado desde un contenedor cliente EXTERNO a la
#       red de compose (host.docker.internal) -> prueba el binding de Windows
#
#  Para verificacion PROFUNDA del dataset (FK, huerfanas, consultas NL2SQL)
#  usar:  .\verificar_dataset.ps1
#
#  Uso:   .\verificar.ps1
# ============================================================================

$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot

# ---- cargar .env ----
$cfg = @{}
Get-Content .env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    $cfg[$k.Trim()] = $v.Trim()
}
$U  = $cfg['TEST_DB_USER']
$P  = $cfg['TEST_DB_PASSWORD']
$DB = $cfg['TEST_DB_NAME']

$TABLES = 'categories', 'customers', 'addresses', 'products', 'orders', 'order_items', 'payments', 'shipments'
$COUNT_SQL_STD = ($TABLES | ForEach-Object { "SELECT '$_' t, COUNT(*) n FROM $_" }) -join ' UNION ALL '
$COUNT_SQL_MSS = ($TABLES | ForEach-Object { "SELECT '$_' t, COUNT(*) n FROM dbo.$_" }) -join ' UNION ALL '

$motores = @(
    @{ Nombre='SQL Server'; Cont='nlqp-sqlserver'; Puerto=[int]$cfg['MSSQL_HOST_PORT'];    Img='mcr.microsoft.com/mssql/server:2022-latest' }
    @{ Nombre='PostgreSQL'; Cont='nlqp-postgres';  Puerto=[int]$cfg['POSTGRES_HOST_PORT']; Img='postgres:16' }
    @{ Nombre='MySQL';      Cont='nlqp-mysql';     Puerto=[int]$cfg['MYSQL_HOST_PORT'];    Img='mysql:8.0' }
    @{ Nombre='MariaDB';    Cont='nlqp-mariadb';   Puerto=[int]$cfg['MARIADB_HOST_PORT'];  Img='mariadb:11.4' }
)

function Get-Val($x) { ($x | Out-String).Trim() }
function Inspect($cont, $fmt) { try { Get-Val (docker inspect -f $fmt $cont 2>$null) } catch { '' } }

# suma de filas de las 8 tablas, como testuser, DENTRO del contenedor
function Suma-Interna($m) {
    switch ($m.Nombre) {
        'PostgreSQL' {
            Get-Val (docker exec -e PGPASSWORD=$P $m.Cont `
                psql -U $U -d $DB -tAc "SELECT SUM(n) FROM ($COUNT_SQL_STD) x;" 2>$null)
        }
        'MySQL' {
            Get-Val (docker exec $m.Cont `
                mysql -u $U -p"$P" $DB -N -B -e "SELECT SUM(n) FROM ($COUNT_SQL_STD) x;" 2>$null)
        }
        'MariaDB' {
            Get-Val (docker exec $m.Cont `
                mariadb -u $U -p"$P" $DB -N -B -e "SELECT SUM(n) FROM ($COUNT_SQL_STD) x;" 2>$null)
        }
        'SQL Server' {
            $out = docker exec $m.Cont /opt/mssql-tools18/bin/sqlcmd -S localhost -U $U -P $P -C -d $DB `
                     -h -1 -W -Q "SET NOCOUNT ON; SELECT SUM(n) FROM ($COUNT_SQL_MSS) x;" 2>$null
            (Get-Val $out) -split "`n" | Where-Object { $_ -match '^\d+$' } | Select-Object -First 1
        }
    }
}

# misma suma pero desde un contenedor cliente EXTERNO, via puerto publicado
function Suma-Externa($m) {
    $h = 'host.docker.internal'
    switch ($m.Nombre) {
        'PostgreSQL' {
            Get-Val (docker run --rm -e PGPASSWORD=$P $m.Img `
                psql -h $h -p $m.Puerto -U $U -d $DB -tAc "SELECT SUM(n) FROM ($COUNT_SQL_STD) x;" 2>$null)
        }
        'MySQL' {
            Get-Val (docker run --rm $m.Img `
                mysql -h $h -P $m.Puerto -u $U -p"$P" $DB -N -B -e "SELECT SUM(n) FROM ($COUNT_SQL_STD) x;" 2>$null)
        }
        'MariaDB' {
            Get-Val (docker run --rm $m.Img `
                mariadb -h $h -P $m.Puerto -u $U -p"$P" $DB -N -B -e "SELECT SUM(n) FROM ($COUNT_SQL_STD) x;" 2>$null)
        }
        'SQL Server' {
            $out = docker run --rm $m.Img /opt/mssql-tools18/bin/sqlcmd -S "$h,$($m.Puerto)" -U $U -P $P -C -d $DB `
                     -h -1 -W -Q "SET NOCOUNT ON; SELECT SUM(n) FROM ($COUNT_SQL_MSS) x;" 2>$null
            (Get-Val $out) -split "`n" | Where-Object { $_ -match '^\d+$' } | Select-Object -First 1
        }
    }
}

$tabla = @()
foreach ($m in $motores) {
    Write-Host ""
    Write-Host "=== $($m.Nombre) ===" -ForegroundColor Cyan

    $estadoCont = Inspect $m.Cont '{{.State.Status}}'
    $salud      = Inspect $m.Cont '{{if .State.Health}}{{.State.Health.Status}}{{else}}sin-healthcheck{{end}}'
    $puertoWin  = try { (Test-NetConnection -ComputerName localhost -Port $m.Puerto -WarningAction SilentlyContinue).TcpTestSucceeded } catch { $false }

    $sumInterna = ''
    $sumExterna = ''
    if ($estadoCont -eq 'running') {
        $sumInterna = Suma-Interna $m
        $sumExterna = Suma-Externa $m
    }

    $okCont  = $estadoCont -eq 'running'
    $okSalud = $salud -eq 'healthy'
    $okPort  = [bool]$puertoWin
    $okQuery = ($sumInterna -match '^\d+$') -and ([int]$sumInterna -ge 2000)
    $okExt   = ($sumExterna -match '^\d+$') -and ([int]$sumExterna -ge 2000)

    Write-Host ("  contenedor .......... {0} ({1})" -f (@{$true='OK';$false='FALLO'}[$okCont]),  $estadoCont)
    Write-Host ("  health check ........ {0} ({1})" -f (@{$true='OK';$false='FALLO'}[$okSalud]), $salud)
    Write-Host ("  puerto {0,-5} (Win) .. {1}"      -f $m.Puerto, (@{$true='OK';$false='FALLO'}[$okPort]))
    Write-Host ("  auth + 8 tablas ..... {0} (filas totales: {1})" -f (@{$true='OK';$false='FALLO'}[$okQuery]), $sumInterna)
    Write-Host ("  puerto publicado ext. {0} (filas totales: {1})" -f (@{$true='OK';$false='FALLO'}[$okExt]),   $sumExterna)

    $global_ok = $okCont -and $okSalud -and $okPort -and $okQuery -and $okExt
    $tabla += [pscustomobject]@{
        Motor           = $m.Nombre
        Host            = 'localhost'
        Puerto          = $m.Puerto
        'Base de datos' = $DB
        Usuario         = $U
        'Filas totales' = $sumInterna
        Estado          = @{$true='OK';$false='FALLO'}[$global_ok]
    }
}

Write-Host ""
Write-Host "==================== RESUMEN ====================" -ForegroundColor Green
$tabla | Format-Table -AutoSize
