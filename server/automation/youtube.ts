import { Page } from 'playwright';

interface YouTubeCommentOptions {
  videoUrl: string;
  comment: string;
  cookies: Record<string, string>;
}

export async function submitYouTubeComment(
  page: Page,
  options: YouTubeCommentOptions
): Promise<{ success: boolean; message: string }> {
  try {
    const { videoUrl, comment } = options;

    console.log('[YouTube] Navigating to video:', videoUrl);
    await page.goto(videoUrl, { waitUntil: 'networkidle' });

    // Wait for the page to fully load
    await page.waitForTimeout(2000);

    // Scroll down to comments section
    console.log('[YouTube] Scrolling to comments section');
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 3);
    });

    await page.waitForTimeout(1000);

    // Try to find and click the comment input field
    console.log('[YouTube] Looking for comment input');
    const commentInputSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      '#contenteditable-root',
      'textarea[aria-label*="comment"]',
      'div[aria-label*="comment"]',
    ];

    let inputFound = false;
    for (const selector of commentInputSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log('[YouTube] Found comment input with selector:', selector);
          await element.click();
          inputFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!inputFound) {
      throw new Error('Could not find comment input field');
    }

    // Type the comment with realistic delays
    console.log('[YouTube] Typing comment');
    await page.keyboard.type(comment, { delay: 50 });

    // Wait for the submit button to appear
    await page.waitForTimeout(500);

    // Look for and click the submit button
    const submitSelectors = [
      'button[aria-label*="Comment"]',
      'button:has-text("Comment")',
      'yt-button-shape[aria-label*="Comment"]',
    ];

    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          console.log('[YouTube] Found submit button with selector:', selector);
          await button.click();
          submitted = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!submitted) {
      throw new Error('Could not find or click submit button');
    }

    // Wait for the comment to be posted
    await page.waitForTimeout(2000);

    console.log('[YouTube] Comment submitted successfully');
    return {
      success: true,
      message: 'Comment posted successfully on YouTube',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[YouTube] Error submitting comment:', errorMessage);
    return {
      success: false,
      message: `Failed to submit comment: ${errorMessage}`,
    };
  }
}
