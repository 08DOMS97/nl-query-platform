import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indicador de Next.js que solo aparece con `npm run dev` (no en producción). A la
  // derecha: a la izquierda tapa el pie de la barra lateral y su menú no se abre bien.
  devIndicators: {
    position: 'bottom-right',
  },
};

export default nextConfig;
