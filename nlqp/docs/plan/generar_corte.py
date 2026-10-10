"""Genera el corte del plan de trabajo en el formato del Excel de David.

    python nlqp/docs/plan/generar_corte.py 2026-10-10

- Línea base fija: tareas, fechas y jerarquía de `plan.json` (las fechas del plan no
  se cambian aunque el trabajo real vaya en otras fechas: así se ve si vamos
  adelantados, al día o atrasados).
- Lo único que se edita en `plan.json` es el avance: `real` (0–1) y `comentario` de
  cada tarea hoja. Las tareas nuevas, fuera del plan original, llevan
  `"nueva": {"agregada": "AAAA-MM-DD", "implementada": "AAAA-MM-DD" | null}` y se
  resaltan en azul.
- %plan de una tarea hoja: 100 % si la fecha de corte ya pasó su fin, 0 % si no
  empezó, proporcional a los días si está en curso. Las filas padre suman a sus
  hijas ponderando por duración (mismas fórmulas que el Excel original).

Escribe:
- `Claude outputs/Plan_de_Trabajo_PG2 DD-MM-AAAA.xlsx` (formato y estilos de
  `plantilla_plan_PG2.xlsx`, con fórmulas y comentarios en la columna %real);
- `cortes/AAAA-MM-DD.json` (foto del corte, versionada);
- la tabla del corte dentro de `nlqp/docs/PLAN_DE_TRABAJO.md` (entre marcadores).

Solo usa la biblioteca estándar de Python.
"""
import argparse
import datetime
import json
import re
import zipfile
from pathlib import Path
from xml.dom import minidom
from xml.sax.saxutils import escape

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[2]
PLANTILLA = AQUI / 'plantilla_plan_PG2.xlsx'
PLAN = AQUI / 'plan.json'
PLAN_MD = AQUI.parent / 'PLAN_DE_TRABAJO.md'
COLOR_NUEVA = 'FFDDEBF7'  # azul claro
MARCA_INI, MARCA_FIN = '<!-- corte:inicio (generado, no editar a mano) -->', '<!-- corte:fin -->'
ROW_ATTRS = 'customFormat="false" ht="15" hidden="false" customHeight="true" outlineLevel="0" collapsed="false"'


def serial(iso):
    return (datetime.date.fromisoformat(iso) - datetime.date(1899, 12, 30)).days


def calcular(tareas, corte):
    por_no = {t['no']: t for t in tareas}
    hijos = {t['no']: [] for t in tareas}
    for t in tareas:
        if t['padre'] is not None:
            hijos[t['padre']].append(t['no'])
    raiz = next(t for t in tareas if t['padre'] is None)

    def visitar(no):
        t = por_no[no]
        if hijos[no]:
            for h in hijos[no]:
                visitar(h)
            hs = [por_no[h] for h in hijos[no]]
            t['_C'] = sum(h['_C'] for h in hs)
            t['_F'] = sum(h['_C'] * h['_F'] for h in hs) / t['_C']
            t['_G'] = sum(h['_C'] * h['_G'] for h in hs) / t['_C']
        else:
            ini, fin = datetime.date.fromisoformat(t['inicio']), datetime.date.fromisoformat(t['fin'])
            t['_C'] = (fin - ini).days + 1
            if corte >= fin:
                t['_F'] = 1.0
            elif corte < ini:
                t['_F'] = 0.0
            else:
                t['_F'] = ((corte - ini).days + 1) / t['_C']
            if 'real' not in t:
                raise SystemExit(f'La tarea {no} ("{t["tarea"]}") no tiene "real".')
            t['_G'] = float(t['real'])
        t['_H'] = t['_G'] - t['_F']

    visitar(raiz['no'])
    for t in tareas:
        t['_I'] = t['_C'] / raiz['_C']
        t['_J'] = t['_I'] * t['_G']
    return hijos, raiz


def estilos_plantilla(sheet):
    """No. de tarea -> {columna: estilo} de la plantilla; también filas 1–3 tal cual."""
    estilos, filas_cabecera = {}, []
    for rnum, row in re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S):
        rnum = int(rnum)
        if rnum <= 3:
            filas_cabecera.append((rnum, row))
            continue
        a = re.search(r'<c r="A\d+" s="\d+" t="n"><v>([\d.]+)</v>', row)
        if a:
            estilos[int(float(a.group(1)))] = dict(re.findall(r'<c r="([A-Z]+)\d+" s="(\d+)"', row))
    return estilos, filas_cabecera


