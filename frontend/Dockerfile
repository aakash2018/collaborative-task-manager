## Frontend Dockerfile - runs CRA dev server on port 3000
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Expose CRA dev server port
EXPOSE 3000

# Start development server
CMD ["npm", "start"]
