#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}ℹ${NC}  $1"; }
success() { echo -e "${GREEN}✔${NC}  $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
error()   { echo -e "${RED}✖${NC}  $1"; exit 1; }

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  ClawPulse — Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# ── Check Node.js ──────────────────────────────────────────
if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Please install Node.js >= 18: https://nodejs.org"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js >= 18 is required (found v$(node -v | sed 's/v//'))"
fi
success "Node.js $(node -v) detected"

# ── Check npm ──────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  error "npm is not installed. It should come with Node.js."
fi
success "npm $(npm -v) detected"

# ── Install dependencies ──────────────────────────────────
info "Installing dependencies..."
npm install --loglevel=error
success "Dependencies installed"

# ── Set up .env.local ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.local"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  if [ ! -f "$ENV_EXAMPLE" ]; then
    error ".env.example not found — repo may be incomplete"
  fi
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  info "Created .env.local from .env.example"
else
  success ".env.local already exists"
fi

# ── Configure Supabase credentials ────────────────────────
needs_config() {
  local val
  val=$(grep "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2-)
  [ -z "$val" ] || [ "$val" = "your_supabase_url" ] || [ "$val" = "your_supabase_anon_key" ]
}

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # Cross-platform sed in-place
    if [[ "$OSTYPE" == darwin* ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    fi
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# Supabase URL
if needs_config NEXT_PUBLIC_SUPABASE_URL; then
  if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
    set_env NEXT_PUBLIC_SUPABASE_URL "$NEXT_PUBLIC_SUPABASE_URL"
    success "Supabase URL set from environment"
  else
    echo ""
    read -rp "$(echo -e "${YELLOW}?${NC}")  Enter your Supabase URL: " SUPA_URL
    if [ -n "$SUPA_URL" ]; then
      set_env NEXT_PUBLIC_SUPABASE_URL "$SUPA_URL"
      success "Supabase URL configured"
    else
      warn "Supabase URL not set — edit .env.local later"
    fi
  fi
else
  success "Supabase URL already configured"
fi

# Supabase Anon Key
if needs_config NEXT_PUBLIC_SUPABASE_ANON_KEY; then
  if [ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
    set_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    success "Supabase Anon Key set from environment"
  else
    echo ""
    read -rp "$(echo -e "${YELLOW}?${NC}")  Enter your Supabase Anon Key: " SUPA_KEY
    if [ -n "$SUPA_KEY" ]; then
      set_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$SUPA_KEY"
      success "Supabase Anon Key configured"
    else
      warn "Supabase Anon Key not set — edit .env.local later"
    fi
  fi
else
  success "Supabase Anon Key already configured"
fi

# ── Done ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
info "Starting dev server..."
echo ""
exec npm run dev