def agregar_estilos_resaltados(styles, ids):
    """Clona los estilos `ids` con relleno azul claro; devuelve (styles, {id: id_resaltado})."""
    fills = re.search(r'<fills count="(\d+)">(.*?)</fills>', styles, re.S)
    nuevo_fill = int(fills.group(1))
    fill_xml = f'<fill><patternFill patternType="solid"><fgColor rgb="{COLOR_NUEVA}"/><bgColor rgb="{COLOR_NUEVA}"/></patternFill></fill>'
    styles = styles.replace(fills.group(0), f'<fills count="{nuevo_fill + 1}">{fills.group(2)}{fill_xml}</fills>')
    xfs_m = re.search(r'<cellXfs count="(\d+)">(.*?)</cellXfs>', styles, re.S)
    xfs = re.findall(r'<xf [^>]*?(?:/>|>.*?</xf>)', xfs_m.group(2), re.S)
    mapa, extra = {}, []
    for i in sorted(ids, key=int):
        clon = re.sub(r'fillId="\d+"', f'fillId="{nuevo_fill}"', xfs[int(i)], count=1)
        mapa[i] = str(len(xfs) + len(extra))
        extra.append(clon)
    total = len(xfs) + len(extra)
    styles = styles.replace(xfs_m.group(0), f'<cellXfs count="{total}">{xfs_m.group(2)}{"".join(extra)}</cellXfs>')
    return styles, mapa


def celda_num(ref, s, valor, formula=None):
    f = f'<f aca="false">{escape(formula)}</f>' if formula else ''
    return f'<c r="{ref}" s="{s}" t="n">{f}<v>{repr(float(valor)) if isinstance(valor, float) else valor}</v></c>'


def celda_txt(ref, s, texto):
    return f'<c r="{ref}" s="{s}" t="inlineStr"><is><t xml:space="preserve">{escape(texto)}</t></is></c>'


def construir_hoja(sheet, tareas, hijos, raiz, corte, estilos, filas_cab, mapa_resalt):
    fila = {t['no']: 4 + i for i, t in enumerate(tareas)}
    hoja_por_defecto = estilos.get(40) or next(e for n, e in estilos.items() if not hijos.get(n))
    padre_por_defecto = estilos.get(26) or estilos.get(21)
    rows = []
    for rnum, row in filas_cab:
        if rnum == 2:
            # Sin textos extra en el Excel (pedido de David, 10/10): la fecha del
            # corte va solo en el nombre del archivo.
            s = re.search(r'<c r="B2" s="(\d+)"', row).group(1)
            row = f'<c r="B2" s="{s}"/>'
        rows.append(f'<row r="{rnum}" {ROW_ATTRS}>{row}</row>')
    for t in tareas:
        r = fila[t['no']]
        es_padre = bool(hijos[t['no']])
        st = dict(estilos.get(t['no']) or (padre_por_defecto if es_padre else hoja_por_defecto))
        if t.get('nueva'):
            st = {c: mapa_resalt.get(s, s) for c, s in st.items()}
        celdas = [celda_num(f'A{r}', st['A'], t['no']),
                  celda_txt(f'B{r}', st['B'], '    ' * t['nivel'] + t['tarea'])]
        if es_padre:
            hs = [fila[h] for h in hijos[t['no']]]
            celdas.append(celda_num(f'C{r}', st['C'], t['_C'], 'SUM(' + ','.join(f'C{h}' for h in hs) + ')'))
        else:
            celdas.append(celda_num(f'C{r}', st['C'], t['_C'], f'E{r}-D{r}+1'))
        celdas.append(celda_num(f'D{r}', st['D'], serial(t['inicio'])))
        celdas.append(celda_num(f'E{r}', st['E'], serial(t['fin'])))
        if es_padre:
            for col in 'FG':
                expr = '(' + '+'.join(f'C{h}*{col}{h}' for h in hs) + f')/C{r}'
                celdas.append(celda_num(f'{col}{r}', st[col], t[f'_{col}'], expr))
        else:
            celdas.append(celda_num(f'F{r}', st['F'], t['_F']))
            celdas.append(celda_num(f'G{r}', st['G'], t['_G']))
        celdas.append(celda_num(f'H{r}', st['H'], t['_H'], f'G{r}-F{r}'))
        celdas.append(celda_num(f'I{r}', st['I'], t['_I'], f'C{r}/$C$4'))
        celdas.append(celda_num(f'J{r}', st['J'], t['_J'], f'I{r}*G{r}'))
        if t['padre'] is None:
            celdas.append(f'<c r="K{r}" s="{st["K"]}"/>')
        else:
            celdas.append(celda_num(f'K{r}', st['K'], t['padre']))
        rows.append(f'<row r="{r}" {ROW_ATTRS}>{"".join(celdas)}</row>')
    # Sin nota al pie: el resaltado azul y el comentario de %real bastan.
    nota = 3 + len(tareas)
    sheet = re.sub(r'<sheetData>.*</sheetData>', '<sheetData>' + ''.join(rows) + '</sheetData>', sheet, flags=re.S)
    sheet = re.sub(r'<dimension ref="[^"]+"/>', f'<dimension ref="A1:K{nota}"/>', sheet)
    return sheet, fila


