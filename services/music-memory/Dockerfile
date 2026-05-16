FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
RUN mkdir -p /app/data
ENV PORT=9777
EXPOSE 9777
CMD ["npm", "start"]
