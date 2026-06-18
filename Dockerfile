# Reliable hosting: this base image already includes Chrome + all its system libs,
# which is the part that usually trips people up when deploying Puppeteer.
FROM ghcr.io/puppeteer/puppeteer:22.0.0

WORKDIR /app
COPY package*.json ./
# Chrome is already in the image, so skip Puppeteer's download.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install --omit=dev
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
