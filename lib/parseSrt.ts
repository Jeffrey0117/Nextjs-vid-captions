import { Subtitle } from "./types";

export function parseSrt(srtText: string): Subtitle[] {
  console.log(
    "🔍 Original SRT text (first 500 chars):",
    srtText.substring(0, 500)
  );

  // Normalize line endings and split by double line breaks
  const normalizedText = srtText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  console.log(
    "🔍 Normalized text (first 500 chars):",
    normalizedText.substring(0, 500)
  );

  const blocks = normalizedText.split("\n\n").filter((block) => block.trim());
  console.log("🔍 Found blocks:", blocks.length);
  console.log("🔍 First block:", blocks[0]);

  return blocks
    .map((block, index) => {
      const lines = block
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      console.log(`🔍 Block ${index + 1} lines:`, lines);

      if (lines.length < 3) {
        console.warn(`⚠️ Block ${index + 1} has insufficient lines:`, lines);
        return null;
      }

      const id = parseInt(lines[0].trim());
      const timeLine = lines[1].trim();
      const textLines = lines.slice(2);

      console.log(`🔍 Parsing block ${index + 1}:`, {
        id,
        timeLine,
        textLines,
      });

      const [startTime, endTime] = parseTimeString(timeLine);

      return {
        id: id || index + 1,
        startTime,
        endTime,
        text: textLines.join(" ").trim(),
      };
    })
    .filter(Boolean) as Subtitle[];
}

function parseTimeString(timeString: string): [number, number] {
  // Format: 00:00:20,000 --> 00:00:24,400
  const [start, end] = timeString.split(" --> ").map(parseTime);
  return [start, end];
}

function parseTime(timeString: string): number {
  // Format: 00:00:20,000
  const [hms, ms] = timeString.split(",");
  const [hours, minutes, seconds] = hms.split(":").map(Number);
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + Number(ms);
}

export function findCurrentSubtitle(
  subtitles: Subtitle[],
  currentTime: number
): Subtitle | null {
  return (
    subtitles.find(
      (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
    ) || null
  );
}
