# Rumble Selfbot API Analysis

## Key Findings from watcher.js

### Comment Method (Lines 234-264)
The `comment(message)` method handles both live streams and normal videos:

```javascript
async comment(message) {
    return new Promise(async (resolve, reject) => {
        if (await this.areCommentsLocked().catch(reject)) {
            return reject(new Error("Unable to make comment because video has comments locked."))
        }

        try {
            if (this.#parent.videoInfo.isLive) {
                // LIVE STREAM COMMENT
                let em = await this.#page.waitForSelector(`#chat-message-text-input`).catch(reject)
                await em.click().catch(reject)
                await this.#page.keyboard.type(message, 25).catch(reject)
                let submit = await this.#page.waitForSelector(`.chat--send`).catch(reject)
                await submit.click().catch(reject)
            } else {
                // NORMAL VIDEO COMMENT
                let em = await this.#page.waitForSelector(`.comments-create-textarea`).catch(reject)
                await em.click().catch(reject)
                await this.#page.keyboard.type(message, 25).catch(reject)
                let submit = await this.#page.waitForSelector(`.comments-add-comment`).catch(reject)
                await submit.click().catch(reject)
            }
            resolve()
        } catch (err) {
            reject(new Error(err))
        }
    })
}
```

### Key Selectors for Rumble

| Type | Selector | Purpose |
|------|----------|---------|
| Live Chat Input | `#chat-message-text-input` | Text input for live stream chat |
| Live Chat Send | `.chat--send` | Submit button for live chat |
| Normal Comment Input | `.comments-create-textarea` | Text area for normal video comments |
| Normal Comment Submit | `.comments-add-comment` | Submit button for normal comments |
| Like Button | `button.rumbles-vote-pill-up.rumblers-vote-pill-button` | Like the video |
| Dislike Button | `button.rumbles-vote-pill-down.rumblers-vote-pill-button` | Dislike the video |
| Follow Button | `div.media-by-channel-container > div > div > button` | Follow the channel |
| Video Element | `video` | The video player element |
| Settings Button | `div[title="Playback settings"]` | Access playback settings |

### Video State Handling
- States: "PLAYING", "PAUSED", "FINISHED"
- Events: pause, play, ended

### Resolution Setting
- Gets lowest resolution to save bandwidth
- Uses `resolutions.sort((a, b) => a - b)[0]`

### Key Methods
- `setup()` - Initialize watcher, set up event listeners
- `play()` / `pause()` - Control video playback
- `seek(time)` - Jump to specific time
- `time()` / `duration()` - Get current time and total duration
- `like()` / `dislike()` - Vote on video
- `follow()` - Follow the channel
- `comment(message)` - Post a comment (live or normal)
- `resolutions()` - Get available quality options
- `setResolution(quality)` - Set video quality

## Integration Plan

1. **Use Playwright** to control browser
2. **Inject cookies** for authenticated session
3. **Navigate to video URL**
4. **Detect if live stream** using `videoInfo.isLive`
5. **Use appropriate selectors** based on video type
6. **Type message** with realistic typing speed (25ms delay)
7. **Click submit** button


## Cookie Handling (from page.js)

### setCookies Method (Lines 293-334)
The API can accept cookies in two formats:

1. **JSON Array** - Already formatted cookie objects
2. **Raw Cookie String** - Like from browser dev tools

When receiving a raw cookie string, it parses it like this:

```javascript
async setCookies(cookies) {
    if (typeof cookies == "string") {
        try {
            cookies = JSON.parse(cookies)
        } catch (err) {
            // Parse raw cookie string format: "name1=value1; name2=value2"
            cookies = cookies.split("; ")
            let res = []

            for (let cookie of cookies) {
                let parts = cookie.split("=")
                let name = parts.shift()
                let value = parts.join("=")

                res.push({
                    name,
                    value,
                    domain: ".rumble.com",
                    path: "/",
                    expires: Date.now() + 657000000,  // ~7.6 days
                    size: name.length + value.length,
                    httpOnly: false,
                    secure: true,
                    session: false,
                    sameSite: "None",
                    sameParty: false,
                    sourceScheme: "Secure",
                    sourcePort: 443,
                })
            }
            cookies = res
        }
    }
    
    this.cookies = await this.getFormattedCookies(cookies)
    await this.browser.addCookies(cookies)
}
```

### Key Cookie Properties for Rumble
- **domain**: `.rumble.com`
- **path**: `/`
- **secure**: `true`
- **sameSite**: `"None"`
- **sourceScheme**: `"Secure"`
- **sourcePort**: `443`

### Anti-Fingerprinting
Uses `playwright-anti-fingerprinter` library:
```javascript
import { ConnectFingerprinter } from "playwright-anti-fingerprinter";

await ConnectFingerprinter("firefox", this.page, {
    fingerprint: this.browser.fingerprint,
    requestInterceptor
}, ["media"])
```

## Implementation Summary

To replicate this in our system:

1. **Parse raw cookies** using the same format (split by "; " then by "=")
2. **Add required properties** (domain, path, secure, sameSite, etc.)
3. **Use playwright-anti-fingerprinter** for anti-detection
4. **Navigate to video URL** 
5. **Detect if live stream** from videoInfo
6. **Use correct selectors** based on video type
7. **Type with realistic delay** (25ms between keystrokes)
8. **Click submit button**
