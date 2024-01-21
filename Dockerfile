# Use la imagen de Node.js como base
FROM node:16

# Instala Playwright en la imagen base de Node.js
RUN npm install -g playwright

# Usa la imagen de Playwright como base, con la versión focal
FROM mcr.microsoft.com/playwright:v1.40.1-focal

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia el archivo package.json y package-lock.json al directorio de trabajo
COPY package*.json ./

# Instala las dependencias del proyecto
RUN npm install

# Copia el resto de los archivos al directorio de trabajo del contenedor
COPY . .

# Exponer el puerto en el que se ejecuta tu aplicación Node.js
EXPOSE 3000

# Comando para ejecutar tu aplicación
CMD ["node", "index.js"]
