#!/bin/bash

# Install dependencies explicitly
echo "Installing dependencies..."
npm install

# Install TypeScript and related packages explicitly
echo "Installing TypeScript and related packages..."
npm install --save-dev typescript@5.3.3 @types/react@19.0.0 @types/react-dom@19.0.0

# Install Tailwind CSS and related packages explicitly
echo "Installing Tailwind CSS and related packages..."
npm install tailwindcss postcss autoprefixer --no-save

# Run the build
echo "Running Next.js build..."
next build

echo "Build completed!"
