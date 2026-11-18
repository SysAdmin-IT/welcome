// Contenido inicial. Solo se usa la primera vez (cuando todavía no hay nada guardado).
// Después, todo se edita desde el panel /admin.
//
// Tipos de botón:
//   { type: "page", value: "/uniformes" }        -> otra página del sitio
//   { type: "file", value: "<id del archivo>" }   -> PDF subido desde el panel
//   { type: "url",  value: "https://..." }        -> enlace externo (Drive, formulario...)

export const seedContent = {
  settings: {
    siteTitle: "Bienvenida",
    avatarFileId: "",
    avatarUrl:
      "https://ugc.production.linktr.ee/0fff52f3-f681-474d-ac6d-496be94bda9b_DM-y-LM-2.jpeg?io=true&size=avatar-v3_0",
  },
  pages: {
    "/": {
      title: "Bienvenida_",
      heading: "@Bienvenida_",
      sections: [
        {
          title: "Primeros pasos",
          links: [
            { label: "¡Bienvenido/a! 👋🏽", type: "url", value: "https://drive.google.com/file/d/1tkxDGp4pvOeRRnbpxOYEE0IMFl5UH3fc/view" },
            { label: "Mi legajo digital ✍🏽", type: "file", value: "" },
            { label: "¿Cómo tomo el talle de mi uniforme? 🥼", type: "page", value: "/uniformes" },
          ],
        },
        {
          title: "Información para tu primer día",
          links: [
            { label: "Información útil 📌", type: "page", value: "/informacion-util" },
            { label: "Nuestros beneficios 🙌", type: "url", value: "https://drive.google.com/file/d/1Y9lMGvOz4thABUxEfF5AYKeDHSRL0G5p/view?usp=sharing" },
            { label: "Cómo nos comunicamos 💬", type: "url", value: "https://drive.google.com/file/d/1pxo74aUbheDwsVm7svmlqCEy-KaY1pSl/view?usp=sharing" },
            { label: "Manual del Colaborador 🩺 🔬", type: "file", value: "" },
            { label: "Reglamento Interno ⚖️", type: "file", value: "" },
          ],
        },
      ],
    },
    "/uniformes": {
      title: "Uniformes",
      heading: "@uniformes_",
      sections: [
        {
          title: "",
          links: [
            { label: "👉🏽 Pedí tu uniforme acá 👈🏽", type: "url", value: "https://docs.google.com/forms/d/e/1FAIpQLSeIkCXTazzVZUkn-nvEPv3NF5gfWiJ1xUVQ4_56zzRLeBHhWQ/viewform" },
            { label: "Instructivo uniforme administrativo", type: "file", value: "" },
            { label: "Instructivo ambo", type: "file", value: "" },
            { label: "Instructivo guardapolvo", type: "file", value: "" },
          ],
        },
      ],
    },
    "/informacion-util": {
      title: "Información útil",
      heading: "@informacion.util",
      sections: [
        {
          title: "",
          links: [
            { label: "¿Cómo registro mi ingreso y egreso a la sede?", type: "url", value: "https://drive.google.com/file/d/1GZFVJR7nqgPuJFENOpjh8ojjHIG_TBsJ/view?usp=sharing" },
            { label: "Sobre mi cuenta bancaria", type: "url", value: "https://drive.google.com/file/d/1i3OnB_nnz6p8rXr0HoAiuoMsGhpJgBAn/view?usp=sharing" },
            { label: "Dudas sobre mi liquidación", type: "url", value: "https://drive.google.com/file/d/162w3iLXKY0YKkWLKwr7sarfWLO7u3I8m/view?usp=sharing" },
            { label: "Mi obra social", type: "url", value: "https://drive.google.com/file/d/1etP_UzVXY6vZT8yWuiPPSVUiBJNXNXkI/view?usp=sharing" },
            { label: "Cómo utilizar las máquinas de café", type: "url", value: "https://drive.google.com/file/d/14HOrPSEqEkmJdvnQfTIuGdG8ubjayGGh/view?usp=sharing" },
            { label: "CloudPayroll: Plataforma de autogestión", type: "file", value: "" },
            { label: "Premio por presentismo - Alta en Nubi", type: "url", value: "https://drive.google.com/file/d/1aF2EtTAb8vS1X6mdpVAdjQ1MyKmHHF6-/view?usp=sharing" },
          ],
        },
      ],
    },
  },
};

// Direcciones viejas de Linktree
export const aliases = {
  "/uniformes_": "/uniformes",
  "/informacion.util": "/informacion-util",
  "/Bienvenida_": "/",
};