def construir_comentarios(plantilla_comments, tareas, fila):
    cabecera = plantilla_comments[:plantilla_comments.index('<commentList>')]
    items, shapes = [], []
    for i, t in enumerate(x for x in tareas if x.get('comentario')):
        r = fila[t['no']]
        items.append(
            f'<comment ref="G{r}" authorId="0"><text><r><rPr><sz val="10"/><rFont val="Arial"/><family val="2"/></rPr>'
            f'<t xml:space="preserve">{escape(t["comentario"])}</t></r></text></comment>')
        shapes.append(
            f'<v:shape id="_x0000_s{1025 + i}" type="#_x0000_t202" fillcolor="#ffffe1" stroked="t" o:allowincell="f" '
            f'style="position:absolute;margin-left:400pt;margin-top:{max(r - 2, 0) * 15}pt;width:260pt;height:90pt;'
            f'z-index:{i + 1};visibility:hidden"><v:shadow on="t" obscured="t" color="black"/>'
            f'<v:textbox style="mso-direction-alt:auto"/><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/>'
            f'<x:Anchor>7, 15, {max(r - 2, 0)}, 2, 11, 15, {r + 4}, 2</x:Anchor><x:AutoFill>False</x:AutoFill>'
            f'<x:Row>{r - 1}</x:Row><x:Column>6</x:Column></x:ClientData></v:shape>')
    comments = cabecera + '<commentList>' + ''.join(items) + '</commentList></comments>'
    vml = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" '
           'xmlns:x="urn:schemas-microsoft-com:office:excel">'
           '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe">'
           '<v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>'
           + ''.join(shapes) + '</xml>')
    return comments, vml


def pct(x):
    return f'{round(x * 100)} %'


