#!/bin/bash

# Mixocracy UI Vercel Deployment Script

echo "🚀 Starting Mixocracy UI deployment to Vercel..."

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
fi

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -d "app" ]; then
    echo "❌ Error: Not in the mixocracy-ui directory"
    exit 1
fi

# Build the project locally first to catch any errors
echo "📦 Building project locally..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors before deploying."
    exit 1
fi

echo "✅ Build successful!"

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."

# For production deployment
if [ "$1" = "--prod" ]; then
    echo "🏭 Deploying to production..."
    vercel --prod
else
    # Preview deployment
    echo "👁️  Creating preview deployment..."
    vercel
fi

echo "✨ Deployment complete!"