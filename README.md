# EnerSol - Sitio Web Corporativo de Energía Solar

Sitio web profesional para empresa dedicada a la venta, instalación y mantenimiento de paneles solares, inversores y soluciones de energía renovable.

## Tecnologías

- [Astro](https://astro.build/) - Framework principal
- [Tailwind CSS](https://tailwindcss.com/) - Estilos
- TypeScript

## Instalación

`ash
npm install
`

## Desarrollo

`ash
npm run dev
`

El sitio estará disponible en http://localhost:4321

## Construcción

`ash
npm run build
`

## Vista previa

`ash
npm run preview
`

## Estructura del proyecto

`
src/
+-- components/     # Componentes Astro
+-- data/          # Configuración del sitio
+-- layouts/       # Plantillas
+-- pages/         # Páginas
+-- styles/        # Estilos globales

public/
+-- images/        # Imágenes
+-- videos/        # Videos
`

## Configuración

Edita src/data/site.ts para actualizar:
- Nombre de la empresa
- Información de contacto (teléfono, email, dirección)
- Redes sociales

## Recursos necesarios

### Video Hero
Coloca un video de paneles solares en public/videos/solar-hero.mp4. Ver public/videos/README.md para más detalles.

### Imágenes
Coloca las imágenes en public/images/. Ver public/images/README.md para más detalles.

## Notas importantes

- El formulario de contacto no está conectado a un backend. Requiere configuración de un servicio de formularios.
- Las imágenes de proyectos son ilustrativas.
- No se han incluido datos reales de contacto (configurables en src/data/site.ts).
