# ─── Stage 1: Build the React Frontend ───
FROM node:20 AS builder
WORKDIR /app

# Copy package descriptors and installer
COPY package*.json ./
RUN npm ci

# Copy configuration and sources
COPY vite.config.js index.html eslint.config.js ./
COPY public/ ./public/
COPY src/ ./src/

# Compile the production React assets inside /app/dist
RUN npm run build

# ─── Stage 2: Build the Node Runner ───
FROM node:20-slim
WORKDIR /app

# Install native dependencies for compiling C++ modules (required for better-sqlite3 compilation inside container)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy static frontend assets from stage 1
COPY --from=builder /app/dist ./dist

# Copy backend files and root runner
COPY server/ ./server/
COPY index.js ./

# Runtime settings
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/var/data/smartroad.db
ENV UPLOAD_DIR=/var/data/uploads

# Expose web service port (Cloud Run defaults requests to PORT environment variable)
EXPOSE 8080

# Starts the Express app (which runs DB initialization + superadmin creation/sync automatically)
CMD ["node", "index.js"]
