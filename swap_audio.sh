#!/bin/bash
set -e

EDITED_DIR="/Users/harry/Downloads/edited"
VIDEOS_DIR="/Users/harry/development/shorts/videos"

# Copy English videos to their folder
echo "=== Copying English videos ==="
cp "$EDITED_DIR"/*.mp4 "$VIDEOS_DIR/english/9x16-edited/"
echo "Done."

get_code() {
    case "$1" in
        dutch)   echo "O"  ;;
        german)  echo "X"  ;;
        spanish) echo "S"  ;;
        welsh)   echo "W"  ;;
        xhosa)   echo "XO" ;;
    esac
}

for lang in dutch german spanish welsh xhosa; do
    code=$(get_code "$lang")
    echo ""
    echo "=== $lang (code: $code) ==="

    for eng_video in "$EDITED_DIR"/*.mp4; do
        filename=$(basename "$eng_video")

        # Skip wcgv for Welsh (no source exists)
        if [[ "$lang" == "welsh" && "$filename" == wcgv* ]]; then
            echo "  Skipping $filename (no Welsh source)"
            continue
        fi

        lang_filename="${filename/_E_/_${code}_}"
        lang_source="$VIDEOS_DIR/$lang/16x9/$lang_filename"
        output="$VIDEOS_DIR/$lang/9x16-edited/$lang_filename"

        if [[ ! -f "$lang_source" ]]; then
            echo "  WARNING: source not found: $lang_source"
            continue
        fi

        echo "  $filename -> $lang_filename"
        ffmpeg -y -loglevel error \
            -i "$eng_video" \
            -i "$lang_source" \
            -map 0:v:0 -map 1:a:0 \
            -c:v copy -c:a copy \
            -shortest \
            "$output"
    done
done

echo ""
echo "=== All done ==="
