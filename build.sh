#!/bin/bash

# Install dependencies explicitly
echo "Installing dependencies..."
npm install

# Install Tailwind CSS and related packages explicitly
echo "Installing Tailwind CSS and related packages..."
npm install tailwindcss postcss autoprefixer --no-save

# Run the build
echo "Running Next.js build..."
npm run build

echo "Build completed!"
