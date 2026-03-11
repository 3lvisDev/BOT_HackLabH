# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Audio Stream Not Redirected to Virtual Sink
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing case: `!play` command with browser launched and audio playing
  - Test that when `!play` is executed, the Chromium sink-input is connected to the virtual sink `discord_music_${guildId}` (from Bug Condition in design)
  - Test that FFmpeg receives audio data from the virtual sink monitor
  - Test that Discord plays audio in the voice channel
  - The test assertions should match: `chromiumSinkInputInVirtualSink(guildId) AND ffmpegReceivingAudioData() AND discordPlayingAudio()`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: Chromium sink-input connected to default sink instead of virtual sink, FFmpeg stdout empty, Discord silent
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Audio-Routing Operations Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (operations not involving audio redirection)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Virtual sink creation with `pactl load-module module-null-sink` works correctly
    - YouTube navigation and video loading work correctly
    - Resource cleanup with `!stop` works correctly
    - Cookie application for YouTube Premium works correctly
    - Audio does NOT play in user's headphones/speakers (remains isolated)
    - System does NOT capture user's microphone (only browser audio)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix for audio isolation with PulseAudio sink redirection

  - [ ] 3.1 Implement sink-input detection and redirection in `_launchBrowser`
    - Add polling mechanism to detect Chromium sink-input in PulseAudio after browser launch
    - Execute `pactl list sink-inputs` in loop with 500ms intervals
    - Search for sink-input corresponding to Chromium process (by application name or PID)
    - Implement 10-second timeout if sink-input is not detected
    - Add diagnostic logging for sink-input detection
    - _Bug_Condition: isBugCondition(input) where input.command == '!play' AND input.browserLaunched == true AND input.audioPlaying == true AND NOT audioStreamInVirtualSink(input.guildId) AND NOT ffmpegReceivingAudio()_
    - _Expected_Behavior: chromiumSinkInputInVirtualSink(guildId) AND ffmpegReceivingAudioData() AND discordPlayingAudio()_
    - _Preservation: Virtual sink creation, YouTube navigation, resource cleanup, cookie application, audio isolation, no microphone capture_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 3.2 Implement explicit sink-input movement to virtual sink
    - Move detected sink-input to virtual sink using `pactl move-sink-input <id> <virtualSinkName>`
    - Verify redirection was successful by checking sink-input location
    - Add diagnostic logging for movement operation
    - Log sink-input ID and initial sink connection
    - Log verification that sink-input is now in correct virtual sink
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.3 Add error handling for sink-input detection failure
    - Throw descriptive error if sink-input cannot be detected after timeout
    - Throw descriptive error if sink-input movement fails
    - Include diagnostic information in error messages
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.4 Keep PULSE_SINK environment variable as fallback
    - Maintain existing PULSE_SINK configuration in browser launch
    - Keep as fallback mechanism for systems where it works reliably
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.5 Add delay in `_navigateToYouTube` after video playback starts
    - Add 1-2 second delay after video starts playing
    - Ensure audio begins flowing before `_startAudioBridge` attempts capture
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Requirements: 2.2, 2.4_

  - [ ] 3.6 Add audio verification in `_startAudioBridge` before FFmpeg starts
    - Verify virtual sink monitor is receiving audio using `pactl list sinks`
    - Check `State` field of virtual sink before starting FFmpeg
    - Add diagnostic logging for audio verification
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Requirements: 2.2, 2.4_

  - [ ] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Audio Stream Redirected to Virtual Sink
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify Chromium sink-input is in virtual sink
    - Verify FFmpeg receives audio data
    - Verify Discord plays audio
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Audio-Routing Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm virtual sink creation still works
    - Confirm YouTube navigation still works
    - Confirm resource cleanup still works
    - Confirm cookie application still works
    - Confirm audio isolation is maintained
    - Confirm no microphone capture occurs

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
