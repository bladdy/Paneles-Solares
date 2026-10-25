export const siteConfig = {
  name: "EnerSol",
  description: "Soluciones solares para hogares y empresas. Venta, instalación y mantenimiento de paneles solares, inversores y sistemas de energía renovable.",
  url: "https://enersol.example.com",
  logo: "/images/logo.svg",
  contact: {
    phone: "+52 55 1234 5678",
    email: "contacto@enersol.mx",
    address: "Av. del Sol #123, Col. Verde, Ciudad de México, CDMX",
  },
  social: {
    facebook: "",
    instagram: "",
    linkedin: "",
  },
} as const;

export const navLinks = [
  { name: "Inicio", href: "#inicio" },
  { name: "Soluciones", href: "#soluciones" },
  { name: "Cómo funciona", href: "#como-funciona" },
  { name: "Proyectos", href: "#proyectos" },
  { name: "Nosotros", href: "#nosotros" },
  { name: "Contacto", href: "#contacto" },
] as const;