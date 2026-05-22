import os
import re

components_dir = r"d:\dev\Dashboard\frontend\src\components"
files_to_update = [
    "TableTopCrimes.jsx",
    "MapMexico.jsx",
    "ChartLineTrend.jsx",
    "ChartBarYears.jsx"
]

for filename in files_to_update:
    filepath = os.path.join(components_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Step 1: Add isVictimasMun and isVictimasBase definitions
    # It usually appears like this:
    # const isVictimas = dataset === 'victimas';
    content = re.sub(
        r"const isVictimas = dataset === 'victimas';",
        r"const isVictimas = dataset === 'victimas';\n  const isVictimasMun = dataset === 'victimas_mun';\n  const isVictimasBase = isVictimas || isVictimasMun;",
        content
    )

    # Step 2: Replace isVictimas with isVictimasBase for labels, titles, and exports
    # Let's find common patterns
    content = re.sub(
        r"isVictimas \? \"Víctimas\" : \"Incidencia\"",
        r"isVictimasBase ? \"Víctimas\" : \"Incidencia\"",
        content
    )
    content = re.sub(
        r"isVictimas \? 'Víctimas' : 'Incidencia'",
        r"isVictimasBase ? 'Víctimas' : 'Incidencia'",
        content
    )
    content = re.sub(
        r"const chartTitle = isVictimas",
        r"const chartTitle = isVictimasBase",
        content
    )
    content = re.sub(
        r"const cardTitle = isVictimas",
        r"const cardTitle = isVictimasBase",
        content
    )
    content = re.sub(
        r"const baseValLabel = isVictimas",
        r"const baseValLabel = isVictimasBase",
        content
    )
    content = re.sub(
        r"isVictimas \? \"victimas_por_anio",
        r"isVictimasBase ? \"victimas_por_anio",
        content
    )
    content = re.sub(
        r"isVictimas \? \"historico_victimas",
        r"isVictimasBase ? \"historico_victimas",
        content
    )
    content = re.sub(
        r"isVictimas \? \"mapa_victimas",
        r"isVictimasBase ? \"mapa_victimas",
        content
    )
    content = re.sub(
        r"isVictimas \? \"datos_entidades_victimas",
        r"isVictimasBase ? \"datos_entidades_victimas",
        content
    )
    content = re.sub(
        r"isVictimas \? \"victimas_mayor_incidencia",
        r"isVictimasBase ? \"victimas_mayor_incidencia",
        content
    )
    content = re.sub(
        r"isVictimas \? `top_victimas_",
        r"isVictimasBase ? `top_victimas_",
        content
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
print("Refactoring complete.")
