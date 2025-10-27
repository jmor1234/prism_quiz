// app/api/report/phase1/pdf/lib/generatePdf.ts

import puppeteer from "puppeteer";
import { PDF_STYLES } from "./pdfStyles";

/**
 * Generate a PDF from HTML content using Puppeteer
 *
 * Process:
 * 1. Launch headless Chromium browser
 * 2. Create new page with embedded CSS styles
 * 3. Set HTML content and wait for rendering
 * 4. Generate PDF with professional settings
 * 5. Clean up browser instance
 *
 * @param htmlContent - HTML string (from markdown conversion)
 * @returns PDF as Uint8Array for response streaming
 */
export async function generatePdf(htmlContent: string): Promise<Uint8Array> {
  console.log("[PDF Generator] Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // Overcome limited resource problems
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();

    console.log("[PDF Generator] Setting page content...");

    // Construct complete HTML document with embedded styles
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Prism Health Report</title>
          <style>${PDF_STYLES}</style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    // Set content and wait for all resources to load
    await page.setContent(fullHtml, {
      waitUntil: ["load", "networkidle0"],
    });

    console.log("[PDF Generator] Generating PDF...");

    // Generate PDF with professional settings
    const pdfBuffer = await page.pdf({
      format: "Letter", // US Letter (8.5" × 11")
      printBackground: true, // Include background colors from tables
      margin: {
        // Margins are in addition to @page CSS margins
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
      preferCSSPageSize: true, // Use @page settings from CSS
      displayHeaderFooter: false, // Simple PDF without headers/footers for now
    });

    console.log(`[PDF Generator] PDF generated successfully (${pdfBuffer.length} bytes)`);

    return pdfBuffer;
  } finally {
    // Always close browser to prevent resource leaks
    await browser.close();
    console.log("[PDF Generator] Browser closed");
  }
}
