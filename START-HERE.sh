#!/usr/bin/env bash
# ============================================================================
# START-HERE.sh — পরবর্তী AI কে দেওয়ার জন্য ছোট্ট স্ক্রিপ্ট
# ============================================================================
# এই স্ক্রিপ্টটা রান করলে:
#   ১. রিপো ক্লোন হবে
#   ২. সব ক্রেডেনশিয়াল ডিকোড হবে (.credentials.enc থেকে)
#   ৩. HANDOFF-SCRIPT.md দেখাবে — সেখান থেকে কাজ শুরু করো
# ============================================================================
set -e

echo "🚀 Enterprise Email Sending Module — Setup"
echo "============================================"

# Step 1: Clone repo
REPO_URL="https://github.com/smiukgdjggrjc536-create/Mms_senderV01.git"
echo "📦 Cloning repo..."
if [ ! -d "Mms_senderV01" ]; then
  git clone "$REPO_URL"
fi
cd Mms_senderV01

# Step 2: Load credentials
echo "🔑 Loading credentials..."
if [ -f ".credentials.enc" ]; then
  eval "$(base64 -d .credentials.enc | awk '{print "CRED_"NR"="$0}')"
  export MONGODB_URI="$CRED_1"
  export ADMIN_USERNAME="$CRED_2"
  export ADMIN_PASSWORD="$CRED_3"
  export ADMIN_API_KEY="$CRED_4"
  export GITHUB_TOKEN="$CRED_5"
  export NETLIFY_URL="$CRED_6"
  export RENDER_URL="$CRED_7"
  export GEMINI_KEY_PRIMARY="$CRED_8"
  export GEMINI_KEY_NEW="$CRED_9"
  export PRIMARY_EMAIL_ACCOUNT="$CRED_10"
  echo "✅ Credentials loaded:"
  echo "   MongoDB: ${MONGODB_URI:0:30}..."
  echo "   Admin: $ADMIN_USERNAME"
  echo "   GitHub Token: ${GITHUB_TOKEN:0:10}..."
  echo "   Netlify: $NETLIFY_URL"
  echo "   Render: $RENDER_URL"
else
  echo "❌ .credentials.enc not found!"
  exit 1
fi

# Step 3: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 4: Show the handoff script
echo ""
echo "📄 HANDOFF-SCRIPT.md পড়ো — সেখানে পুরো কাজের নির্দেশনা আছে:"
echo "   cat HANDOFF-SCRIPT.md"
echo ""
echo "🎯 তোমার কাজ: স্প্যাম-ফ্রি অ্যান্টি-বাইপাস ডেইলি বাল্ক শুট সেটআপ"
echo "   বিস্তারিত: HANDOFF-SCRIPT.md এর অংশ ৬"
echo ""
echo "🚀 শুরু করো!"
