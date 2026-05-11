#!/bin/bash
set -euo pipefail

SHORTS_DIR="/Users/harry/development/shorts/videos"
DOWNLOADS_DIR="/Users/harry/Downloads/videos"

lang_to_folder() {
    case "$1" in
        E)  echo "english" ;;
        S)  echo "spanish" ;;
        X)  echo "german"  ;;
        O)  echo "dutch"   ;;
        W)  echo "welsh"   ;;
        XO) echo "xhosa"   ;;
        *)  echo "unknown" ;;
    esac
}

# Fetch 720p CDN URL from JW.org API
get_720p_url() {
    local pub=$1 lang=$2 track=${3:-}
    local api="https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?output=json&pub=${pub}&fileformat=MP4&alllangs=0&langwritten=${lang}"
    [[ -n "$track" ]] && api+="&track=${track}"
    curl -sf "$api" | python3 -c "
import sys, json
d = json.load(sys.stdin)
lang = list(d['files'].keys())[0]
for f in d['files'][lang]['MP4']:
    if f.get('label') == '720p':
        print(f['file']['url'])
        sys.exit(0)
sys.exit(1)"
}

# MM:SS or HH:MM:SS → total seconds (base-10 safe)
to_secs() {
    IFS=: read -ra p <<< "$1"
    if (( ${#p[@]} == 2 )); then
        echo $(( 10#${p[0]} * 60 + 10#${p[1]} ))
    else
        echo $(( 10#${p[0]} * 3600 + 10#${p[1]} * 60 + 10#${p[2]} ))
    fi
}

# MM:SS → MMSS zero-padded to 4 digits for filenames
to_fname_ts() {
    local stripped="${1//:/}"
    printf '%04d' "$((10#$stripped))"
}

trim_and_crop() {
    local input=$1 pub=$2 track_label=$3 lang=$4 start=$5 end=$6
    local folder
    folder=$(lang_to_folder "$lang")

    local start_s end_s dur
    start_s=$(to_secs "$start")
    end_s=$(to_secs "$end")
    dur=$(( end_s - start_s ))

    local fname="${pub}${track_label}_${lang}_$(to_fname_ts "$start")-$(to_fname_ts "$end").mp4"
    local out_16x9="${SHORTS_DIR}/${folder}/16x9/${fname}"
    local out_9x16="${SHORTS_DIR}/${folder}/9x16-crop/${fname}"

    echo "    → $fname"

    # Trim: input-seek for speed, duration-based end point
    ffmpeg -ss "$start" -i "$input" -t "$dur" -c copy "$out_16x9" -y -loglevel error

    # Center crop to 9:16 from the trimmed 16:9 file
    ffmpeg -i "$out_16x9" \
        -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0" \
        -c:a copy "$out_9x16" -y -loglevel error
}

process_pub() {
    local pub=$1 track=$2
    shift 2
    # Remaining args: alternating start end pairs

    local track_label=""
    [[ -n "$track" ]] && track_label="_$(printf '%02d' "$track")"

    echo ""
    echo "=== $pub${track:+ (track $track)} ==="

    # Online languages: fetch URL from API then trim
    for lang in E S X O; do
        echo "  [$lang — $(lang_to_folder "$lang")]"
        local input
        if ! input=$(get_720p_url "$pub" "$lang" "$track"); then
            echo "    SKIP: not available via API"
            continue
        fi
        local i=0
        local args=("$@")
        while (( i < ${#args[@]} )); do
            trim_and_crop "$input" "$pub" "$track_label" "$lang" "${args[$i]}" "${args[$i+1]}"
            i=$(( i + 2 ))
        done
    done

    # Local languages: Welsh (W) and Xhosa (XO) already downloaded
    for lang in W XO; do
        local local_file
        if [[ -n "$track" ]]; then
            local_file="${DOWNLOADS_DIR}/${pub}_${lang}_$(printf '%02d' "$track")_r720P.mp4"
        else
            local_file="${DOWNLOADS_DIR}/${pub}_${lang}_r720P.mp4"
        fi

        if [[ ! -f "$local_file" ]]; then
            echo "  [$lang] SKIP: $(basename "$local_file") not found"
            continue
        fi

        echo "  [$lang — $(lang_to_folder "$lang")]"
        local i=0
        local args=("$@")
        while (( i < ${#args[@]} )); do
            trim_and_crop "$local_file" "$pub" "$track_label" "$lang" "${args[$i]}" "${args[$i+1]}"
            i=$(( i + 2 ))
        done
    done
}

# Episode 1: The True Light of the World
process_pub gnj 1 \
    "15:32" "15:59" \
    "40:44" "41:28" \
    "52:57" "53:18"

# The Story of Jonah (full movie — no track number)
process_pub jcm "" \
    "8:48"  "9:23" \
    "11:35" "12:18" \
    "13:19" "13:53"

# Please Save Us
process_pub wcgv 6 \
    "2:18" "2:50"

# Daniel: A Lifetime of Faith—Part I
process_pub dlf 1 \
    "21:37" "22:10" \
    "25:03" "25:38" \
    "32:06" "32:36"
