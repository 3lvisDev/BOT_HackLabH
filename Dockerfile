FROM node:18-alpine

# Crear el directorio de la aplicación
WORKDIR /usr/src/app

# Copiar los archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar el resto del código del bot y dashboard web
COPY . .

# Exponer el puerto para el panel web
EXPOSE 3000

# Comando para iniciar la aplicación
CMD [ "npm", "start" ]
