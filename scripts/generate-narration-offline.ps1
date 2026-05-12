# OFFLINE FALLBACK for ideas/sentient-demo-narration.wav.
#
# The primary generator is scripts/generate-narration.mjs (Node), which
# uses the en-GB-RyanNeural voice via Microsoft Edge's Read-Aloud
# endpoint and produces a far more natural MP3. This script exists for
# machines without internet access.
#
# Uses the Windows Runtime (WinRT) SpeechSynthesizer so it can reach the
# OneCore voice store (Microsoft George, en-GB male). NOTE: WinRT
# SpeechSynthesizer cannot see Windows 11 "Natural Voices" (Ryan, Sonia
# etc.) — those are appx packages exposed only to Narrator. Best
# available here is George.
#
# Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/generate-narration-offline.ps1
$VOICE_PREFERENCE = @(
    "Ryan",        # en-GB-RyanNeural (Natural) — best if installed
    "Thomas",      # en-GB neural male (rare)
    "George",      # OneCore en-GB male — default fallback
    "Hazel",       # OneCore en-GB female
    "Susan",       # OneCore en-GB female
    "Mark"         # generic male fallback
)

$ssml = @'
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
<voice xml:lang="en-GB">
<prosody rate="-15%" pitch="-2st">

Welcome to Spacio.
<break time="600ms"/>
What you are seeing is a live operational view of a two floor office, fused from three data sources.
<break time="400ms"/>
Cisco Spaces wifi presence.
<break time="300ms"/>
ThousandEyes network telemetry.
<break time="300ms"/>
And Wellness IoT sensors.
<break time="900ms"/>
It is eight in the morning. The lobby is the only zone with any meaningful traffic.
<break time="400ms"/>
Three early arrivals across the building.
<break time="400ms"/>
Everything else reads green, and quiet.
<break time="12s"/>

Nine o'clock.
<break time="400ms"/>
Cisco Spaces is now reporting around forty percent occupancy in the Windows and Security neighbourhoods on the ground floor. The Engineering pods on the first floor are filling at a similar pace.
<break time="800ms"/>
In the right panel, two notifications fire. The first is a context aware welcome. The system has matched the arriving user's team to the Windows neighbourhood, and is inviting them to book a desk nearby.
<break time="700ms"/>
The second is more interesting. A ThousandEyes alert. The uplink serving the East Pods on the first floor has degraded. The map shows that zone in amber, and the chip reads patchy. Anyone with a video meeting in the next hour gets a different recommendation.
<break time="20s"/>

Eleven o'clock. Peak morning density. Notice the red glow over Support, on the ground floor.
<break time="400ms"/>
Eighty percent occupancy. The Security zone is matching it.
<break time="700ms"/>
Now, watch the right hand panel. Two ghost bookings have been flagged. G zero three one, booked by Daniel Reyes from Cyber Security. No presence sensed for ninety minutes. F zero one three, Sara Bennett. Same story.
<break time="500ms"/>
The system offers a one click release for each, and an auto release countdown is running. This is the ghost booking problem that most desk booking tools simply cannot see, because they only have booking data. Not presence data.
<break time="800ms"/>
The notification feed also surfaces a quieter suggestion. Virtualisation is only fifty five percent full, with five quiet zone desks still free. That is a colleague aware suggestion, not a static map filter.
<break time="22s"/>

One in the afternoon. Lunch dip. Occupancy on the working floors has dropped to the mid forties. The Breakout zone has spiked to seventy five percent.
<break time="700ms"/>
One of the earlier ghost bookings has now auto released. The system reclaimed that desk without human intervention.
<break time="500ms"/>
Trustworthy utilisation data. Bookings reconciled with actual presence. Flows straight into the analytics layer this view sits on top of.
<break time="800ms"/>
If you click any colleague on the right panel, the floor plan draws a route from the lobby to their desk. That is indoor wayfinding, ready to be backed by Bluetooth beacons or Cisco DNA Spaces when the real signals are wired in.
<break time="22s"/>

Three in the afternoon. The second peak of the day. Support has hit ninety percent.
<break time="500ms"/>
Look at the wellness strip along the bottom. Carbon dioxide in Support is over a thousand parts per million, and the air quality chip has flipped to amber. The notification feed has already pinged facilities to step up the HVAC. A wellness signal informing real time building operations.
<break time="700ms"/>
The earlier network alert has cleared. East Pods is back to good. Safe for video again.
<break time="14s"/>

Four o'clock. Occupancy is starting to taper, but not uniformly. The Data pods on the first floor are holding steady while the ground floor empties first. The heat map captures that gradient in a way a table of bookings simply cannot.
<break time="18s"/>

Six in the evening. The building is at eight percent occupancy.
<break time="500ms"/>
The last notification of the day is a polite reminder to the three remaining users with active bookings. Badge out, or the system will release the desk for tomorrow's first arrivals.
<break time="800ms"/>
That, is a workday on Spacio.
<break time="500ms"/>
Cisco Spaces gave us the presence signal. ThousandEyes gave us the network signal. The Wellness IoT layer gave us the human signal. The desk booking app stitched them into a single operational view, and the people working in the building barely noticed it was there.
<break time="2s"/>

</prosody>
</voice>
</speak>
'@

$outPath = Join-Path (Split-Path $PSScriptRoot -Parent) "ideas\sentient-demo-narration.wav"
$ideasDir = Split-Path $outPath -Parent
if (-not (Test-Path $ideasDir)) { New-Item -ItemType Directory -Path $ideasDir | Out-Null }

# -------- WinRT setup --------
[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# AsTask<TResult>(IAsyncOperation<TResult>) helper, picked once
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1

function Wait-AsyncOp {
    param($AsyncOp, [type]$ResultType)
    $task = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOp))
    $task.Wait()
    return $task.Result
}

# -------- Pick a voice --------
$synth = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()
$allVoices = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
$picked = $null
foreach ($pref in $VOICE_PREFERENCE) {
    $match = $allVoices | Where-Object { $_.DisplayName -match $pref } | Select-Object -First 1
    if ($match) { $picked = $match; break }
}
if (-not $picked) {
    $picked = $allVoices | Where-Object { $_.Language -eq 'en-GB' } | Select-Object -First 1
}
if (-not $picked) {
    $picked = $allVoices | Select-Object -First 1
}
$synth.Voice = $picked
Write-Host ("Using voice: {0}  [{1}]" -f $picked.DisplayName, $picked.Language)

# -------- Synthesize --------
$streamOp = $synth.SynthesizeSsmlToStreamAsync($ssml)
$speechStream = Wait-AsyncOp $streamOp ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])

$size = [int]$speechStream.Size
$reader = [Windows.Storage.Streams.DataReader]::new($speechStream.GetInputStreamAt(0))
$loadOp = $reader.LoadAsync($size)
$null = Wait-AsyncOp $loadOp ([uint32])

$buffer = New-Object byte[] $size
$reader.ReadBytes($buffer)
[System.IO.File]::WriteAllBytes($outPath, $buffer)
$reader.Dispose()
$synth.Dispose()

$f = Get-Item $outPath
Write-Host ("Wrote {0}" -f $outPath)
Write-Host ("Size: {0:N1} KB" -f ($f.Length / 1KB))
