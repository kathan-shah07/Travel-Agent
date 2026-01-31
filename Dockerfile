
# Build for Render
# Use official Node.js image (Lightweight)
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies (including dev deps for building)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose Port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
