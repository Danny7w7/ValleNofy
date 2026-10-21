# ValleNofy 🪗

**Cinco canciones para arrancar. Toda una parranda por descubrir.**

Aplicación académica de recomendación de vallenato, creada a partir de la idea de **Danny Zabaleta**. El nombre combina *vallenato* y *Spotify*. El catálogo curado está limitado a grabaciones publicadas hasta **2013 inclusive**, con canciones de **La 9a Batalla** y de épocas anteriores. Al buscar por título o intérprete también se consultan canciones de Apple Music Colombia con año confirmado hasta 2013.

El usuario escoge cinco canciones, recibe sugerencias y responde con expresiones costeñas. Sus gustos quedan en una biblioteca por navegador, almacenada en SQLite.

> **Para el profesor:** el [historial de prompts](#historial-de-prompts-y-actualizaciones) reproduce el mensaje que originó esta aplicación y registra las actualizaciones solicitadas. Es parte de la entrega y debe conservarse en futuras modificaciones.

## Iniciar con doble clic en Windows

1. Tener instalado **Python 3.12, 3.13 o 3.14 de 64 bits** y **Node.js 22.12+ o 24 LTS**, con npm y sus ejecutables disponibles en `PATH`.
2. Abrir **`iniciar.bat`** con doble clic desde la carpeta del proyecto.
3. Esperar la preparación inicial. Se abrirá **http://127.0.0.1:8000** automáticamente.
4. Mantener abierta la consola mientras se usa la aplicación. Detener con `Ctrl+C`.

Descargas oficiales: [Python para Windows](https://www.python.org/downloads/windows/) y [Node.js](https://nodejs.org/en/download). El lanzador detecta si falta alguno y muestra cómo continuar; no instala programas de sistema.

**La primera preparación necesita Internet** para descargar dependencias. Las siguientes reutilizan las dependencias y la compilación si no cambiaron sus archivos. El catálogo curado, las recomendaciones y la biblioteca funcionan localmente después de preparar el proyecto. La búsqueda ampliada en Apple Music, los reproductores y los enlaces a YouTube y Spotify necesitan Internet.

El `.bat` crea o reutiliza `venv/`, instala Python exclusivamente ahí, instala JavaScript en `Frontent/node_modules/`, compila React, aplica migraciones, carga las canciones sin duplicarlas, prepara los archivos estáticos e inicia el servidor local. **No instala paquetes globales ni borra los gustos.**

El servidor queda limitado a la interfaz local `127.0.0.1`. React compilado y Django se sirven desde el mismo origen mediante Waitress y WhiteNoise.

Opciones desde una terminal en la raíz:

```bat
iniciar.bat --port 8001
iniciar.bat --no-browser
iniciar.bat --prepare-only
```

`--prepare-only` completa la instalación, compilación y carga de datos sin dejar un servidor ejecutándose. Si se vuelve a abrir el `.bat` mientras esta misma instalación está funcionando en ese puerto, se abre la aplicación existente.

## Cómo se usa

1. Buscar en el catálogo curado o escribir un título o intérprete para consultar Apple Music Colombia. Apple puede clasificar un vallenato con un género general como «Latino», así que el usuario confirma qué resultados son vallenato. Solo se pueden escoger **exactamente cinco canciones diferentes** con año conocido hasta 2013.
2. Al escoger una canción, aparece su reproductor de Apple Music en el panel de las cinco elegidas. Se puede cambiar la canción del preview con el botón de audífonos junto a cada seleccionada.
3. Iniciar la parranda para ver una recomendación a la vez, con una explicación de afinidad y su reproductor incrustado. El reproductor no se inicia solo; la muestra puede durar hasta 30 segundos.
4. Usar **Escuchar en YouTube** o **Escuchar en Spotify** si se quiere buscar la grabación completa. Esos botones abren resultados de búsqueda en otra pestaña. Si Apple Music no encuentra un reproductor compatible, la canción sigue disponible en esos enlaces.
5. Reaccionar:

| Expresión | Preferencia | Influencia |
| --- | --- | --- |
| Esa canción me da sed | Me gusta | Peso positivo 1 |
| ¡Sírvelooo! | Favorita especial | Peso positivo 3 |
| Paso, compae | No me gusta | Perfil negativo |

5. Consultar la biblioteca y cambiar una reacción cuando se quiera. Las cinco canciones iniciales también se guardan como gustos normales.

La última reacción de una canción reemplaza la anterior: no se acumulan votos al pulsar varias veces. Las sugerencias excluyen las cinco canciones iniciales y las ya calificadas. Al completar el catálogo, se muestra un estado de finalización y se puede revisar la biblioteca.

**Identidad por navegador:** Django guarda un identificador en una cookie persistente de un año; los datos musicales viven en SQLite, no en `localStorage`. Volver con el mismo navegador y dirección recupera la biblioteca. Borrar cookies, usar modo privado, cambiar de navegador o pasar de `127.0.0.1` a `localhost` crea otra identidad; la biblioteca anterior no se borra de la base de datos, pero ese navegador pierde su identificación. No hay registro, contraseña ni sincronización entre dispositivos.

Cambiar las cinco canciones conserva el resto del historial; volver a escoger una canción descartada la convierte en gusto positivo. Si todas las preferencias terminan siendo negativas, se solicita una selección nueva.

## Cómo recomienda: explicación para la sustentación

Se utiliza **filtrado basado en contenido**, con scikit-learn:

1. Cada canción se representa mediante términos de **intérprete principal, década y etiquetas musicales**. El término del intérprete se incluye dos veces para darle algo más de influencia; el cantante mantiene su identidad aunque cambie de acordeonero entre álbumes. El título y el álbum se usan para presentar y buscar, no como señales de similitud.
2. `TfidfVectorizer` aprende el vocabulario y la frecuencia inversa de esos términos a partir del catálogo. Produce un vector normalizado por canción.
3. Se calcula el promedio ponderado de los vectores que gustan: peso `1` para los gustos normales y `3` para las favoritas especiales. Las cinco canciones iniciales participan como gustos normales, sin contarse dos veces.
4. Se calcula por separado el promedio de canciones rechazadas, si existen.
5. Para cada candidata se calcula:

```text
puntuación = coseno(canción, perfil positivo)
             - 0.5 × coseno(canción, perfil negativo)
```

6. Se ordenan las candidatas por puntuación y se devuelven hasta diez; la interfaz presenta una por una. Después de cada reacción se vuelve a calcular el perfil y la lista.

La puntuación es una **medida de afinidad**, no una probabilidad de que guste la canción. El vocabulario y los valores TF-IDF se ajustan al catálogo; los pesos `1`, `3` y `0.5` son decisiones explícitas del diseño, no parámetros aprendidos de un conjunto de evaluaciones.

Las explicaciones comparan la candidata con una canción positiva cercana y mencionan coincidencias reales de intérprete, etiquetas o década. Las etiquetas son curaduría editorial. El sistema no analiza audio, letras, tonos ni instrumentos grabados; tampoco usa una API de inteligencia artificial, datos de Spotify o historiales de otras personas.

La matriz del catálogo se conserva en memoria y se vuelve a generar cuando cambian sus características. El perfil se reconstruye desde SQLite. No hace falta descargar ni distribuir un modelo externo.

Referencias técnicas: [TF-IDF en scikit-learn](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html), [similitud de coseno](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.pairwise.cosine_similarity.html) e [instalación aislada de scikit-learn](https://scikit-learn.org/stable/install.html).

## Arquitectura y archivos

```text
ValleNofy/
├── Backend/                  Django, API, recomendador y servidor local
│   ├── config/               Configuración y rutas
│   ├── music/                Modelos, vistas, migraciones y recomendador
│   │   └── data/catalog.json Catálogo y fuentes de los metadatos
│   ├── manage.py
│   ├── requirements.txt      Versiones fijadas, incluidas las transitivas
│   ├── serve.py              Waitress + apertura del navegador
│   └── db.sqlite3            Se genera localmente; no se versiona
├── Frontent/                 React + Vite (nombre solicitado)
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   └── dist/                 Compilación generada
├── scripts/bootstrap.py      Preparación y detección de cambios
├── venv/                     Entorno virtual local generado
├── iniciar.bat
├── readme.md
└── .gitignore
```

**Tecnologías:** Django 5.2 LTS, React, Vite, SQLite3, scikit-learn, Waitress y WhiteNoise. La configuración usa la zona horaria `America/Bogota`. Las versiones exactas de las dependencias Python están en `Backend/requirements.txt`; las de JavaScript se fijan en `Frontent/package-lock.json`.

**Modelo de datos:** canciones con metadatos, género, identificador opcional de Apple, marca de pertenencia al catálogo recomendado y caché del reproductor; perfiles con UUID y cinco canciones iniciales; reacciones con restricción única por perfil y canción y fecha de actualización. Una restricción de base de datos impide guardar años posteriores a 2013. Las canciones elegidas desde Apple se guardan en SQLite, pero quedan fuera de las candidatas recomendables. Las migraciones quedan versionadas. El catálogo curado se carga por una clave estable para preservar identificadores y gustos en arranques posteriores.

El catálogo curado documenta fuentes primarias en `Backend/music/data/catalog.json`: cada canción tiene `source_url` y el documento incluye una lista de fuentes. Al escribir una búsqueda, el backend consulta la iTunes Search API de Apple para Colombia y combina los resultados con el catálogo local. Solo deja escoger canciones con año confirmado entre 1900 y 2013; si Apple no responde, permanecen visibles las coincidencias locales. El género de Apple se muestra como metadato, pero no se usa como filtro estricto porque puede ser general.

Las canciones de Apple se vuelven a confirmar por su identificador al guardar las cinco preferencias y sus metadatos quedan en SQLite. El recomendador usa las preferencias de Apple para aprender afinidad por intérprete, década y vallenato, pero estas canciones no se agregan al conjunto curado de candidatas. Al pedir un preview, ValleNofy transforma el enlace de pista de Apple en la URL del reproductor oficial incrustado. El audio permanece alojado y se reproduce en el iframe de Apple Music; Apple puede ofrecer clips o reproducción completa según la cuenta y el contenido. ValleNofy no descarga ni distribuye audio ni letras. Ver [Apple Music Embeds](https://artistsupport.cdn-apple.com/support/1117-apple-music-marketing-tools) y la [documentación de iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/UnderstandingSearchResults.html). Las ilustraciones de la interfaz son SVG locales.

### API JSON

| Método y ruta | Uso |
| --- | --- |
| `GET /api/health/` | Estado e identificador de instalación del servidor |
| `GET /api/profile/` | Perfil, cinco canciones iniciales, estadísticas y cookie CSRF |
| `GET /api/songs/?q=...&artist=...` | Búsqueda local del catálogo curado |
| `GET /api/songs/search/?q=...&artist=...` | Coincidencias locales y resultados de Apple Music Colombia; devuelve género, preview y aviso si Apple no responde |
| `GET /api/songs/7/preview/` | URL del reproductor Apple Music para esa canción, o estado sin preview disponible |
| `POST /api/onboarding/` | Guardar cinco referencias mixtas, por ejemplo tres `catalog` y dos `apple` en `{"songs": [{"source": "catalog", "id": 1}, {"source": "catalog", "id": 2}, {"source": "catalog", "id": 3}, {"source": "apple", "track_id": "123456789"}, {"source": "apple", "track_id": "987654321"}]}` |
| `GET /api/recommendations/` | Recomendaciones con canción, puntuación, motivo y cantidad restante |
| `PUT /api/reactions/7/` | Guardar `{"reaction": "like"}`, `"love"` o `"dislike"` |
| `GET /api/library/` | Biblioteca, reacciones, marca de canción inicial y estadísticas |

La identidad se obtiene de la sesión del servidor; no se acepta un identificador de perfil enviado por el cliente. Las escrituras requieren el encabezado `X-CSRFToken` con el valor de la cookie `csrftoken`. Los errores de validación de la API devuelven `{"error": "mensaje"}`. La búsqueda local ignora mayúsculas y tildes. Las actualizaciones de preferencias se realizan dentro de transacciones.

## Desarrollo y mantenimiento

Preparar primero con `iniciar.bat --prepare-only`. Después, en dos terminales desde la raíz:

```powershell
# Terminal 1: Django
.\venv\Scripts\python.exe Backend\manage.py runserver 127.0.0.1:8000
```

```powershell
# Terminal 2: React con recarga automática
cd Frontent
npm.cmd run dev
```

Abrir **http://localhost:5173**. Vite envía `/api/` a Django mediante un proxy; se mantiene el flujo de cookies y CSRF. La biblioteca usada desde Vite puede ser diferente de la de `127.0.0.1:8000` porque las cookies se distinguen por dominio.

Comandos administrativos, siempre con el Python local:

```powershell
.\venv\Scripts\python.exe Backend\manage.py check
.\venv\Scripts\python.exe Backend\manage.py migrate
.\venv\Scripts\python.exe Backend\manage.py seed_catalog
.\venv\Scripts\python.exe Backend\manage.py test music
```

Para administrar el catálogo de forma opcional, crear un superusuario con `Backend\manage.py createsuperuser`, ejecutado también con `venv\Scripts\python.exe`, y entrar en `/admin/`. No se entrega una contraseña predeterminada. El comando de carga actualiza los metadatos de las canciones incluidas en el JSON; los cambios permanentes en esas canciones deben reflejarse también en el catálogo fuente.

Para entregar en otro computador, copiar el código completo, incluidos migraciones, catálogo y `package-lock.json`. No copiar `venv`, `node_modules` ni secretos: el `.bat` los prepara localmente. La base SQLite se excluye de Git; una entrega nueva arranca con biblioteca vacía. Para conservar una instalación local, respaldar `Backend/db.sqlite3` y `.local-secret` con el servidor detenido; se necesitan también las cookies del navegador para reconocer los perfiles existentes.

### Validación de la entrega — 20 de octubre de 2026

| Comprobación | Resultado |
| --- | --- |
| `manage.py check` y `makemigrations --check --dry-run` | Sin problemas ni migraciones pendientes de generar. |
| Pruebas de Django | **22 pruebas aprobadas**, con casos de selección inicial inválida, cookies, aislamiento entre perfiles, CSRF, cambios de reacción, carga idempotente y comportamiento del recomendador. |
| Compilación React/Vite | Completada con las versiones fijadas en el lockfile. |
| `.bat`, preparación y arranque posterior | Probados: instala localmente, compila, prepara SQLite y reutiliza dependencias y compilación en ejecuciones posteriores. |
| Recorrido real en Edge | Selección de cinco canciones, recomendación, favorita especial, pestañas de biblioteca, cambio a rechazo, edición de las cinco y persistencia al recargar. |
| Navegación y presentación | Cierre del diálogo con Escape; vistas de computador y móvil; sin desbordamiento horizontal a 390 y 320 píxeles en la vista de recomendación. |

Las pruebas usan una base temporal de Django; la inspección de interfaz utiliza un perfil de navegador separado. Las comprobaciones del navegador cargaron React y la API desde el mismo servidor local y no registraron excepciones de JavaScript.

## Problemas comunes

| Situación | Solución |
| --- | --- |
| Python o Node no se encuentran | Instalar las versiones indicadas, agregarlas al PATH y abrir una terminal nueva. |
| Una descarga falla | Revisar Internet o el proxy, y ejecutar otra vez el `.bat`; los pasos completados se reutilizan. |
| npm muestra `EPERM` o un archivo de Rolldown bloqueado | Cerrar la terminal de `npm run dev` de este proyecto antes de actualizar dependencias y volver a abrir el `.bat`. Windows impide reemplazar módulos nativos mientras están en uso. |
| Puerto 8000 ocupado | Detener la otra aplicación o ejecutar `iniciar.bat --port 8001`. No se matan procesos ajenos. |
| El navegador no se abre | Copiar la dirección que muestra la consola. |
| El navegador dice que no conecta | Mantener abierta la consola del servidor y revisar allí si hubo un error. |
| No aparece la biblioteca anterior | Usar el mismo navegador, sin modo privado, y la misma dirección de acceso. |
| Falta la compilación o un archivo | Volver a ejecutar `iniciar.bat`; copiar la entrega completa si falta código fuente. |
| Se movió un entorno virtual desde otro equipo | No distribuir el entorno; renombrar `venv` para conservarlo y dejar que el `.bat` cree uno nuevo. |
| Cambiaron las dependencias | Volver a abrir el `.bat`; compara las huellas de requirements y package-lock antes de instalar. |

---

## Historial de prompts y actualizaciones

**Regla de mantenimiento:** conservar íntegro el prompt original y añadir las nuevas solicitudes funcionales del usuario en orden cronológico, sin sustituir las anteriores. Registrar debajo las decisiones tomadas para implementarlas. Los mensajes administrativos excluidos explícitamente por el usuario no forman parte de este historial.

### 1. Prompt original — 20 de octubre de 2026

Se reproduce tal como fue recibido, incluida su escritura:

```text
Colega, vamos a crear un sistema ValleNofy o SpoNato (La que suene mejor con esa nos quedamos) (El nombre es la mezcla de vallenato con Spotify)

En ese sistema vamos a seleccionar 5 canciones de vallenato preferidas y el te va a recomendar las canciones.

Las canciones se van a ir mostrando y el usuario tendrá la posibilidad dedecir "Esa canción me da sed" o "Sirvelooo", etc (haciendo alusión a que le gusta mucho) o algo parecido pero con la jerga costeña cuando no le gusta.

Los gustos del usuario se van a ir guardando como en una especie de biblioteca.

Vas a utilizar Django + React usando Vite y la base de datos SQLite3

Vas a manejar la raíz del proyecto con
Backend
Frontent

Vas a crearme también un venv, no me vayas a instalar cosas globales que me dañas mis otros proyectos.
Vas a crearle un readme.md para el proyecto junto a su .gitignore
Vas a crear un .bat para que el profesor solo al darle click le ejecute y funcione el sistema.

Vas a hacer full enfacis o en el readme.md vas a copiar este promt y lo vas a poner para que el profesor pueda ver de donde salió el promt de esta aplicación (Y si te pido actualizaciones también las vas a agregar)

Un saludo Jorge Torres :D
```

### 2. Decisiones de diseño — 20 de octubre de 2026

En las preguntas de planificación, el usuario seleccionó:

- **Enlaces externos:** buscar las canciones en YouTube o Spotify.
- **Perfil en este navegador:** biblioteca persistente sin registro ni contraseña.
- **Parranda costeña:** interfaz musical oscura con acentos cálidos.
- **Aprendizaje automático:** vectores de características y similitud mediante una biblioteca de machine learning.

Se adoptó el nombre **ValleNofy** y se mantuvo **Frontent**, tal como se solicitó.

### 3. Actualización del catálogo — 20 de octubre de 2026

Respuesta textual del usuario al preguntar qué selección musical incluir:

```text
Ponme vallenatos de la 9na batalla de silvestre dangond para atras (2013) esos vallenatos de hoy en dia eso no es pa hombres
```

**Aplicación del cambio:** limitar el catálogo a publicaciones hasta 2013 inclusive, incorporar canciones de *La 9a Batalla* y seleccionar repertorio de épocas anteriores.

### 4. Solicitud de implementación — 20 de octubre de 2026

```text
Implement the plan.
```

**Alcance acordado:** catálogo de 60 canciones, cinco preferencias iniciales, recomendador TF-IDF con similitud de coseno y reacciones ponderadas, biblioteca por navegador, Django/React/SQLite, entorno aislado y arranque local mediante doble clic.

### 5. Solicitud de preview de canciones — 20 de octubre de 2026

```text
Perfecto colega, maravilloso, me gustaria que hubiera un preview de la cancion cuando la seleccionamos y cuando aparece.
```

**Aplicación inicial:** mostrar botones **Escuchar en YouTube** y **Escuchar en Spotify** junto a las canciones del catálogo y en cada recomendación. La solicitud siguiente aclaró que también se necesita un reproductor dentro de ValleNofy.

### 6. Aclaración del preview integrado — 20 de octubre de 2026

```text
Colega, lo que yo te estoy pidiendo es algo como agregar un Iframe o algo por el estilo.
```

**Aplicación del cambio:** incrustar el reproductor de Apple Music de la pista elegida y de cada recomendación. Al elegir una canción, el panel de selección muestra su reproductor; los audífonos junto a cada una permiten cambiar cuál se previsualiza. El reproductor no inicia automáticamente. Los enlaces a YouTube y Spotify quedan como alternativas. Si no hay un embed compatible, se muestra el enlace de Apple Music disponible.

### 7. Búsqueda de canciones en Apple Music — 20 de octubre de 2026

```text
Quiero que el buscar del comienzo pueda buscar cualquier cancion (Que sea vallenato) y poner el preview entonces con apple.
```

**Decisiones acordadas:** conservar el límite de 2013 inclusive; mostrar el género que devuelve Apple y dejar que el usuario confirme que sea vallenato; guardar las canciones escogidas como preferencias en SQLite y usarlas para orientar el recomendador, manteniendo el catálogo curado como conjunto de candidatas.
