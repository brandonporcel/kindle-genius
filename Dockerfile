# Usa la imagen oficial de Playwright (ya tiene Node y browsers)
FROM mcr.microsoft.com/playwright:v1.40.1-focal

# Establece el directorio de trabajo
WORKDIR /usr/src/app

# Copia solo los archivos necesarios primero (para aprovechar el cache de Docker)
COPY package*.json ./

# Instala dependencias
RUN npm install

# Copia el resto de los archivos
COPY . .

# Compila TypeScript a JavaScript
RUN npm run build

# Expone el puerto (si tu app escucha en 3000)
EXPOSE 3000

# Comando para iniciar tu app
CMD ["npm", "start"]
