#!/bin/bash

# Script to replace sensitive data in Git history

# The sensitive Azure Event Hub key
SECRET_KEY="I8RtvoJ7MJ+UEAdPodGQkVcCjCaur4wyc+AEhB1Lw7A="
REPLACEMENT_TEXT="REMOVED_SECRET_KEY"

# Replace in all files in history
git filter-branch --force --index-filter \
  "git ls-files -z | xargs -0 sed -i '' -e 's/$SECRET_KEY/$REPLACEMENT_TEXT/g'" \
  --prune-empty --tag-name-filter cat -- --all

echo "Completed replacing sensitive data in Git history."
echo "To push changes forcefully, run: git push --force" 