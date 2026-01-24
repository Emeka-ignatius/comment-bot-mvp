FROM node:22-bookworm-slim

WORKDIR /app

# System deps:
# - ffmpeg: stable audio capture (fixes Render SIGSEGV from bundled ffmpeg binaries)
# - ca-certificates: HTTPS
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack
RUN corepack enable

# Copy only what we need for dependency install (better Docker layer caching)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install dependencies
ENV PLAYWRIGHT_BROWSERS_PATH=0
RUN pnpm install --frozen-lockfile

# Install Playwright Chromium + OS deps inside the container
RUN pnpm exec playwright install --with-deps chromium

# Copy the rest of the source
COPY . .

# Build (client + server bundle)
RUN pnpm build

# Prefer system ffmpeg in this container (skip npm ffmpeg binaries entirely)
ENV FFMPEG_PATH=ffmpeg
ENV FFMPEG_ONLY=1
ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["pnpm", "start"]

