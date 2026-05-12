# Generates ideas/sentient-demo-narration.wav from inline SSML using
# Windows SAPI (System.Speech.Synthesis). Run from the repo root:
#   pwsh -File scripts/generate-narration.ps1
# or
#   powershell.exe -File scripts/generate-narration.ps1

Add-Type -AssemblyName System.Speech

$ssml = @'
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
<prosody rate="-1">

Welcome to Spacio. What you are seeing is a live operational view of a two-floor office, fused from three data sources. Cisco Spaces wifi presence. ThousandEyes network telemetry. And Wellness IoT sensors.
<break time="800ms"/>
It is eight in the morning. The lobby is the only zone with any meaningful traffic. Three early arrivals across the building. Everything else reads green and quiet.
<break time="12s"/>

Nine o clock. Cisco Spaces is now reporting around forty percent occupancy in the Windows and Security neighbourhoods on the ground floor. The Engineering pods on the first floor are filling at a similar pace.
<break time="800ms"/>
Up in the right panel, you will see two notifications fire. The first is a context aware welcome. The system has matched the arriving user's team to the Windows neighbourhood, and is inviting them to book a desk nearby.
<break time="800ms"/>
The second is more interesting. A ThousandEyes alert. The uplink serving the East Pods on the first floor has degraded. The map shows that zone in amber, and the chip reads patchy. Anyone with a video meeting in the next hour gets a different recommendation.
<break time="20s"/>

Eleven o clock. We are at peak morning density. Notice the red glow over Support, ground floor. Eighty percent occupancy. The Security zone is matching it.
<break time="800ms"/>
Here is where the system starts earning its keep. Two ghost bookings have just been flagged. G zero three one, booked by Daniel Reyes from Cyber Security. No presence sensed for ninety minutes. F zero one three, Sara Bennett. Same story. The right hand panel offers a one click release for each, and an auto release countdown is running. This is the ghost booking problem most desk booking tools simply cannot see, because they only have booking data, not presence data.
<break time="800ms"/>
The notification feed also surfaces a quiet tip. Virtualisation is only fifty five percent full, with five quiet zone desks still free. That is a colleague aware suggestion, not a static map filter.
<break time="22s"/>

One in the afternoon. Lunch dip. Occupancy on the working floors has dropped to the mid forties. The Breakout zone has spiked to seventy five percent.
<break time="800ms"/>
One of the earlier ghost bookings has now auto released. The system reclaimed that desk without human intervention. Trustworthy utilisation data. Bookings reconciled with actual presence. Flows straight into the analytics layer this view sits on top of.
<break time="800ms"/>
If you click any colleague on the right panel, the floor plan draws a route from the lobby to their desk. That is indoor wayfinding, ready to be backed by Bluetooth beacons or Cisco DNA Spaces when the real signals are wired in.
<break time="22s"/>

Three in the afternoon. Second peak of the day. Support has hit ninety percent. Look at the wellness strip along the bottom. CO 2 in Support is over a thousand parts per million, and the air quality chip has flipped to amber. The notification feed has already pinged facilities to step up the H V A C. That is a wellness signal informing real time building operations.
<break time="800ms"/>
The earlier network alert has cleared. East Pods is back to good. Safe for video again.
<break time="14s"/>

Four o clock. Occupancy is starting to taper, but not uniformly. The Data pods on the first floor are holding steady while the ground floor empties first. The heat map captures that gradient in a way a table of bookings just cannot.
<break time="18s"/>

Six in the evening. The building is at eight percent occupancy. The last notification of the day is a polite reminder to the three remaining users with active bookings. Badge out, or the system will release the desk for tomorrow's first arrivals.
<break time="800ms"/>
That is a workday on Spacio. Cisco Spaces gave us the presence signal. ThousandEyes gave us the network signal. The Wellness IoT layer gave us the human signal. The desk booking app stitched them into a single operational view, and the people working in the building barely noticed it was there.
<break time="2s"/>

</prosody>
</speak>
'@

$out = Join-Path (Split-Path $PSScriptRoot -Parent) "ideas\sentient-demo-narration.wav"
$ideasDir = Split-Path $out -Parent
if (-not (Test-Path $ideasDir)) { New-Item -ItemType Directory -Path $ideasDir | Out-Null }

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $synth.SelectVoice("Microsoft Hazel Desktop")
} catch {
    Write-Warning "Hazel voice unavailable, using default."
}

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    16000,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono
)
$synth.SetOutputToWaveFile($out, $format)
$synth.SpeakSsml($ssml)
$synth.Dispose()

Write-Host "Wrote $out"
$file = Get-Item $out
Write-Host ("Size: {0:N1} KB" -f ($file.Length / 1KB))
