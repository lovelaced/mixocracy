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
    
    # Check if .env.production exists
    if [ ! -f ".env.production" ]; then
        echo "⚠️  Warning: .env.production not found!"
        echo "   Please create .env.production with your production environment variables"
        echo "   See .env.local for reference"
        exit 1
    fi
    
    # Check if environment variables are set in Vercel
    echo "🔐 Checking environment variables..."
    echo "   Reading from .env.production..."
    
    # Function to check and set env var from .env file
    check_and_set_env() {
        local var_name=$1
        local env_type=${2:-"production"}
        
        # Get value from .env.production and trim whitespace
        local var_value=$(grep "^$var_name=" .env.production | cut -d '=' -f2- | tr -d '\n\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        if [ -z "$var_value" ]; then
            echo "❌ $var_name not found in .env.production"
            return 1
        fi
        
        # Check if variable exists in Vercel
        if vercel env ls | grep -q "$var_name"; then
            echo "✓ $var_name already configured in Vercel"
        else
            echo "→ Setting $var_name in Vercel..."
            echo "$var_value" | vercel env add "$var_name" "$env_type" --force
        fi
    }
    
    # Set environment variables if they don't exist
    echo ""
    check_and_set_env "NEXT_PUBLIC_NETWORK"
    check_and_set_env "NEXT_PUBLIC_MIXOCRACY_CONTRACT_ADDRESS"
    check_and_set_env "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
    check_and_set_env "NEXT_PUBLIC_SPOTIFY_CLIENT_ID"
    check_and_set_env "NEXT_PUBLIC_SPOTIFY_REDIRECT_URI"
    check_and_set_env "SPOTIFY_CLIENT_SECRET"
    
    # Check for hot wallet configuration (optional - warn if not set)
    if grep -q "^HOT_WALLET_PRIVATE_KEY=" .env.production; then
        echo "⚠️  WARNING: HOT_WALLET_PRIVATE_KEY found in .env.production"
        echo "   For security, set this directly in Vercel dashboard instead"
        # Don't automatically upload the private key
    else
        echo "ℹ️  HOT_WALLET_PRIVATE_KEY not found in .env.production"
        echo "   Please set it manually in Vercel dashboard for automatic song removal"
    fi
    
    echo ""
    echo "✅ Environment variables configured!"
    echo ""
    
    vercel --prod
else
    # Preview deployment
    echo "👁️  Creating preview deployment..."
    vercel
fi

echo "✨ Deployment complete!"