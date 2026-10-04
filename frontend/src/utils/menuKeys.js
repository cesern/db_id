/**
 * Teclado de un menú desplegable (role="menu"): flechas, Inicio y Fin mueven el foco entre sus
 * opciones (menuitem / menuitemradio), de forma circular. Se usa como onKeyDown del contenedor.
 */
export const menuArrows = (e) => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const items = [...e.currentTarget.querySelectorAll('[role^="menuitem"]')];
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement);
  const next = e.key === 'Home' ? 0
    : e.key === 'End' ? items.length - 1
    : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next].focus();
};

/** Al abrir: foco en la opción marcada o, si no hay, en la primera. */
export const focusFirstMenuItem = (menuEl) => {
  const el = menuEl?.querySelector('[role^="menuitem"][aria-checked="true"]') || menuEl?.querySelector('[role^="menuitem"]');
  el?.focus();
};
