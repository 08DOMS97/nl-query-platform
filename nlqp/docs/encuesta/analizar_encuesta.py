"""
Análisis de la encuesta de usabilidad de NLQP (secciones 3.3.2 y 3.7 de la tesis).

    python analizar_encuesta.py respuestas.csv

Lee el CSV que descarga Google Forms (Respuestas → Descargar respuestas), calcula por
dimensión y por perfil el promedio, la desviación estándar y la distribución de 1 a 5,
el porcentaje de adopción, y verifica los criterios de 3.7:
  - promedio >= 4.0 en al menos 3 de las 5 dimensiones;
  - adopción («Sí» en la pregunta 11) >= 70 %.
Escribe resultados_encuesta.md junto al CSV, con las tablas para la tesis.
"""
import csv
import statistics
import sys
from collections import Counter
from pathlib import Path

DIMENSIONES = {
    'D1 Facilidad de formulación': ['P1.', 'P2.'],
    'D2 Claridad de los resultados': ['P3.', 'P4.'],
    'D3 Confianza en el resultado': ['P5.', 'P6.'],
    'D4 Velocidad de respuesta': ['P7.', 'P8.'],
    'D5 Satisfacción y adopción': ['P9.', 'P10.'],
}
PERFIL = '1.'
ADOPCION = '11.'


def columna(encabezados, prefijo):
    for h in encabezados:
        if h.strip().startswith(prefijo):
            return h
    raise SystemExit(f'No se encontró la pregunta que empieza con «{prefijo}» en el CSV.')


def perfil_corto(valor):
    return 'Técnico' if valor.lower().startswith('usuario técnico') else 'No técnico'


def resumen(valores):
    if not valores:
        return None
    dist = Counter(valores)
    return {
        'n': len(valores),
        'media': statistics.mean(valores),
        'de': statistics.stdev(valores) if len(valores) > 1 else 0.0,
        'dist': [dist.get(i, 0) for i in range(1, 6)],
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    ruta = Path(sys.argv[1])
    with ruta.open(encoding='utf-8-sig', newline='') as f:
        filas = list(csv.DictReader(f))
    if not filas:
        raise SystemExit('El CSV no tiene respuestas.')
    enc = list(filas[0].keys())
    c_perfil, c_adop = columna(enc, PERFIL), columna(enc, ADOPCION)
    cols = {d: [columna(enc, p) for p in ps] for d, ps in DIMENSIONES.items()}

    grupos = {'Todos': filas}
    for fila in filas:
        grupos.setdefault(perfil_corto(fila[c_perfil]), []).append(fila)

    salida = [f'# Resultados de la encuesta de usabilidad ({len(filas)} participantes)', '']
    perfiles = Counter(perfil_corto(f[c_perfil]) for f in filas)
    salida += ['| Perfil | Participantes |', '|---|---|'] + [f'| {k} | {v} |' for k, v in perfiles.items()] + ['']

    salida += ['## Promedio por dimensión (escala de 1 a 5)', '',
               '| Dimensión | ' + ' | '.join(grupos) + ' |', '|---|' + '---|' * len(grupos)]
    medias_todos = {}
    for d, cs in cols.items():
        celdas = []
        for g, fs in grupos.items():
            vals = [int(f[c]) for f in fs for c in cs if f[c].strip()]
            r = resumen(vals)
            celdas.append(f"{r['media']:.2f} (DE {r['de']:.2f})" if r else '—')
            if g == 'Todos':
                medias_todos[d] = r['media'] if r else 0
        salida.append(f'| {d} | ' + ' | '.join(celdas) + ' |')

    salida += ['', '## Distribución de respuestas (todos los participantes)', '',
               '| Dimensión | 1 | 2 | 3 | 4 | 5 |', '|---|---|---|---|---|---|']
    for d, cs in cols.items():
        r = resumen([int(f[c]) for f in filas for c in cs if f[c].strip()])
        salida.append(f'| {d} | ' + ' | '.join(str(x) for x in r['dist']) + ' |')

    adop = Counter(f[c_adop].strip() for f in filas)
    pct_si = 100 * adop.get('Sí', 0) / len(filas)
    salida += ['', '## Disposición de adopción (pregunta 11)', '', '| Respuesta | Participantes | % |', '|---|---|---|']
    salida += [f'| {k} | {v} | {100 * v / len(filas):.1f} % |' for k, v in adop.most_common()]

    cumplen = [d for d, m in medias_todos.items() if m >= 4.0]
    c1 = len(cumplen) >= 3
    c2 = pct_si >= 70
    salida += ['', '## Criterios de la sección 3.7', '',
               f'- Promedio >= 4.0 en al menos 3 de 5 dimensiones: **{"se cumple" if c1 else "no se cumple"}** ({len(cumplen)} de 5: {", ".join(cumplen) or "ninguna"}).',
               f'- Adopción >= 70 %: **{"se cumple" if c2 else "no se cumple"}** ({pct_si:.1f} %).',
               f'- Variable dependiente: **{"verificada" if c1 and c2 else "no verificada"}** con {len(filas)} participantes.']
    if len(filas) < 35:
        salida.append(f'- Muestra reducida: {len(filas)} de los 35 previstos en la sección 3.6; reportar como aplicación piloto.')

    texto = '\n'.join(salida) + '\n'
    print(texto)
    destino = ruta.with_name('resultados_encuesta.md')
    destino.write_text(texto, encoding='utf-8')
    print(f'Escrito: {destino}')


if __name__ == '__main__':
    main()
