// ============================================================
//  CONTENIDO DE LA PÁGINA — editá solo este archivo.
//  Cada push a GitHub (rama main) vuelve a desplegar el Worker.
// ============================================================

export const profile = {
  title: "Bienvenida_",
  handle: "@Bienvenida_",
  bio: "", // opcional: agregá una frase de bienvenida
  // Podés reemplazarla por "/avatar.jpeg" si guardás la imagen en /public
  avatar:
    "https://ugc.production.linktr.ee/0fff52f3-f681-474d-ac6d-496be94bda9b_DM-y-LM-2.jpeg?io=true&size=avatar-v3_0",
};

export const sections = [
  {
    title: "Primeros pasos",
    links: [
      {
        label: "¡Bienvenido/a! 👋🏽",
        url: "https://drive.google.com/file/d/1tkxDGp4pvOeRRnbpxOYEE0IMFl5UH3fc/view",
      },
      {
        label: "Mi legajo digital ✍🏽",
        // TODO: pegá acá el link del PDF (o subilo a /public y usá "/legajo.pdf")
        url: "",
        type: "PDF",
      },
      {
        label: "¿Cómo tomo el talle de mi uniforme? 🥼",
        url: "https://linktr.ee/uniformes_",
      },
    ],
  },
  {
    title: "Información para tu primer día",
    links: [
      {
        label: "Información útil 📌",
        url: "https://linktr.ee/informacion.util",
      },
      {
        label: "Nuestros beneficios 🙌",
        url: "https://drive.google.com/file/d/1Y9lMGvOz4thABUxEfF5AYKeDHSRL0G5p/view?usp=sharing",
      },
      {
        label: "Cómo nos comunicamos 💬",
        url: "https://drive.google.com/file/d/1pxo74aUbheDwsVm7svmlqCEy-KaY1pSl/view?usp=sharing",
      },
      {
        label: "Manual del Colaborador 🩺 🔬",
        // TODO: link del PDF
        url: "",
        type: "PDF",
      },
      {
        label: "Reglamento Interno ⚖️",
        // TODO: link del PDF
        url: "",
        type: "PDF",
      },
    ],
  },
];

export const theme = {
  background: "#f3f6f9",
  card: "#ffffff",
  text: "#1d2b3a",
  muted: "#5b6b7c",
  accent: "#1f6feb",
};
