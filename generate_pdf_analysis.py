import sys
import os
import subprocess

# 1. Instalar fpdf2 de manera automática si no está presente
try:
    from fpdf import FPDF
except ImportError:
    print("La librería fpdf2 no está instalada. Instalándola ahora...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "fpdf2"])
        from fpdf import FPDF
        print("fpdf2 instalada correctamente.")
    except Exception as e:
        print(f"Error al instalar fpdf2: {e}")
        print("Intentando continuar con pip estándar...")
        try:
            subprocess.check_call(["pip", "install", "fpdf2"])
            from fpdf import FPDF
        except Exception as e2:
            print(f"Error crítico al instalar dependencias: {e2}")
            sys.exit(1)

# 2. Definición del helper de codificación para evitar errores con fuentes core
def clean(text):
    if not text:
        return ""
    # Reemplazar comillas tipográficas y guiones largos que no están en latin-1
    replacements = {
        '\u201c': '"', '\u201d': '"',
        '\u2018': "'", '\u2019': "'",
        '\u2014': '-', '\u2013': '-',
        '\u00a0': ' ', '\u2026': '...',
        'á': '\u00e1', 'é': '\u00e9', 'í': '\u00ed', 'ó': '\u00f3', 'ú': '\u00fa',
        'Á': '\u00c1', 'É': '\u00c9', 'Í': '\u00cd', 'Ó': '\u00d3', 'Ú': '\u00da',
        'ñ': '\u00f1', 'Ñ': '\u00d1', 'ü': '\u00fc', 'Ü': '\u00dc',
        '¿': '\u00bf', '¡': '\u00a1', 'º': '\u00ba', 'ª': '\u00aa'
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    # Codificar en latin-1 ignorando caracteres incompatibles residuales
    return text.encode('latin-1', errors='replace').decode('latin-1')

# 3. Clase PDF con diseño premium
class SystemAnalysisPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_margins(20, 20, 20)
        self.alias_nb_pages()

    def header(self):
        if self.page_no() == 1:
            # No poner encabezado en la portada
            return
        
        # Color azul oscuro institucional (#081C3A)
        self.set_text_color(8, 28, 58)
        self.set_font("helvetica", "B", 8)
        self.cell(0, 6, clean("DASHBOARD DE INCIDENCIA DELICTIVA EN MÉXICO — ANÁLISIS DEL SISTEMA"), 0, 0, "L")
        
        # Fecha a la derecha
        self.set_font("helvetica", "", 8)
        self.set_text_color(100, 116, 139) # Gris azulado
        self.cell(0, 6, clean("Mayo 2026"), 0, 1, "R")
        
        # Línea divisoria en color dorado (#C8A96B)
        self.set_draw_color(200, 169, 107)
        self.set_line_width(0.4)
        self.line(20, 26, 190, 26)
        self.ln(6)

    def footer(self):
        if self.page_no() == 1:
            # No poner pie en la portada
            return
        
        # Línea superior de pie de página
        self.set_draw_color(226, 232, 240)
        self.set_line_width(0.3)
        self.line(20, 282, 190, 282)
        
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(100, 116, 139)
        self.cell(0, 10, clean("Documento de Análisis de Software Confidencial e Interno"), 0, 0, "L")
        self.cell(0, 10, clean(f"Página {self.page_no()} de {{nb}}"), 0, 0, "R")

    def cover_page(self):
        self.add_page()
        # Fondo decorativo
        self.set_fill_color(8, 28, 58) # Azul institucional
        self.rect(0, 0, 210, 297, "F")
        
        # Franja decorativa dorada
        self.set_fill_color(200, 169, 107) # Dorado
        self.rect(0, 95, 210, 8, "F")

        # Título principal
        self.set_y(115)
        self.set_font("helvetica", "B", 26)
        self.set_text_color(255, 255, 255)
        self.multi_cell(0, 12, clean("DASHBOARD DE INCIDENCIA\nDELICTIVA EN MÉXICO"), 0, "L")
        
        self.ln(5)
        
        # Subtítulo
        self.set_font("helvetica", "", 13)
        self.set_text_color(200, 169, 107)
        self.multi_cell(0, 6, clean("Análisis Técnico del Sistema, Herramientas, Funcionalidades e Instructivo de Ejecución"), 0, "L")
        
        # Datos del proyecto en la parte inferior
        self.set_y(230)
        self.set_text_color(255, 255, 255)
        self.set_font("helvetica", "B", 10)
        self.cell(0, 5, clean("Entorno de Producción: Local (Desarrollo/Evaluación)"), 0, 1, "L")
        self.set_font("helvetica", "", 10)
        self.set_text_color(209, 213, 219)
        self.cell(0, 5, clean("Arquitectura: Backend decoupled (Python/FastAPI) + Frontend (React/Vite)"), 0, 1, "L")
        self.cell(0, 5, clean("Base de Datos Analítica: DuckDB (sobre archivos Parquet optimizados)"), 0, 1, "L")
        
        self.ln(10)
        self.set_draw_color(200, 169, 107)
        self.set_line_width(0.5)
        self.line(20, 255, 70, 255)
        
        self.set_y(260)
        self.set_font("helvetica", "I", 9)
        self.set_text_color(156, 163, 175)
        self.cell(0, 5, clean("Cesar Ernesto Salazar Buelna + Antigravity AI"), 0, 1, "L")
        self.cell(0, 5, clean("Fecha de Emisión: 21 de Mayo de 2026"), 0, 1, "L")

    def add_chapter(self, num, title):
        self.ln(4)
        self.set_font("helvetica", "B", 13)
        self.set_text_color(8, 28, 58) # Azul
        self.set_fill_color(241, 245, 249) # Gris azulado suave
        self.cell(0, 8, clean(f" {num}. {title.upper()}"), 0, 1, "L", fill=True)
        self.ln(2)

    def add_section(self, title):
        self.set_font("helvetica", "B", 10)
        self.set_text_color(200, 169, 107) # Dorado
        self.cell(0, 6, clean(title), 0, 1, "L")
        self.ln(1)

    def add_paragraph(self, text, style="", size=9.5):
        self.set_font("helvetica", style, size)
        self.set_text_color(30, 41, 59) # Slate 800
        self.multi_cell(0, 4.5, clean(text))
        self.ln(2.5)

    def add_bullet(self, title, desc):
        self.set_font("helvetica", "B", 9.5)
        self.set_text_color(15, 23, 42)
        self.write(4.5, clean(f"  • {title}: "))
        self.set_font("helvetica", "", 9.5)
        self.set_text_color(51, 65, 85)
        self.write(4.5, clean(f"{desc}\n"))
        self.ln(1)

    def add_code(self, code_text):
        self.set_font("courier", "", 8.5)
        self.set_text_color(30, 41, 59)
        self.set_fill_color(248, 250, 252) # Slate-50
        self.set_draw_color(226, 232, 240)
        
        # Eliminar líneas vacías al inicio y al final
        lines = code_text.strip().split("\n")
        formatted_code = "\n".join(lines)
        
        self.multi_cell(0, 4, clean(formatted_code), border=1, fill=True)
        self.ln(2.5)

# 4. Construcción del PDF
def generate_pdf():
    pdf = SystemAnalysisPDF()
    pdf.cover_page()
    
    # ── PÁGINA 2 ──
    pdf.add_page()
    
    pdf.add_chapter(1, "Resumen Ejecutivo")
    pdf.add_paragraph(
        "Este documento presenta el análisis técnico del sistema 'Dashboard de Incidencia Delictiva', "
        "una herramienta interactiva diseñada para la visualización, exploración y exportación de datos "
        "sobre seguridad pública y delitos en México. El sistema está estructurado bajo una arquitectura "
        "desacoplada que separa un backend analítico de alto rendimiento y una interfaz frontend dinámica, "
        "lo que permite responder de manera ágil a filtros complejos sobre millones de registros delictivos."
    )
    
    pdf.add_section("Arquitectura de Información y Flujo de Datos")
    pdf.add_paragraph(
        "El sistema opera bajo un flujo unidireccional de datos optimizado para consultas rápidas sobre "
        "archivos estructurados en disco local. El flujo general consta de las siguientes etapas:"
    )
    pdf.add_bullet("1. Ingesta y Optimización", "Los archivos CSV origen con datos mensuales se consolidan y procesan a través de una pipeline de datos escrita en Python que optimiza los tipos y genera archivos en formato Parquet.")
    pdf.add_bullet("2. Almacenamiento Columnar", "Los archivos Parquet se almacenan en el backend. Son archivos binarios optimizados para lectura rápida de columnas, permitiendo compresión y rendimiento superior a bases relacionales tradicionales para tareas analíticas.")
    pdf.add_bullet("3. Motor en Memoria", "El backend inicializa una base de datos DuckDB en memoria que levanta vistas automáticas apuntando directamente a los archivos Parquet en disco.")
    pdf.add_bullet("4. API Endpoint (REST)", "El backend publica endpoints en FastAPI. DuckDB resuelve las consultas SQL dinámicas basadas en los filtros de la API y devuelve respuestas en JSON de manera sub-segundo.")
    pdf.add_bullet("5. Renderizado Frontend", "El cliente React consume los endpoints API vía Axios, actualiza su estado global y renderiza los gráficos de Recharts, la tabla de top de delitos y el mapa interactivo de México.")

    pdf.add_chapter(2, "Stack Tecnológico e Infraestructura")
    pdf.add_paragraph(
        "El sistema ha sido implementado utilizando tecnologías de última generación tanto en el backend "
        "como en el frontend, garantizando modularidad, facilidad de mantenimiento y excelente experiencia de usuario."
    )
    
    pdf.add_section("Herramientas del Backend")
    pdf.add_bullet("Python 3", "Lenguaje de programación principal para el procesamiento analítico y la creación del servidor.")
    pdf.add_bullet("FastAPI", "Web framework moderno y rápido para construir APIs con Python basado en tipos estándares. Genera documentación OpenAPI automática y es ideal para aplicaciones asíncronas.")
    pdf.add_bullet("DuckDB", "Base de datos SQL analítica en memoria de alto rendimiento optimizada para procesos OLAP (Online Analytical Processing). Resuelve agregaciones complejas sobre archivos locales de forma ultra-rápida.")
    pdf.add_bullet("Pandas y NumPy", "Librerías de manipulación de datos utilizadas para la conversión y reformateo de los CSV originales en la pipeline.")
    pdf.add_bullet("Uvicorn", "Servidor web ASGI de producción de alta velocidad para ejecutar la aplicación de FastAPI.")
    pdf.add_bullet("Pydantic", "Validación de datos y configuración del sistema mediante tipado estricto.")
    
    # ── PÁGINA 3 ──
    pdf.add_page()
    
    pdf.add_section("Herramientas del Frontend")
    pdf.add_bullet("React", "Librería de JavaScript para construir interfaces de usuario reactivas basadas en componentes reutilizables.")
    pdf.add_bullet("Vite", "Herramienta de desarrollo y empaquetador ultrarrápido que reemplaza a Create React App, ofreciendo HMR (Hot Module Replacement) inmediato y compilaciones optimizadas.")
    pdf.add_bullet("Recharts", "Librería de gráficos basada en componentes de React y SVG, utilizada para mostrar las barras de distribución anual y la línea histórica de delitos.")
    pdf.add_bullet("React-Simple-Maps", "Librería declarativa para crear mapas de forma sencilla. Renderiza el mapa del territorio mexicano utilizando coordenadas geográficas simplificadas en formato TopoJSON.")
    pdf.add_bullet("html-to-image", "Herramienta de exportación del lado del cliente que convierte un nodo del DOM de HTML en una imagen PNG, utilizada para exportar las gráficas dinámicas.")
    pdf.add_bullet("Axios", "Cliente HTTP basado en promesas para consumir la API de FastAPI desde el navegador.")
    pdf.add_bullet("Vanilla CSS", "Estilado mediante variables personalizadas CSS (custom properties) para soportar el diseño premium y la adaptabilidad visual (como HSL e interactividad fluida).")

    pdf.add_chapter(3, "Análisis del Pipeline de Datos (convertir_datos.py)")
    pdf.add_paragraph(
        "Uno de los componentes más críticos del sistema es el script de optimización de datos "
        "(convertir_datos.py). Este módulo actúa como el proceso ETL (Extracción, Transformación y Carga) "
        "local. Transforma los CSV crudos emitidos por las instituciones oficiales al formato de lectura "
        "del backend."
    )
    
    pdf.add_section("Operación del Pipeline")
    pdf.add_bullet("Melt de Columnas", "Los datos oficiales se entregan con columnas independientes para cada mes (Enero, Febrero, ...). El script realiza un melt() para pivotar estas 12 columnas a una estructura de filas 'Mes' e 'Incidencia/Víctimas', necesaria para realizar agregaciones históricas y mensuales flexibles.")
    pdf.add_bullet("Reparación de Encoding", "Corrige errores frecuentes de codificación en caracteres especiales como acentos y la letra Ñ ('delitos_combinado.csv' suele presentar problemas de codificación UTF-8/Latin-1 cruzados). Normaliza el texto a la representación NFC (Normalization Form Canonical Composition).")
    pdf.add_bullet("Optimización Automática de Tipos", "El script analiza cada columna antes de escribir en disco. Para columnas numéricas, reduce los enteros de 64 bits a tipos más pequeños (int8, int16 o int32) de forma segura según el rango real de valores. Para columnas de texto de baja cardinalidad (Entidad, Mes, Rango de Edad, Sexo, etc.), las convierte en tipo 'category'.")
    pdf.add_bullet("Evaluación del Umbral", "La optimización de tipos solo se aplica si la reducción estimada en el consumo de memoria RAM supera el 10%. En caso afirmativo, guarda los datos en Parquet usando compresión ZSTD. De lo contrario, se graba con tipos básicos y compresión Snappy.")

    # ── PÁGINA 4 ──
    pdf.add_page()
    
    pdf.add_chapter(4, "Funcionalidades y APIs del Servidor")
    pdf.add_paragraph(
        "El backend provee endpoints específicos para cada vista del dashboard. "
        "Todos los endpoints soportan filtros dinámicos que se construyen en una cláusula WHERE de SQL "
        "para DuckDB de forma dinámica en base a parámetros de consulta (query parameters) opcionales."
    )
    
    pdf.add_section("Endpoints Clave de la API")
    pdf.add_bullet("/api/filtros", "Obtiene los valores únicos disponibles de todas las categorías (años, entidades, municipios, bienes jurídicos, etc.) para poblar de forma dinámica los menús desplegables del frontend.")
    pdf.add_bullet("/api/total_incidencia", "Devuelve la suma total de delitos o víctimas según los filtros aplicados. Soporta dos métricas: absoluta (suma directa) y rate (tasa por cada 100,000 habitantes calculated en base a proyecciones demográficas en pob_municipios.parquet).")
    pdf.add_bullet("/api/incidencia_por_entidad", "Devuelve el listado de entidades federativas ordenadas de mayor a menor número de delitos/víctimas absolutos o por tasa.")
    pdf.add_bullet("/api/incidencia_por_municipio", "Similar al anterior, pero agrupa y ranquea la incidencia a nivel municipal de la entidad federativa seleccionada.")
    pdf.add_bullet("/api/incidencia_por_anio", "Agrupa los datos históricamente para renderizar la gráfica de barras de evolución anual.")
    pdf.add_bullet("/api/incidencia_por_mes_historico", "Entrega la evolución temporal detallada por mes y año para la gráfica lineal de tendencias.")
    pdf.add_bullet("/api/incidencia_por_delito", "Agrupa por Bien Jurídico, Tipo o Subtipo de Delito para popular la tabla de delitos más recurrentes.")

    pdf.add_chapter(5, "Características del Frontend")
    pdf.add_paragraph(
        "La interfaz del dashboard implementa patrones avanzados de UX, asegurando que "
        "la visualización sea interactiva y visualmente impactante."
    )
    
    pdf.add_section("Módulos Principales de la UI")
    pdf.add_bullet("Mapa Coroplético", "Visualiza geográficamente la incidencia a nivel estatal. Utiliza un gradiente de color dinámico en escala HSL basado en el ranking o valor de cada estado. Permite interactuar al hacer clic en un estado para filtrar automáticamente todo el panel de control.")
    pdf.add_bullet("Gráficos de Recharts", "Las tarjetas de evolución anual (ChartBarYears) y evolución mensual (ChartLineTrend) se actualizan dinámicamente con transiciones fluidas al aplicar filtros. Incluyen tooltips enriquecidos al pasar el ratón.")
    pdf.add_bullet("Menú de Exportación Integrado", "Cada tarjeta cuenta con el componente ExportMenu.jsx. Este permite exportar los datos subyacentes como CSV (con codificación UTF-8 y BOM para compatibilidad directa con Excel), copiar los datos de la tabla directamente al portapapeles con tabulaciones, o exportar la gráfica como imagen de alta resolución (PNG) utilizando Canvas.")

    # ── PÁGINA 5 ──
    pdf.add_page()
    
    pdf.add_chapter(6, "Manual de Ejecución del Sistema")
    pdf.add_paragraph(
        "A continuación se describen los pasos específicos para ejecutar de forma local tanto el Backend, "
        "el Frontend y el proceso de conversión de datos en una máquina Windows."
    )
    
    pdf.add_section("1. Preparación y Conversión de Datos (ETL)")
    pdf.add_paragraph(
        "Antes de correr el servidor, es indispensable que los archivos de datos existan y "
        "se conviertan al formato Parquet optimizado. Para ello:"
    )
    pdf.add_bullet("CSV Origen", "Deben ubicarse en la carpeta 'backend/data/'. Ejemplos: 'delitos_combinado.csv', 'victimas_combinado.csv' y 'victimas_combinado_municipal_2026.csv'.")
    pdf.add_bullet("Conversión Directa", "Puedes dar doble clic al archivo 'backend/convertir_datos.bat' para activar el entorno virtual y lanzar la conversión automáticamente.")
    pdf.add_bullet("Conversión por Comandos", "Alternativamente, abre una terminal en 'backend/', activa el venv y ejecuta:")
    pdf.add_code("python convertir_datos.py")
    
    pdf.add_section("2. Configuración y Ejecución del Backend (FastAPI)")
    pdf.add_paragraph(
        "El backend se ejecuta en un entorno virtual aislado de Python para evitar conflictos."
    )
    pdf.add_bullet("Abrir Terminal", "Navega a la carpeta del backend:")
    pdf.add_code("cd d:\\dev\\Dashboard\\backend")
    pdf.add_bullet("Activar Entorno Virtual", "Ejecuta el script de activación de Windows:")
    pdf.add_code(".\\venv\\Scripts\\activate")
    pdf.add_bullet("Instalar Dependencias", "Solo es necesario la primera vez o ante cambios en requirements.txt:")
    pdf.add_code("pip install -r requirements.txt")
    pdf.add_bullet("Iniciar Servidor", "Lanza Uvicorn con auto-recarga habilitada:")
    pdf.add_code("uvicorn app.main:app --reload")
    pdf.add_paragraph("El servidor estará disponible en la dirección local: http://127.0.0.1:8000")
    
    pdf.add_section("3. Configuración y Ejecución del Frontend (React + Vite)")
    pdf.add_paragraph(
        "El cliente web requiere contar con Node.js previamente instalado."
    )
    pdf.add_bullet("Abrir Terminal 2", "Abre una terminal nueva e ingresa a la carpeta frontend:")
    pdf.add_code("cd d:\\dev\\Dashboard\\frontend")
    pdf.add_bullet("Instalar Paquetes de Node", "Instala las dependencias declaradas en package.json:")
    pdf.add_code("npm install")
    pdf.add_bullet("Lanzar Servidor de Desarrollo", "Inicia el servidor local de Vite:")
    pdf.add_code("npm run dev")
    pdf.add_paragraph("El panel de control se desplegará en tu navegador web por defecto en: http://localhost:5173")
    
    # Escribir archivo de salida
    output_filename = "d:/dev/Dashboard/Analisis_del_Sistema.pdf"
    pdf.output(output_filename)
    print(f"PDF generado exitosamente en: {output_filename}")

if __name__ == "__main__":
    generate_pdf()
