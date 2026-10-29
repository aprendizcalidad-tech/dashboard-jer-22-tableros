# Dashboard contractual JER: 22 tableros

Proyecto estático para GitHub Pages con **dos Google Sheets**, Firebase Authentication, Apps Script y descarga de PDF. Está preparado para conectar las fuentes originales de Boyacá y Amazonas, **sin publicar los Excel ni sus datos en GitHub**.

## 0. Qué contiene el ZIP

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Página de acceso y dashboard. |
| `css/styles.css` | Diseño y adaptación a celular. |
| `js/catalog.js` | Los 22 tableros: temas, hojas y columnas de cada región. |
| `js/data.js`, `js/charts.js`, `js/app.js`, `js/pdf.js` | Lectura, filtros, gráficas, interfaz y PDF. |
| `js/auth.js` | Inicio de sesión y verificación del correo con Firebase. |
| `js/config.js` | **Único archivo del sitio** donde pondrás la configuración pública de Firebase y URL de Apps Script. |
| `apps-script/Code.gs` | Código privado del servicio de datos. Se copia al editor de Apps Script; **no se ejecuta desde GitHub Pages**. |

**Necesitarás:** una cuenta Google con acceso a los dos libros, un proyecto de Firebase y un repositorio GitHub. No hacen falta Firestore, Firebase Storage, Cloud Functions ni un servidor propio. El navegador consulta Apps Script, que abre cada libro por ID y comprueba el token y la lista de correos **antes de leer** las hojas.

> **Estado de esta entrega:** el código está completo y probado localmente con datos de prueba y contra los encabezados de los Excel recibidos. No puede conectarse de verdad hasta que coloques tus IDs, crees Firebase y publiques tu propio Apps Script. El flujo de navegador con las cuentas reales se debe probar antes de uso empresarial.

## 1. Prepara los dos Google Sheets

