#!/bin/bash
# Deploy privacy policy to GitHub Pages
# Usage: ./deploy-privacy.sh YOUR_GITHUB_USERNAME YOUR_REPO_NAME

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./deploy-privacy.sh YOUR_GITHUB_USERNAME YOUR_REPO_NAME"
  echo "Example: ./deploy-privacy.sh johndoe happiwalk-mobile"
  exit 1
fi

USERNAME=$1
REPO=$2

echo "Deploying privacy policy to GitHub Pages..."
echo ""
echo "Steps:"
echo "1. Go to https://github.com/$USERNAME/$REPO/settings/pages"
echo "2. Source: Deploy from a branch"
echo "3. Branch: main, folder: / (root)"
echo "4. Click Save"
echo ""
echo "After deployment, your privacy policy will be at:"
echo "https://$USERNAME.github.io/$REPO/privacy-policy.html"
echo ""
echo "Then update app.json with the URL and rebuild."

# Create a simple CNAME file if needed
echo "Optional: Create a CNAME file for custom domain"
echo "your-domain.com" > CNAME

echo ""
echo "Done! Follow the steps above to complete deployment."