def tabla_md(tareas, hijos, raiz, corte):
    dif = raiz['_H']
    estado = 'adelantados' if dif >= 0.01 else 'atrasados' if dif <= -0.01 else 'al día'
    lineas = [
        MARCA_INI,
        f'### Corte {corte:%d/%m/%Y}',
        '',
        f'**Proyecto: plan {pct(raiz["_F"])} · real {pct(raiz["_G"])} · diferencia '
        f'{dif * 100:+.1f} puntos → vamos {estado}.** Excel: '
        f'`Claude outputs/Plan_de_Trabajo_PG2 {corte:%d-%m-%Y}.xlsx`; foto: `plan/cortes/{corte.isoformat()}.json`.',
        '',
    ]
    atrasos = sorted((t for t in tareas if not hijos[t['no']] and t['_H'] < 0), key=lambda t: t['_I'] * t['_H'])
    if atrasos:
        lineas.append('Lo que más pesa en el atraso: ' + '; '.join(
            f'{t["tarea"]} ({pct(t["_G"])} de {pct(t["_F"])})' for t in atrasos[:5]) + '.')
        lineas.append('')
    lineas += ['| No. | Tarea | Inicio | Fin | %plan | %real | Dif. | Comentario |', '|---|---|---|---|---|---|---|---|']
    for t in tareas:
        nombre = ('· ' * max(t['nivel'] - 1, 0)) + t['tarea']
        if hijos[t['no']]:
            nombre = f'**{nombre}**'
        if t.get('nueva'):
            nombre += ' 🆕'
        com = (t.get('comentario') or '').replace('|', '\\|').replace('\n', ' ')
        lineas.append(f'| {t["no"]} | {nombre} | {t["inicio"][8:]}/{t["inicio"][5:7]} | {t["fin"][8:]}/{t["fin"][5:7]} | '
                      f'{pct(t["_F"])} | {pct(t["_G"])} | {t["_H"] * 100:+.0f} | {com} |')
    lineas += ['', '🆕 = tarea nueva, fuera del plan original, ya implementada (azul en el Excel).', MARCA_FIN]
    return '\n'.join(lineas)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('corte', help='fecha de corte AAAA-MM-DD')
    ap.add_argument('--salida', default=str(RAIZ / 'Claude outputs'))
    args = ap.parse_args()
    corte = datetime.date.fromisoformat(args.corte)

    plan = json.loads(PLAN.read_text(encoding='utf-8'))
    tareas = plan['tareas']
    hijos, raiz = calcular(tareas, corte)

    z = zipfile.ZipFile(PLANTILLA)
    sheet = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
    estilos, filas_cab = estilos_plantilla(sheet)
    ids = set()
    for t in tareas:
        if t.get('nueva'):
            base = estilos.get(t['no']) or estilos.get(40)
            ids |= set(base.values())
    styles, mapa = agregar_estilos_resaltados(z.read('xl/styles.xml').decode('utf-8'), ids)
    sheet, fila = construir_hoja(sheet, tareas, hijos, raiz, corte, estilos, filas_cab, mapa)
    comments, vml = construir_comentarios(z.read('xl/comments1.xml').decode('utf-8'), tareas, fila)
    workbook = z.read('xl/workbook.xml').decode('utf-8').replace('<calcPr ', '<calcPr fullCalcOnLoad="true" ', 1)

    reemplazos = {'xl/worksheets/sheet1.xml': sheet, 'xl/styles.xml': styles, 'xl/comments1.xml': comments,
                  'xl/drawings/vmlDrawing1.vml': vml, 'xl/workbook.xml': workbook}
    for nombre, contenido in reemplazos.items():
        minidom.parseString(contenido.encode('utf-8'))  # falla si el XML quedó mal formado

    salida = Path(args.salida) / f'Plan_de_Trabajo_PG2 {corte:%d-%m-%Y}.xlsx'
    salida.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED) as out:
        for item in z.infolist():
            datos = reemplazos[item.filename].encode('utf-8') if item.filename in reemplazos else z.read(item.filename)
            out.writestr(item, datos)

    foto = {'corte': corte.isoformat(), 'tareas': [
        {**{k: v for k, v in t.items() if not k.startswith('_')},
         'duracion': t['_C'], 'plan': round(t['_F'], 4), 'real_calc': round(t['_G'], 4), 'dif': round(t['_H'], 4)}
        for t in tareas]}
    (AQUI / 'cortes').mkdir(exist_ok=True)
    (AQUI / 'cortes' / f'{corte.isoformat()}.json').write_text(
        json.dumps(foto, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    md = PLAN_MD.read_text(encoding='utf-8')
    bloque = tabla_md(tareas, hijos, raiz, corte)
    if MARCA_INI in md:
        md = re.sub(re.escape(MARCA_INI) + r'.*?' + re.escape(MARCA_FIN), lambda _: bloque, md, flags=re.S)
    else:
        md = md.rstrip() + '\n\n' + bloque + '\n'
    PLAN_MD.write_text(md, encoding='utf-8', newline='\n')

    print(f'{salida}\nProyecto: plan {pct(raiz["_F"])}, real {pct(raiz["_G"])}, dif {raiz["_H"] * 100:+.1f} puntos')


if __name__ == '__main__':
    main()
