import os

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

    # Replace escaped quotes with normal quotes
    content = content.replace('\\"', '"')

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
print("Quotes fixed.")
