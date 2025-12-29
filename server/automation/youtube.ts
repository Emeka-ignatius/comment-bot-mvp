import { Page } from 'playwright';

interface YouTubeCommentOptions {
  videoUrl: string;
  comment: string;
  cookies: string | Record<string, string>;
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

    // Scroll to comments section
    await page.evaluate(() => {
      const commentSection = document.querySelector('#comments');
      if (commentSection) {
        commentSection.scrollIntoView({ behavior: 'smooth' });
      }
    });

    await page.waitForTimeout(1000);

    // Click on the comment input field
    const commentInput = await page.$('#placeholder-area');
    if (!commentInput) {
      throw new Error('Comment input field not found');
    }

    await commentInput.click();
    await page.waitForTimeout(500);

    // Type the comment
    await page.keyboard.type(comment, { delay: 50 });
    await page.waitForTimeout(500);

    // Click the submit button
    const submitButton = await page.$('#submit-button');
    if (!submitButton) {
      throw new Error('Submit button not found');
    }

    await submitButton.click();
    await page.waitForTimeout(2000);

    console.log('[YouTube] Comment submitted successfully');
    return { success: true, message: 'Comment submitted successfully' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[YouTube] Failed to submit comment:', errorMessage);
    return { success: false, message: errorMessage };
  }
}
