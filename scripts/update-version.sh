#!/bin/bash

# Get current date in Turkish format
# Example: 10 Mart 2026, 08:45
CURRENT_DATE=$(date +"%d %B %Y, %H:%M" | sed 's/January/Ocak/;s/February/Şubat/;s/March/Mart/;s/April/Nisan/;s/May/Mayıs/;s/June/Haziran/;s/July/Temmuz/;s/August/Ağustos/;s/September/Eylül/;s/October/Ekim/;s/November/Kasım/;s/December/Aralık/')

cat <<EOF > src/utils/version.ts
export const LAST_UPDATE = "$CURRENT_DATE";
EOF

echo "Version updated to: $CURRENT_DATE"
