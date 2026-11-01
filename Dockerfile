FROM node:26-alpine

# Create and switch to the app directory
WORKDIR /app

# Copy in your package.json and lockfile first (for efficient caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install pnpm globally
RUN npm install -g pnpm@12

# Install production dependencies only (jest and supertest are for local tests)
RUN pnpm install --prod --frozen-lockfile

# Now copy the rest of your project files
COPY . .

# This exposes port 3000 *inside* the container.
# (Even if your .env says port=5555, the container process can *listen* on 3000
# internally, or read the .env. We'll map it to the host via docker-compose.)
EXPOSE 3012

# Start the application (node directly, so it gets the stop signal from Docker)
CMD ["node", "server.js"]
