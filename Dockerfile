# Build for Render
# Use full Node.js image to ensure all system libraries (glibc, libstdc++) are present
FROM node:18

# Install build essentials for native modules (like lancedb/onnx)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

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
