import { toPng } from 'html-to-image';
import { toast } from 'sonner';

export const downloadCSV = (filename, data, headers, filters) => {
  let csvContent = "";

  // 1. Metadata / Filters block
  csvContent += "=== FILTROS APLICADOS ===\n";
  if (filters) {
    const dataset = filters.dataset || 'delitos';
    csvContent += `Dataset,${dataset === 'victimas' ? 'Víctimas' : 'Delitos'}\n`;
    csvContent += `Año,${filters.anio || 'Todos'}\n`;
    csvContent += `Métrica,${filters.metricType === 'rate' ? 'Tasa por 100,000 habitantes' : 'Absoluta'}\n`;
    csvContent += `Entidad,${filters.entidad === 'All' ? 'Nacional' : filters.entidad}\n`;
    if (dataset === 'delitos') {
      csvContent += `Municipio,${filters.municipio === 'All' ? 'Todos los municipios' : (filters.municipio || 'N/A')}\n`;
    }
    csvContent += `Bien jurídico afectado,${(filters.bienJuridico && filters.bienJuridico.length > 0) ? filters.bienJuridico.join(' | ') : 'Todos'}\n`;
    csvContent += `Tipo de delito,${(filters.tipoDelito && filters.tipoDelito.length > 0) ? filters.tipoDelito.join(' | ') : 'Todos'}\n`;
    csvContent += `Subtipo de delito,${(filters.subtipoDelito && filters.subtipoDelito.length > 0) ? filters.subtipoDelito.join(' | ') : 'Todos'}\n`;
    csvContent += `Modalidad,${(filters.modalidad && filters.modalidad.length > 0) ? filters.modalidad.join(' | ') : 'Todos'}\n`;
    
    if (dataset === 'victimas') {
      csvContent += `Sexo,${(filters.sexo && filters.sexo.length > 0) ? filters.sexo.join(' | ') : 'Todos'}\n`;
      csvContent += `Rango de edad,${(filters.rangoEdad && filters.rangoEdad.length > 0) ? filters.rangoEdad.join(' | ') : 'Todos'}\n`;
    }
    
    csvContent += `Meses,${(filters.meses && filters.meses.length > 0) ? filters.meses.join(' | ') : 'Todos'}\n`;
  }
  csvContent += "\n";

  // 2. Data block
  csvContent += "=== DATOS ===\n";
  // Add headers
  csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
  
  // Add rows
  data.forEach(row => {
    let rowValues = [];
    if (Array.isArray(row)) {
      rowValues = row;
    } else if (typeof row === 'object' && row !== null) {
      // If we have explicit keys mapping, or we just take values.
      // Let's assume order is matched or custom mapped.
      rowValues = Object.values(row);
    }
    
    const formattedRow = rowValues.map(val => {
      const stringVal = val === null || val === undefined ? "" : String(val);
      if (stringVal.includes(",") || stringVal.includes("\n") || stringVal.includes('"')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    });
    
    csvContent += formattedRow.join(",") + "\n";
  });

  // UTF-8 BOM to preserve accents in Excel
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadImage = (element, filename) => {
  if (!element) return;
  
  // Opciones premium para exportar como imagen
  toPng(element, {
    backgroundColor: 'var(--bg-card, #ffffff)', // Usar color de fondo de la card o blanco
    style: {
      borderRadius: '12px',
      boxShadow: 'none'
    },
    quality: 1.0,
    pixelRatio: 2 // Mayor densidad de píxeles para que la imagen salga nítida
  })
    .then((dataUrl) => {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    })
    .catch((err) => {
      console.error('Error al exportar imagen:', err);
    });
};

const getSelfContainedSVGString = (element) => {
  const svgs = element.querySelectorAll('svg');
  let originalSvg = null;
  
  for (let s of svgs) {
    if (!s.closest('button')) {
      originalSvg = s;
      break;
    }
  }
  
  if (!originalSvg) {
    console.error('No se encontró ningún SVG para exportar.');
    return null;
  }

  const clonedSvg = originalSvg.cloneNode(true);
  
  const stylesToPreserve = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
    'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'color', 'transform', 'visibility',
    'stop-color', 'stop-opacity'
  ];

  const originalElements = [originalSvg, ...Array.from(originalSvg.querySelectorAll('*'))];
  const clonedElements = [clonedSvg, ...Array.from(clonedSvg.querySelectorAll('*'))];

  for (let i = 0; i < originalElements.length; i++) {
    const origEl = originalElements[i];
    const cloneEl = clonedElements[i];
    
    // Ocultar tooltips, cursores activos y otros elementos temporales de recharts
    if (origEl.classList && (origEl.classList.contains('recharts-active-dot') || origEl.classList.contains('recharts-tooltip-cursor') || origEl.classList.contains('recharts-tooltip-wrapper'))) {
      cloneEl.style.display = 'none';
      cloneEl.style.opacity = '0';
      continue;
    }

    const computedStyle = window.getComputedStyle(origEl);
    
    stylesToPreserve.forEach(prop => {
      let val = computedStyle.getPropertyValue(prop);
      if (val && val !== 'none' && val !== 'normal' && val !== 'auto' && val !== '0px') {
        // Fix para referencias a gradientes locales que el navegador devuelve con URL absoluta
        if (typeof val === 'string' && val.startsWith('url(') && val.includes('#')) {
          const idParts = val.split('#');
          if (idParts.length > 1) {
            const id = idParts[1].replace('")', '').replace("')", "").replace(")", "");
            val = `url(#${id})`;
          }
        }
        cloneEl.setAttribute(prop, val);
      }
    });
  }

  if (!clonedSvg.getAttribute('xmlns')) {
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(clonedSvg);
};

export const downloadPNGFromSVG = (element, filename) => {
  if (!element) return;
  const source = getSelfContainedSVGString(element);
  if (!source) return;

  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    // Escala 3x para máxima nitidez
    const scale = 3; 
    
    const svgs = element.querySelectorAll('svg');
    let originalSvg = null;
    for (let s of svgs) {
      if (!s.closest('button')) {
        originalSvg = s;
        break;
      }
    }
    
    const rect = originalSvg.getBoundingClientRect();
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    
    const ctx = canvas.getContext('2d');
    // No pintamos fondo blanco para conservar la transparencia
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, rect.width, rect.height);
    
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = pngUrl;
    link.click();
    
    URL.revokeObjectURL(url);
  };
  img.src = url;
};

export const copyTableToClipboard = (data, headers) => {
  let content = headers.join("\t") + "\n";
  data.forEach(row => {
    let rowValues = Array.isArray(row) ? row : Object.values(row);
    content += rowValues.join("\t") + "\n";
  });
  navigator.clipboard.writeText(content).then(() => {
    toast.success("¡Tabla copiada al portapapeles!");
  }).catch(err => {
    console.error("Error al copiar:", err);
    toast.error("Error al copiar la tabla");
  });
};
