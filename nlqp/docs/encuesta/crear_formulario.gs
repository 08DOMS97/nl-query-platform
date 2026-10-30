/**
 * Crea el Google Form de la encuesta de usabilidad de NLQP (sección 3.3.2 de la tesis).
 * Uso: https://script.google.com → Proyecto nuevo → pegar este archivo → ejecutar
 * crearFormulario → autorizar. El registro de ejecución muestra los enlaces.
 * Los títulos de las preguntas deben coincidir con los que espera analizar_encuesta.py
 * (empiezan con «P1.», «P2.», …, «11.»): no cambiarlos.
 */
function crearFormulario() {
  var form = FormApp.create('Encuesta de usabilidad — NLQP');
  form.setDescription(
    'Gracias por probar NLQP, una plataforma para consultar las bases de datos de la organización ' +
    'escribiendo preguntas en español. La encuesta es anónima y toma unos 2 minutos. ' +
    'Se evalúa el sistema, no a la persona. Las respuestas se usan solo con fines académicos.'
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);

  // Sección 1. Perfil
  form.addSectionHeaderItem().setTitle('Perfil');
  form.addMultipleChoiceItem().setTitle('1. ¿Cuál describe mejor su rol?').setRequired(true)
    .setChoiceValues(['Usuario de negocio (no trabajo con bases de datos)', 'Usuario técnico (sistemas, TI, DBA, desarrollo)']);
  form.addMultipleChoiceItem().setTitle('2. ¿Con qué frecuencia necesita datos o reportes de las bases de la organización?').setRequired(true)
    .setChoiceValues(['Diaria', 'Semanal', 'Mensual', 'Rara vez']);
  form.addMultipleChoiceItem().setTitle('3. Hoy, cuando necesita un reporte, ¿cómo lo obtiene?').setRequired(true)
    .setChoiceValues(['Lo pido al área de TI o a un compañero técnico', 'Lo hago yo mismo con SQL o una herramienta técnica']).showOtherOption(true);

  // Sección 2. Evaluación (Likert 1–5)
  form.addPageBreakItem().setTitle('Evaluación')
    .setHelpText('Indique qué tan de acuerdo está con cada afirmación: 1 = totalmente en desacuerdo, 5 = totalmente de acuerdo.');
  var afirmaciones = [
    'P1. Me resultó fácil escribir mis preguntas en lenguaje natural.',
    'P2. Pude hacer las consultas sin conocer SQL ni la estructura de la base de datos.',
    'P3. Los resultados se presentaron de forma clara y fácil de entender.',
    'P4. Pude usar el resultado (ver, descargar o guardar) sin ayuda.',
    'P5. Confío en que los datos mostrados responden a lo que pregunté.',
    'P6. Usaría estos resultados para tomar una decisión o entregar un reporte.',
    'P7. El sistema respondió en un tiempo aceptable.',
    'P8. Obtener el dato con el sistema fue más rápido que pedirlo por el proceso habitual.',
    'P9. En general, estoy satisfecho con el sistema.',
    'P10. Recomendaría el sistema a otras personas de mi organización.'
  ];
  afirmaciones.forEach(function (t) {
    form.addScaleItem().setTitle(t).setBounds(1, 5)
      .setLabels('Totalmente en desacuerdo', 'Totalmente de acuerdo').setRequired(true);
  });

  // Sección 3. Adopción
  form.addPageBreakItem().setTitle('Adopción');
  form.addMultipleChoiceItem().setTitle('11. ¿Usaría NLQP en lugar de pedir el reporte por el proceso habitual?').setRequired(true)
    .setChoiceValues(['Sí', 'No', 'No estoy seguro']);
  form.addParagraphTextItem().setTitle('12. ¿Qué mejoraría del sistema?').setRequired(false);

  Logger.log('Enlace para responder: ' + form.getPublishedUrl());
  Logger.log('Enlace de edición: ' + form.getEditUrl());
}
