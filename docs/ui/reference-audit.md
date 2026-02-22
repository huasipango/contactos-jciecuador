# Reference Audit — JCI Design Values

> **Fecha:** 2026-02-22
> **Fuentes:** [jci.be](https://jci.be/) · [jci.cc](https://jci.cc/)
> **Método:** Computed Styles vía DevTools (navegador 1185 px viewport)
> **Propósito:** Extraer valores medidos para mapear a tokens Tailwind v4 @theme + shadcn/ui

---

## 1. Tipografía

### Font Family

| Propiedad | jci.be | jci.cc | Observación |
|---|---|---|---|
| Font family principal | "Plus Jakarta Sans", sans-serif | "Plus Jakarta Sans" | **Coinciden.** Alineado con Brand Guidelines |

### Headings

| Nivel | Sitio | font-size | font-weight | line-height | color | Observación |
|---|---|---:|---:|---:|---|---|
| H1 | jci.be | 45 px | 600 (semibold) | 63 px (1.4) | `rgb(31,71,137)` — JCI Navy | Hero principal |
| H1 | jci.cc | ~42 px | 900 (black) | ~50 px (1.19) | `rgb(255,255,255)` — blanco | Hero con fondo imagen/oscuro |
| H2 | jci.be | 28.5 px | 600 | 40 px (1.4) | `rgb(31,71,137)` — Navy | Secciones internas |
| H2 | jci.cc | ~38 px | 900 | ~45 px (1.2) | blanco o negro según sección | Más grande, más bold |
| H3 | jci.be | 24 px | 700 (bold) | 33.6 px (1.4) | `rgb(19,15,45)` — JCI Black | Subtítulos (ej. "Our partners") |
| H3 | jci.cc | ~18 px | 900 | ~23 px (1.3) | negro | Menor tamaño que jci.be |
| H4 | jci.be | 19.5 px | 600 | 29.25 px (1.5) | `rgb(19,15,45)` — JCI Black | Card headings |
| H6 (label) | jci.be | 9.75 px | 500 | — | `rgb(0,151,215)` — JCI Blue | Uppercase, letter-spacing 1.5 px |

### Body Text

| Propiedad | jci.be | jci.cc | Observación |
|---|---|---|---|
| font-size | 18 px | ~18 px | **Coinciden** |
| font-weight | 400 | 400 | **Coinciden** |
| line-height | 28.8 px (1.6) | ~27 px (1.5) | Muy cercanos |
| color (light bg) | `rgb(19,15,45)` — JCI Black | negro | jci.be usa exactamente JCI Black |

---

## 2. Colores usados (Computed)

| Rol | jci.be | jci.cc | Token sugerido |
|---|---|---|---|
| **Primary (acción)** | `rgb(239,196,15)` — JCI Yellow (botones CTA) | `rgb(0,151,215)` — JCI Blue (botones CTA) | `--primary` → JCI Blue (#0097D7) para nuestra app |
| **Text headings** | `rgb(31,71,137)` — JCI Navy | negro o blanco | `--foreground` → JCI Black (#130F2D) |
| **Text body** | `rgb(19,15,45)` — JCI Black | negro o blanco | `--foreground` → JCI Black |
| **Background claro** | blanco (`#FFF`) | blanco (`#FFF`) | `--background` → #FFFFFF |
| **Background oscuro** | — | `rgb(19,15,45)` — JCI Black | `--card` (dark) / sección invertida |
| **Background muted** | — | `rgba(191,229,245,0.26)` — azul claro 26% | `--muted` → tint de JCI Blue |
| **Footer bg** | — (transparente, fondo blanco) | `rgb(242,242,242)` — gris claro | `--muted` o `--card` |
| **Links footer** | JCI Navy | `rgb(0,151,215)` — JCI Blue | `--primary` |
| **Ghost btn border** | — | `rgb(230,247,255)` — azul muy claro | `--primary-foreground` / `--ring` |
| **Nav links (header)** | `rgb(19,15,45)` / `rgb(51,55,61)` | `rgb(0,0,0)` / `rgb(0,151,215)` (active) | `--foreground` + `--primary` (active) |

---

## 3. Layout — Containers

| Propiedad | jci.be | jci.cc | Observación |
|---|---|---|---|
| Container max-width | `min(100%, 1400px)` / `1056px` / `795px` | `1000px` / `800px` | jci.be más amplio; jci.cc más compacto |
| Section padding-X | ~55–95 px (~3.5–6 rem) | ~56 px (~3.5 rem) | Consistentes ~56 px en jci.cc |
| Section padding-Y (hero) | ~80 px (~5 rem) | ~11–16 px (slider) | jci.be da más vertical al hero |
| Section padding-Y (normal) | — | ~103 px (~6.5 rem) | jci.cc generoso en Y |
| Section gap (interno) | 10–20 px | ~52 px (~3.25 rem) | jci.cc más separación interna |
| Gutters (padding horizontal contenedor) | ~71–95 px | ~56 px | — |

---

## 4. Header

| Propiedad | jci.be | jci.cc | Observación |
|---|---|---|---|
| Altura total | ~131 px (2 filas: top bar + nav bar) | ~66 px (fila única) | jci.be tiene doble barra |
| Nav bar height | ~95 px | ~66 px | — |
| Background | blanco | blanco | **Coinciden** |
| Nav link font-size | 13 px (main), 11.7 px (top) | ~16 px | jci.cc más grande |
| Nav link font-weight | 500 | 400 | — |
| Nav link color | `rgb(19,15,45)` JCI Black | negro / JCI Blue (active) | — |
| Nav link padding | 10 px 20 px | ~13 px 0 px | jci.be usa padding-x |
| Nav gap | — | 24 px (flex gap) | — |
| CTA button en header | "I want to become a member" | "Sign In" | — |
| CTA padding | — | 8 px 24 px | — |
| CTA radius | — | 5 px | — |
| CTA bg | — | JCI Blue `rgb(0,151,215)` | — |
| CTA border | — | 2 px solid JCI Blue | — |
| CTA height | — | 36 px | — |

---

## 5. Buttons

### Primary CTA

| Propiedad | jci.be | jci.cc | Consenso sugerido |
|---|---|---|---|
| height | 41 px | 50 px | **~44–48 px** (h-11 / h-12) |
| padding | 13 px 25 px | ~14 px 27 px | **14 px 24 px** |
| border-radius | `8px 8px 8px 0px` (esquina asimétrica) | 5 px (uniforme) | **8 px** uniforme (on-brand pero limpio) |
| font-size | 15 px | ~18 px | **15–16 px** (0.9375–1 rem) |
| font-weight | 500 | 400 | **500** |
| background | `rgb(239,196,15)` — JCI Yellow | `rgb(0,151,215)` — JCI Blue | **JCI Blue** (primary) |
| color (text) | blanco | blanco | **blanco** |
| border | none | 2 px solid same-color | **none** (cleaner) |
| shadow | none | none | **none** |

### Ghost / Outline Button

| Propiedad | jci.cc | Valor |
|---|---|---|
| height | 50 px | — |
| padding | 14 px 27 px | — |
| border-radius | 5 px | — |
| background | transparent | — |
| color | `rgb(230,247,255)` | — |
| border | 2 px solid `rgb(230,247,255)` | — |

### Link Button (texto)

| Propiedad | jci.be | Valor |
|---|---|---|
| padding | 0 px 0 px 6 px (bottom) | — |
| font-size | 13.5 px | — |
| font-weight | 500 | — |
| color | `rgb(55,85,136)` — navy variant | — |
| border-bottom | implícito (underline style) | — |

---

## 6. Cards

| Propiedad | jci.be | jci.cc | Observación |
|---|---|---|---|
| **Padding** | 0 px 27 px | 0 px | jci.be usa padding-x; jci.cc no |
| **Border-radius** | `15px 15px 15px 0px` (asimétrico) | 0 px | jci.be con esquina recortada |
| **Border** | none | none | **Coinciden** |
| **Box-shadow** | none | none | **Coinciden** (diseño plano) |
| **Background** | blanco `rgb(255,255,255)` | transparent | jci.be con card explícito |
| **Width** | ~269 px (4-col grid) | ~233 px (4-col grid) | Depende de container |
| **Gap (grid)** | 20 px | 24 px | Similares (~20–24 px) |
| **Grid columns** | 4 columnas iguales | 4 columnas iguales | **Coinciden** |

---

## 7. Input Fields

| Propiedad | jci.cc | Valor sugerido |
|---|---|---|
| padding | 11 px 15 px | ~12 px 16 px |
| border-radius | 7 px | **8 px** (consistente con botones) |
| border | 1 px solid `rgb(218,219,221)` | 1 px solid `--border` |
| font-size | ~18 px | 16 px (1 rem) |
| background | blanco | `--background` |
| height (computada) | — (contenido + padding ~42 px) | **40–44 px** (h-10 / h-11) |

> jci.be no tiene inputs visibles en la homepage.

---

## 8. Footer

| Propiedad | jci.be | jci.cc | Observación |
|---|---|---|---|
| Altura total | ~401 px | ~895 px | jci.cc mucho más alto (más contenido) |
| Padding-Y | — (transparente) | 116 px top, 46 px bottom | jci.cc generoso |
| Padding-X | — | ~56 px | — |
| Background | transparente (hereda blanco) | `rgb(242,242,242)` — gris claro | — |
| Estructura | 4 columnas: logo+text, menu, links, contacto | Multi-sección densa (30+ links) | — |
| Link font-size | ~15 px | ~18 px | — |
| Link color | JCI Navy | JCI Blue | — |
| Gap entre columnas | — | ~78 px | — |
| Copyright bar | inline (bottom) | separada | — |

---

## 9. Secciones alternadas

| Patrón | jci.cc | Observación |
|---|---|---|
| Blanco | `rgb(255,255,255)` | Secciones "feature" |
| Oscuro (dark) | `rgb(19,15,45)` — JCI Black | Sección "content-lima" (texto blanco) |
| Muted (tint) | `rgba(191,229,245,0.26)` — azul claro 26% | Background sutil |
| Gris claro | `rgba(217,217,217,0.3)` | Variante muted |

> jci.be no alterna fondos de forma tan explícita; usa fondo blanco general con imágenes.

---

## 10. Resumen de patrones consistentes entre ambos sitios

1. **Tipografía:** Plus Jakarta Sans en ambos (la fuente oficial JCI).
2. **Body text:** ~18 px / 400 / line-height ~1.5–1.6 — idéntico.
3. **Colores JCI:** Ambos usan JCI Blue (#0097D7), JCI Black (#130F2D), JCI Navy (#1F4789), blanco.
4. **Grid de cards:** 4 columnas con gap ~20–24 px.
5. **Sin sombras en cards/botones:** Diseño plano ("flat"), sin box-shadow.
6. **Sin bordes en cards:** Diseño limpio, sin bordes visibles en cards.
7. **Background blanco:** Predominante en ambos.
8. **Botones sin border-radius excesivo:** 5–8 px (no "pill", no cuadrado).

### Diferencias clave

| Aspecto | jci.be | jci.cc |
|---|---|---|
| Primary CTA color | JCI Yellow | JCI Blue |
| Heading weight | 600 (semibold) | 900 (black) |
| Heading color (light bg) | Navy | Negro |
| Card radius | 15 px (asimétrico) | 0 px |
| Section padding-Y | moderado (~80 px) | generoso (~103 px) |
| Header | 2 filas, 131 px | 1 fila, 66 px |

---

## 11. Propuestas de tokens (solo texto, NO código)

### Colores base

- `--primary` → JCI Blue `#0097D7` (ambos sitios lo usan como color de acción principal)
- `--primary-foreground` → blanco `#FFFFFF`
- `--background` → blanco `#FFFFFF`
- `--foreground` → JCI Black `#130F2D`
- `--secondary` → JCI Navy `#1F4789` (headings, links institucionales)
- `--secondary-foreground` → blanco `#FFFFFF`
- `--accent` → JCI Teal `#57BCBC`
- `--accent-foreground` → JCI Black `#130F2D`
- `--muted` → tint de JCI Blue, tipo `hsl(200 60% 96%)` o `#EEF7FC`
- `--muted-foreground` → gris medio, tipo `#64748B`
- `--destructive` → rojo estándar `#EF4444`
- `--destructive-foreground` → blanco
- `--card` → blanco `#FFFFFF`
- `--card-foreground` → JCI Black `#130F2D`
- `--border` → gris claro `#DADBDD` (coincide con jci.cc input border)
- `--input` → igual a `--border`
- `--ring` → JCI Blue `#0097D7` (focus rings)
- Yellow (`#EFC40F`) reservar solo para badges/highlights puntuales, no como primario

### Spacing / Layout

- Container max-width: `1200px` (punto medio entre jci.be 1400 y jci.cc 1000)
- Section padding-Y: `80px` / `5rem` (hero), `64px` / `4rem` (secciones normales)
- Section padding-X: `56px` / `3.5rem` (desktop), responsive abajo
- Grid gap: `24px` / `1.5rem`
- Card padding: `24px` / `1.5rem` (simplificado)

### Radius

- `--radius` base: `8px` / `0.5rem` (botones, cards, inputs, todos igual)
- Variante pequeña: `4px` (badges, chips)
- Variante grande: `12px` (modals, dropdowns)
- NO usar radius asimétrico de jci.be (es su firma visual, no necesitamos replicarla)

### Typography Scale

- H1: `36px` / `2.25rem`, weight `700`, line-height `1.3`
- H2: `30px` / `1.875rem`, weight `700`, line-height `1.3`
- H3: `24px` / `1.5rem`, weight `600`, line-height `1.4`
- H4: `20px` / `1.25rem`, weight `600`, line-height `1.4`
- Body: `16px` / `1rem`, weight `400`, line-height `1.6`
- Small: `14px` / `0.875rem`, weight `400`, line-height `1.5`
- Label: `12px` / `0.75rem`, weight `500`, uppercase, letter-spacing `0.05em`

### Buttons

- Primary: height `40px` (h-10), padding `10px 24px`, bg `--primary`, radius `--radius`, font `500 / 15px`
- Secondary: height `40px`, padding `10px 24px`, bg `--secondary`, radius `--radius`
- Ghost/outline: height `40px`, padding `10px 24px`, border `1px solid --border`, bg transparent
- Link: sin borde ni fondo, color `--primary`, underline on hover

### Inputs

- Height: `40px` (h-10), padding `8px 12px`, border `1px solid --border`, radius `--radius`
- Focus: ring `2px --ring` offset `2px`
- Background: `--background`

### Header

- Altura: `64px` (single row), fondo blanco, border-bottom `1px solid --border`
- Nav links: `14–15px`, weight `500`, gap `24px`
- CTA button: versión compacta (height `36px`, padding `8px 20px`)

### Footer

- Padding-Y: `64px` top / `32px` bottom
- Background: `--muted` o `--card`
- Estructura: 3–4 columnas, gap `48px`
- Links: `14px`, color `--muted-foreground`, hover `--primary`
