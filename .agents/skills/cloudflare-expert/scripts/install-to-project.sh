#!/usr/bin/env bash
set -e

# ==============================================================================
# Cloudflare Expert Installer Script
# Installs Cloudflare rules, MCP configs, and skill to any target project.
# Usage:
#   bash install-to-project.sh [TARGET_PROJECT_PATH]
# ==============================================================================

TARGET_DIR="${1:-.}"

if [ ! -d "$TARGET_DIR" ]; then
  echo "Target directory '$TARGET_DIR' does not exist."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Installing Cloudflare Expert into: $TARGET_DIR"

# 1. Create directory structure
mkdir -p "$TARGET_DIR/.agents/skills"
mkdir -p "$TARGET_DIR/.agents/rules"

# 2. Copy the entire cloudflare-expert skill into target project
cp -R "$SKILL_ROOT" "$TARGET_DIR/.agents/skills/"

# 3. Setup AGENTS.md if not already present
if [ ! -f "$TARGET_DIR/AGENTS.md" ]; then
  cp "$SKILL_ROOT/resources/AGENTS.md.template" "$TARGET_DIR/AGENTS.md"
  echo "✅ Created AGENTS.md"
else
  echo "ℹ️  AGENTS.md already exists, skipping overwrite."
fi

# 4. Setup rules
cp "$SKILL_ROOT/references/rules.md" "$TARGET_DIR/.agents/rules/cloudflare-workers.md"
echo "✅ Created .agents/rules/cloudflare-workers.md"

# 5. Setup MCP configurations
cp "$SKILL_ROOT/resources/mcp.json.template" "$TARGET_DIR/.mcp.json"
cp "$SKILL_ROOT/resources/mcp.json.template" "$TARGET_DIR/.agents/mcp_config.json"
echo "✅ Created .mcp.json and .agents/mcp_config.json"

echo "🎉 Done! Cloudflare Expert is now fully integrated into '$TARGET_DIR'."
