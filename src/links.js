// ============================================================
//  CONTENIDO DEL SITIO — editá solo este archivo.
//  Cada push a GitHub (rama main) vuelve a desplegar el Worker.
//
//  Cada botón puede tener:
//    label : texto del botón
//    page  : enlace a otra página de este mismo sitio (ej. "/uniformes")
//    file  : archivo alojado en el Worker, dentro de public/ (ej. "/archivos/manual.pdf")
//    url   : enlace externo (Drive, formulario, etc.)
//
//  Si un botón tiene "file" y el archivo YA existe en public/, se usa ese.
//  Si todavía no lo subiste, el botón usa "url" como respaldo.
//  Si no hay ninguno de los dos, el botón aparece gris.
// ============================================================

export const theme = {
  background: "#f3f6f9",
  card: "#ffffff",
  text: "#1d2b3a",
  muted: "#5b6b7c",
  accent: "#1f6feb",
};

// Foto de perfil: subí la imagen a public/avatar.jpeg y se usa automáticamente.
export const avatar = {
  file: "/avatar.jpeg",
  url: "https://ugc.production.linktr.ee/0fff52f3-f681-474d-ac6d-496be94bda9b_DM-y-LM-2.jpeg?io=true&size=avatar-v3_0",
};

export const pages = {
  // ----------------------------------------------------------
  "/": {
    title: "Bienvenida_",
    heading: "@Bienvenida_",
    sections: [
      {
        title: "Primeros pasos",
        links: [
          {
            label: "¡Bienvenido/a! 👋🏽",
            file: "/archivos/bienvenida.pdf",
            url: "https://drive.google.com/file/d/1tkxDGp4pvOeRRnbpxOYEE0IMFl5UH3fc/view",
          },
          {
            label: "Mi legajo digital ✍🏽",
            file: "/archivos/legajo-digital.pdf",
            url: "",
          },
          {
            label: "¿Cómo tomo el talle de mi uniforme? 🥼",
            page: "/uniformes",
          },
        ],
      },
      {
        title: "Información para tu primer día",
        links: [
          { label: "Información útil 📌", page: "/informacion-util" },
          {
            label: "Nuestros beneficios 🙌",
            file: "/archivos/beneficios.pdf",
            url: "https://drive.google.com/file/d/1Y9lMGvOz4thABUxEfF5AYKeDHSRL0G5p/view?usp=sharing",
          },
          {
            label: "Cómo nos comunicamos 💬",
            file: "/archivos/como-nos-comunicamos.pdf",
            url: "https://drive.google.com/file/d/1pxo74aUbheDwsVm7svmlqCEy-KaY1pSl/view?usp=sharing",
          },
          {
            label: "Manual del Colaborador 🩺 🔬",
            file: "/archivos/manual-del-colaborador.pdf",
            url: "",
          },
          {
            label: "Reglamento Interno ⚖️",
            file: "/archivos/reglamento-interno.pdf",
            url: "",
          },
        ],
      },
    ],
  },

  // ----------------------------------------------------------
  "/uniformes": {
    title: "Uniformes",
    heading: "@uniformes_",
    back: "/",
    sections: [
      {
        title: "",
        links: [
          {
            label: "👉🏽 Pedí tu uniforme acá 👈🏽",
            // Formulario de Google: se mantiene externo (necesita Google para guardar respuestas)
            url: "https://docs.google.com/forms/d/e/1FAIpQLSeIkCXTazzVZUkn-nvEPv3NF5gfWiJ1xUVQ4_56zzRLeBHhWQ/viewform",
          },
          {
            label: "Instructivo uniforme administrativo",
            file: "/archivos/instructivo-uniforme-administrativo.pdf",
            url: "",
          },
          {
            label: "Instructivo ambo",
            file: "/archivos/instructivo-ambo.pdf",
            url: "",
          },
          {
            label: "Instructivo guardapolvo",
            file: "/archivos/instructivo-guardapolvo.pdf",
            url: "",
          },
        ],
      },
    ],
  },

  // ----------------------------------------------------------
  "/informacion-util": {
    title: "Información útil",
    heading: "@informacion.util",
    back: "/",
    sections: [
      {
        title: "",
        links: [
          {
            label: "¿Cómo registro mi ingreso y egreso a la sede?",
            file: "/archivos/registro-ingreso-egreso.pdf",
            url: "https://drive.google.com/file/d/1GZFVJR7nqgPuJFENOpjh8ojjHIG_TBsJ/view?usp=sharing",
          },
          {
            label: "Sobre mi cuenta bancaria",
            file: "/archivos/cuenta-bancaria.pdf",
            url: "https://drive.google.com/file/d/1i3OnB_nnz6p8rXr0HoAiuoMsGhpJgBAn/view?usp=sharing",
          },
          {
            label: "Dudas sobre mi liquidación",
            file: "/archivos/dudas-liquidacion.pdf",
            url: "https://drive.google.com/file/d/162w3iLXKY0YKkWLKwr7sarfWLO7u3I8m/view?usp=sharing",
          },
          {
            label: "Mi obra social",
            file: "/archivos/obra-social.pdf",
            url: "https://drive.google.com/file/d/1etP_UzVXY6vZT8yWuiPPSVUiBJNXNXkI/view?usp=sharing",
          },
          {
            label: "Cómo utilizar las máquinas de café",
            file: "/archivos/maquinas-de-cafe.pdf",
            url: "https://drive.google.com/file/d/14HOrPSEqEkmJdvnQfTIuGdG8ubjayGGh/view?usp=sharing",
          },
          {
            label: "CloudPayroll: Plataforma de autogestión",
            file: "/archivos/cloudpayroll.pdf",
            url: "",
          },
          {
            label: "Premio por presentismo - Alta en Nubi",
            file: "/archivos/presentismo-nubi.pdf",
            url: "https://drive.google.com/file/d/1aF2EtTAb8vS1X6mdpVAdjQ1MyKmHHF6-/view?usp=sharing",
          },
        ],
      },
    ],
  },
};

// Las direcciones viejas de Linktree que alguien tenga guardadas
export const aliases = {
  "/uniformes_": "/uniformes",
  "/informacion.util": "/informacion-util",
  "/Bienvenida_": "/",
};
