// Generates ideas/sentient-demo-narration.mp3 using a Microsoft neural
// voice (en-GB-RyanNeural by default) via the same public TTS endpoint
// that Microsoft Edge's "Read Aloud" feature uses. No API key required.
//
// Run from the repo root:
//   node scripts/generate-narration.mjs
//   node scripts/generate-narration.mjs --voice=en-GB-SoniaNeural

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { mkdirSync, existsSync, createWriteStream, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const OUT_PATH = resolve(REPO_ROOT, 'ideas/sentient-demo-narration.mp3');

const DEFAULT_VOICE = 'en-GB-RyanNeural';

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    })
);

const voice = args.voice || DEFAULT_VOICE;

// The Microsoft Edge TTS endpoint silently rejects payloads that
// contain SSML tags like <break/> or <say-as/>, even though they're
// valid SSML. Sticking to plain text with punctuation-driven prosody
// keeps the request inside the supported envelope. The neural voice
// handles pacing naturally from commas, periods, and paragraph breaks.
const body = `Welcome to Spacio. What you are seeing is a live operational view of a two-floor office, fused from three data sources. Cisco Spaces wi-fi presence. ThousandEyes network telemetry. And Wellness Internet of Things sensors.

It is eight in the morning. The lobby is the only zone with any meaningful traffic. Three early arrivals across the building. Everything else reads green, and quiet.

Now, nine o'clock. Cisco Spaces is reporting around forty percent occupancy in the Windows and Security neighbourhoods on the ground floor. The Engineering pods on the first floor are filling at a similar pace.

In the right panel, two notifications fire. The first is a context-aware welcome. The system has matched the arriving user's team to the Windows neighbourhood, and is inviting them to book a desk nearby. The second is more interesting. A ThousandEyes alert. The uplink serving the East Pods on the first floor has degraded. The map shows that zone in amber, and the chip reads, patchy. Anyone with a video meeting in the next hour gets a different recommendation.

Eleven o'clock. Peak morning density. Notice the red glow over Support, on the ground floor. Eighty percent occupancy. The Security zone is matching it.

Now, watch the right hand panel. Two ghost bookings have been flagged. Desk G zero three one, booked by Daniel Reyes from Cyber Security. No presence sensed for ninety minutes. Desk F zero one three, Sara Bennett. Same story.

The system offers a one click release for each, and an auto release countdown is running. This is the ghost booking problem that most desk booking tools simply cannot see. Because they only have booking data. Not presence data.

The notification feed also surfaces a quieter suggestion. Virtualisation is only fifty-five percent full, with five quiet-zone desks still free. That is a colleague-aware suggestion. Not a static map filter.

One in the afternoon. Lunch dip. Occupancy on the working floors has dropped to the mid-forties. The Breakout zone has spiked to seventy-five percent.

One of the earlier ghost bookings has now auto-released. The system reclaimed that desk without human intervention. Trustworthy utilisation data. Bookings reconciled with actual presence. Flows straight into the analytics layer this view sits on top of.

If you click any colleague on the right panel, the floor plan draws a route from the lobby to their desk. That is indoor wayfinding. Ready to be backed by Bluetooth beacons or Cisco DNA Spaces when the real signals are wired in.

Three in the afternoon. The second peak of the day. Support has hit ninety percent.

Look at the wellness strip along the bottom. Carbon dioxide in Support is over a thousand parts per million, and the air-quality chip has flipped to amber. The notification feed has already pinged facilities to step up the H V A C. A wellness signal, informing real-time building operations. The earlier network alert has cleared. East Pods is back to good. Safe for video again.

Four o'clock. Occupancy is starting to taper. But not uniformly. The Data pods on the first floor are holding steady while the ground floor empties first. The heat-map captures that gradient in a way a table of bookings simply cannot.

Six in the evening. The building is at eight percent occupancy. The last notification of the day is a polite reminder to the three remaining users with active bookings. Badge out. Or the system will release the desk for tomorrow's first arrivals.

That, is a workday on Spacio. Cisco Spaces gave us the presence signal. ThousandEyes gave us the network signal. The Wellness Internet of Things layer gave us the human signal. The desk booking app stitched them into a single operational view, and the people working in the building, barely noticed it was there.`;

if (!existsSync(dirname(OUT_PATH))) {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
}

const tts = new MsEdgeTTS();
await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

console.log(`Voice:  ${voice}`);
console.log(`Output: ${OUT_PATH}`);

const { audioStream } = tts.toStream(body, { rate: '-7%' });

await new Promise((resolveP, reject) => {
  const out = createWriteStream(OUT_PATH);
  audioStream.on('data', (chunk) => out.write(chunk));
  audioStream.on('close', () => { out.end(); resolveP(); });
  audioStream.on('error', reject);
  out.on('error', reject);
});

tts.close();

const size = statSync(OUT_PATH).size;
console.log(`Wrote ${(size / 1024).toFixed(1)} KB`);
