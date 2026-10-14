# QA inventory

Flow: title → choose stage/character → start → move/jump → pause → resume → result → retry/home.

| Claim / control | Functional check | Visual state / evidence |
|---|---|---|
| Start normal/timed | click each; inspect mode, stage, character | title at all five sizes |
| Stage cards | select both and reload | selected state + hero image |
| Character picker | select Bobo/Mew/Aclaire | picker + active character in title |
| How to play/minigames | expand/collapse; enter/exit RPS | expanded help, RPS battle |
| Touch size | standard/large/reload; invalid storage | pause + gameplay with both sizes |
| Movement | left/right+jump; release/cancel | pressed buttons + changed player position |
| Pause | pause/resume/restart/home | paused screen and returning game |
| Sound/music/fullscreen | toggle full cycle; unsupported hidden | matching pressed state on both surfaces |
| HUD | normal/timed, powers, Mew float/Aclaire guard | dense HUD at smallest viewports |
| Result | complete timed round with input, retry/home | result screenshot |
| Fit | bounding boxes and no horizontal overflow | 360×640, 390×844, 640×360, 844×390, 1366×768 |
| Resilience | asset/font failure, bad/unavailable storage | usable title fallback |
| Accessibility | keyboard focus, labels, reduced motion | focus-visible and paused settings |

Exploratory: rotate while holding a direction; lose visibility/focus while playing; resize paused menu; open result then retry.

Real iOS/Android devices are not available. Emulation is explicitly separate from device QA. Debug staging of dense states is allowed for screenshots and does not count as gameplay completion.
