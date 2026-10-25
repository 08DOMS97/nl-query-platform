import type { NextConfig } from "next";

// En Docker (`nlqp/docker-compose.yml`) el navegador no llama al backend directamente:
// pide `/api/...` al frontend y este lo reenvía por la red interna de Docker. Así el
// backend no queda expuesto en la red, no hace falta CORS y la imagen no depende de la
// IP del servidor. Se activa al construir con NLQP_BACKEND_INTERNAL_URL; sin ella (npm
// run dev / start) todo sigue igual que antes.
const backendInternalUrl = process.env.NLQP_BACKEND_INTERNAL_URL;

const nextConfig: NextConfig = {
  // Sin el indicador flotante de Next.js (solo aparece con `npm run dev`). Los errores
  // de compilación o de ejecución se siguen mostrando.
  devIndicators: false,
  ...(backendInternalUrl
    ? {
        output: "standalone" as const,
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${backendInternalUrl}/:path*` }];
        },
        experimental: {
          // El reenvío corta a los 30 s por defecto; una consulta puede durar hasta el tope
          // de su conexión (máximo 60 min), y el backend la cancela antes.
          proxyTimeout: 61 * 60 * 1000,
        },
      }
    : {}),
};

export default nextConfig;