1. Entra en [Google Drive](https://drive.google.com/) con la cuenta propietaria o administradora del informe.
2. Pulsa **Nuevo → Subir archivo** y sube `Informe Looker Boyaca.xlsx`.
3. Ábrelo. Si está como Excel, selecciona **Archivo → Guardar como Hojas de cálculo de Google**. Esto crea una copia nativa de Google Sheets. Dale un nombre claro, por ejemplo `Informe JER Boyacá · fuente dashboard`.
4. Haz lo mismo con `Informe Looker Amazonas.xlsx`, en un **segundo libro independiente**.
5. Abre la copia *Google Sheets* de Boyacá y revisa varias pestañas, por ejemplo `Ventas AP`, `Minimos` y `Formularios Empresa`. Confirma que sus fórmulas sigan dando resultados y que no se hayan alterado encabezados o espacios finales. Repite con `Ventas`, `Minimos` y `Formularios zona` en Amazonas.
6. Copia los **IDs** desde la barra del navegador. En una dirección como `https://docs.google.com/spreadsheets/d/ABC123456/edit`, el ID es solo `ABC123456`.
7. Guarda los dos IDs **por separado**. No pegues la URL completa en las propiedades `SPREADSHEET_ID_*`.
8. Comparte ambos Google Sheets con la cuenta que **desplegará Apps Script**, con permiso de lectura o edición según corresponda. No hace falta compartir los libros con los usuarios finales: Apps Script leerá como la cuenta que lo implementa.

Si el equipo actualiza los `.xlsx` locales, los cambios **no** aparecen automáticamente en las copias Google Sheets. Deben editar o volver a sincronizar las hojas de Google que sirven como fuente. El dashboard no modifica los libros.

## 2. Crea Firebase Authentication

1. Entra en [Firebase Console](https://console.firebase.google.com/) y pulsa **Agregar proyecto**. Usa un proyecto de la organización aprobado para este informe.
2. En el menú lateral, abre **Compilación → Authentication** y pulsa **Comenzar**.
3. En **Método de acceso**, activa **Correo electrónico/Contraseña** y guarda.
4. En la página principal de Firebase, abre **Configuración del proyecto** (icono de engranaje). En **Tus apps**, crea una aplicación web (`</>`). El registro de la app web **no** significa que debas usar Firebase Hosting.
5. Copia del objeto de configuración web estos cuatro campos: `apiKey`, `authDomain`, `projectId`, `appId`.
6. En **Authentication → Configuración → Dominios autorizados**, añade el dominio de GitHub Pages, por ejemplo `tu-usuario.github.io`. Incluye solo el dominio, sin `https://` y sin la ruta `/tu-repositorio/`. Para pruebas locales, añade `localhost` si hace falta.
7. No necesitas activar Firestore ni crear reglas de Firestore: los datos se leen a través de Apps Script.

**Diferencia fundamental:** crear una cuenta Firebase permite identificarse, pero **no autoriza** a leer datos. El correo verificado debe aparecer además en `AUTHORIZED_EMAILS` dentro de Apps Script. Esa lista **nunca** debe quedar en el código público de GitHub.

## 3. Crea Apps Script (el puente seguro)

1. Abre [script.google.com](https://script.google.com/) con la cuenta que puede abrir los dos Google Sheets.
2. Pulsa **Nuevo proyecto** y ponle un nombre como `Servicio Dashboard JER 22 Tableros`.
3. Abre el archivo `apps-script/Code.gs` de este proyecto descargado y copia su contenido completo.
4. En el editor de Google, borra el contenido inicial de `Code.gs`, pega lo copiado y pulsa **Guardar**.
5. A la izquierda, abre **Configuración del proyecto** (engranaje). En **Zona horaria** elige `America/Bogota`. Busca **Propiedades del script** y añade **una propiedad por fila**:

| Propiedad (cópiala exactamente) | Valor que debes poner |
|---|---|
| `SPREADSHEET_ID_BOYACA` | ID de la copia *Google Sheets* de Boyacá. |
| `SPREADSHEET_ID_AMAZONAS` | ID de la copia *Google Sheets* de Amazonas. |
| `FIREBASE_API_KEY` | Mismo `apiKey` de la app web Firebase. Es un identificador público de la app, no una contraseña. |
| `FIREBASE_PROJECT_ID` | Mismo `projectId` de Firebase. |
| `AUTHORIZED_EMAILS` | Correos autorizados separados por coma, por ejemplo `ana@empresa.com,luis@empresa.com`. Inicialmente incluye tu correo de prueba. |
| `ALLOWED_ORIGINS` | Origen exacto del sitio, por ejemplo `https://tu-usuario.github.io` **sin** ruta ni barra final. Para pruebas puedes agregar `http://localhost:5500`, separado por coma. |

6. Guarda las propiedades. Si todavía no conoces tu usuario o repositorio GitHub, puedes completar `ALLOWED_ORIGINS` después; recuerda volver a probar.
7. Arriba, en el desplegable de funciones, selecciona **`probarConexion`** y pulsa **Ejecutar**. Google solicitará permisos: autoriza el acceso a las hojas y a la conexión de validación de Firebase. Abre **Registro de ejecución**: debe mostrar ambos nombres de libro y las hojas faltantes esperadas. Por ejemplo, que Amazonas no tenga `Formularios Empresa` es normal.
8. Si `probarConexion` dice que falta una propiedad, revisa la ortografía y los valores de la tabla anterior. Si aparece un error de acceso, comprueba que la cuenta del script tenga acceso **a los dos** libros.

### Publica Apps Script como aplicación web

9. Pulsa **Implementar → Nueva implementación**.
10. En **Seleccionar tipo**, escoge **Aplicación web**.
11. En **Ejecutar como**, elige **Yo** (la cuenta con acceso a los dos Sheets).
12. En **Quién tiene acceso**, elige **Cualquier persona** para que GitHub Pages pueda enviar una solicitud sin sesión Google. La URL es invocable, pero el código no devuelve datos sin un token Firebase válido y un correo incluido en la lista.
13. Pulsa **Implementar**. Google puede pedirte autorizar de nuevo. Copia la **URL de la aplicación web** que termina en `/exec`. No copies la URL de edición del proyecto ni una URL terminada en `/dev`.
14. Cada vez que modifiques `Code.gs`, usa **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**. Guardar el código en el editor por sí solo no actualiza `/exec`.

El `doGet` de este servicio solo muestra un mensaje informativo. Los datos viajan en solicitudes `POST` enviadas desde el sitio, y Apps Script devuelve el resultado a la pestaña correcta mediante un mensaje de iframe. El servidor valida el token con Google Identity Platform y comprueba correo verificado, proyecto Firebase, lista autorizada y origen permitido.

## 4. Edita la configuración pública del sitio

1. Abre `js/config.js` con VS Code o un editor de texto. Verás cinco valores `PEGA_AQUI_...`.
2. En `appsScriptUrl`, pega la URL `/exec` del paso 13 **entre las comillas**.
3. En `firebase`, pega `apiKey`, `authDomain`, `projectId` y `appId` del paso 2. Conserva comillas, comas, llaves y nombres de propiedad. Ejemplo de forma (los valores son ilustrativos):

```js
export const CONFIG = Object.freeze({
  appName: 'Centro de Control JER',
  appsScriptUrl: 'https://script.google.com/macros/s/ID_REAL/exec',
  firebase: {
    apiKey: 'CLAVE_PUBLICA_REAL',
    authDomain: 'tu-proyecto.firebaseapp.com',
    projectId: 'tu-proyecto',
    appId: '1:123:web:abc'
  }
});
```

4. Guarda. **No** pongas en `config.js` los IDs de las hojas, `AUTHORIZED_EMAILS`, contraseñas de usuarios, tokens o claves de cuenta de servicio. Los IDs se guardan en las propiedades de Apps Script.

## 5. Prueba primero en tu computador

1. En VS Code, abre **la carpeta** `dashboard-jer-22-tableros`, no solo `index.html`.
2. Puedes instalar la extensión **Live Server**, abrir `index.html` y pulsar **Go Live**. Otra opción, con Python instalado, es abrir una terminal dentro de la carpeta y ejecutar `python -m http.server 5500`.
3. Entra a `http://localhost:5500` (o el puerto indicado por Live Server). No abras `index.html` mediante `file://`.
4. Si usaste el puerto 5500, comprueba que `ALLOWED_ORIGINS` contenga exactamente `http://localhost:5500`. `localhost` y `127.0.0.1` son orígenes distintos: añade el que realmente usas.
5. Crea una cuenta de prueba en la pantalla del dashboard. Abre el correo de verificación y confirma la dirección.
6. Agrega ese correo a `AUTHORIZED_EMAILS`. Inicia sesión y pulsa **Actualizar**. Deben aparecer los tableros que tengan datos en los meses elegidos.
7. Prueba otro correo **verificado pero no incluido** en `AUTHORIZED_EMAILS`: podrá iniciar sesión, pero la consulta debe mostrar **«Tu correo no está autorizado o verificado»** y no debe recibir datos.
8. Vuelve a la cuenta autorizada. Revisa la pestaña 3: cuatro parejas independientes de mínimos. Revisa la 10: solo Boyacá. La 17 muestra únicamente pólizas. Cambia a una UAD y verifica que los totales sin desglose se identifiquen como regionales.
9. Pulsa **PDF de esta pestaña** y luego **Informe PDF completo**. Abre ambos archivos descargados y revisa tablas largas y saltos de página. El PDF completo puede tardar porque consulta cada pestaña antes de generarlo.

## 6. Publica en GitHub Pages

1. En GitHub, crea un repositorio nuevo, por ejemplo `dashboard-contractual-jer`. **GitHub Pages puede ser público:** sube solamente el código de esta carpeta; **no subas** los Excel, capturas con datos reales ni PDF descargados.
2. Dentro del repositorio, elige **Add file → Upload files**. Selecciona `index.html` y las carpetas `css`, `js` y `apps-script`, más `README.md`. Mantén `index.html` en la **raíz** del repositorio. También puedes subir todos los archivos de esta carpeta; los tests no contienen datos reales.
3. Confirma la carga en la rama `main`.
4. Ve a **Settings → Pages**. En **Build and deployment**, elige **Deploy from a branch**, rama **`main`**, carpeta **`/(root)`**. Guarda.
5. Espera a que GitHub muestre la URL, por ejemplo `https://tu-usuario.github.io/dashboard-contractual-jer/`.
6. En Firebase, autoriza **`tu-usuario.github.io`** en los dominios de Authentication.
7. En Apps Script, pon **`https://tu-usuario.github.io`** en `ALLOWED_ORIGINS` (sin `/dashboard-contractual-jer/`). Si ya estaba ahí, no cambies nada.
8. Abre la URL pública, inicia sesión y repite las pruebas de correo autorizado/no autorizado, filtros y PDF. La mera aparición de la pantalla de acceso **no demuestra** que el servidor esté conectado; confirma una consulta real.

Para actualizar el diseño, reemplaza los archivos del repositorio y espera la nueva publicación. Para actualizar `Code.gs`, también despliega una **nueva versión** de Apps Script. Para actualizar cifras, edita Google Sheets: al pulsar **Actualizar**, el dashboard volverá a consultar las hojas.

## 7. Cómo se usan los filtros

- **Período:** año completo, trimestre, semestre o una selección manual de meses. En los tableros de ventas, los años 2025 y 2026 son columnas de comparación de los archivos; el filtro elige **meses**, no inventa años adicionales.
- **Departamento:** ambos (Boyacá arriba y Amazonas abajo), solo Boyacá o solo Amazonas.
- **UAD / zona:** las ocho zonas registradas para Boyacá y Leticia para Amazonas. Una UAD concreta limita las hojas con columna `ZONA`. Una hoja sin desglose por UAD conserva su total regional con una advertencia visible. Si eliges una UAD de Boyacá, no se muestra el bloque de Amazonas, porque esa UAD no existe allí.
- **Obligación:** categorías temáticas que ayudan a encontrar las pestañas correspondientes. **No existe una columna universal `OBLIGACIÓN`** en los libros, por eso este filtro determina las pestañas visibles; no modifica silenciosamente los valores de una hoja.
- **Ajuste de esta pestaña:** abre el cuadro donde puedes heredar o reemplazar meses, departamento, UAD y obligación solo para la pestaña activa. En obligación puedes dejar la global, elegir «Todas» o confirmar el tema de esta pestaña; un tema diferente se consulta abriendo su propia pestaña. Se guarda en `localStorage` de ese navegador; no se sincroniza entre personas ni equipos. **Quitar ajuste individual** restaura los filtros globales.

Cada sección del tablero es **su propia tabla y su propia gráfica**. Por ejemplo, municipios, PDV, fuerza de venta y terminales son cuatro parejas distintas en Boyacá y cuatro en Amazonas. No se crea un bloque si la hoja correspondiente no existe para esa región.

## 8. Decisiones sobre los datos recibidos

- El tablero **1** tiene seis posiciones: gráficas de Chance y apuestas permanentes arriba; cumplimiento Chance y derechos en medio; requerimientos y capacitación abajo. Los dos últimos muestran **«Sin fórmula/meta definida»** porque los archivos no contienen numerador/denominador suficiente para calcular un porcentaje fiable. En Amazonas esas dos hojas no existen.
- El tablero **8** conserva literalmente `-1` y `100` en efectividad. No se reescalan ni se sustituyen.
- El tablero **10** lee **compra = columna D** y **saldo = `INVENTARIO BODEGA`, columna F** de `Formularios Empresa` en Boyacá. No hay hoja equivalente en Amazonas. `ENVIO` y `TOT` de `Formularios zona` no se presentan como compra ni saldo de bodega.
- El tablero **17** muestra las dos clases de póliza de los libros. En la copia de Boyacá solo están diligenciados sus encabezados. No se agregan «documentos legales / PDV» porque no hay hoja de origen identificada.
- El tablero **19** muestra una pareja por reporte 207, 219 y cada código AP. La gráfica representa **presencia de un registro**, no interpreta el radicado como una cantidad para sumar. La tabla conserva el valor exacto.
- `VENTA POR MODALIDAD` en Boyacá y `VENTA POR MODALIUDAD` en Amazonas se ubican **provisionalmente** al final de la pestaña 22, porque el apunte manuscrito aparece después de «Capacitación» sin un número propio. Puedes mover esa sección editando `js/catalog.js` y los permisos de hoja en `apps-script/Code.gs`.
- El PDF completo incluye **todos los registros de las tablas**. En gráficas muy largas se muestran los primeros 14 registros y se indica esa limitación en el propio PDF; la tabla sigue completa.

## 9. Si aparece un error

| Síntoma | Qué comprobar |
|---|---|
| «Falta conectar el proyecto» | Revisa los cinco valores en `js/config.js`; la URL debe terminar exactamente en `/exec`. |
| No llega correo de verificación | Comprueba spam y la plantilla de correo de Firebase. |
| Inicia sesión pero no hay datos | Mira `AUTHORIZED_EMAILS`, `FIREBASE_PROJECT_ID`, correo verificado y acceso del propietario del script a **ambos** libros. |
| «Origen o solicitud no autorizados» | `ALLOWED_ORIGINS` debe tener origen exacto, por ejemplo `https://usuario.github.io`, sin ruta. |
| Apps Script no responde | Confirma implementación `/exec`, permisos de Web App, versión publicada, navegador y errores en **Ejecuciones** de Apps Script. |
| Una sección dice «Faltan columnas» | Compara encabezados y espacios con `js/catalog.js`. Especial cuidado con `CAPACITACIONES ` (espacio final) y `VENTA POR MODALIUDAD` (así se llama la hoja Amazonas). |
| Un mes muestra «Sin dato» | La celda está vacía o contiene un error en el libro; cero es un dato distinto. |
| PDF no descarga | Revisa la conexión al recurso `jsPDF` y permite la descarga del navegador; para informes completos, espera a que consulte las pestañas. |

## 10. Comprobaciones antes de entregar a la empresa

1. Consulta con correo autorizado, no autorizado, no verificado y sin iniciar sesión.
2. Quita un correo de `AUTHORIZED_EMAILS` y comprueba que en la **siguiente consulta** ya no accede.
3. Prueba meses sueltos, trimestres, una UAD de Boyacá, Leticia, ambas regiones y ajustes individuales.
4. Verifica totales y porcentajes contra la copia Google Sheets de cada región, en especial el resumen comercial, premios y derechos de explotación.
5. Exporta el PDF completo y revisa que no falten temas ni se corten filas largas.
6. Mantén los Excel originales y los Google Sheets fuera del repositorio público.

## 11. Pruebas del código

Si tienes Node.js instalado, desde esta carpeta ejecuta `node --test tests/*.test.mjs`. Esas pruebas usan datos inventados. No requieren acceso a Firebase ni a los Sheets reales. La prueba final de conexión se hace siguiendo los pasos 5 y 6 con cuentas reales autorizadas.
